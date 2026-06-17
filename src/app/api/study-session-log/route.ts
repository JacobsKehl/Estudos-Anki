/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { StudySessionActionType, StudySessionSource } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_ACTION_TYPES: string[] = [
  "SECOND_PASS",
  "REINFORCEMENT",
  "EXTRA_STUDY",
];

export async function POST(req: NextRequest) {
  try {
    const userId = await getMockUserId();
    const body = await req.json();

    const { studyBlockId, actionType, startedAt, completedAt, actualDurationMinutes } = body as {
      studyBlockId: string;
      actionType: string;
      startedAt?: string;
      completedAt?: string;
      actualDurationMinutes?: number;
    };

    // 1. Validar campos obrigatórios
    if (!studyBlockId || !actionType) {
      return NextResponse.json({ error: "studyBlockId e actionType são obrigatórios" }, { status: 400 });
    }

    if (!ALLOWED_ACTION_TYPES.includes(actionType)) {
      return NextResponse.json({ error: `actionType '${actionType}' não é permitido neste endpoint` }, { status: 400 });
    }

    // 2. Validar ownership do bloco
    const block = await (prisma as any).studyBlock.findFirst({
      where: { id: studyBlockId, userId },
    });

    if (!block) {
      return NextResponse.json({ error: "Bloco não encontrado ou acesso negado" }, { status: 404 });
    }

    // 3. Validar timestamps e duração
    let validatedStartedAt: Date | null = null;
    let validatedCompletedAt: Date | null = null;
    let validatedDuration: number;
    let logSource: StudySessionSource = StudySessionSource.MANUAL;

    if (startedAt && completedAt && actualDurationMinutes !== undefined && actualDurationMinutes !== null) {
      const start = new Date(startedAt);
      const end = new Date(completedAt);

      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start.getTime() >= end.getTime()) {
        return NextResponse.json({ error: "startedAt deve ser anterior a completedAt" }, { status: 400 });
      }

      validatedStartedAt = start;
      validatedCompletedAt = end;
      logSource = StudySessionSource.TIMER;

      let rawDuration = actualDurationMinutes;
      if (rawDuration <= 0) {
        rawDuration = 1;
      }

      // Clamping: janela física + 1 min tolerância
      const physicalDiffMin = Math.round((end.getTime() - start.getTime()) / 60000);
      if (rawDuration > physicalDiffMin + 1) {
        console.warn(`[SESSION LOG] Duração ${rawDuration}min excede janela física ${physicalDiffMin}min. Clamping.`);
        rawDuration = Math.max(1, physicalDiffMin);
      }

      // Clamping: 2x estimativa
      const estimated = block.estimatedStudyMinutes || 30;
      if (rawDuration > 2 * estimated) {
        console.warn(`[SESSION LOG] Duração ${rawDuration}min excede 2x estimativa ${estimated}min. Clamping para ${2 * estimated}min.`);
        rawDuration = 2 * estimated;
      }

      validatedDuration = rawDuration;
    } else {
      // Manual sem timer
      validatedDuration = block.estimatedStudyMinutes || 30;
    }

    // 4. Criar apenas o StudySessionLog (sem alterar StudyBlock, StudyScheduleItem, ou Flashcards)
    const sessionLog = await prisma.studySessionLog.create({
      data: {
        userId,
        studyBlockId,
        studyScheduleItemId: null,
        actionType: actionType as StudySessionActionType,
        durationMinutes: validatedDuration,
        startedAt: validatedStartedAt,
        completedAt: validatedCompletedAt || new Date(),
        source: logSource,
      },
    });

    return NextResponse.json({
      success: true,
      message: actionType === "SECOND_PASS"
        ? "Segunda leitura registrada com sucesso."
        : "Sessão de estudo registrada com sucesso.",
      logId: sessionLog.id,
    });
  } catch (error: any) {
    console.error("[STUDY-SESSION-LOG]", error);
    return NextResponse.json(
      { error: "Erro ao registrar sessão de estudo", details: error.message },
      { status: 500 }
    );
  }
}
