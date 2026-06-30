import { prisma } from "../src/lib/prisma";
import { getTodayRangeSP } from "../src/lib/date-utils";
import { reorganizeOverdueSchedule } from "../src/lib/scheduler";

async function getUniqueCompletedTheoryDaysCount(userId: string): Promise<{ count: number; dates: string[] }> {
  const completedItems = await prisma.studyScheduleItem.findMany({
    where: {
      userId,
      status: "COMPLETED",
      actionType: "THEORY"
    },
    select: {
      completedAt: true,
      scheduledDate: true
    }
  });

  const uniqueDates = new Set<string>();
  completedItems.forEach(item => {
    const dateToUse = item.completedAt || item.scheduledDate;
    if (dateToUse) {
      const dateStr = getTodayRangeSP(dateToUse).dateString;
      uniqueDates.add(dateStr);
    }
  });

  return { count: uniqueDates.size, dates: Array.from(uniqueDates).sort() };
}

async function getLastCompletedTheorySubjectIds(userId: string): Promise<{ subjects: string[]; details: any[] }> {
  const lastCompleted = await prisma.studyScheduleItem.findFirst({
    where: {
      userId,
      status: "COMPLETED",
      actionType: "THEORY"
    },
    orderBy: {
      completedAt: "desc"
    },
    select: {
      completedAt: true,
      scheduledDate: true
    }
  });

  if (!lastCompleted) return { subjects: [], details: [] };

  const dateToUse = lastCompleted.completedAt || lastCompleted.scheduledDate;
  if (!dateToUse) return { subjects: [], details: [] };

  const range = getTodayRangeSP(dateToUse);
  const completedOnSameDay = await prisma.studyScheduleItem.findMany({
    where: {
      userId,
      status: "COMPLETED",
      actionType: "THEORY",
      OR: [
        { completedAt: { gte: range.start, lt: range.end } },
        { completedAt: null, scheduledDate: { gte: range.start, lt: range.end } }
      ]
    },
    include: {
      subject: true
    }
  });

  return {
    subjects: Array.from(new Set(completedOnSameDay.map(item => item.subjectId))),
    details: completedOnSameDay.map(item => ({
      subjectName: item.subject?.name,
      completedAt: item.completedAt,
      scheduledDate: item.scheduledDate
    }))
  };
}

async function run() {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail }
    });

    if (!user) {
      console.error("❌ Gabriela não encontrada!");
      return;
    }

    console.log(`👤 Usuário Encontrado: ${user.name} (${user.id})`);

    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: user.id }
    });
    console.log(`⚙️ Preferências do Usuário:`, JSON.stringify(prefs, null, 2));

    // B. Auditar histórico de conclusão
    const uniqueCountResult = await getUniqueCompletedTheoryDaysCount(user.id);
    console.log("\n=== AUDITORIA DE HISTÓRICO ===");
    console.log(`Quantidade de datas únicas com teoria concluída: ${uniqueCountResult.count}`);
    console.log("Datas únicas identificadas:");
    uniqueCountResult.dates.forEach(d => console.log(`  - ${d}`));
    console.log(`nextStudyDayNumber calculado: ${uniqueCountResult.count + 1}`);

    const lastCompletedSubjects = await getLastCompletedTheorySubjectIds(user.id);
    console.log("\nMatérias concluídas no último dia ativo de estudo:");
    lastCompletedSubjects.details.forEach(item => {
      console.log(`  - Matéria: ${item.subjectName} (completedAt: ${item.completedAt}, scheduledDate: ${item.scheduledDate})`);
    });

    // Executar simulação de Rollover (dryRun = true)
    console.log("\n=== SIMULAÇÃO DE ROLLOVER (DRY RUN) ===");
    const result = await reorganizeOverdueSchedule(user.id, false, true, new Date());
    
    console.log(`Sucesso: ${result.success}`);
    if (result.reason) console.log(`Motivo: ${result.reason}`);
    console.log(`Itens com data deslocada (carryover): ${result.changes.length}`);
    
    console.log("\nDetalhes das alterações propostas (exemplo de reordenamento):");
    result.changes.forEach((c: any) => {
      console.log(`  - Item ID: ${c.itemId} [${c.actionType}] Matéria: ${c.subjectName} de ${c.originalDate} para ${c.newDate}`);
    });

  } catch (err: any) {
    console.error("❌ Erro no script de diagnóstico:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
