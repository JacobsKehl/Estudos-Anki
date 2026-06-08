/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { calculateNextReview, FlashcardRating, FlashcardState } from "@/lib/srs/anki";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = await getMockUserId();

  try {
    const body = await req.json();
    const { rating } = body as { rating: FlashcardRating };

    if (!rating || rating < 1 || rating > 4) {
      return NextResponse.json({ error: "Rating inválido (deve ser entre 1 e 4)" }, { status: 400 });
    }

    const flashcard = await (prisma as any).flashcard.findFirst({
      where: { id, userId: mockUserId },
    });

    if (!flashcard) {
      return NextResponse.json({ error: "Flashcard não encontrado ou acesso não autorizado." }, { status: 404 });
    }

    // 2. Calculate next review data using the new Anki SRS logic
    const currentData = {
      state: (flashcard.reviewState as FlashcardState) || "NEW",
      learningStep: flashcard.learningStep || 0,
      easeFactor: flashcard.easeFactor || 2.5,
      intervalDays: flashcard.intervalDays || 0,
      lapseCount: flashcard.lapseCount || 0,
    };

    const nextReviewData = calculateNextReview(currentData, rating);

    // 3. Update flashcard and create history record in a transaction
    const [updatedCard, reviewRecord] = await prisma.$transaction([
      (prisma as any).flashcard.update({
        where: { id },
        data: {
          reviewState: nextReviewData.state,
          learningStep: nextReviewData.learningStep,
          easeFactor: nextReviewData.easeFactor,
          intervalDays: nextReviewData.intervalDays,
          lapseCount: nextReviewData.lapseCount,
          repetitionCount: { increment: 1 },
          nextReviewAt: nextReviewData.nextReviewAt,
          lastReviewedAt: new Date(),
        }
      }),
      (prisma as any).flashcardReview.create({
        data: {
          flashcardId: id,
          userId: mockUserId,
          rating: rating,
          reviewedAt: new Date(),
          previousState: flashcard.reviewState,
          newState: nextReviewData.state,
          previousInterval: flashcard.intervalDays,
          newInterval: nextReviewData.intervalDays,
          previousEaseFactor: flashcard.easeFactor,
          newEaseFactor: nextReviewData.easeFactor,
          previousNextReviewAt: flashcard.nextReviewAt,
          newNextReviewAt: nextReviewData.nextReviewAt,
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
