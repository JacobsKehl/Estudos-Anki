import { prisma } from "@/lib/prisma";

/**
 * O estoque novo: o que ela ainda não viu. Cartão novo não é dívida — não usa
 * nextReviewAt (que nasce no passado por default do schema), só reviewState e
 * lastReviewedAt.
 */
export async function getNewCardsWaitingCount(userId: string): Promise<number> {
  return prisma.flashcard.count({
    where: {
      userId,
      status: "APPROVED",
      reviewState: "NEW",
      lastReviewedAt: null,
    },
  });
}
