import { NextRequest, NextResponse } from "next/server";
import { completeStudyBlock } from "@/lib/study/completion";

export const dynamic = "force-dynamic";

/**
 * POST /api/study-blocks/:id/complete-step
 * Body: { scheduleItemId?: string }
 *
 * Marks a block as completed and synchronizes with the study schedule.
 * Schedules spaced repetition reviews (D+1, D+7, etc.)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mockUserId = await getMockUserId();

  try {
    const body = await req.json().catch(() => ({}));
    const { scheduleItemId } = body as { scheduleItemId?: string };

    const result = await completeStudyBlock(mockUserId, id, scheduleItemId);

    return NextResponse.json({
      message: result.message,
      block: result.block,
      scheduleItem: result.scheduleItem,
    });

  } catch (error: any) {
    console.error("[COMPLETE-BLOCK API]", error);
    return NextResponse.json({ 
      error: "Falha ao concluir bloco de estudo", 
      details: error.message 
    }, { status: 500 });
  }
}
