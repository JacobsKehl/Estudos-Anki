import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Step = "THEORY" | "QUESTIONS" | "FLASHCARDS";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * POST /api/study-blocks/:id/complete-step
 * Body: { step: "THEORY" | "QUESTIONS" | "FLASHCARDS" }
 *
 * Marks a step as complete and schedules spaced repetition block reviews (D+1, D+7, D+15, D+30)
 * when theory is completed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { step } = (await req.json()) as { step: Step };
    if (!step || !["THEORY", "QUESTIONS", "FLASHCARDS"].includes(step)) {
      return NextResponse.json({ error: "step inválido. Use: THEORY, QUESTIONS ou FLASHCARDS" }, { status: 400 });
    }

    const block = await prisma.studyBlock.findUnique({ where: { id } });
    if (!block) {
      return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      lastStudiedAt: now,
    };

    if (step === "THEORY") {
      updateData.theoryStatus = "COMPLETED";
      updateData.theoryCompletedAt = now;
      // Agenda revisões espaçadas
      updateData.review1dScheduledAt = addDays(now, 1);
      updateData.review7dScheduledAt = addDays(now, 7);
      updateData.review15dScheduledAt = addDays(now, 15);
      updateData.review30dScheduledAt = addDays(now, 30);
      // Próxima ação sugerida
      updateData.nextActionType = "QUESTIONS";
      updateData.nextActionAt = now;
      // Status do bloco
      updateData.status = "IN_PROGRESS";
    }

    if (step === "QUESTIONS") {
      updateData.questionsStatus = "COMPLETED";
      updateData.questionsCompletedAt = now;
      updateData.nextActionType = "GENERATE_FLASHCARDS";
      updateData.nextActionAt = now;
    }

    if (step === "FLASHCARDS") {
      updateData.flashcardsStatus = "GENERATED";
      updateData.flashcardsGeneratedAt = now;
      updateData.nextActionType = "REVIEW_BLOCK";
      updateData.nextActionAt = addDays(now, 1); // D+1
      // Bloco totalmente completo quando tem teoria + flashcards
      if ((block as any).theoryStatus === "COMPLETED") {
        updateData.status = "COMPLETED";
      }
    }

    const updated = await prisma.studyBlock.update({
      where: { id },
      data: updateData as any,
    });

    const reviewsScheduled = step === "THEORY"
      ? { d1: addDays(now, 1), d7: addDays(now, 7), d15: addDays(now, 15), d30: addDays(now, 30) }
      : null;

    return NextResponse.json({
      message: `Etapa "${step}" concluída com sucesso.`,
      block: updated,
      reviewsScheduled,
    });

  } catch (error: any) {
    console.error("[COMPLETE-STEP]", error);
    return NextResponse.json({ error: "Falha ao registrar etapa", details: error.message }, { status: 500 });
  }
}
