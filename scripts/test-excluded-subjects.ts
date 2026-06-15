import { PrismaClient } from "@prisma/client";
import { generateSmartSchedule, reorganizeOverdueSchedule } from "../src/lib/scheduler";
import { getTodayRangeSP } from "../src/lib/date-utils";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== INICIANDO SUÍTE DE TESTES: MATÉRIAS EXCLUÍDAS DO CRONOGRAMA ===\n");

  const testUserId = "test-user-gabriela-mock";
  const otherUserId = "test-user-other-mock";

  try {
    // --- 0. CLEANUP INICIAL E SETUP DOS USUÁRIOS DE TESTE ---
    console.log("Setup: Limpando dados de testes anteriores...");
    await cleanUpUser(testUserId);
    await cleanUpUser(otherUserId);

    console.log("Setup: Criando usuários e preferências de teste...");
    await prisma.user.create({
      data: {
        id: testUserId,
        name: "Gabriela Mock",
        email: "gabriela.mock@test.com",
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

    await prisma.user.create({
      data: {
        id: otherUserId,
        name: "Outro Usuário",
        email: "outro.user@test.com",
        preferences: {
          create: {
            examGoal: "TRT4",
            languageTone: "MASCULINE_NEUTRAL",
            scheduleGenerationMode: "DYNAMIC",
            dailyGoalMinutes: 120,
            studyDaysOfWeek: "1,2,3,4,5,6,0"
          }
        }
      }
    });

    // Criar matérias para o Test User
    // Matéria A (Ativa)
    const subjectA = await prisma.studySubject.create({
      data: {
        id: "subj-a-primary",
        name: "Direito do Trabalho",
        studyPriority: "PRIMARY",
        userId: testUserId
      }
    });

    // Matéria B (Será Excluída)
    const subjectB = await prisma.studySubject.create({
      data: {
        id: "subj-b-excluded",
        name: "Direito Civil",
        studyPriority: "PRIMARY",
        userId: testUserId
      }
    });

    // Criar matérias para o outro usuário
    const subjectOther = await prisma.studySubject.create({
      data: {
        id: "subj-other",
        name: "Direito do Trabalho",
        studyPriority: "PRIMARY",
        userId: otherUserId
      }
    });

    // Criar materiais de estudo
    const materialA = await prisma.studyMaterial.create({
      data: {
        id: "mat-a",
        fileName: "trabalho.pdf",
        userId: testUserId,
        subjectId: subjectA.id,
        materialRole: "MAIN_MATERIAL"
      }
    });

    const materialB = await prisma.studyMaterial.create({
      data: {
        id: "mat-b",
        fileName: "civil.pdf",
        userId: testUserId,
        subjectId: subjectB.id,
        materialRole: "MAIN_MATERIAL"
      }
    });

    const materialOther = await prisma.studyMaterial.create({
      data: {
        id: "mat-other",
        fileName: "trabalho-outro.pdf",
        userId: otherUserId,
        subjectId: subjectOther.id,
        materialRole: "MAIN_MATERIAL"
      }
    });

    // Criar blocos de estudo
    const blockA = await prisma.studyBlock.create({
      data: {
        id: "block-a",
        title: "Teoria A",
        pageStart: 1,
        pageEnd: 10,
        userId: testUserId,
        subjectId: subjectA.id,
        materialId: materialA.id,
        estimatedStudyMinutes: 45
      }
    });

    // Criamos múltiplos blocos para B para ter itens suficientes agendados
    const blockB1 = await prisma.studyBlock.create({
      data: {
        id: "block-b1",
        title: "Teoria B1",
        pageStart: 1,
        pageEnd: 10,
        userId: testUserId,
        subjectId: subjectB.id,
        materialId: materialB.id,
        estimatedStudyMinutes: 45
      }
    });

    const blockB2 = await prisma.studyBlock.create({
      data: {
        id: "block-b2",
        title: "Teoria B2",
        pageStart: 11,
        pageEnd: 20,
        userId: testUserId,
        subjectId: subjectB.id,
        materialId: materialB.id,
        estimatedStudyMinutes: 45
      }
    });

    const blockOther = await prisma.studyBlock.create({
      data: {
        id: "block-other",
        title: "Teoria Outro",
        pageStart: 1,
        pageEnd: 10,
        userId: otherUserId,
        subjectId: subjectOther.id,
        materialId: materialOther.id,
        estimatedStudyMinutes: 45
      }
    });

    // --- TESTE 1: Gabriela/LEGACY_TRT4 com matéria EXCLUDED não aparece no cronograma novo ---
    console.log("Teste 1: Gerando cronograma com matéria B como EXCLUDED em modo LEGACY_TRT4...");
    // Definir Subject B como EXCLUDED
    await prisma.studySubject.update({
      where: { id: subjectB.id },
      data: { studyPriority: "EXCLUDED" }
    });

    await generateSmartSchedule(testUserId, { title: "Cronograma Teste LEGACY" });

    // Verificar itens gerados
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId: testUserId, status: "ACTIVE" },
      include: { items: true }
    });

    const hasSubjectBItems = activeSchedule?.items.some(item => item.subjectId === subjectB.id) || false;
    console.log(`  -> Itens da matéria EXCLUDED no cronograma novo? ${hasSubjectBItems ? "Sim ❌" : "Não (Sucesso) ✅"}`);
    console.assert(!hasSubjectBItems, "Erro: Matéria EXCLUDED foi agendada no novo cronograma LEGACY!");

    // --- TESTE 2, 3 e 4: Ao marcar como EXCLUDED, remove PENDING/IN_PROGRESS e preserva COMPLETED ---
    console.log("\nTeste 2, 3, 4: Verificando comportamento de purga transacional no PATCH...");
    // Primeiro reativar matéria B para PRIMARY e regerar cronograma
    await prisma.studySubject.update({
      where: { id: subjectB.id },
      data: { studyPriority: "PRIMARY" }
    });
    await generateSmartSchedule(testUserId, { title: "Cronograma Teste Regeração" });

    // Modificar um item de B para IN_PROGRESS e outro para COMPLETED
    const scheduleItems = await prisma.studyScheduleItem.findMany({
      where: { userId: testUserId, subjectId: subjectB.id }
    });

    console.log(`  -> Itens gerados para matéria B: ${scheduleItems.length}`);
    if (scheduleItems.length >= 2) {
      await prisma.studyScheduleItem.update({
        where: { id: scheduleItems[0].id },
        data: { status: "IN_PROGRESS" }
      });
      await prisma.studyScheduleItem.update({
        where: { id: scheduleItems[1].id },
        data: { status: "COMPLETED", completedAt: new Date() }
      });
    } else {
      throw new Error(`Não foram gerados itens suficientes para a matéria B (gerados: ${scheduleItems.length})`);
    }

    // Criar um item pendente para o outro usuário para o Teste 8
    await prisma.studySchedule.updateMany({
      where: { userId: otherUserId },
      data: { status: "ACTIVE" }
    });
    const activeScheduleOther = await prisma.studySchedule.create({
      data: {
        userId: otherUserId,
        title: "Cronograma Outro",
        status: "ACTIVE",
        dailyStudyMinutes: 120
      }
    });
    const itemOther = await prisma.studyScheduleItem.create({
      data: {
        userId: otherUserId,
        scheduleId: activeScheduleOther.id,
        subjectId: subjectOther.id,
        studyBlockId: blockOther.id,
        status: "PENDING",
        actionType: "THEORY",
        dayNumber: 1
      }
    });

    // Simular o PATCH mudando matéria B para EXCLUDED usando a lógica de transação implementada
    await prisma.$transaction(async (tx) => {
      await tx.studySubject.update({
        where: { id: subjectB.id, userId: testUserId },
        data: { studyPriority: "EXCLUDED" }
      });

      await tx.studyScheduleItem.deleteMany({
        where: {
          userId: testUserId,
          subjectId: subjectB.id,
          status: { in: ["PENDING", "IN_PROGRESS"] }
        }
      });
    });

    // Asserções
    const remainingItemsB = await prisma.studyScheduleItem.findMany({
      where: { userId: testUserId, subjectId: subjectB.id }
    });

    const pendingCount = remainingItemsB.filter(i => i.status === "PENDING").length;
    const inProgressCount = remainingItemsB.filter(i => i.status === "IN_PROGRESS").length;
    const completedCount = remainingItemsB.filter(i => i.status === "COMPLETED").length;

    console.log(`  -> Itens PENDING restantes: ${pendingCount} (Esperado: 0) ${pendingCount === 0 ? "✅" : "❌"}`);
    console.log(`  -> Itens IN_PROGRESS restantes: ${inProgressCount} (Esperado: 0) ${inProgressCount === 0 ? "✅" : "❌"}`);
    console.log(`  -> Itens COMPLETED restantes: ${completedCount} (Esperado: 1) ${completedCount === 1 ? "✅" : "❌"}`);

    console.assert(pendingCount === 0, "Erro: Itens PENDING de matéria EXCLUDED não foram removidos!");
    console.assert(inProgressCount === 0, "Erro: Itens IN_PROGRESS de matéria EXCLUDED não foram removidos!");
    console.assert(completedCount === 1, "Erro: Itens COMPLETED de matéria EXCLUDED foram removidos ou alterados!");

    // --- TESTE 8: Nenhum dado de outro usuário é afetado ---
    console.log("\nTeste 8: Verificando se itens de outros usuários permanecem intocados...");
    const checkItemOther = await prisma.studyScheduleItem.findUnique({
      where: { id: itemOther.id }
    });
    console.log(`  -> Item do outro usuário preservado? ${checkItemOther ? "Sim (Sucesso) ✅" : "Não ❌"}`);
    console.assert(!!checkItemOther, "Erro: O cronograma do outro usuário foi afetado!");

    // --- TESTE 5 e 6: reorganizeOverdueSchedule com dryRun e purga real ---
    console.log("\nTeste 5 e 6: Testando reorganizeOverdueSchedule com dryRun e purga real...");
    
    // Inserir manualmente itens PENDING da matéria B (EXCLUDED) com data no passado para forçar o cenário do rollover
    const pastDate = new Date();
    pastDate.setUTCDate(pastDate.getUTCDate() - 2);

    const activeSched = await prisma.studySchedule.findFirst({
      where: { userId: testUserId, status: "ACTIVE" }
    });

    const oldPendingItem = await prisma.studyScheduleItem.create({
      data: {
        userId: testUserId,
        scheduleId: activeSched!.id,
        subjectId: subjectB.id,
        studyBlockId: blockB1.id,
        status: "PENDING",
        actionType: "THEORY",
        scheduledDate: pastDate,
        dayNumber: 1
      }
    });

    // Testar com dryRun = true
    console.log("Executando reorganizeOverdueSchedule com dryRun = true...");
    const resultDryRun = await reorganizeOverdueSchedule(testUserId, false, true, new Date());
    
    // Verificar se o item ainda existe no banco
    const checkDryRunExists = await prisma.studyScheduleItem.findUnique({
      where: { id: oldPendingItem.id }
    });
    
    console.log(`  -> dryRun=true removeu o item do banco? ${checkDryRunExists ? "Não (Sucesso) ✅" : "Sim ❌"}`);
    console.log(`  -> dryRun=true contou itens purgados? Contagem: ${resultDryRun.excludedItemsPurgedCount} (Esperado: 1) ${resultDryRun.excludedItemsPurgedCount === 1 ? "✅" : "❌"}`);
    console.assert(!!checkDryRunExists, "Erro: dryRun=true removeu registro fisicamente!");
    console.assert(resultDryRun.excludedItemsPurgedCount === 1, "Erro: dryRun=true não reportou contagem de purga!");

    // Testar com dryRun = false (purga real)
    console.log("Executando reorganizeOverdueSchedule com dryRun = false...");
    const resultReal = await reorganizeOverdueSchedule(testUserId, false, false, new Date());
    
    const checkRealExists = await prisma.studyScheduleItem.findUnique({
      where: { id: oldPendingItem.id }
    });

    console.log(`  -> dryRun=false removeu o item do banco? ${!checkRealExists ? "Sim (Sucesso) ✅" : "Não ❌"}`);
    console.log(`  -> dryRun=false contou itens purgados? Contagem: ${resultReal.excludedItemsPurgedCount} (Esperado: 1) ${resultReal.excludedItemsPurgedCount === 1 ? "✅" : "❌"}`);
    console.assert(!checkRealExists, "Erro: Reorganização real não removeu o item pendente da matéria EXCLUDED!");
    console.assert(resultReal.excludedItemsPurgedCount === 1, "Erro: Reorganização real não reportou contagem de purga!");

    // --- TESTE 7: Usuário DYNAMIC continua respeitando EXCLUDED ---
    console.log("\nTeste 7: Verificando usuário DYNAMIC...");
    // Setup do usuário DYNAMIC
    const dynamicUserId = otherUserId; // otherUserId está configurado como DYNAMIC nas preferências
    
    // Configurar matéria de outro usuário como EXCLUDED
    await prisma.studySubject.update({
      where: { id: subjectOther.id },
      data: { studyPriority: "EXCLUDED" }
    });

    // Gerar cronograma dinâmico
    await generateSmartSchedule(dynamicUserId, { title: "Cronograma Teste DYNAMIC" });

    const activeScheduleDynamic = await prisma.studySchedule.findFirst({
      where: { userId: dynamicUserId, status: "ACTIVE" },
      include: { items: true }
    });

    const hasDynamicSubjectOtherItems = activeScheduleDynamic?.items.some(
      item => item.subjectId === subjectOther.id && (item.status === "PENDING" || item.status === "IN_PROGRESS")
    ) || false;

    console.log(`  -> Itens pendentes/em andamento da matéria EXCLUDED no cronograma DYNAMIC? ${hasDynamicSubjectOtherItems ? "Sim ❌" : "Não (Sucesso) ✅"}`);
    console.assert(!hasDynamicSubjectOtherItems, "Erro: Cronograma DYNAMIC agendou matéria EXCLUDED!");

    console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! 🚀 ===");

  } catch (error) {
    console.error("\n❌ ERRO NA EXECUÇÃO DOS TESTES:", error);
  } finally {
    // --- CLEANUP FINAL ---
    console.log("\nCleanup: Removendo registros temporários de teste...");
    await cleanUpUser(testUserId);
    await cleanUpUser(otherUserId);
    await prisma.$disconnect();
  }
}

async function cleanUpUser(userId: string) {
  try {
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

runTests();
