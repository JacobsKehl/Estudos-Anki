import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    const blocks = await prisma.studyBlock.findMany({
      where: {
        userId,
        possiblyAlreadyStudied: true,
        theoryStatus: { not: "COMPLETED" }
      },
      include: {
        subject: { select: { id: true, name: true } },
        material: { select: { id: true, originalFileName: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const formattedBlocks = blocks.map(b => ({
      id: b.id,
      title: b.title,
      subjectId: b.subjectId,
      subjectName: b.subject?.name || "Desconhecido",
      materialId: b.materialId,
      originalFileName: b.material?.originalFileName || "PDF Desconhecido",
      officialTopicId: b.officialTopicId,
      officialTopicName: b.officialTopicName,
      possiblyAlreadyStudied: b.possiblyAlreadyStudied,
      theoryStatus: b.theoryStatus
    }));

    return NextResponse.json({
      count: formattedBlocks.length,
      blocks: formattedBlocks
    });
  } catch (error: any) {
    console.error("[GET /api/flagged-blocks] error:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao buscar blocos sinalizados." },
      { status: 500 }
    );
  }
}
