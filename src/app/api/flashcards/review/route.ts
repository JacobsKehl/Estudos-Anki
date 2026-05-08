import { NextRequest, NextResponse } from "next/server";
import { applyFlashcardReview } from "@/services/review.service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const updated = await applyFlashcardReview(body);
  return NextResponse.json(updated);
}
