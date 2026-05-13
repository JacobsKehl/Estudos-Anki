/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { detectStructure } from "@/lib/ai/organizer";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pdf = require("pdf-parse");
  const { id } = await params;
  const userId = "cm39k012x0001k93jqwerty12";

  try {
    const material = await (prisma as any).studyMaterial.findUnique({
      where: { id, userId },
      include: { _count: { select: { studyBlocks: true } } }
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    if (!material.sourcePath || !fs.existsSync(material.sourcePath)) {
      return NextResponse.json({ error: "Arquivo original não encontrado para análise" }, { status: 400 });
    }

    // 1. Extrair texto para detecção de estrutura (primeiras 15 páginas para pegar sumário)
    const dataBuffer = fs.readFileSync(material.sourcePath);
    const pdfData = await pdf(dataBuffer, { max: 15 });
    
    if (!pdfData.text || pdfData.text.trim().length < 100) {
      return NextResponse.json({ 
        error: "Não foi possível extrair texto suficiente do PDF para detectar a estrutura automática." 
      }, { status: 400 });
    }

    // 2. Detectar blocos com IA
    const detectedBlocks = await detectStructure(pdfData.text);

    if (detectedBlocks.length === 0) {
      return NextResponse.json({ error: "A IA não conseguiu identificar uma estrutura clara neste material." }, { status: 400 });
    }

    // 3. Criar os blocos de estudo
    const createdBlocks = await prisma.$transaction(
      detectedBlocks.map((block, index) => 
        prisma.studyBlock.create({
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

    // 4. Atualizar o status do material
    await (prisma as any).studyMaterial.update({
      where: { id },
      data: {
        organizationStatus: "ORGANIZED",
        detectedStructure: JSON.stringify(detectedBlocks)
      }
    });

    return NextResponse.json({
      message: `${createdBlocks.length} blocos de estudo criados automaticamente.`,
      blocks: createdBlocks
    });

  } catch (error: any) {
    console.error("Erro na organização automática:", error);
    return NextResponse.json({ error: "Falha ao organizar material", details: error.message }, { status: 500 });
  }
}
