/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { createRequire } from "module";
import { detectStructure } from "@/lib/ai/organizer";

export const dynamic = "force-dynamic";

interface DetectedBlock {
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  sourceHeading?: string;
}

export async function POST(req: NextRequest) {
  const require = createRequire(import.meta.url);
  const pdf = require("pdf-parse");
  const userId = "cm39k012x0001k93jqwerty12"; // Mock user for MVP

  try {
    // 1. Buscar materiais importados que ainda não foram organizados
    const unorganizedMaterials = await (prisma as any).studyMaterial.findMany({
      where: { 
        userId, 
        organizationStatus: { in: ["IMPORTED", "ANALYZING", "UPLOADED"] },
        sourceType: "LOCAL_INBOX"
      }
    });

    if (unorganizedMaterials.length === 0) {
      return NextResponse.json({ 
        message: "Nenhum material pendente de organização encontrado.",
        count: 0
      });
    }

    const results = {
      success: 0,
      errors: 0,
      totalBlocks: 0,
      subjectsCreated: 0
    };

    // 2. Processar cada material
    for (const material of unorganizedMaterials) {
      try {
        if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
          console.error(`Arquivo não encontrado para material ${material.id}: ${material.sourcePath}`);
          await (prisma as any).studyMaterial.update({
            where: { id: material.id },
            data: { organizationStatus: "ERROR", processingError: "Arquivo local não encontrado" }
          });
          results.errors++;
          continue;
        }

        // Marcar como organizando para evitar processamento duplo
        await (prisma as any).studyMaterial.update({
          where: { id: material.id },
          data: { organizationStatus: "ANALYZING" }
        });

        // Extrair texto (primeiras 15 páginas)
        const dataBuffer = fs.readFileSync(material.sourcePath);
        const pdfData = await pdf(dataBuffer, { max: 15 });
        
        if (!pdfData.text || pdfData.text.trim().length < 100) {
          throw new Error("Texto insuficiente no PDF");
        }

        // Detectar blocos com IA
        const detectedBlocks: DetectedBlock[] = await detectStructure(pdfData.text);

        if (detectedBlocks.length > 0) {
          // Criar blocos em transação
          await prisma.$transaction(
            detectedBlocks.map((block: DetectedBlock, index: number) => 
              (prisma.studyBlock as any).create({
                data: {
                  userId,
                  subjectId: material.subjectId,
                  materialId: material.id,
                  title: block.title,
                  description: block.description,
                  pageStart: block.pageStart,
                  pageEnd: block.pageEnd,
                  orderIndex: index,
                  estimatedStudyMinutes: block.estimatedStudyMinutes || 60,
                  createdBy: "AI",
                  sourceHeading: block.sourceHeading,
                  status: "NOT_STARTED"
                }
              })
            )
          );

          // Atualizar status do material
          await (prisma as any).studyMaterial.update({
            where: { id: material.id },
            data: {
              organizationStatus: "ORGANIZED",
              detectedStructure: JSON.stringify(detectedBlocks)
            }
          });

          results.success++;
          results.totalBlocks += detectedBlocks.length;
        } else {
          results.errors++;
          await (prisma as any).studyMaterial.update({
            where: { id: material.id },
            data: { organizationStatus: "ERROR", processingError: "IA não detectou estrutura" }
          });
        }
      } catch (err) {
        console.error(`Erro ao processar material ${material.id}:`, err);
        results.errors++;
        await (prisma as any).studyMaterial.update({
          where: { id: material.id },
          data: { organizationStatus: "ERROR" }
        });
      }
    }

    return NextResponse.json({
      message: results.success > 0 
        ? `Estudos organizados com sucesso! Processamos ${results.success} materiais e criamos ${results.totalBlocks} blocos de estudo.`
        : "Não conseguimos organizar seus estudos agora. Verifique os arquivos e tente novamente.",
      results
    });

  } catch (error: any) {
    console.error("Erro na organização em lote:", error);
    return NextResponse.json({ error: "Falha ao organizar estudos em lote", details: error.message }, { status: 500 });
  }
}
