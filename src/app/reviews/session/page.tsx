/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { ReviewSessionClient } from "@/components/reviews/ReviewSessionClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewSessionPage() {
  const mockUserId = await getMockUserId();
  const now = new Date();

  // 1. Get today's block IDs to exclude them (they are in "Cards do Dia")
  let todayBlockIds: string[] = [];
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId: mockUserId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        schedule: { status: "ACTIVE" },
        scheduledDate: { gte: todayStart, lt: todayEnd },
      },
      select: { studyBlockId: true }
    });

    todayBlockIds = todayItems
      .filter((item: any) => item.studyBlockId)
      .map((item: any) => item.studyBlockId);

    // Fallback logic matching page.tsx: include latest 5 blocks with cards
    if (todayBlockIds.length === 0) {
      const allWithCards = await (prisma as any).studyBlock.findMany({
        where: { userId: mockUserId },
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
  } catch (e) {
    console.error("Failed to fetch today block IDs for review exclusion:", e);
  }

  let pendingCards: any[] = [];

  try {
    pendingCards = await (prisma as any).flashcard.findMany({
      where: {
        userId: mockUserId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
        reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
        studyBlockId: { notIn: todayBlockIds }
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
        easeFactor: true,
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
