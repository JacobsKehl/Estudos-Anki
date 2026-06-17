import { NextRequest, NextResponse } from "next/server";
import { completeStudyBlock } from "@/lib/study/completion";
import { getMockUserId } from "@/lib/auth-mock";

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
    const { scheduleItemId, startedAt, completedAt, actualDurationMinutes } = body as { 
      scheduleItemId?: string;
      startedAt?: string;
      completedAt?: string;
      actualDurationMinutes?: number;
    };

    const parsedStartedAt = startedAt ? new Date(startedAt) : null;
    const parsedCompletedAt = completedAt ? new Date(completedAt) : null;

    const result = await completeStudyBlock(
      mockUserId, 
      id, 
      scheduleItemId,
      parsedStartedAt,
      parsedCompletedAt,
      actualDurationMinutes
    );

    return NextResponse.json({
      message: result.message,
      block: result.block,
      scheduleItem: result.scheduleItem,
    });

  } catch (error: any) {
    console.error("[COMPLETE-BLOCK API]", error);
    if (error.message === "UNAUTHORIZED_OR_NOT_FOUND") {
      return NextResponse.json({ error: "Item não encontrado ou acesso não autorizado" }, { status: 404 });
    }
    if (error.message === "INVALID_BLOCK_ID") {
      return NextResponse.json({ error: "Item não pertence a este bloco de estudo" }, { status: 400 });
    }
    if (error.message === "INVALID_STATUS") {
      return NextResponse.json({ error: "Item de cronograma não está pendente ou em andamento" }, { status: 400 });
    }
    if (error.message === "INVALID_SUBJECT_PRIORITY") {
      return NextResponse.json({ error: "Matéria inativa ou excluída do cronograma" }, { status: 403 });
    }

    return NextResponse.json({ 
      error: "Falha ao concluir bloco de estudo", 
      details: error.message 
    }, { status: 500 });
  }
}
