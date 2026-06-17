import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSmartSchedule, reorganizeOverdueSchedule } from "@/lib/scheduler";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "cron_secret_kehl_study_2026_xyz") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testUserId = "test-user-carryover-mock";
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    log("=== INICIANDO SUÍTE DE TESTES: CARRYOVER OBRIGATÓRIO EM VERCEL ===");

    // --- Setup inicial ---
    log("Setup: Limpando dados antigos...");
    await cleanUpUser(testUserId);

    log("Setup: Criando usuário e preferências...");
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Gabriela Carryover Mock",
        email: "gabriela.carryover@test.com",
        preferences: {
          create: {
            examGoal: "TRT4",
            languageTone: "FEMININE",
            scheduleGenerationMode: "LEGACY_TRT4",
            dailyGoalMinutes: 120,
            studyDaysOfWeek: "1,2,3,4,5,6,0" // Todos os dias
          }
        }
      }
    });

    // Criar matérias
    const subjectA = await prisma.studySubject.create({
      data: { id: "sub-carry-a", name: "Direito Constitucional", studyPriority: "PRIMARY", userId: testUserId }
    });
    const subjectB = await prisma.studySubject.create({
      data: { id: "sub-carry-b", name: "Direito Civil", studyPriority: "PRIMARY", userId: testUserId }
    });
    const subjectC = await prisma.studySubject.create({
      data: { id: "sub-carry-c", name: "Discursiva", studyPriority: "SECONDARY", userId: testUserId }
    });

    // Criar materiais
    const matA = await prisma.studyMaterial.create({
      data: { id: "mat-carry-a", fileName: "const.pdf", userId: testUserId, subjectId: subjectA.id, materialRole: "MAIN_MATERIAL" }
    });
    const matB = await prisma.studyMaterial.create({
      data: { id: "mat-carry-b", fileName: "civil.pdf", userId: testUserId, subjectId: subjectB.id, materialRole: "MAIN_MATERIAL" }
    });

    // Criar blocos
    const blockA1 = await prisma.studyBlock.create({
      data: { id: "block-carry-a1", title: "Constitucional 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 45 }
    });
    const blockA2 = await prisma.studyBlock.create({
      data: { id: "block-carry-a2", title: "Constitucional 2", pageStart: 11, pageEnd: 20, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 45 }
    });
    const blockB1 = await prisma.studyBlock.create({
      data: { id: "block-carry-b1", title: "Civil 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectB.id, materialId: matB.id, estimatedStudyMinutes: 45 }
    });
    const blockB2 = await prisma.studyBlock.create({
      data: { id: "block-carry-b2", title: "Civil 2", pageStart: 11, pageEnd: 20, userId: testUserId, subjectId: subjectB.id, materialId: matB.id, estimatedStudyMinutes: 45 }
    });

    // Criar flashcard para blockA1 para tornar o REVIEW_BLOCK elegível
    await prisma.flashcard.create({
      data: {
        id: "card-carry-1",
        userId: testUserId,
        subjectId: subjectA.id,
        studyBlockId: blockA1.id,
        question: "Pergunta de teste",
        answer: "Resposta de teste",
        status: "APPROVED",
        reviewState: "NEW"
      }
    });

    // Criar cronograma ativo
    const schedule = await prisma.studySchedule.create({
      data: {
        id: "sched-carry-active",
        userId: testUserId,
        title: "Cronograma Carryover",
        status: "ACTIVE",
        dailyStudyMinutes: 120
      }
    });

    // Data de referência de simulação: Hoje é 2026-06-17
    const now = new Date("2026-06-17T12:00:00Z");
    const todayRange = getTodayRangeSP(now);

    const pastDate1 = new Date("2026-06-15T12:00:00Z");
    const pastDate2 = new Date("2026-06-16T12:00:00Z");
    const futureDate1 = new Date("2026-06-17T12:00:00Z"); // Hoje
    const futureDate2 = new Date("2026-06-18T12:00:00Z"); // Amanhã

    // Inserir itens
    // 1. Concluído no passado (deve ser preservado)
    const itemCompleted = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA1.id,
        actionType: "THEORY",
        status: "COMPLETED",
        scheduledDate: pastDate1,
        dayNumber: 10,
        estimatedMinutes: 45,
        completedAt: pastDate1
      }
    });

    // 2. Atrasado THEORY (deve ser priorizado no carryover)
    const itemOverdueTheory = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectB.id,
        studyBlockId: blockB1.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: pastDate2,
        dayNumber: 11,
        estimatedMinutes: 45
      }
    });

    // 3. Atrasado REVIEW_BLOCK (não deve ser dívida obrigatória e não conta para a meta de teoria)
    const itemOverdueReview = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA1.id,
        actionType: "REVIEW_BLOCK",
        status: "PENDING",
        scheduledDate: pastDate2,
        dayNumber: 11,
        estimatedMinutes: 30
      }
    });

    // 4. Futuro THEORY previsto para hoje
    const itemFutureTheory1 = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA2.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: futureDate1,
        dayNumber: 12,
        estimatedMinutes: 45
      }
    });

    // 5. Futuro secundário (deve ser ignorado/removido)
    const itemSecondary = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectC.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: futureDate1,
        dayNumber: 12,
        estimatedMinutes: 30
      }
    });

    // 6. SRS diário de hoje (não deve contar como teoria principal)
    const itemSrsToday = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        actionType: "REVIEW_FLASHCARDS",
        status: "PENDING",
        scheduledDate: futureDate1,
        dayNumber: 12,
        estimatedMinutes: 30
      }
    });

    log("Executando reorganizeOverdueSchedule com dryRun = false...");
    const result = await reorganizeOverdueSchedule(testUserId, false, false, now);

    // --- ASSERÇÕES ---
    log("--- ASSERÇÕES DOS TESTES ---");

    const checkCompleted = await prisma.studyScheduleItem.findUnique({ where: { id: itemCompleted.id } });
    const completedPreserved = checkCompleted?.status === "COMPLETED" && checkCompleted.scheduledDate?.toISOString().split("T")[0] === "2026-06-15";
    log(`- Item concluído preservado: ${completedPreserved ? "PASSED ✅" : "FAILED ❌"}`);

    const checkSecondary = await prisma.studyScheduleItem.findUnique({ where: { id: itemSecondary.id } });
    const secondaryRemoved = !checkSecondary;
    log(`- Item de matéria secundária removido: ${secondaryRemoved ? "PASSED ✅" : "FAILED ❌"}`);

    const checkOverdueTheory = await prisma.studyScheduleItem.findUnique({ where: { id: itemOverdueTheory.id } });
    const overdueNewDateStr = checkOverdueTheory?.scheduledDate?.toISOString().split("T")[0];
    const overdueMovedCorrectly = overdueNewDateStr === "2026-06-17";
    log(`- Item de teoria atrasado foi reagendado para hoje (17/06): ${overdueMovedCorrectly ? "PASSED ✅" : "FAILED ❌"} (Nova data: ${overdueNewDateStr})`);

    const itemsOnToday = await prisma.studyScheduleItem.findMany({
      where: { userId: testUserId, scheduledDate: { gte: todayRange.start, lte: todayRange.end } }
    });

    const theoryOnToday = itemsOnToday.filter(i => i.actionType === "THEORY" && i.status !== "COMPLETED");
    const theoryMinutesToday = theoryOnToday.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);
    const theoryMetaMet = theoryMinutesToday >= 90;
    log(`- Minutos de teoria agendados para hoje: ${theoryMinutesToday} min (Esperado: >= 90) -> ${theoryMetaMet ? "PASSED ✅" : "FAILED ❌"}`);

    const nonTheoryOnToday = itemsOnToday.filter(i => i.actionType !== "THEORY");
    const nonTheoryNotCounted = nonTheoryOnToday.length > 0 && theoryMinutesToday === 90;
    log(`- SRS/Revisões não contaram como teoria principal: ${nonTheoryNotCounted ? "PASSED ✅" : "FAILED ❌"}`);

    const checkOverdueReview = await prisma.studyScheduleItem.findUnique({ where: { id: itemOverdueReview.id } });
    const reviewNewDateStr = checkOverdueReview?.scheduledDate?.toISOString().split("T")[0];
    const reviewMovedCorrectly = reviewNewDateStr === "2026-06-17";
    log(`- REVIEW_BLOCK atrasado foi movido para hoje sem bloquear a teoria: ${reviewMovedCorrectly ? "PASSED ✅" : "FAILED ❌"}`);

    const blockIds = itemsOnToday.map(i => i.studyBlockId).filter(id => !!id);
    const noDuplicates = new Set(blockIds).size === blockIds.length;
    log(`- Sem duplicidade de studyBlockId no mesmo dia: ${noDuplicates ? "PASSED ✅" : "FAILED ❌"}`);

    const allPassed = completedPreserved && secondaryRemoved && overdueMovedCorrectly && theoryMetaMet && nonTheoryNotCounted && reviewMovedCorrectly && noDuplicates;

    await cleanUpUser(testUserId);

    return NextResponse.json({
      success: allPassed,
      logs,
      resultSummary: result
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

async function cleanUpUser(userId: string) {
  try {
    await prisma.studyScheduleItem.deleteMany({ where: { userId } });
    await prisma.studySchedule.deleteMany({ where: { userId } });
    await prisma.flashcard.deleteMany({ where: { userId } });
    await prisma.studyBlock.deleteMany({ where: { userId } });
    await prisma.studyMaterial.deleteMany({ where: { userId } });
    await prisma.studySubject.deleteMany({ where: { userId } });
    await prisma.userPreferences.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  } catch (e) {
    console.error(`Erro ao limpar usuário ${userId}:`, e);
  }
}
