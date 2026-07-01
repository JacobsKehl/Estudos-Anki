import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { skipQuestionReview } from "@/lib/services/question-review";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getMockUserId();
    const body = await req.json().catch(() => ({}));
    
    const { notes } = body;

    const task = await skipQuestionReview(userId, id, notes);

    return NextResponse.json(task);
  } catch (error: any) {
    console.error("[QUESTION REVIEWS SKIP POST]", error);
    if (error.message.includes("não encontrada")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Erro ao pular revisão por questões", details: error.message },
      { status: 500 }
    );
  }
}
