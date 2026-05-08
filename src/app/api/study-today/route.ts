import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

  const today = new Date();
  const item = await prisma.studyPlanDay.findFirst({
    where: { studyPlan: { userId }, status: "PENDING", scheduledDate: { lte: today } },
    include: { subject: true, content: { include: { material: true } } },
    orderBy: { dayNumber: "asc" },
  });

  return NextResponse.json(item);
}
