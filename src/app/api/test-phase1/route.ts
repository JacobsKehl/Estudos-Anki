import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeStudyBlock } from "@/lib/study/completion";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "cron_secret_kehl_study_2026_xyz") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const testUserId = "test-user-phase1-mock";
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    log("=== INICIANDO SUÍTE DE TESTES: ACELERAÇÃO FASE 1 (COLETA TEMPO REAL) ===");

    // --- Setup inicial ---
    log("Setup: Limpando dados antigos...");
    await cleanUpUser(testUserId);

    log("Setup: Criando usuário e preferências...");
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Gabriela Aceleração Mock",
        email: "gabriela.aceleracao@test.com",
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
      data: { id: "sub-p1-a", name: "Direito Constitucional", studyPriority: "PRIMARY", userId: testUserId }
    });
    const subjectSecondary = await prisma.studySubject.create({
      data: { id: "sub-p1-sec", name: "Discursiva", studyPriority: "SECONDARY", userId: testUserId }
    });

    // Criar materiais
    const matA = await prisma.studyMaterial.create({
      data: { id: "mat-p1-a", fileName: "const.pdf", userId: testUserId, subjectId: subjectA.id, materialRole: "MAIN_MATERIAL" }
    });

    // Criar blocos
    const blockA1 = await prisma.studyBlock.create({
      data: { id: "block-p1-a1", title: "Constitucional 1", pageStart: 1, pageEnd: 10, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30 }
    });
    const blockA2 = await prisma.studyBlock.create({
      data: { id: "block-p1-a2", title: "Constitucional 2", pageStart: 11, pageEnd: 20, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30 }
    });
    const blockA3 = await prisma.studyBlock.create({
      data: { id: "block-p1-a3", title: "Constitucional 3", pageStart: 21, pageEnd: 30, userId: testUserId, subjectId: subjectA.id, materialId: matA.id, estimatedStudyMinutes: 30 }
    });

    // Criar cronograma ativo
    const schedule = await prisma.studySchedule.create({
      data: {
        id: "sched-p1-active",
        userId: testUserId,
        title: "Cronograma Aceleração",
        status: "ACTIVE",
        dailyStudyMinutes: 120
      }
    });

    const todayRange = getTodayRangeSP(new Date());

    // Inserir itens no cronograma
    // Item 1: THEORY PENDING para blockA1
    const item1 = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p1-1",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA1.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: todayRange.start,
        dayNumber: 1,
        estimatedMinutes: 30
      }
    });

    // Item 2: THEORY PENDING para blockA2
    const item2 = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p1-2",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectA.id,
        studyBlockId: blockA2.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: todayRange.start,
        dayNumber: 1,
        estimatedMinutes: 30
      }
    });

    // Item 3: Item pertencente a matéria secundária
    const itemSec = await prisma.studyScheduleItem.create({
      data: {
        id: "item-p1-sec",
        userId: testUserId,
        scheduleId: schedule.id,
        subjectId: subjectSecondary.id,
        actionType: "THEORY",
        status: "PENDING",
        scheduledDate: todayRange.start,
        dayNumber: 1,
        estimatedMinutes: 30
      }
    });

    // --- EXECUÇÃO DOS CENÁRIOS DE TESTE ---

    // Cenário 1: Conclusão via timer com tempo menor que estimatedMinutes (estimado 30, real 15)
    log("Cenário 1: Conclusão via timer menor que estimativa...");
    const start1 = new Date();
    const end1 = new Date(start1.getTime() + 15 * 60 * 1000); // Janela física de 15 minutos
    await completeStudyBlock(testUserId, blockA1.id, item1.id, start1, end1, 15);

    const checkItem1 = await prisma.studyScheduleItem.findUnique({ where: { id: item1.id } });
    const checkLog1 = await prisma.studySessionLog.findFirst({ where: { studyScheduleItemId: item1.id } });

    const c1Passed = checkItem1?.status === "COMPLETED" && 
                     checkItem1.actualDurationMinutes === 15 && 
                     checkLog1?.durationMinutes === 15 && 
                     checkLog1.source === "TIMER";
    log(`- Cenário 1 (Salvar tempo real de 15 min): ${c1Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 2: Conclusão via timer com tempo maior que estimatedMinutes (estimado 30, real 80 -> clamp para 60)
    log("Cenário 2: Conclusão via timer maior que estimativa (Clamping 2x)...");
    const start2 = new Date();
    const end2 = new Date(start2.getTime() + 85 * 60 * 1000); // Janela física de 85 min
    await completeStudyBlock(testUserId, blockA2.id, item2.id, start2, end2, 80);

    const checkItem2 = await prisma.studyScheduleItem.findUnique({ where: { id: item2.id } });
    const checkLog2 = await prisma.studySessionLog.findFirst({ where: { studyScheduleItemId: item2.id } });

    const c2Passed = checkItem2?.status === "COMPLETED" && 
                     checkItem2.actualDurationMinutes === 60 && // Clamped to 2x 30 = 60
                     checkLog2?.durationMinutes === 60 && 
                     checkLog2.source === "TIMER";
    log(`- Cenário 2 (Clamp tempo real em 60 min): ${c2Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 3: Conclusão manual sem parâmetros de timer
    log("Cenário 3: Conclusão manual sem telemetria...");
    // Concluir bloco A3 diretamente (sem scheduleItemId, simulando manual)
    await completeStudyBlock(testUserId, blockA3.id);
    
    const checkBlockA3 = await prisma.studyBlock.findUnique({ where: { id: blockA3.id } });
    const checkLog3 = await prisma.studySessionLog.findFirst({ where: { studyBlockId: blockA3.id, source: "MANUAL" } });

    const c3Passed = checkBlockA3?.status === "COMPLETED" && 
                     checkLog3?.durationMinutes === 30 && // Usar valor estimado
                     checkLog3.source === "MANUAL" &&
                     checkLog3.startedAt === null;
    log(`- Cenário 3 (Conclusão manual salva source=MANUAL): ${c3Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 4: Validação de posse do scheduleItemId (outro usuário não pode concluir)
    log("Cenário 4: Validação de posse de usuário do scheduleItemId...");
    let c4Passed = false;
    try {
      await completeStudyBlock("another-user-id", blockA1.id, item1.id);
    } catch (e: any) {
      c4Passed = e.message === "UNAUTHORIZED_OR_NOT_FOUND";
    }
    log(`- Cenário 4 (Rejeita scheduleItemId de outro usuário): ${c4Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 5: Validação de bloco incorreto do scheduleItemId
    log("Cenário 5: Validação de bloco incorreto do scheduleItemId...");
    let c5Passed = false;
    try {
      // Tentar concluir bloco A2 passando item1 (que aponta para bloco A1)
      await completeStudyBlock(testUserId, blockA2.id, item1.id);
    } catch (e: any) {
      c5Passed = e.message === "INVALID_BLOCK_ID";
    }
    log(`- Cenário 5 (Rejeita item associado a outro bloco): ${c5Passed ? "PASSED ✅" : "FAILED ❌"}`);

    // Cenário 6: Validação de matéria secundária ou excluída
    log("Cenário 6: Validação de matéria secundária ou excluída...");
    let c6Passed = false;
    try {
      // Tentar concluir item de matéria secundária
      await completeStudyBlock(testUserId, "some-block", itemSec.id);
    } catch (e: any) {
      c6Passed = e.message === "INVALID_SUBJECT_PRIORITY";
    }
    log(`- Cenário 6 (Rejeita matérias inativas/secundárias): ${c6Passed ? "PASSED ✅" : "FAILED ❌"}`);

    await cleanUpUser(testUserId);

    const allPassed = c1Passed && c2Passed && c3Passed && c4Passed && c5Passed && c6Passed;

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
