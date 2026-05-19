import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const extractedPagesCount = await prisma.extractedContent.count();
    const materialsCount = await prisma.studyMaterial.count();
    const subjectsCount = await prisma.studySubject.count();
    const blocksCount = await prisma.studyBlock.count();
    const flashcardsCount = await prisma.flashcard.count();
    const usersCount = await prisma.user.count();

    const sampleMaterials = await prisma.studyMaterial.findMany({
      take: 10,
      select: {
        id: true,
        fileName: true,
        processingStatus: true,
        organizationStatus: true,
        totalPages: true
      }
    });

    return NextResponse.json({
      counts: {
        extractedPages: extractedPagesCount,
        materials: materialsCount,
        subjects: subjectsCount,
        blocks: blocksCount,
        flashcards: flashcardsCount,
        users: usersCount
      },
      sampleMaterials
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
