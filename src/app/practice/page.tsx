/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { PracticeDashboard } from "@/components/flashcards/PracticeDashboard";

import { getUnifiedTodayCards } from "@/lib/srs/srs-utils";

export default async function PracticePage({ searchParams }: { searchParams: { blockId?: string, blockIds?: string, source?: string } }) {
  const mockUserId = await getMockUserId();
  const { blockId, blockIds, source } = await searchParams;

  let practiceCards: any[] = [];

  try {
    if (source === "today") {
      const { cards } = await getUnifiedTodayCards(mockUserId);
      practiceCards = cards;
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
      <PracticeDashboard cards={practiceCards} />
    </div>
  );
}
