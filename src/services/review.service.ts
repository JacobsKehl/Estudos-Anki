import { prisma } from "@/lib/prisma";
import { calculateNextReview, ReviewRating } from "@/lib/sm2";

export async function applyFlashcardReview(params: { flashcardId: string; userId: string; rating: ReviewRating; }) {
  const card = await prisma.flashcard.findFirstOrThrow({ where: { id: params.flashcardId, userId: params.userId } });
  const result = calculateNextReview({
    easeFactor: card.easeFactor,
    intervalDays: card.intervalDays,
    repetitionCount: card.repetitionCount,
    rating: params.rating,
  });

  await prisma.flashcardReview.create({
    data: {
      flashcardId: card.id,
      userId: params.userId,
      rating: params.rating,
      previousInterval: card.intervalDays,
      newInterval: result.intervalDays,
      previousEaseFactor: card.easeFactor,
      newEaseFactor: result.easeFactor,
    },
  });

  return prisma.flashcard.update({
    where: { id: card.id },
    data: {
      easeFactor: result.easeFactor,
      intervalDays: result.intervalDays,
      repetitionCount: result.repetitionCount,
      lastReviewedAt: new Date(),
      nextReviewAt: result.nextReviewAt,
      status: "ACTIVE",
    },
  });
}
