/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-mock";
import { PracticeDashboard } from "@/components/flashcards/PracticeDashboard";

import { getTodayReviewQueue } from "@/lib/srs/today-review-queue";

export default async function PracticePage({ searchParams }: { searchParams: { blockId?: string, blockIds?: string, source?: string } }) {
  const mockUserId = await getCurrentUserId();
  const { blockId, blockIds, source } = await searchParams;

  let practiceCards: any[] = [];
  let practiceStats: Awaited<ReturnType<typeof getTodayReviewQueue>>["stats"] | undefined;

  try {
    if (source === "today") {
      const { cards, stats } = await getTodayReviewQueue(mockUserId);
      practiceCards = cards;
      practiceStats = stats;
    } else {
      let ids: string[] = [];
      if (blockId) ids.push(blockId);
      if (blockIds) ids = [...ids, ...blockIds.split(",")];

      if (ids.length > 0) {
        practiceCards = await (prisma as any).flashcard.findMany({
          where: {
            userId: mockUserId,
            status: "APPROVED",
            studyBlockId: { in: ids }
          },
          include: {
            subject: { select: { name: true } },
            studyBlock: { select: { id: true, title: true } }
          },
          orderBy: [
            { studyBlockId: "asc" },
            { createdAt: "asc" }
          ]
        });
      }
    }
  } catch (error) {
    console.error("Failed to fetch practice cards:", error);
  }

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PracticeDashboard cards={practiceCards} stats={practiceStats} />
    </div>
  );
}
