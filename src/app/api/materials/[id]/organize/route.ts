import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { identifySubject, detectStructure } from "@/lib/ai/organizer";
import { generateFlashcards } from "@/lib/ai/flashcards";

export const dynamic = "force-dynamic";

interface PageContent {
  pageNumber: number;
  text: string;
}

// Cache do pdfjs para não reconfigurar o worker a cada chamada
let pdfjsCache: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;

async function getPdfjsLib() {
  if (pdfjsCache) return pdfjsCache;
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  lib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).href;
  pdfjsCache = lib;
  return lib;
}

async function extractAllPages(sourcePath: string, isLocal: boolean): Promise<{ pages: PageContent[]; numPages: number }> {
  const pdfjsLib = await getPdfjsLib();
  let uint8Array: Uint8Array;

  if (isLocal) {
     throw new Error("Arquivos locais não são suportados na Web. Use o upload em nuvem.");
  } else {
    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from('materials').download(sourcePath);
    if (error) throw new Error(`Erro ao baixar arquivo do Storage: ${error.message}`);
    const arrayBuffer = await data.arrayBuffer();
    uint8Array = new Uint8Array(arrayBuffer);
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
  });

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  const pages: PageContent[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    pages.push({ pageNumber: i, text });
  }

  return { pages, numPages };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Buscar o material e o usuário real
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const userId = user.id;

    const material = await prisma.studyMaterial.findFirst({
      where: { id, userId }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    const isLocal = material.sourceType === "LOCAL_INBOX";

    if (isLocal) {
      return NextResponse.json({ error: "Arquivos locais não são suportados na Web. Faça o upload via Nuvem." }, { status: 400 });
    }

    // 2. Marcar como analisando
    await prisma.studyMaterial.update({
      where: { id },
      data: { organizationStatus: "ANALYZING" }
    });

    // 3. Extrair texto de todas as páginas
    const { pages, numPages } = await extractAllPages(material.sourcePath!, isLocal);
    const nonEmptyPages = pages.filter(p => p.text.length > 10);

    if (nonEmptyPages.length === 0) {
      await prisma.studyMaterial.update({ where: { id }, data: { organizationStatus: "ERROR", processingError: "Texto insuficiente" } });
      return NextResponse.json({
        error: "Não foi possível extrair texto deste PDF. Ele pode ser uma imagem escaneada ou estar protegido."
      }, { status: 400 });
    }

    // 4. Salvar ExtractedContent por página para este material (limpando o antigo)
    await prisma.extractedContent.deleteMany({
      where: { materialId: material.id }
    });

    const contentRecords = nonEmptyPages.map((p, idx) => ({
      userId,
      subjectId: material.subjectId || "", // preenchido temporariamente, atualizado depois
      materialId: material.id,
      pageNumber: p.pageNumber,
      text: p.text,
      orderIndex: idx,
      estimatedStudyMinutes: 0, 
    }));

    // 5. Identificar matéria se não tiver
    let subjectId = material.subjectId;
    const sampleText = nonEmptyPages
      .slice(0, Math.min(5, nonEmptyPages.length))
      .map(p => p.text)
      .join("\n\n");

    if (!subjectId) {
      const idResult = await identifySubject(sampleText.substring(0, 3000), material.fileName);
      const detectedSubject = idResult.subjectName;

      let subject = await prisma.studySubject.findFirst({
        where: { userId, name: { contains: detectedSubject } }
      });

      if (!subject) {
        const allSubjects = await prisma.studySubject.findMany({ where: { userId } });
        subject = allSubjects.find(s => detectedSubject.includes(s.name)) ?? null;
      }

      if (!subject) {
        subject = await prisma.studySubject.create({
          data: { name: detectedSubject, userId, priority: 1 }
        });
      }

      subjectId = subject.id;
      await prisma.studyMaterial.update({
        where: { id },
        data: { subjectId, detectedSubjectName: detectedSubject }
      });
    }

    // Corrigir subjectId nos registros de conteúdo extraído
    const updatedContentRecords = contentRecords.map(rec => ({
      ...rec,
      subjectId: subjectId as string
    }));

    await prisma.extractedContent.createMany({ data: updatedContentRecords });

    // 6. Detectar estrutura com IA
    const fullTextForStructure = nonEmptyPages
      .slice(0, 15)
      .map(p => p.text)
      .join("\n");

    const detectedBlocks = await detectStructure(fullTextForStructure, numPages);

    if (!detectedBlocks || detectedBlocks.length === 0) {
      await prisma.studyMaterial.update({ where: { id }, data: { organizationStatus: "ERROR", processingError: "IA não detectou estrutura" } });
      return NextResponse.json({
        error: "Não conseguimos organizar este PDF. Nenhum bloco foi criado."
      }, { status: 400 });
    }

    // 7. Remover blocos antigos e flashcards antigos deste material (reorganização limpa)
    await prisma.$transaction([
      prisma.studyBlock.deleteMany({ where: { materialId: material.id } }),
      prisma.flashcard.deleteMany({ where: { materialId: material.id } })
    ]);

    let flashcardCount = 0;

    // 8. Criar novos blocos e gerar flashcards
    for (let i = 0; i < detectedBlocks.length; i++) {
      const blockDef = detectedBlocks[i];
      const pageStart = blockDef.pageStart || 1;
      const pageEnd = blockDef.pageEnd || pageStart || 1;

      const studyBlock = await prisma.studyBlock.create({
        data: {
          userId,
          subjectId: subjectId as string,
          materialId: material.id,
          title: blockDef.title || `Parte ${i + 1}`,
          description: blockDef.description || "",
          pageStart,
          pageEnd,
          orderIndex: i,
          estimatedStudyMinutes: blockDef.estimatedStudyMinutes || 60,
          createdBy: blockDef.createdBy || "AI",
          confidence: blockDef.confidence ?? 1.0,
          sourceHeading: blockDef.sourceHeading,
          status: "NOT_STARTED",
          theoryStatus: "NOT_STARTED",
          questionsStatus: "NOT_STARTED",
          flashcardsStatus: "NOT_STARTED",
          nextActionType: "THEORY"
        }
      });

      // Pegar texto deste bloco específico
      const blockPages = nonEmptyPages.filter(p => p.pageNumber >= pageStart && p.pageNumber <= pageEnd);
      const blockText = blockPages.map(p => p.text).join("\n");

      if (blockText.trim().length >= 50) {
        try {
          const cards = await generateFlashcards(blockText.substring(0, 6000));
          if (cards && cards.length > 0) {
            const MAX_FLASHCARDS_PER_BLOCK = 15;
            const limitedCards = cards.slice(0, MAX_FLASHCARDS_PER_BLOCK);

            const flashcardsData = limitedCards.map(card => ({
              userId,
              subjectId: subjectId as string,
              materialId: material.id,
              studyBlockId: studyBlock.id,
              question: card.question,
              answer: card.answer,
              type: card.type,
              difficulty: card.difficulty,
              status: "APPROVED",
              reviewState: "NEW",       
              nextReviewAt: new Date(),      
              approvedAt: new Date(),        
              learningStep: 0,
              easeFactor: 2.5,
              intervalDays: 0,
              repetitionCount: 0,
              lapseCount: 0,
              sourcePageStart: pageStart,
              sourcePageEnd: pageEnd,
            }));

            const createResult = await prisma.flashcard.createMany({
              data: flashcardsData
            });

            flashcardCount += createResult.count;

            await prisma.studyBlock.update({
              where: { id: studyBlock.id },
              data: { 
                flashcardsStatus: "GENERATED",
                flashcardsGeneratedAt: new Date()
              }
            });
          }
        } catch (flashErr: any) {
          console.error(`[Flashcards Reorganize] Erro para bloco ${studyBlock.title}:`, flashErr.message);
        }
      }
    }

    // 9. Atualizar status final do material
    await prisma.studyMaterial.update({
      where: { id },
      data: {
        organizationStatus: "ORGANIZED",
        detectedStructure: JSON.stringify(detectedBlocks),
        totalPages: numPages
      }
    });

    return NextResponse.json({
      message: `${detectedBlocks.length} blocos de estudo criados e ${flashcardCount} flashcards enviados para curadoria com sucesso.`,
      blocksCount: detectedBlocks.length,
      flashcardsCount: flashcardCount
    });

  } catch (error: any) {
    console.error("[ORGANIZE SINGLE] Erro:", error);
    await prisma.studyMaterial.update({
      where: { id },
      data: { organizationStatus: "ERROR", processingError: error.message }
    }).catch(() => {});
    return NextResponse.json({ error: "Falha ao organizar material", details: error.message }, { status: 500 });
  }
}
