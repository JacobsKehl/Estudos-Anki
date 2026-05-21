/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { getTodayRangeSP, getDayLabelSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const todayRange = getTodayRangeSP(new Date());

    // 1. Encontrar o cronograma ativo
    const activeSchedule = await (prisma as any).studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      return NextResponse.json({ hasPending: false, message: "Nenhum cronograma ativo" });
    }

    // 2. Buscar tarefas teóricas ou de revisão pendentes futuras (scheduledDate >= fim de hoje em SP)
    const futurePendingItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId,
        scheduleId: activeSchedule.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        actionType: { in: ["THEORY", "REVIEW_BLOCK"] },
        scheduledDate: { gte: todayRange.end },
      },
      include: {
        subject: true,
        studyBlock: {
          include: {
            material: true,
            supportMaterials: {
              include: { material: true }
            },
            _count: {
              select: { flashcards: true }
            }
          }
        }
      },
      orderBy: { scheduledDate: "asc" },
    });

    if (futurePendingItems.length === 0) {
      return NextResponse.json({ hasPending: false });
    }

    // 3. Agrupar por data calendário no fuso America/Sao_Paulo
    const spFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const itemsByDate: Record<string, any[]> = {};

    for (const item of futurePendingItems) {
      const parts = spFormatter.formatToParts(item.scheduledDate);
      const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const dateKey = `${partMap.year}-${partMap.month}-${partMap.day}`;

      if (!itemsByDate[dateKey]) {
        itemsByDate[dateKey] = [];
      }
      itemsByDate[dateKey].push(item);
    }

    // 4. Selecionar o primeiro dia do calendário futuro com tarefas pendentes
    const sortedDates = Object.keys(itemsByDate).sort();
    if (sortedDates.length === 0) {
      return NextResponse.json({ hasPending: false });
    }

    const targetDateKey = sortedDates[0];
    const targetItems = itemsByDate[targetDateKey];

    // Ordenar itens por ordem de prioridade
    targetItems.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

    // Obter rótulo amigável (ex: "Amanhã", "Segunda-feira")
    const label = getDayLabelSP(targetDateKey, todayRange.dateString);

    return NextResponse.json({
      hasPending: true,
      date: targetDateKey,
      label,
      items: targetItems
    });

  } catch (error: any) {
    console.error("Erro na rota /api/schedule/next-pending-day:", error);
    return NextResponse.json(
      { error: "Erro ao buscar próximo dia pendente", details: error.message },
      { status: 500 }
    );
  }
}
