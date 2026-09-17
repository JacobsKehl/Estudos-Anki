import { prisma } from "@/lib/prisma";
import { SRS_LIMITS } from "@/lib/scheduler/config";

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
        {
          studyBlockId: { in: todayBlockIds },
          OR: [
            {
              reviewState: "NEW",
              OR: [
                { lastReviewedAt: null },
                { repetitionCount: 0 },
                { repetitionCount: null }
              ]
            },
            { nextReviewAt: { lte: now } }
          ]
        },
        { 
          nextReviewAt: { lte: now },
          reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] } // Overdue SRS
        },
        {
          reviewState: "NEW",
          OR: [
            { lastReviewedAt: null },
            { repetitionCount: 0 },
            { repetitionCount: null }
          ]
        }
      ]
    },
    include: {
      subject: { select: { name: true } },
      studyBlock: { select: { id: true, title: true } }
    }
  });

  // 3. Deduplicate by ID
  const uniqueCards = Array.from(
    new Map(cards.map((card: any) => [card.id, card])).values()
  );

  // 4. Apply checkpoint logic:
  // Exclude if (lastReviewedAt >= todayStart AND nextReviewAt > now)
  // This means the card was already done today and isn't due again yet.
  const filteredCards = uniqueCards.filter((card: any) => {
    const wasReviewedToday = card.lastReviewedAt && card.lastReviewedAt >= todayStart;
    const isDueNow = card.nextReviewAt && card.nextReviewAt <= now;
    
    if (wasReviewedToday && !isDueNow) {
      return false; // Already done today and not due for re-entry
    }
    return true;
  });

  // 5. Teto diário (SRS_LIMITS.maxReviewsPerDay) — corta a FILA DE SAÍDA, nunca
  // reescreve nextReviewAt. O que não couber continua vencido e reaparece amanhã.
  // Prioridade: (1) cartões dos blocos estudados HOJE, (2) LEARNING/RELEARNING
  // (já em andamento), (3) REVIEW vencidos, mais antigo primeiro, (4) NEW.
  const todaySet = new Set(todayBlockIds);
  const priorityRank = (card: any): number => {
    if (todaySet.has(card.studyBlockId)) return 0;
    if (card.reviewState === "LEARNING" || card.reviewState === "RELEARNING") return 1;
    if (card.reviewState === "REVIEW") return 2;
    return 3; // NEW
  };
  const cappedCards = [...filteredCards]
    .sort((a: any, b: any) => {
      const rankDiff = priorityRank(a) - priorityRank(b);
      if (rankDiff !== 0) return rankDiff;
      const aTime = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : Infinity;
      const bTime = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id).localeCompare(String(b.id)); // desempate estável
    })
    .slice(0, SRS_LIMITS.maxReviewsPerDay);

  return {
    cards: cappedCards,
    todayBlockIds,
    stats: {
      total: cappedCards.length,
      fromTodayBlocks: cappedCards.filter((c: any) => todayBlockIds.includes(c.studyBlockId)).length,
      fromSpacedReview: cappedCards.filter((c: any) => !todayBlockIds.includes(c.studyBlockId) && c.nextReviewAt <= now).length,
      breakdown: {
        new: cappedCards.filter((c: any) => c.reviewState === "NEW").length,
        learning: cappedCards.filter((c: any) => c.reviewState === "LEARNING").length,
        review: cappedCards.filter((c: any) => c.reviewState === "REVIEW").length,
        relearning: cappedCards.filter((c: any) => c.reviewState === "RELEARNING").length,
      },
      subjects: Array.from(new Set(cappedCards.map((c: any) => c.subject.name))) as string[]
    }
  };
}
