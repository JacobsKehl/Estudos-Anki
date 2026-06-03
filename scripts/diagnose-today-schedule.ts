import { prisma } from "../src/lib/prisma";
import { getTodayRangeSP } from "../src/lib/date-utils";

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

  if (!userEmail) {
    console.error("❌ Erro: O parâmetro --user-email é obrigatório.");
    console.log("\nUso correto:");
    console.log("  npx tsx scripts/diagnose-today-schedule.ts --user-email=\"gabriela.furtado.p@gmail.com\"");
    process.exit(1);
  }

  console.log(`🔍 Buscando usuário com e-mail: ${userEmail}...`);
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: { preferences: true }
  });

  if (!user) {
    console.error(`❌ Erro: Usuário com e-mail "${userEmail}" não encontrado.`);
    process.exit(1);
  }

  // 1. Usuário analisado
  console.log("\n====================================================");
  console.log("👤 1. DADOS DO USUÁRIO");
  console.log("====================================================");
  console.log(`ID:        ${user.id}`);
  console.log(`Nome:      ${user.name || "Não informado"}`);
  console.log(`E-mail:    ${user.email}`);
  console.log(`Meta:      ${user.preferences?.examGoal || "Não informada"}`);
  console.log(`Meta Diária (minutos): ${user.preferences?.dailyGoalMinutes || 120}`);
  console.log(`Dias de Estudo Semanais: ${user.preferences?.studyDaysOfWeek || "Não informado"}`);

  // 2. Cronograma ativo
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId: user.id, status: "ACTIVE" }
  });

  console.log("\n====================================================");
  console.log("📅 2. CRONOGRAMA ATIVO");
  console.log("====================================================");
  if (!activeSchedule) {
    console.log("❌ NENHUM CRONOGRAMA ATIVO ENCONTRADO PARA ESTE USUÁRIO.");
    process.exit(0);
  }
  console.log(`ID:           ${activeSchedule.id}`);
  console.log(`Título:       ${activeSchedule.title}`);
  console.log(`Data Início:  ${activeSchedule.startDate.toISOString()}`);
  console.log(`Minutos Diários: ${activeSchedule.dailyStudyMinutes}`);
  console.log(`Status:       ${activeSchedule.status}`);
  console.log(`Atualizado em: ${activeSchedule.updatedAt.toISOString()}`);

  // 3 & 4. Horários e Fuso
  const now = new Date();
  const todayRange = getTodayRangeSP(now);
  const todayStart = todayRange.start;
  const todayEnd = todayRange.end;

  console.log("\n====================================================");
  console.log("⏰ 3 & 4. DATA ATUAL E INTERVALO UTC EQUIVALENTE");
  console.log("====================================================");
  console.log(`Data Atual Local (Horário do Servidor): ${now.toString()}`);
  console.log(`Data Atual (UTC):                     ${now.toISOString()}`);
  console.log(`Hoje em America/Sao_Paulo:            ${todayRange.dateString} (${todayRange.label})`);
  console.log(`Query UTC Range - Início:             ${todayStart.toISOString()}`);
  console.log(`Query UTC Range - Fim:                ${todayEnd.toISOString()}`);

  // Buscar todos os itens do cronograma ativo para análise em memória
  const allItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId: user.id,
      scheduleId: activeSchedule.id
    },
    include: {
      subject: true,
      studyBlock: {
        include: {
          material: true
        }
      }
    },
    orderBy: [
      { scheduledDate: "asc" },
      { priorityScore: "desc" },
      { id: "asc" }
    ]
  });

  console.log(`\nTotal de itens no cronograma ativo: ${allItems.length}`);

  // Helper para classificar itens por data útil relativa
  const getItemsForDayOffset = (offset: number) => {
    const range = getTodayRangeSP(now, offset);
    return allItems.filter((item: any) => 
      item.scheduledDate && 
      item.scheduledDate >= range.start && 
      item.scheduledDate < range.end
    );
  };

  const formatItemSummary = (items: any[]) => {
    if (items.length === 0) return "   Nenhum item agendado.";
    const counts: Record<string, { total: number; pending: number; completed: number; inProgress: number; skipped: number }> = {};
    items.forEach((item: any) => {
      const type = item.actionType || "UNKNOWN";
      if (!counts[type]) {
        counts[type] = { total: 0, pending: 0, completed: 0, inProgress: 0, skipped: 0 };
      }
      counts[type].total++;
      if (item.status === "PENDING") counts[type].pending++;
      else if (item.status === "COMPLETED") counts[type].completed++;
      else if (item.status === "IN_PROGRESS") counts[type].inProgress++;
      else if (item.status === "SKIPPED") counts[type].skipped++;
    });

    return Object.entries(counts)
      .map(([type, stats]) => `   - ${type}: ${stats.total} itens (Pendentes: ${stats.pending}, Em Progresso: ${stats.inProgress}, Concluídos: ${stats.completed}, Pulados: ${stats.skipped})`)
      .join("\n");
  };

  // 5. Ontem (D-1)
  console.log("\n====================================================");
  console.log("⏮️ 5. ITENS DE ONTEM (D-1)");
  console.log("====================================================");
  const yesterdayItems = getItemsForDayOffset(-1);
  console.log(formatItemSummary(yesterdayItems));

  // 6. Hoje (D0)
  console.log("\n====================================================");
  console.log("⏺️ 6. ITENS DE HOJE (D0)");
  console.log("====================================================");
  const todayItems = getItemsForDayOffset(0);
  console.log(formatItemSummary(todayItems));

  // 7. Amanhã (D+1)
  console.log("\n====================================================");
  console.log("⏭️ 7. ITENS DE AMANHÃ (D+1)");
  console.log("====================================================");
  const tomorrowItems = getItemsForDayOffset(1);
  console.log(formatItemSummary(tomorrowItems));

  // 8. Próximos 5 dias (D+1 a D+5)
  console.log("\n====================================================");
  console.log("📅 8. PRÓXIMOS 5 DIAS POR DATA E STATUS");
  console.log("====================================================");
  for (let i = 1; i <= 5; i++) {
    const range = getTodayRangeSP(now, i);
    const dayItems = getItemsForDayOffset(i);
    console.log(`Dia D+${i} (${range.dateString}): ${dayItems.length} itens`);
    console.log(formatItemSummary(dayItems));
    console.log("----------------------------------------------------");
  }

  // 9, 10, 11 & 12. Quantidade por tipo Hoje
  const theoryToday = todayItems.filter((i: any) => i.actionType === "THEORY");
  const reviewBlockToday = todayItems.filter((i: any) => i.actionType === "REVIEW_BLOCK");
  const supportToday = todayItems.filter((i: any) => i.actionType === "SUPPORT");
  const reviewFlashcardsToday = todayItems.filter((i: any) => i.actionType === "REVIEW_FLASHCARDS");

  console.log("\n====================================================");
  console.log("📊 9-12. DETALHAMENTO DE ITENS DE HOJE POR TIPO");
  console.log("====================================================");
  console.log(`- THEORY (Teoria):                  ${theoryToday.length} itens`);
  console.log(`- REVIEW_BLOCK (Revisão Conteúdo):   ${reviewBlockToday.length} itens`);
  console.log(`- SUPPORT (Material Apoio):         ${supportToday.length} itens`);
  console.log(`- REVIEW_FLASHCARDS (Cards Anki):   ${reviewFlashcardsToday.length} itens`);

  // 13. Itens com estimatedMinutes = 0 ou nulo
  const zeroMinutesItems = allItems.filter((i: any) => i.estimatedMinutes === 0 || i.estimatedMinutes === null);
  console.log("\n====================================================");
  console.log(`⏳ 13. ITENS COM ESTIMATEDMINUTES = 0 OU NULO (Total: ${zeroMinutesItems.length})`);
  console.log("====================================================");
  const sampleZero = zeroMinutesItems.slice(0, 10);
  sampleZero.forEach((item: any, idx: number) => {
    const dateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
    console.log(`   [${idx + 1}] ID: ${item.id} | Tipo: ${item.actionType} | Data: ${dateStr} | Minutos: ${item.estimatedMinutes} | Matéria: ${item.subject?.name} | Título: ${item.studyBlock?.title || "N/A"} | Status: ${item.status}`);
  });
  if (zeroMinutesItems.length > 10) {
    console.log(`   ... e mais ${zeroMinutesItems.length - 10} itens.`);
  }

  // 14. Primeiros 10 THEORY futuros
  const futureTheory = allItems.filter((i: any) => 
    i.actionType === "THEORY" && 
    i.scheduledDate && 
    i.scheduledDate > todayEnd &&
    (i.status === "PENDING" || i.status === "IN_PROGRESS")
  );
  console.log("\n====================================================");
  console.log(`📖 14. PRIMEIROS 10 THEORY PENDENTES NO FUTURO (Total: ${futureTheory.length})`);
  console.log("====================================================");
  const sampleTheory = futureTheory.slice(0, 10);
  sampleTheory.forEach((item: any, idx: number) => {
    const dateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
    console.log(`   [${idx + 1}] ID: ${item.id} | Data: ${dateStr} | Matéria: ${item.subject?.name} | Bloco: ${item.studyBlock?.title || "N/A"} | Status: ${item.status}`);
  });

  // 15. Primeiros 10 REVIEW_BLOCK de hoje
  console.log("\n====================================================");
  console.log(`🔄 15. PRIMEIROS 10 REVIEW_BLOCK DE HOJE (Total: ${reviewBlockToday.length})`);
  console.log("====================================================");
  const sampleReviewBlock = reviewBlockToday.slice(0, 10);
  sampleReviewBlock.forEach((item: any, idx: number) => {
    console.log(`   [${idx + 1}] ID: ${item.id} | Bloco: ${item.studyBlock?.title || "N/A"} | Matéria: ${item.subject?.name} | Status: ${item.status} | Minutos: ${item.estimatedMinutes} | Bloco ID: ${item.studyBlockId} | Material ID: ${item.materialId}`);
  });

  // 16. Itens sem studyBlockId
  const noBlockItems = allItems.filter((i: any) => !i.studyBlockId);
  console.log("\n====================================================");
  console.log(`🚫 16. ITENS SEM STUDYBLOCKID (Total: ${noBlockItems.length})`);
  console.log("====================================================");
  const sampleNoBlock = noBlockItems.slice(0, 10);
  sampleNoBlock.forEach((item: any, idx: number) => {
    const dateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
    console.log(`   [${idx + 1}] ID: ${item.id} | Tipo: ${item.actionType} | Data: ${dateStr} | Motivo: ${item.reason} | Status: ${item.status}`);
  });

  // 17. Itens sem materialId
  const noMaterialItems = allItems.filter((i: any) => !i.materialId);
  console.log("\n====================================================");
  console.log(`📄 17. ITENS SEM MATERIALID (Total: ${noMaterialItems.length})`);
  console.log("====================================================");
  const sampleNoMaterial = noMaterialItems.slice(0, 10);
  sampleNoMaterial.forEach((item: any, idx: number) => {
    const dateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
    console.log(`   [${idx + 1}] ID: ${item.id} | Tipo: ${item.actionType} | Data: ${dateStr} | Motivo: ${item.reason} | Status: ${item.status}`);
  });

  // 18. Itens PENDING/IN_PROGRESS no passado (atrasados)
  const overdueItems = allItems.filter((i: any) => 
    i.scheduledDate && 
    i.scheduledDate < todayStart && 
    (i.status === "PENDING" || i.status === "IN_PROGRESS")
  );
  console.log("\n====================================================");
  console.log(`⚠️ 18. ITENS PENDENTES/IN_PROGRESS NO PASSADO (ATRASADOS) (Total: ${overdueItems.length})`);
  console.log("====================================================");
  const sampleOverdue = overdueItems.slice(0, 10);
  sampleOverdue.forEach((item: any, idx: number) => {
    const dateStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem Data";
    console.log(`   [${idx + 1}] ID: ${item.id} | Tipo: ${item.actionType} | Data: ${dateStr} | Matéria: ${item.subject?.name} | Título: ${item.studyBlock?.title || "N/A"} | Status: ${item.status}`);
  });

  // 19. Análise / Indício de que THEORY foi empurrado pelo rollover
  console.log("\n====================================================");
  console.log("🧠 19. ANÁLISE DE INDÍCIO DE EMPURRAMENTO DE TEORIA");
  console.log("====================================================");

  const pendingTheoryToday = theoryToday.filter((i: any) => i.status === "PENDING" || i.status === "IN_PROGRESS");
  const pendingReviewToday = reviewBlockToday.filter((i: any) => i.status === "PENDING" || i.status === "IN_PROGRESS");

  console.log(`Pendências de Teoria hoje: ${pendingTheoryToday.length}`);
  console.log(`Pendências de Revisão hoje: ${pendingReviewToday.length}`);
  console.log(`Futuras Teorias pendentes: ${futureTheory.length}`);

  if (pendingReviewToday.length > 0 && pendingTheoryToday.length === 0 && futureTheory.length > 0) {
    console.log("🚨 ALERTA: Há revisões de bloco hoje, nenhuma teoria hoje, mas há teorias pendentes no futuro!");
    console.log("   Isso indica fortemente que o rollover organizou os itens por data original.");
    console.log("   Como as revisões (REVIEW_BLOCK) D+1 foram criadas no passado quando a teoria foi concluída,");
    console.log("   elas ficaram com a data do dia seguinte à conclusão (também no passado).");
    console.log("   Ao rodar o rollover, o script pegou todas as pendências agrupadas por data original:");
    console.log("   - As revisões do passado ficaram associadas a uma data mais antiga do que a teoria pendente seguinte.");
    console.log("   - O rollover ordenou essas datas originais ascendente.");
    console.log("   - Consequentemente, a data com apenas as revisões antigas foi mapeada para 'Hoje',");
    console.log("     e a data com a teoria subsequente foi empurrada para 'Amanhã' ou mais adiante.");
    console.log("   Fato confirmador: Verifique se o dia número de hoje possui apenas as revisões.");
  } else {
    console.log("   Nenhum padrão clássico de empurramento detectado automaticamente ou a situação é diferente.");
  }
  
  console.log("\n====================================================");
  console.log("🏁 FIM DO DIAGNÓSTICO");
  console.log("====================================================");
}

main()
  .catch((err) => {
    console.error("❌ Erro ao rodar o diagnóstico:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
