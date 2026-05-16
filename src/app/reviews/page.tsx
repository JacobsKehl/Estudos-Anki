/* eslint-disable @typescript-eslint/no-explicit-any */
import { RotateCw } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { ReviewDashboard } from "@/components/reviews/ReviewDashboard";

import { PageHeader } from "@/components/ui/page-header";

export default async function ReviewsPage() {
  const mockUserId = await getMockUserId();
  const now = new Date();

  // 1. Fetch pending cards (nextReviewAt <= now AND status = APPROVED)
  let pendingCards: any[] = [];
  let reviewedTodayCount = 0;
  let pendingApprovalCount = 0;

  try {
    pendingCards = await (prisma as any).flashcard.findMany({
      where: {
        userId: mockUserId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
        reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] }
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

    // 2. Count cards reviewed in the last 24h
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    reviewedTodayCount = await (prisma as any).flashcardReview.count({
      where: {
        userId: mockUserId,
        reviewedAt: { gte: oneDayAgo }
      }
    });

    // 3. Count cards pending approval
    pendingApprovalCount = await (prisma as any).flashcard.count({
      where: {
        userId: mockUserId,
        status: "PENDING_APPROVAL"
      }
    });
  } catch (error) {
    console.error("Failed to fetch review data:", error);
  }

  const stats = {
    totalPending: pendingCards.length,
    dueToday: pendingCards.length,
    reviewedToday: reviewedTodayCount,
    pendingApproval: pendingApprovalCount
  };

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader 
        icon={RotateCw}
        title="Revisões Diárias"
        description="Gerencie seu progresso de longo prazo com o algoritmo de repetição espaçada."
      />

      <ReviewDashboard pendingCards={pendingCards} stats={stats} />
    </div>
  );
}
