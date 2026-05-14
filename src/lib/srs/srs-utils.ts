import { prisma } from "@/lib/prisma";

/**
 * Normalizes text for semantic comparison.
 * Removes accents, lowercase, removes special chars, and trims.
 */
export function normalizeText(text: string) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches the unified set of flashcards for the "Today" session.
 * Consolidates cards from today's blocks and overdue SRS cards.
 * Implements deduplication and checkpoint logic.
 */
export async function getUnifiedTodayCards(userId: string) {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 1. Get today's scheduled block IDs (only THEORY or REVIEW_BLOCK, not COMPLETED)
  const todayItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      schedule: { status: "ACTIVE" },
      scheduledDate: { gte: todayStart, lt: todayEnd },
      actionType: { in: ["THEORY", "REVIEW_BLOCK"] },
      studyBlockId: { not: null }
    },
    select: { studyBlockId: true }
  });

  let todayBlockIds = todayItems
    .filter((item: any) => item.studyBlockId)
    .map((item: any) => item.studyBlockId);

  // Fallback: latest 5 blocks if no schedule (matching Dashboard logic)
  if (todayBlockIds.length === 0) {
    const allWithCards = await (prisma as any).studyBlock.findMany({
      where: { userId },
      include: {
        flashcards: {
          where: { status: "APPROVED" },
          select: { id: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    todayBlockIds = allWithCards
      .filter((b: any) => b.flashcards.length > 0)
      .map((b: any) => b.id);
  }

  // 2. Fetch cards from these blocks OR cards that are overdue globally
  // Group A: Cards from today's scheduled blocks (any state except SUSPENDED/ARCHIVED)
  // Group B: Overdue cards from ANY block, but ONLY if they are already in SRS (LEARNING, REVIEW, RELEARNING)
  // This effectively excludes global NEW cards from future/other blocks.
  const cards = await (prisma as any).flashcard.findMany({
    where: {
      userId,
      status: "APPROVED",
      reviewState: { notIn: ["SUSPENDED", "ARCHIVED"] },
      OR: [
        { studyBlockId: { in: todayBlockIds } }, // Today's content
        { 
          nextReviewAt: { lte: now },
          reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] } // Overdue SRS
        }
      ]
    },
    include: {
      subject: { select: { name: true } }
    }
  });

  // 3. Apply checkpoint logic:
  // Exclude if (lastReviewedAt >= todayStart AND nextReviewAt > now)
  // This means the card was already done today and isn't due again yet.
  const filteredCards = cards.filter((card: any) => {
    const wasReviewedToday = card.lastReviewedAt && card.lastReviewedAt >= todayStart;
    const isDueNow = card.nextReviewAt && card.nextReviewAt <= now;
    
    if (wasReviewedToday && !isDueNow) {
      return false; // Already done today and not due for re-entry
    }
    return true;
  });

  // Deduplication by ID is already handled by Prisma fetch (one record per card),
  // but if we were merging lists we'd use a Map. 
  // Since it's a single query with OR, it's already unique.

  return {
    cards: filteredCards,
    todayBlockIds,
    stats: {
      total: filteredCards.length,
      fromTodayBlocks: filteredCards.filter((c: any) => todayBlockIds.includes(c.studyBlockId)).length,
      fromSpacedReview: filteredCards.filter((c: any) => !todayBlockIds.includes(c.studyBlockId) && c.nextReviewAt <= now).length,
      breakdown: {
        new: filteredCards.filter((c: any) => c.reviewState === "NEW").length,
        learning: filteredCards.filter((c: any) => c.reviewState === "LEARNING").length,
        review: filteredCards.filter((c: any) => c.reviewState === "REVIEW").length,
        relearning: filteredCards.filter((c: any) => c.reviewState === "RELEARNING").length,
      },
      subjects: Array.from(new Set(filteredCards.map((c: any) => c.subject.name))) as string[]
    }
  };
}
