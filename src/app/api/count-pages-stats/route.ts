import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const extractedPagesCount = await prisma.extractedContent.count();
    const materialsProcessed = await prisma.studyMaterial.findMany({
      where: {
        processingStatus: "PROCESSED"
      },
      select: {
        fileName: true,
        totalPages: true
      }
    });

    const sumTotalPages = materialsProcessed.reduce((acc, m) => acc + (m.totalPages || 0), 0);

    return NextResponse.json({
      extractedPagesCount,
      sumTotalPages,
      materials: materialsProcessed
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
