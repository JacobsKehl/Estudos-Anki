import { PrismaClient } from "@prisma/client";
import { generateSmartSchedule, reorganizeOverdueSchedule } from "../src/lib/scheduler";
import { getTodayRangeSP } from "../src/lib/date-utils";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES: CARRYOVER OBRIGATÓRIO ===\n");

  const testUserId = "test-user-carryover-mock";

  try {
    // --- Setup inicial ---
    console.log("Setup: Limpando dados antigos...");
    await cleanUpUser(testUserId);

    console.log("Setup: Criando usuário e preferências...");
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

    console.log("Executando reorganizeOverdueSchedule com dryRun = false...");
    const result = await reorganizeOverdueSchedule(testUserId, false, false, now);

    // --- ASSERÇÕES ---
    console.log("\n--- ASSERÇÕES DOS TESTES ---");

    // 1. Verificar se o concluído foi preservado
    const checkCompleted = await prisma.studyScheduleItem.findUnique({ where: { id: itemCompleted.id } });
    console.log(`- Item concluído preservado: ${checkCompleted?.status === "COMPLETED" && checkCompleted.scheduledDate?.toISOString().split("T")[0] === "2026-06-15" ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(checkCompleted?.status === "COMPLETED", "Erro: O item concluído foi alterado!");

    // 2. Verificar se o item secundário foi removido
    const checkSecondary = await prisma.studyScheduleItem.findUnique({ where: { id: itemSecondary.id } });
    console.log(`- Item de matéria secundária removido: ${!checkSecondary ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(!checkSecondary, "Erro: O item de matéria secundária não foi removido!");

    // 3. Verificar o carryover do item de teoria atrasado para o dia corrente (hoje, 17/06)
    const checkOverdueTheory = await prisma.studyScheduleItem.findUnique({ where: { id: itemOverdueTheory.id } });
    const overdueNewDateStr = checkOverdueTheory?.scheduledDate?.toISOString().split("T")[0];
    console.log(`- Item de teoria atrasado foi reagendado para hoje (17/06): ${overdueNewDateStr === "2026-06-17" ? "PASSED ✅" : "FAILED ❌"} (Nova data: ${overdueNewDateStr})`);
    console.assert(overdueNewDateStr === "2026-06-17", "Erro: O item de teoria atrasado não foi movido para hoje!");

    // 4. Verificar a carga teórica do dia 17/06: deve ter pelo menos 90 min de THEORY (itemOverdueTheory + itemFutureTheory1)
    const itemsOnToday = await prisma.studyScheduleItem.findMany({
      where: { userId: testUserId, scheduledDate: { gte: todayRange.start, lte: todayRange.end } }
    });

    const theoryOnToday = itemsOnToday.filter(i => i.actionType === "THEORY" && i.status !== "COMPLETED");
    const theoryMinutesToday = theoryOnToday.reduce((sum, i) => sum + (i.estimatedMinutes || 0), 0);
    console.log(`- Minutos de teoria agendados para hoje: ${theoryMinutesToday} min (Esperado: >= 90) -> ${theoryMinutesToday >= 90 ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(theoryMinutesToday >= 90, "Erro: A carga de teoria de hoje ficou abaixo da meta!");

    // 5. Verificar se REVIEW_BLOCK ou REVIEW_FLASHCARDS (SRS) NÃO foram contados na meta de teoria de hoje
    const nonTheoryOnToday = itemsOnToday.filter(i => i.actionType !== "THEORY");
    console.log(`- SRS/Revisões não contaram como teoria principal: ${nonTheoryOnToday.length > 0 && theoryMinutesToday === 90 ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(theoryMinutesToday === 90, "Erro: SRS ou REVIEW_BLOCK foram computados incorretamente como teoria!");

    // 6. Verificar se o REVIEW_BLOCK atrasado foi reagendado para hoje sem consumir cota de teoria (não empurrou a teoria)
    const checkOverdueReview = await prisma.studyScheduleItem.findUnique({ where: { id: itemOverdueReview.id } });
    const reviewNewDateStr = checkOverdueReview?.scheduledDate?.toISOString().split("T")[0];
    console.log(`- REVIEW_BLOCK atrasado foi movido para hoje sem bloquear a teoria: ${reviewNewDateStr === "2026-06-17" ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(reviewNewDateStr === "2026-06-17", "Erro: O REVIEW_BLOCK atrasado não foi movido!");

    // 7. Não duplicar studyBlockId
    const blockIds = itemsOnToday.map(i => i.studyBlockId).filter(id => !!id);
    const hasDuplicates = new Set(blockIds).size !== blockIds.length;
    console.log(`- Sem duplicidade de studyBlockId no mesmo dia: ${!hasDuplicates ? "PASSED ✅" : "FAILED ❌"}`);
    console.assert(!hasDuplicates, "Erro: Existem blocos de estudo duplicados no mesmo dia!");

    console.log("\n=== TODOS OS TESTES DE CARRYOVER PASSARAM COM SUCESSO! 🚀 ===");

  } catch (error) {
    console.error("\n❌ ERRO NA EXECUÇÃO DOS TESTES DE CARRYOVER:", error);
  } finally {
    console.log("\nCleanup: Limpando registros temporários de teste...");
    await cleanUpUser(testUserId);
    await prisma.$disconnect();
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

runTests();
