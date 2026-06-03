import { prisma } from "../src/lib/prisma";
import { reorganizeOverdueSchedule } from "../src/lib/scheduler";

async function main() {
  const args = process.argv.slice(2);
  
  let userEmail: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--user-email=')) {
      userEmail = args[i].split('=')[1];
    } else if (args[i] === '--user-email' && i + 1 < args.length) {
      userEmail = args[i + 1];
    }
  }

  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const preserveToday = args.includes('--preserve-today');

  if (!userEmail) {
    console.error("❌ Erro: O parâmetro --user-email é obrigatório.");
    console.log("\nUso correto:");
    console.log("  npx tsx scripts/rollover-missed-schedule.ts --user-email=\"gabriela.furtado.p@gmail.com\" --dry-run --preserve-today");
    console.log("  npx tsx scripts/rollover-missed-schedule.ts --user-email=\"gabriela.furtado.p@gmail.com\" --apply --preserve-today");
    process.exit(1);
  }

  if (!dryRun && !apply) {
    console.error("❌ Erro: Você deve especificar --dry-run ou --apply.");
    process.exit(1);
  }

  if (dryRun && apply) {
    console.error("❌ Erro: Não especifique --dry-run e --apply simultaneamente.");
    process.exit(1);
  }

  console.log(`🔍 Buscando usuário com e-mail: ${userEmail}...`);
  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  });

  if (!user) {
    console.error(`❌ Erro: Usuário com e-mail "${userEmail}" não encontrado.`);
    process.exit(1);
  }

  console.log(`👤 Usuário encontrado: ${user.name} (ID: ${user.id})`);
  console.log(`⚙️ Executando algoritmo de Rollover Dinâmico... Mode: ${dryRun ? "DRY-RUN (Simulação)" : "APPLY (Escrita)"}`);

  try {
    const result = await reorganizeOverdueSchedule(user.id, preserveToday, dryRun);
    
    // Importar dinamicamente helper para cálculo de fuso local
    const { getTodayRangeSP } = require("../src/lib/date-utils");
    
    // Emulação dos itens finais após a reorganização
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId: user.id, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      console.error("❌ Erro: Nenhum cronograma ativo encontrado.");
      process.exit(1);
    }

    const newDatesMap = new Map<string, string>();
    result.changes.forEach((c: any) => {
      newDatesMap.set(c.itemId, c.newDate);
    });

    const activeScheduleItems = await (prisma as any).studyScheduleItem.findMany({
      where: { scheduleId: activeSchedule.id },
      include: { subject: true, studyBlock: true }
    });

    const simulatedTodayItems = activeScheduleItems.map((item: any) => {
      const origDateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
      const finalDateStr = newDatesMap.get(item.id) || origDateStr;
      return { ...item, finalDateStr };
    }).filter((item: any) => item.finalDateStr === result.todayDateSP);

    const simulatedTodayTheory = simulatedTodayItems.filter((i: any) => i.actionType === "THEORY" && i.status !== "COMPLETED");
    const simulatedTodayReview = simulatedTodayItems.filter((i: any) => i.actionType === "REVIEW_BLOCK" && i.status !== "COMPLETED");
    const simulatedTodayFlashcards = simulatedTodayItems.filter((i: any) => i.actionType === "REVIEW_FLASHCARDS" && i.status !== "COMPLETED");

    console.log("\n====================================================");
    console.log(`🚀 RELATÓRIO DE ROLLOVER DE CRONOGRAMA - ${apply ? "EXECUTANDO (APPLY)" : "SIMULAÇÃO (DRY-RUN)"}`);
    console.log("====================================================");
    console.log(`preserveToday:                    ${result.preserveToday ? "SIM" : "NÃO"}`);
    console.log(`Data de hoje (America/Sao_Paulo): ${result.todayDateSP}`);
    console.log(`Data inicial de realocação:       ${result.allocationStartDateSP}`);
    console.log(`Itens atrasados encontrados:      ${result.overdueItemsCount}`);
    if (result.preserveToday) {
      console.log(`Itens de hoje preservados:        ${result.preservedTodayCount}`);
    }
    console.log(`Itens futuros empurrados:         ${result.futureItemsShiftedCount}`);
    console.log(`Itens COMPLETED preservados:      ${result.completedItemsPreservedCount}`);
    console.log(`Itens REVIEW_FLASHCARDS ignorados: ${result.ignoredFlashcardsCount}`);
    console.log("----------------------------------------------------");
    console.log(`📚 DIAS DE TEORIA IDENTIFICADOS:  ${result.theoryDatesCount}`);
    console.log(`🔄 DIAS DE REVISÃO APENAS:       ${result.reviewOnlyDatesCount}`);
    console.log(`📦 REVISÕES MESCLADAS NO DIA 1:  ${result.mergedReviewBlocksCount}`);
    console.log(`📖 HOJE PASSARÁ A TER TEORIA?    ${simulatedTodayTheory.length > 0 ? `SIM (${simulatedTodayTheory.length} itens de teoria)` : "NÃO"}`);
    console.log("----------------------------------------------------");

    if (simulatedTodayReview.length > 0) {
      console.log("📦 Revisões (REVIEW_BLOCK) mescladas no primeiro dia útil:");
      simulatedTodayReview.forEach((item: any, idx: number) => {
        console.log(`   - [${idx + 1}] Bloco: ${item.studyBlock?.title || "N/A"} (${item.subject?.name})`);
      });
      if (simulatedTodayReview.length > 10) {
        console.log(`   ⚠️ ALERTA: Há ${simulatedTodayReview.length} revisões mescladas hoje. Isso pode poluir visualmente a aba Hoje!`);
      }
      console.log("----------------------------------------------------");
    }

    if (!result.success) {
      console.log(`⚠️ Falha/Aviso no rollover: ${result.reason}`);
    } else if (result.changes.length === 0) {
      console.log("✨ Nenhuma alteração de data necessária! O cronograma já está 100% em dia.");
    } else {
      console.log(`📝 Primeiras 10 alterações previstas de um total de ${result.changes.length}:`);
      const first10 = result.changes.slice(0, 10);
      first10.forEach((c, idx) => {
        console.log(`   [${idx + 1}] ID: ${c.itemId} | Tipo: ${c.actionType} | Matéria: ${c.subjectName} | De ${c.originalDate} para ${c.newDate}`);
      });
      console.log("----------------------------------------------------");
      console.log(`📅 Última data do cronograma após reorganização: ${result.lastDateAfterReorganization}`);
    }
    console.log("====================================================");

    if (apply && result.success && result.changes.length > 0) {
      console.log("✅ Rollover aplicado com total sucesso no banco de dados!");
    } else if (dryRun) {
      console.log("ℹ️ Simulação (Dry-run) concluída com sucesso. Nenhuma gravação foi efetuada.");
    }

  } catch (error) {
    console.error("❌ Ocorreu um erro crítico durante o processamento do rollover:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("❌ Erro fatal no script:", err);
  process.exit(1);
});
