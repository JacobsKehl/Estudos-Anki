import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { backfillQuestionReviews } from "@/lib/services/question-review";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    
    // Este endpoint de API é estritamente restrito a PREVIEW (dry-run).
    // A gravação real (apply: true) é permitida exclusivamente via CLI para segurança.
    const result = await backfillQuestionReviews(userId, { apply: false });

    return NextResponse.json({
      message: "Preview gerado com sucesso. Gravação permitida apenas via terminal CLI por segurança.",
      result
    });
  } catch (error: any) {
    console.error("[QUESTION REVIEWS BACKFILL PREVIEW POST]", error);
    return NextResponse.json(
      { error: "Erro ao gerar preview de backfill", details: error.message },
      { status: 500 }
    );
  }
}
