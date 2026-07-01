import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { backfillQuestionReviews } from "@/lib/services/question-review";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();

    const body = await req.json().catch(() => ({}));
    const apply = !!body.apply;

    // Executa a carga inteligente para o usuário autenticado atual
    const result = await backfillQuestionReviews(userId, { apply });

    return NextResponse.json({
      message: apply 
        ? "Carga real de revisões por questões iniciada com sucesso." 
        : "Preview gerado com sucesso.",
      result
    });
  } catch (error: any) {
    console.error("[QUESTION REVIEWS BACKFILL POST]", error);
    return NextResponse.json(
      { error: "Erro ao executar processo de backfill", details: error.message },
      { status: 500 }
    );
  }
}
