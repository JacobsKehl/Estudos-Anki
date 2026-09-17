import { prisma } from "@/lib/prisma";

/**
 * A dívida de revisão: quanto ela já estudou e deve, sem teto e sem prioridade.
 * Exclui NEW deliberadamente — Flashcard.nextReviewAt tem @default(now()) no
 * schema, então um cartão nunca revisado nasce com nextReviewAt no passado.
 * `lastReviewedAt: { not: null }` é o cinto e suspensório contra esse default.
 */
export async function getReviewBacklogSize(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.flashcard.count({
    where: {
      userId,
      status: "APPROVED",
      reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
      nextReviewAt: { lte: now },
      lastReviewedAt: { not: null },
    },
  });
}
