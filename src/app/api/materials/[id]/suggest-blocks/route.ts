/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestStudyBlocks } from "@/lib/ai/study-blocks";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const material = await prisma.studyMaterial.findUnique({
      where: { id },
      include: {
        extractedContent: {
          orderBy: { pageNumber: "asc" } as any,
        },
      },
    });

    if (!material) {
      return NextResponse.json({ error: "Material não encontrado" }, { status: 404 });
    }

    if (material.processingStatus !== "PROCESSED") {
      return NextResponse.json({ error: "Extraia o texto do material antes de gerar blocos." }, { status: 400 });
    }

    if (material.extractedContent.length === 0) {
      return NextResponse.json({ error: "Nenhum conteúdo extraído encontrado para este material." }, { status: 400 });
    }

    const suggestions = await suggestStudyBlocks(id, material.extractedContent);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("Erro na rota de sugestão de blocos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
