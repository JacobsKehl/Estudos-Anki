import { NextRequest, NextResponse } from "next/server";
import { generateSimpleSchedule } from "@/lib/scheduler";

export async function POST(req: NextRequest) {
  const mockUserId = "cm39k012x0001k93jqwerty12";

  try {
    const body = await req.json();
    const { title, dailyMinutes } = body;

    const schedule = await generateSimpleSchedule(mockUserId, {
      title: title || "Meu Plano de Estudos",
      dailyMinutes: dailyMinutes || 60,
      startDate: new Date()
    });

    if (!schedule) {
      return NextResponse.json({ 
        error: "Ainda não há blocos de estudo suficientes para criar um cronograma. Que tal fatiar algum material primeiro?" 
      }, { status: 400 });
    }

    return NextResponse.json(schedule);
  } catch (error: unknown) {
    console.error("Schedule generation error:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Tivemos uma falha ao organizar seu cronograma. Por favor, tente novamente.", details: err.message },
      { status: 500 }
    );
  }
}
