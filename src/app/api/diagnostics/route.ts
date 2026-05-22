import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();

    // 1. Detect Duplicate Study Blocks
    // Fetch all study blocks for this user
    const blocks = await prisma.studyBlock.findMany({
      where: { userId },
      select: {
        id: true,
        materialId: true,
        pageStart: true,
        pageEnd: true,
        title: true,
        createdAt: true,
      },
    });

    const blockGroups: { [key: string]: typeof blocks } = {};
    for (const b of blocks) {
      const key = `${b.materialId}_${b.pageStart}_${b.pageEnd}`;
      if (!blockGroups[key]) {
        blockGroups[key] = [];
      }
      blockGroups[key].push(b);
    }

    const duplicates = Object.entries(blockGroups)
      .filter(([_, group]) => group.length > 1)
      .map(([key, group]) => ({
        key,
        title: group[0].title,
        pageStart: group[0].pageStart,
        pageEnd: group[0].pageEnd,
        count: group.length,
        blockIds: group.map(b => b.id),
      }));

    // 2. Detect Orphaned Flashcards
    // Fetch all flashcards with their block and material IDs
    const cards = await prisma.flashcard.findMany({
      where: { userId },
      select: {
        id: true,
        question: true,
        studyBlockId: true,
        materialId: true,
      },
    });

    // Fetch existing block and material IDs to check existence
    const existingBlockIds = new Set(
      (
        await prisma.studyBlock.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map(b => b.id)
    );

    const existingMaterialIds = new Set(
      (
        await prisma.studyMaterial.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map(m => m.id)
    );

    const orphanedCards = cards.filter(card => {
      const hasInvalidBlock = card.studyBlockId && !existingBlockIds.has(card.studyBlockId);
      const hasInvalidMaterial = card.materialId && !existingMaterialIds.has(card.materialId);
      return hasInvalidBlock || hasInvalidMaterial;
    }).map(c => ({
      id: c.id,
      question: c.question.substring(0, 60) + (c.question.length > 60 ? "..." : ""),
      studyBlockId: c.studyBlockId,
      materialId: c.materialId,
      reason: c.studyBlockId && !existingBlockIds.has(c.studyBlockId) ? "Missing Block" : "Missing Material",
    }));

    return NextResponse.json({
      summary: {
        duplicateBlockGroups: duplicates.length,
        totalDuplicateBlocks: duplicates.reduce((acc, curr) => acc + curr.count - 1, 0),
        orphanedFlashcards: orphanedCards.length,
      },
      details: {
        duplicates,
        orphanedCards,
      },
    });
  } catch (error: any) {
    console.error("[DIAGNOSTICS GET]", error);
    return NextResponse.json(
      { error: "Erro ao executar diagnóstico.", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const body = await req.json().catch(() => ({}));
    const action = body.action || "fix_all"; // fix_duplicates | fix_orphans | fix_all

    let fixedDuplicatesCount = 0;
    let deletedOrphansCount = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Fix Duplicates
      if (action === "fix_duplicates" || action === "fix_all") {
        const blocks = await tx.studyBlock.findMany({
          where: { userId },
          select: {
            id: true,
            materialId: true,
            pageStart: true,
            pageEnd: true,
            createdAt: true,
          },
        });

        const blockGroups: { [key: string]: typeof blocks } = {};
        for (const b of blocks) {
          const key = `${b.materialId}_${b.pageStart}_${b.pageEnd}`;
          if (!blockGroups[key]) {
            blockGroups[key] = [];
          }
          blockGroups[key].push(b);
        }

        const duplicateGroups = Object.values(blockGroups).filter(g => g.length > 1);

        for (const group of duplicateGroups) {
          // Sort by createdAt ascending (earliest first)
          group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          const [keptBlock, ...duplicatesToRemove] = group;
          const duplicateIds = duplicatesToRemove.map(b => b.id);

          // Update flashcards pointing to duplicate blocks to point to the kept block
          await tx.flashcard.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Update schedule items pointing to duplicate blocks to point to the kept block
          await tx.studyScheduleItem.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Update support material relationships if any
          await tx.studyBlockSupport.updateMany({
            where: {
              studyBlockId: { in: duplicateIds },
            },
            data: {
              studyBlockId: keptBlock.id,
            },
          });

          // Delete the duplicate blocks
          await tx.studyBlock.deleteMany({
            where: {
              id: { in: duplicateIds },
            },
          });

          fixedDuplicatesCount += duplicateIds.length;
        }
      }

      // 2. Fix Orphaned Flashcards
      if (action === "fix_orphans" || action === "fix_all") {
        const cards = await tx.flashcard.findMany({
          where: { userId },
          select: {
            id: true,
            studyBlockId: true,
            materialId: true,
          },
        });

        const existingBlocks = await tx.studyBlock.findMany({
          where: { userId },
          select: { id: true },
        });
        const existingBlockIds = new Set(existingBlocks.map(b => b.id));

        const existingMaterials = await tx.studyMaterial.findMany({
          where: { userId },
          select: { id: true },
        });
        const existingMaterialIds = new Set(existingMaterials.map(m => m.id));

        const cardsToDelete = cards.filter(card => {
          const hasInvalidBlock = card.studyBlockId && !existingBlockIds.has(card.studyBlockId);
          const hasInvalidMaterial = card.materialId && !existingMaterialIds.has(card.materialId);
          return hasInvalidBlock || hasInvalidMaterial;
        });

        if (cardsToDelete.length > 0) {
          const idsToDelete = cardsToDelete.map(c => c.id);
          await tx.flashcard.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });
          deletedOrphansCount = idsToDelete.length;
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: "Correção de dados executada com sucesso.",
      fixedDuplicates: fixedDuplicatesCount,
      deletedOrphans: deletedOrphansCount,
    });
  } catch (error: any) {
    console.error("[DIAGNOSTICS POST]", error);
    return NextResponse.json(
      { error: "Erro ao executar correção de dados.", details: error.message },
      { status: 500 }
    );
  }
}
