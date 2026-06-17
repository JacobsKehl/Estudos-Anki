/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";
import { StudySessionActionType, StudySessionSource } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "cron_secret_kehl_study_2026_xyz") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testUserId = "test-user-phase2-mock";
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    log("=== INICIANDO SUÍTE DE TESTES: ACELERAÇÃO FASE 2 (CONTINUAR ESTUDANDO) ===");

    // --- Setup inicial ---
    log("Setup: Limpando dados antigos...");
    await cleanUpUser(testUserId);

    log("Setup: Criando usuário e preferências...");
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Gabriela Aceleração Mock Phase 2",
        email: "gabriela.aceleracao.p2@test.com",
        preferences: {
          create: {
            examGoal: "TRT4",
            languageTone: "FEMININE",
            scheduleGenerationMode: "LEGACY_TRT4",
            dailyGoalMinutes: 120,
            studyDaysOfWeek: "1,2,3,4,5,6,0"
          }
        }
      }
    });

    // Criar matérias
    const subjectA = await prisma.studySubject.create({
      data: { id: "sub-p2-a", name: "Direito Constitucional", studyPriority: "PRIMARY", userId: testUserId }
    });
    const subjectB = await prisma.studySubject.create({
      data: { id: "sub-p2-b", name: "Direito Administrativo", studyPriority: "ACTIVE", userId: testUserId }
    });
    const subjectSecondary = await prisma.studySubject.create({
      data: { id: "sub-p2-sec", name: "Direito Civil", studyPriority: "SECONDARY", userId: testUserId }
    });

    // Criar materiais
    const matA = await prisma.studyMaterial.create({
      data: { id: "mat-p2-a", fileName: "const.pdf", userId: testUserId, subjectId: subjectA.id, materialRole: "MAIN_MATERIAL" }
    });
    const matB = await prisma.studyMaterial.create({
      data: { id: "mat-p2-b", fileName: "admin.pdf", userId: testUserId, subjectId: subjectB.id, materialRole: "MAIN_MATERIAL" }
    });
    const matSec = await prisma.studyMaterial.create({
      data: { id: "mat-p2-sec", fileName: "civil.pdf", userId: testUserId, subjectId: subjectSecondary.id, materialRole: "MAIN_MATERIAL" }
    });

    // Criar blocos
    // blockA1: completed block
    const blockA1 = await prisma.studyBlock.create({
      data: { id: "block-p2-a1", title: "Constitucional 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30, status: "COMPLETED" }
    });
    // blockA2: overdue scheduled block
    const blockA2 = await prisma.studyBlock.create({
      data: { id: "block-p2-a2", title: "Constitucional 2", pageStart: 11, pageEnd: 20, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30, status: "NOT_STARTED" }
    });
    // blockA3: today cycle scheduled block
    const blockA3 = await prisma.studyBlock.create({
      data: { id: "block-p2-a3", title: "Constitucional 3", pageStart: 21, pageEnd: 30, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30, status: "NOT_STARTED" }
    });
    // blockA4: not scheduled block (SAME_SUBJECT candidate)
    const blockA4 = await prisma.studyBlock.create({
      data: { id: "block-p2-a4", title: "Constitucional 4", pageStart: 31, pageEnd: 40, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30, status: "NOT_STARTED", orderIndex: 4 }
    });
    // blockB1: next eligible block (NEXT_ELIGIBLE candidate)
    const blockB1 = await prisma.studyBlock.create({
      data: { id: "block-p2-b1", title: "Administrativo 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectB.id, materialId: matB.id, estimatedStudyMinutes: 30, status: "NOT_STARTED", orderIndex: 1 }
    });
    // blockSec1: secondary block
    const blockSec1 = await prisma.studyBlock.create({
      data: { id: "block-p2-sec1", title: "Civil 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectSecondary.id, materialId: matSec.id, estimatedStudyMinutes: 30, status: "NOT_STARTED" }
    });

    // Criar cronograma ativo
    const schedule = await prisma.studySchedule.create({
      data: {
        id: "sched-p2-active",
        userId: testUserId,
        title: "Cronograma Aceleração P2",
        status: "ACTIVE",
        dailyStudyMinutes: 120
      }
    });

    const todayRange = getTodayRangeSP(new Date());
    const yesterday = new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000);

    // Inserir itens no cronograma
    // itemOverdue: yesterday THEORY PENDING para blockA2
    const itemOverdue = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p2-overdue",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA2.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: yesterday,
        dayNumber: 1,
        estimatedMinutes: 30
      }
    });

    // itemToday: today THEORY PENDING para blockB1 (exclui subjectA completed block, is a today task)
    const itemToday = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p2-today",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectB.id,
        studyBlockId: blockB1.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: todayRange.start,
        dayNumber: 2,
        estimatedMinutes: 30
      }
    });

    // itemSecondary: secondary item
    const itemSecondary = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p2-sec",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectSecondary.id,
        studyBlockId: blockSec1.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: todayRange.start,
        dayNumber: 2,
        estimatedMinutes: 30
      }
    });

    // --- EXECUÇÃO DOS CENÁRIOS DE TESTE ---

    // Cenário 1: Buscar sugestões e validar a presença de OVERDUE
    log("Cenário 1: Validando sugestão de tarefa atrasada (OVERDUE)...");
    const suggestions1 = await getSuggestionsForTest(testUserId, blockA1.id);
    const overdueSuggestion = suggestions1.find((s: any) => s.type === "OVERDUE");
    const c1Passed = overdueSuggestion !== undefined && 
                     overdueSuggestion.scheduleItemId === itemOverdue.id &&
                     overdueSuggestion.studyBlockId === blockA2.id &&
                     overdueSuggestion.reason.includes("Pendência atrasada");
    log(`- Cenário 1: ${c1Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 2: Validando sugestão de próximo bloco da mesma matéria (SAME_SUBJECT)
    log("Cenário 2: Validando sugestão de próximo bloco da mesma matéria (SAME_SUBJECT)...");
    const sameSubjectSuggestion = suggestions1.find((s: any) => s.type === "SAME_SUBJECT");
    const c2Passed = sameSubjectSuggestion !== undefined &&
                     sameSubjectSuggestion.studyBlockId === blockA4.id &&
                     sameSubjectSuggestion.reason.includes("Próximo bloco desta matéria");
    log(`- Cenário 2: ${c2Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 3: Validando sugestão de tarefa do ciclo do dia (TODAY_CYCLE)
    log("Cenário 3: Validando sugestão de tarefa do ciclo do dia (TODAY_CYCLE)...");
    const todayCycleSuggestion = suggestions1.find((s: any) => s.type === "TODAY_CYCLE");
    const c3Passed = todayCycleSuggestion !== undefined &&
                     todayCycleSuggestion.studyBlockId === blockB1.id &&
                     todayCycleSuggestion.reason.includes("Próxima tarefa do dia");
    log(`- Cenário 3: ${c3Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 4: Validando NEXT_ELIGIBLE quando SAME_SUBJECT e TODAY_CYCLE não estão disponíveis
    log("Cenário 4: Validando sugestão de outro bloco elegível do ciclo (NEXT_ELIGIBLE)...");
    // Para testar o NEXT_ELIGIBLE, vamos simular que completamos blockA1 e não temos SAME_SUBJECT nem TODAY_CYCLE.
    // Vamos deletar blockA4 (para não ter SAME_SUBJECT) e deletar itemToday (para não ter TODAY_CYCLE).
    await prisma.studyBlock.delete({ where: { id: blockA4.id } });
    await prisma.studyScheduleItem.delete({ where: { id: itemToday.id } });

    const suggestions2 = await getSuggestionsForTest(testUserId, blockA1.id);
    const nextEligibleSuggestion = suggestions2.find((s: any) => s.type === "NEXT_ELIGIBLE");
    
    // Como deletamos blockA4, SAME_SUBJECT deve ser nulo. E itemToday deletado, TODAY_CYCLE nulo.
    // Então NEXT_ELIGIBLE deve retornar blockB1 (já que é do subjectB que é ACTIVE).
    const c4Passed = nextEligibleSuggestion !== undefined &&
                     nextEligibleSuggestion.studyBlockId === blockB1.id &&
                     nextEligibleSuggestion.reason.includes("Próximo bloco elegível do ciclo");
    log(`- Cenário 4: ${c4Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 5: SECOND_PASS sempre presente referenciando o bloco concluído
    log("Cenário 5: Validando que SECOND_PASS está sempre presente no final...");
    const hasSecondPass = suggestions2.find((s: any) => s.type === "SECOND_PASS");
    const c5Passed = hasSecondPass !== undefined &&
                     hasSecondPass.studyBlockId === blockA1.id &&
                     hasSecondPass.reason.includes("Segunda leitura");
    log(`- Cenário 5: ${c5Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 6: Matérias SECONDARY/EXCLUDED devem ser filtradas e nunca aparecer nas sugestões
    log("Cenário 6: Validando que matérias secundárias são filtradas...");
    const hasSecondarySuggestion = suggestions2.some(
      (s: any) => s.studyBlockId === blockSec1.id || s.scheduleItemId === itemSecondary.id
    );
    const c6Passed = !hasSecondarySuggestion;
    log(`- Cenário 6: ${c6Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 7: Registrar SECOND_PASS cria apenas StudySessionLog sem alterar StudyBlock, StudyScheduleItem ou flashcards
    log("Cenário 7: Registrar segunda leitura...");
    const sessionLogBody = {
      studyBlockId: blockA1.id,
      actionType: "SECOND_PASS",
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      actualDurationMinutes: 15
    };
    
    const logResult = await createStudySessionLogForTest(testUserId, sessionLogBody);
    const checkLog = await prisma.studySessionLog.findFirst({
      where: { userId: testUserId, studyBlockId: blockA1.id, actionType: "SECOND_PASS" }
    });

    // Verificar que o bloco A1 permaneceu COMPLETED e nenhum StudyScheduleItem foi associado
    const checkBlock = await prisma.studyBlock.findUnique({ where: { id: blockA1.id } });
    const c7Passed = logResult.success &&
                     checkLog !== null &&
                     checkLog.durationMinutes === 15 &&
                     checkLog.studyScheduleItemId === null &&
                     checkBlock?.status === "COMPLETED";
    log(`- Cenário 7: ${c7Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 8: Clamping de tempo físico + 1 min tolerância
    log("Cenário 8: Validando clamping de tempo físico (+1 min tolerância)...");
    const clampBody1 = {
      studyBlockId: blockA1.id,
      actionType: "SECOND_PASS",
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Janela física de 10 min
      actualDurationMinutes: 25 // Gabriela informou 25 min (excede 10+1 = 11)
    };
    const logResultClamp1 = await createStudySessionLogForTest(testUserId, clampBody1);
    const checkLogClamp1 = await prisma.studySessionLog.findUnique({ where: { id: logResultClamp1.logId } });
    // Deve sofrer clamp para physicalDiffMin = 10 min
    const c8Passed = logResultClamp1.success && checkLogClamp1?.durationMinutes === 10;
    log(`- Cenário 8 (Duração 25 min clamped para 10 min): ${c8Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 9: Clamping de tempo de 2x a estimativa do bloco
    log("Cenário 9: Validando clamping de 2x estimativa do bloco...");
    // Estimativa do blockA1 é 30 min. 2x estimativa = 60 min.
    const clampBody2 = {
      studyBlockId: blockA1.id,
      actionType: "SECOND_PASS",
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // Janela física de 90 min
      actualDurationMinutes: 80 // Gabriela informou 80 min (excede 2x estimativa = 60)
    };
    const logResultClamp2 = await createStudySessionLogForTest(testUserId, clampBody2);
    const checkLogClamp2 = await prisma.studySessionLog.findUnique({ where: { id: logResultClamp2.logId } });
    // Deve sofrer clamp para 2x30 = 60 min
    const c9Passed = logResultClamp2.success && checkLogClamp2?.durationMinutes === 60;
    log(`- Cenário 9 (Duração 80 min clamped para 60 min): ${c9Passed ? "PASSED ✅" : "FAILED ❌"}`);

    await cleanUpUser(testUserId);

    const allPassed = c1Passed && c2Passed && c3Passed && c4Passed && c5Passed && c6Passed && c7Passed && c8Passed && c9Passed;

    return NextResponse.json({
      success: allPassed,
      logs
    });

  } catch (error: any) {
    await cleanUpUser(testUserId);
    return NextResponse.json({
      success: false,
      error: error.message,
      logs
    }, { status: 500 });
  }
}

async function getSuggestionsForTest(userId: string, completedBlockId: string) {
  const completedBlock = await (prisma as any).studyBlock.findFirst({
    where: { id: completedBlockId, userId },
    include: { subject: true },
  });

  if (!completedBlock) throw new Error("Bloco de teste não encontrado");

  const completedSubjectId = completedBlock.subjectId;
  const activeSchedule = await (prisma as any).studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
  });

  const suggestions: any[] = [];
  const todayRange = getTodayRangeSP(new Date());

  const eligibleSubjects = await prisma.studySubject.findMany({
    where: {
      userId,
      studyPriority: { in: ["PRIMARY", "ACTIVE"] },
    },
  });
  const eligibleSubjectIds = eligibleSubjects.map((s) => s.id);

  if (activeSchedule) {
    // ── SUGGESTION 1: OVERDUE
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

    // ── SUGGESTION 3: TODAY_CYCLE
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

  // ── SUGGESTION 2: SAME_SUBJECT
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

  // ── SUGGESTION 4: NEXT_ELIGIBLE
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

  // ── SUGGESTION 5: SECOND_PASS (sempre)
  suggestions.push({
    type: "SECOND_PASS",
    studyBlockId: completedBlockId,
    subjectName: completedBlock.subject?.name || "Matéria",
    blockTitle: completedBlock.title || "Bloco",
    estimatedMinutes: completedBlock.estimatedStudyMinutes || 30,
    reason: "Segunda leitura (não altera cronograma)",
  });

  const typeOrder: Record<string, number> = {
    OVERDUE: 0,
    SAME_SUBJECT: 1,
    TODAY_CYCLE: 2,
    NEXT_ELIGIBLE: 3,
    SECOND_PASS: 4,
  };
  suggestions.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

  return suggestions;
}

async function createStudySessionLogForTest(userId: string, body: any) {
  const { studyBlockId, actionType, startedAt, completedAt, actualDurationMinutes } = body;
  
  const ALLOWED_ACTION_TYPES = ["SECOND_PASS", "REINFORCEMENT", "EXTRA_STUDY"];
  if (!studyBlockId || !actionType) return { success: false, error: "Missing required fields" };
  if (!ALLOWED_ACTION_TYPES.includes(actionType)) return { success: false, error: "Invalid action type" };

  const block = await (prisma as any).studyBlock.findFirst({
    where: { id: studyBlockId, userId },
  });
  if (!block) return { success: false, error: "Block not found" };

  let validatedStartedAt: Date | null = null;
  let validatedCompletedAt: Date | null = null;
  let validatedDuration = block.estimatedStudyMinutes || 30;
  let logSource: StudySessionSource = StudySessionSource.MANUAL;

  if (startedAt && completedAt && actualDurationMinutes !== undefined && actualDurationMinutes !== null) {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start.getTime() >= end.getTime()) {
      return { success: false, error: "Invalid timestamps" };
    }
    validatedStartedAt = start;
    validatedCompletedAt = end;
    logSource = StudySessionSource.TIMER;

    let rawDuration = actualDurationMinutes;
    if (rawDuration <= 0) rawDuration = 1;

    const physicalDiffMin = Math.round((end.getTime() - start.getTime()) / 60000);
    if (rawDuration > physicalDiffMin + 1) {
      rawDuration = Math.max(1, physicalDiffMin);
    }

    const estimated = block.estimatedStudyMinutes || 30;
    if (rawDuration > 2 * estimated) {
      rawDuration = 2 * estimated;
    }
    validatedDuration = rawDuration;
  }

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

  return { success: true, logId: sessionLog.id };
}

async function cleanUpUser(userId: string) {
  try {
    await prisma.studySessionLog.deleteMany({ where: { userId } });
    await prisma.studyScheduleItem.deleteMany({ where: { userId } });
    await prisma.studySchedule.deleteMany({ where: { userId } });
    await prisma.studyBlock.deleteMany({ where: { userId } });
    await prisma.studyMaterial.deleteMany({ where: { userId } });
    await prisma.studySubject.deleteMany({ where: { userId } });
    await prisma.userPreferences.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  } catch (e) {
    console.error(`Erro ao limpar usuário ${userId}:`, e);
  }
}
