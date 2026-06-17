import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "cron_secret_kehl_study_2026_xyz") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = 'cmp8od0wz0000iybklaotfqbs'; // Gabriela
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      return NextResponse.json({ error: "No active schedule found" });
    }

    // Query all subjects to know their priority
    const subjects = await prisma.studySubject.findMany({
      where: { userId }
    });
    const subjectsMap = new Map(subjects.map(s => [s.id, s]));

    // Query active items for the next 21 days starting from June 17, 2026
    const startDate = new Date("2026-06-17T00:00:00.000Z");
    const endDate = new Date("2026-07-08T23:59:59.999Z"); // 21 days

    const items = await prisma.studyScheduleItem.findMany({
      where: {
        userId,
        scheduleId: activeSchedule.id,
        scheduledDate: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: [
        { scheduledDate: "asc" },
        { dayNumber: "asc" },
        { createdAt: "asc" }
      ],
      include: {
        studyBlock: true
      }
    });

    // Group items by date string
    const byDate: Record<string, typeof items> = {};
    for (const item of items) {
      if (!item.scheduledDate) continue;
      const dateStr = item.scheduledDate.toISOString().split("T")[0];
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(item);
    }

    // Scan day by day
    const analysis: any[] = [];
    const dateList: string[] = [];
    
    // Generate the list of 21 dates starting from June 17
    for (let i = 0; i < 22; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      dateList.push(d.toISOString().split("T")[0]);
    }

    for (const dateStr of dateList) {
      const dayItems = byDate[dateStr] || [];
      const theoryItems = dayItems.filter(item => item.actionType === "THEORY");
      const reviewItems = dayItems.filter(item => item.actionType === "REVIEW_BLOCK" || item.actionType === "REVIEW_FLASHCARDS");
      
      const totalTheoryMinutes = theoryItems.reduce((sum, item) => sum + (item.estimatedMinutes || 60), 0);
      const dayNumber = dayItems.length > 0 ? dayItems[0].dayNumber : null;

      // Identify if there are secondary or excluded subjects in the day
      const secondaryOrExcludedSubjects: string[] = [];
      for (const item of dayItems) {
        const sub = subjectsMap.get(item.subjectId);
        if (sub && (sub.studyPriority === "SECONDARY" || sub.studyPriority === "EXCLUDED")) {
          secondaryOrExcludedSubjects.push(`${sub.name} (${sub.studyPriority})`);
        }
      }

      // Check for Direito Civil on Day 2 of cycle
      // Legado TRT4 Cycle: Day 2 slots are: DayNumber 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, etc.?
      // Or based on actual DayNumbers: let's see which dayNumbers have Constitucional or Civil
      const hasCivil = dayItems.some(item => {
        const sub = subjectsMap.get(item.subjectId);
        return sub && sub.name.toLowerCase().includes("civil") && !sub.name.toLowerCase().includes("processual");
      });

      const hasConstitucional = dayItems.some(item => {
        const sub = subjectsMap.get(item.subjectId);
        return sub && sub.name.toLowerCase().includes("constitucional");
      });

      // Alert Criteria
      const alerts: string[] = [];
      if (theoryItems.length === 0) {
        alerts.push("Lacuna total: nenhuma tarefa teórica agendada.");
      } else {
        if (totalTheoryMinutes < 60) {
          alerts.push(`Carga baixa: apenas ${totalTheoryMinutes} min de teoria.`);
        }
        if (theoryItems.length === 1) {
          alerts.push("Carga baixa: apenas 1 tarefa teórica no dia.");
        }
      }
      if (secondaryOrExcludedSubjects.length > 0) {
        alerts.push(`Matéria secundária/excluída agendada: [${secondaryOrExcludedSubjects.join(", ")}]`);
      }
      // If it has Constitucional (indicating a Day 2 cycle slot) but does not have Civil, and Civil is PRIMARY
      if (hasConstitucional && !hasCivil && dateStr >= "2026-06-18") {
        alerts.push("Ausência de Direito Civil em dia de ciclo (Constitucional está agendado).");
      }

      analysis.push({
        date: dateStr,
        dayNumber,
        itemsCount: dayItems.length,
        theoryMinutes: totalTheoryMinutes,
        theoryTasks: theoryItems.length,
        reviewTasks: reviewItems.length,
        subjects: Array.from(new Set(dayItems.map(item => subjectsMap.get(item.subjectId)?.name || "Unknown"))),
        alerts,
        hasCivil,
        hasConstitucional
      });
    }

    return NextResponse.json({
      success: true,
      analysis,
      totalItemsInScope: items.length
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
