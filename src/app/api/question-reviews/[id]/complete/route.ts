import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { completeQuestionReview } from "@/lib/services/question-review";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getMockUserId();
    const body = await req.json().catch(() => ({}));
    
    const { questionsAttempted, correctCount, wrongCount, notes } = body;

    const task = await completeQuestionReview(userId, id, {
      questionsAttempted: questionsAttempted !== undefined ? Number(questionsAttempted) : undefined,
      correctCount: correctCount !== undefined ? Number(correctCount) : undefined,
      wrongCount: wrongCount !== undefined ? Number(wrongCount) : undefined,
      notes
    });

    return NextResponse.json(task);
  } catch (error: any) {
    console.error("[QUESTION REVIEWS COMPLETE POST]", error);
    if (error.message.includes("não encontrada")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Erro ao concluir revisão por questões", details: error.message },
      { status: 500 }
    );
  }
}
