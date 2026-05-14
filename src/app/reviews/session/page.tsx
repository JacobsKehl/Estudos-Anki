/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { ReviewSessionClient } from "@/components/reviews/ReviewSessionClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewSessionPage() {
  const mockUserId = await getMockUserId();
  const now = new Date();

  let pendingCards: any[] = [];

  try {
    pendingCards = await (prisma as any).flashcard.findMany({
      where: {
        userId: mockUserId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
        reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] }
      },
      include: {
        subject: { select: { name: true } }
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
        subject: { select: { name: true } }
      },
      orderBy: { nextReviewAt: "asc" }
    });
  } catch (error) {
    console.error("Failed to fetch review cards:", error);
  }

  if (pendingCards.length === 0) {
    redirect("/");
  }

  return (
    <div className="max-w-4xl mx-auto pt-10 px-4">
      <ReviewSessionClient cards={pendingCards} />
    </div>
  );
}
