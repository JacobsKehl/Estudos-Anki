import { prisma } from "@/lib/prisma";

/**
 * A dívida de revisão: quanto ela já estudou e deve, sem teto e sem prioridade.
 * Exclui NEW deliberadamente — Flashcard.nextReviewAt tem @default(now()) no
 * schema, então um cartão nunca revisado nasce com nextReviewAt no passado.
 * `lastReviewedAt: { not: null }` é o cinto e suspensório contra esse default.
 */
function backlogWhere(userId: string, now: Date) {
  return {
    userId,
    status: "APPROVED",
    reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
    nextReviewAt: { lte: now },
    lastReviewedAt: { not: null },
  };
}

export async function getReviewBacklogSize(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.flashcard.count({
    where: backlogWhere(userId, now),
  });
}

/**
 * Mesma dívida de getReviewBacklogSize, mas com as linhas completas — para
 * telas que precisam de detalhe (ex.: resumo por matéria em /reviews), não
 * só do total.
 */
export async function getReviewBacklogCards(userId: string, now: Date = new Date()) {
  return prisma.flashcard.findMany({
    where: backlogWhere(userId, now),
    select: {
      id: true,
      question: true,
      answer: true,
      type: true,
      difficulty: true,
      reviewState: true,
      intervalDays: true,
      learningStep: true,
      subject: { select: { name: true } },
    },
    orderBy: { nextReviewAt: "asc" },
  });
}
