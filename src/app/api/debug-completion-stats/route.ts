import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();

    const completedBlocks = await prisma.studyBlock.findMany({
      where: { userId, status: "COMPLETED" },
      select: { id: true, title: true, theoryCompletedAt: true }
    });

    const completedScheduleItems = await prisma.studyScheduleItem.findMany({
      where: { userId, status: "COMPLETED" },
      select: { id: true, studyBlockId: true, actionType: true, reason: true, completedAt: true }
    });

    return NextResponse.json({
      success: true,
      stats: {
        completedBlocksCount: completedBlocks.length,
        completedScheduleItemsCount: completedScheduleItems.length,
        completedBlocks: completedBlocks.map(b => ({
          id: b.id,
          title: b.title,
          theoryCompletedAt: b.theoryCompletedAt
        })),
        completedScheduleItems: completedScheduleItems.map(item => ({
          id: item.id,
          studyBlockId: item.studyBlockId,
          actionType: item.actionType,
          reason: item.reason,
          completedAt: item.completedAt
        }))
      }
    });
  } catch (error: any) {
    console.error("Error in debug route:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
