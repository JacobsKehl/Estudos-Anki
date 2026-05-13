/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateNextReview, ReviewRating } from "@/lib/spaced-repetition";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = "cm39k012x0001k93jqwerty12";

  try {
    const body = await req.json();
    const { rating } = body as { rating: ReviewRating };

    if (!rating || rating < 1 || rating > 4) {
      return NextResponse.json({ error: "Rating inválido (deve ser entre 1 e 4)" }, { status: 400 });
    }

    // 1. Get current flashcard data
    const flashcard = await (prisma as any).flashcard.findUnique({
      where: { id },
    });

    if (!flashcard) {
      return NextResponse.json({ error: "Flashcard não encontrado" }, { status: 404 });
    }

    // 2. Calculate next review data
    const currentData = {
      easeFactor: flashcard.easeFactor,
      intervalDays: flashcard.intervalDays,
      repetitionCount: flashcard.repetitionCount,
      reviewStatus: flashcard.reviewStatus
    };

    const nextReviewData = calculateNextReview(currentData, rating);

    // 3. Update flashcard and create history record in a transaction
    const [updatedCard, reviewRecord] = await prisma.$transaction([
      (prisma as any).flashcard.update({
        where: { id },
        data: {
          easeFactor: nextReviewData.easeFactor,
          intervalDays: nextReviewData.intervalDays,
          repetitionCount: nextReviewData.repetitionCount,
          nextReviewAt: nextReviewData.nextReviewAt,
          lastReviewedAt: new Date(),
          reviewStatus: nextReviewData.reviewStatus
        }
      }),
      (prisma as any).flashcardReview.create({
        data: {
          flashcardId: id,
          userId: mockUserId,
          rating: rating,
          reviewedAt: new Date(),
          previousInterval: flashcard.intervalDays,
          newInterval: nextReviewData.intervalDays,
          previousEaseFactor: flashcard.easeFactor,
          newEaseFactor: nextReviewData.easeFactor
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      nextReviewAt: updatedCard.nextReviewAt,
      review: reviewRecord
    });

  } catch (error: unknown) {
    console.error("Flashcard review error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Erro ao registrar revisão", details: err.message },
      { status: 500 }
    );
  }
}
