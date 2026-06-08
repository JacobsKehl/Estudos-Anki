import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSmartSchedule } from "@/lib/scheduler";
import { getMockUserId } from "@/lib/auth-mock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { title, dailyMinutes, daysAhead } = body;

    const result = await generateSmartSchedule(user.id, {
      title: title || undefined,
      dailyMinutes: dailyMinutes || undefined,
      daysAhead: daysAhead || undefined,
    });

    if (!result) {
      return NextResponse.json({
        message: "Nenhuma tarefa de estudo encontrada para gerar cronograma. Organize seus PDFs primeiro.",
      }, { status: 400 });
    }

    if (result.warning) {
      return NextResponse.json({
        message: `${result.warning.message} Cronograma criado com ${result.itemsCount} tarefa(s).`,
        scheduleId: result.schedule.id,
        itemsCount: result.itemsCount,
        warning: result.warning
      });
    }

    return NextResponse.json({
      message: `Cronograma criado com ${result.itemsCount} tarefa(s).`,
      scheduleId: result.schedule.id,
      itemsCount: result.itemsCount,
    });
  } catch (error: any) {
    console.error("[SCHEDULE GENERATE]", error);
    return NextResponse.json(
      { error: "Falha ao gerar cronograma.", details: error.message },
      { status: 500 }
    );
  }
}
