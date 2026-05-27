import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectQuestionsOrGabaritoHeuristic } from "@/lib/ai/organizer";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  return repairMaterials(req);
}

export async function POST(req: NextRequest) {
  return repairMaterials(req);
}

async function repairMaterials(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    console.log(`[Repair Supports] Iniciando varredura de materiais para usuário: ${userId}`);

    // 1. Buscar apenas os materiais do próprio usuário organizados que não são rotulados como apoio
    const materials = await prisma.studyMaterial.findMany({
      where: {
        userId,
        organizationStatus: "ORGANIZED",
        materialRole: { not: "SUPPORT_MATERIAL" }
      },
      include: {
        subject: true
      }
    });

    const results = {
      totalScanned: materials.length,
      migratedCount: 0,
      details: [] as any[]
    };

    for (const material of materials) {
      // 2. Buscar todo o texto extraído do usuário para esse material
      const extractedPages = await prisma.extractedContent.findMany({
        where: { materialId: material.id, userId },
        orderBy: { pageNumber: "asc" }
      });

      if (extractedPages.length === 0) continue;

      const fullText = extractedPages.map(p => p.text).join("\n");

      // 3. Executar a heurística pedagógica de detecção de questões/gabaritos
      const check = detectQuestionsOrGabaritoHeuristic(fullText);

      if (check.isQuestions || check.isAnswerKey) {
        const detectedType = check.isAnswerKey ? "ANSWER_KEY" : "QUESTIONS";
        console.log(`[Repair Supports] Detectado material de apoio: ${material.fileName} (${detectedType}, conf: ${check.confidence})`);

        // 4. Buscar os blocos falsos do usuário criados a partir deste material
        const falseBlocks = await prisma.studyBlock.findMany({
          where: { materialId: material.id, userId }
        });

        let supportTopicId: string | null = null;
        const linkedBlocks: string[] = [];

        // 5. Para cada bloco falso, tentar encontrar um bloco teórico verdadeiro correspondente
        for (const fb of falseBlocks) {
          if (fb.officialTopicId) {
            supportTopicId = fb.officialTopicId;
          }

          // Buscar bloco teórico real da mesma matéria e tópico (de um material diferente do usuário)
          let targetMainBlock = await prisma.studyBlock.findFirst({
            where: {
              userId,
              subjectId: material.subjectId as string,
              officialTopicId: fb.officialTopicId || undefined,
              materialId: { not: material.id }
            }
          });

          // Se não achar por tópico, busca qualquer bloco teórico dessa mesma matéria
          if (!targetMainBlock) {
            targetMainBlock = await prisma.studyBlock.findFirst({
              where: {
                userId,
                subjectId: material.subjectId as string,
                materialId: { not: material.id }
              }
            });
          }

          if (targetMainBlock) {
            // Re-vincular os flashcards criados para o bloco falso ao bloco verdadeiro
            await prisma.flashcard.updateMany({
              where: { studyBlockId: fb.id, userId },
              data: { studyBlockId: targetMainBlock.id }
            });

            // Criar o vínculo do material de apoio
            await prisma.studyBlockSupport.create({
              data: {
                studyBlockId: targetMainBlock.id,
                materialId: material.id,
                pageStart: fb.pageStart,
                pageEnd: fb.pageEnd,
                supportType: detectedType,
                confidence: check.confidence
              }
            });

            linkedBlocks.push(targetMainBlock.title);
          }
        }

        // 6. Deletar os blocos principais falsos
        if (falseBlocks.length > 0) {
          const falseBlockIds = falseBlocks.map(b => b.id);
          
          // Deletar itens do cronograma vinculados a estes blocos para não poluir
          await prisma.studyScheduleItem.deleteMany({
            where: { studyBlockId: { in: falseBlockIds }, userId }
          });

          await prisma.studyBlock.deleteMany({
            where: { id: { in: falseBlockIds }, userId }
          });
        }

        // 7. Atualizar o papel do material no banco de dados
        await prisma.studyMaterial.update({
          where: { id: material.id },
          data: {
            materialRole: "SUPPORT_MATERIAL",
            supportForTopicId: supportTopicId
          }
        });

        results.migratedCount++;
        results.details.push({
          fileName: material.fileName,
          detectedType,
          confidence: check.confidence,
          blocksRemoved: falseBlocks.length,
          linkedToTheoreticalBlocks: linkedBlocks
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.migratedCount} materiais contendo questões/gabaritos foram convertidos em materiais de apoio com sucesso!`,
      results
    });

  } catch (error: any) {
    console.error("[Repair Supports Error]", error);
    return NextResponse.json(
      { success: false, error: "Erro crítico ao executar varredura e reparo." },
      { status: 500 }
    );
  }
}
