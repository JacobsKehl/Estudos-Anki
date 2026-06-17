/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const { searchParams } = new URL(req.url);
    const completedBlockId = searchParams.get("completedBlockId");

    if (!completedBlockId) {
      return NextResponse.json({ error: "completedBlockId é obrigatório" }, { status: 400 });
    }

    // 1. Buscar bloco concluído e validar ownership
    const completedBlock = await (prisma as any).studyBlock.findFirst({
      where: { id: completedBlockId, userId },
      include: { subject: true },
    });

    if (!completedBlock) {
      return NextResponse.json({ error: "Bloco não encontrado ou acesso negado" }, { status: 404 });
    }

    const completedSubjectId = completedBlock.subjectId;

    // 2. Buscar cronograma ativo
    const activeSchedule = await (prisma as any).studySchedule.findFirst({
      where: { userId, status: "ACTIVE" },
    });

    const suggestions: any[] = [];
    const todayRange = getTodayRangeSP(new Date());

    // Matérias elegíveis (PRIMARY ou ACTIVE)
    const eligibleSubjects = await prisma.studySubject.findMany({
      where: {
        userId,
        studyPriority: { in: ["PRIMARY", "ACTIVE"] },
      },
    });
    const eligibleSubjectIds = eligibleSubjects.map((s) => s.id);

    if (activeSchedule) {
      // ── SUGGESTION 1: OVERDUE ──────────────────────────────────────────
      const overdueItem = await (prisma as any).studyScheduleItem.findFirst({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          actionType: "THEORY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          scheduledDate: { lt: todayRange.start },
          subjectId: { in: eligibleSubjectIds },
          studyBlockId: { not: completedBlockId },
        },
        include: {
          subject: true,
          studyBlock: true,
        },
        orderBy: { scheduledDate: "asc" },
      });

      if (overdueItem && overdueItem.studyBlock) {
        const dateStr = overdueItem.scheduledDate
          ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(overdueItem.scheduledDate)
          : "";
        suggestions.push({
          type: "OVERDUE",
          scheduleItemId: overdueItem.id,
          studyBlockId: overdueItem.studyBlockId,
          subjectName: overdueItem.subject?.name || "Matéria",
          blockTitle: overdueItem.studyBlock?.title || "Bloco",
          estimatedMinutes: overdueItem.estimatedMinutes || overdueItem.studyBlock?.estimatedStudyMinutes || 30,
          reason: `Pendência atrasada (${dateStr})`,
          scheduledDate: overdueItem.scheduledDate?.toISOString(),
        });
      }

      // ── SUGGESTION 3: TODAY_CYCLE ──────────────────────────────────────
      const todayCycleItem = await (prisma as any).studyScheduleItem.findFirst({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          actionType: "THEORY",
          status: { in: ["PENDING", "IN_PROGRESS"] },
          scheduledDate: { gte: todayRange.start, lt: todayRange.end },
          subjectId: { in: eligibleSubjectIds },
          studyBlockId: { not: completedBlockId },
        },
        include: {
          subject: true,
          studyBlock: true,
        },
        orderBy: { priorityScore: "desc" },
      });

      if (todayCycleItem && todayCycleItem.studyBlock) {
        suggestions.push({
          type: "TODAY_CYCLE",
          scheduleItemId: todayCycleItem.id,
          studyBlockId: todayCycleItem.studyBlockId,
          subjectName: todayCycleItem.subject?.name || "Matéria",
          blockTitle: todayCycleItem.studyBlock?.title || "Bloco",
          estimatedMinutes: todayCycleItem.estimatedMinutes || todayCycleItem.studyBlock?.estimatedStudyMinutes || 30,
          reason: "Próxima tarefa do dia",
        });
      }
    }

    // ── SUGGESTION 2: SAME_SUBJECT ──────────────────────────────────────
    // Blocos já agendados como PENDING/IN_PROGRESS no cronograma ativo
    let scheduledBlockIds: string[] = [];
    if (activeSchedule) {
      const scheduledItems = await (prisma as any).studyScheduleItem.findMany({
        where: {
          userId,
          scheduleId: activeSchedule.id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          studyBlockId: { not: null },
        },
        select: { studyBlockId: true },
      });
      scheduledBlockIds = scheduledItems.map((item: any) => item.studyBlockId).filter(Boolean);
    }

    const sameSubjectBlock = await (prisma as any).studyBlock.findFirst({
      where: {
        userId,
        subjectId: completedSubjectId,
        status: "NOT_STARTED",
        id: { notIn: [completedBlockId, ...scheduledBlockIds] },
        material: { materialRole: { not: "SUPPORT_MATERIAL" } },
      },
      include: { subject: true },
      orderBy: [{ orderIndex: "asc" }, { pageStart: "asc" }],
    });

    if (sameSubjectBlock) {
      suggestions.push({
        type: "SAME_SUBJECT",
        studyBlockId: sameSubjectBlock.id,
        subjectName: sameSubjectBlock.subject?.name || "Matéria",
        blockTitle: sameSubjectBlock.title || "Bloco",
        estimatedMinutes: sameSubjectBlock.estimatedStudyMinutes || 30,
        reason: "Próximo bloco desta matéria",
      });
    }

    // ── SUGGESTION 4: NEXT_ELIGIBLE ──────────────────────────────────────
    // Só aparece se não houve SAME_SUBJECT nem TODAY_CYCLE
    const hasSameSubject = suggestions.some((s) => s.type === "SAME_SUBJECT");
    const hasTodayCycle = suggestions.some((s) => s.type === "TODAY_CYCLE");

    if (!hasSameSubject && !hasTodayCycle) {
      const nextEligibleBlock = await (prisma as any).studyBlock.findFirst({
        where: {
          userId,
          subjectId: { in: eligibleSubjectIds, not: completedSubjectId },
          status: "NOT_STARTED",
          id: { notIn: [completedBlockId, ...scheduledBlockIds] },
          material: { materialRole: { not: "SUPPORT_MATERIAL" } },
        },
        include: { subject: true },
        orderBy: [{ orderIndex: "asc" }, { pageStart: "asc" }],
      });

      if (nextEligibleBlock) {
        suggestions.push({
          type: "NEXT_ELIGIBLE",
          studyBlockId: nextEligibleBlock.id,
          subjectName: nextEligibleBlock.subject?.name || "Matéria",
          blockTitle: nextEligibleBlock.title || "Bloco",
          estimatedMinutes: nextEligibleBlock.estimatedStudyMinutes || 30,
          reason: "Próximo bloco elegível do ciclo",
        });
      }
    }

    // ── SUGGESTION 5: SECOND_PASS (sempre) ──────────────────────────────
    suggestions.push({
      type: "SECOND_PASS",
      studyBlockId: completedBlockId,
      subjectName: completedBlock.subject?.name || "Matéria",
      blockTitle: completedBlock.title || "Bloco",
      estimatedMinutes: completedBlock.estimatedStudyMinutes || 30,
      reason: "Segunda leitura (não altera cronograma)",
    });

    // Ordenar pela hierarquia definida
    const typeOrder: Record<string, number> = {
      OVERDUE: 0,
      SAME_SUBJECT: 1,
      TODAY_CYCLE: 2,
      NEXT_ELIGIBLE: 3,
      SECOND_PASS: 4,
    };
    suggestions.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("[CONTINUE-SUGGESTIONS]", error);
    return NextResponse.json(
      { error: "Erro ao buscar sugestões de continuação", details: error.message },
      { status: 500 }
    );
  }
}
