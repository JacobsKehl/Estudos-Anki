/**
 * src/lib/reviews/get-due-flashcards.ts
 *
 * Consulta que monta a fila diária de revisão SRS.
 */
import { prisma } from "@/lib/prisma";
import { SRS_LIMITS } from "@/lib/scheduler/config";

export interface GetDueFlashcardsParams {
  userId: string;
  now?: Date;
  excludeStudyBlockIds?: string[];
}

export async function getDueFlashcards({ userId, now = new Date(), excludeStudyBlockIds = [] }: GetDueFlashcardsParams) {
  return (prisma as any).flashcard.findMany({
    where: {
      userId,
      status: "APPROVED",
      nextReviewAt: { lte: now },
      reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
      ...(excludeStudyBlockIds.length > 0 ? { studyBlockId: { notIn: excludeStudyBlockIds } } : {}),
    },
    select: {
      id: true,
      question: true,
      answer: true,
      type: true,
      difficulty: true,
      reviewState: true,
      intervalDays: true,
      learningStep: true,
      easeFactor: true,
      subject: { select: { name: true } },
    },
    orderBy: { nextReviewAt: "asc" },
    take: SRS_LIMITS.maxReviewsPerDay,
  });
}
