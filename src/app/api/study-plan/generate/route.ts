import { NextRequest, NextResponse } from "next/server";
import { generateStudyPlan } from "@/services/study-plan.service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = body.userId as string;
  const plan = await generateStudyPlan(userId, {
    estimatedExamDate: new Date(body.estimatedExamDate),
    dailyStudyMinutes: body.dailyStudyMinutes,
    availableWeekDays: body.availableWeekDays,
  });
  return NextResponse.json({ planId: plan.id });
}
