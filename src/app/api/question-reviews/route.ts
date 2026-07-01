import { NextRequest, NextResponse } from "next/server";
import { getMockUserId } from "@/lib/auth-mock";
import { getTodayQuestionReviews, getQuestionReviewStats } from "@/lib/services/question-review";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    const date = dateStr ? new Date(dateStr) : new Date();

    const [tasks, stats] = await Promise.all([
      getTodayQuestionReviews(userId, date),
      getQuestionReviewStats(userId)
    ]);

    return NextResponse.json({ tasks, stats });
  } catch (error: any) {
    console.error("[QUESTION REVIEWS GET]", error);
    return NextResponse.json(
      { error: "Erro ao obter revisões por questões", details: error.message },
      { status: 500 }
    );
  }
}
