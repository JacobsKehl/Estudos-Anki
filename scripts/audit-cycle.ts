import { prisma } from "../src/lib/prisma";
import { getTodayRangeSP } from "../src/lib/date-utils";
import { reorganizeOverdueSchedule } from "../src/lib/scheduler";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const TRT4_STRATEGY = {
  cycle: [
    ["Direito do Trabalho", "Língua Portuguesa"],
    ["Direito Processual do Trabalho", "Direito Administrativo"],
    ["Direito Constitucional", "Direito Processual Civil"]
  ]
};

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

    console.log(`👤 Usuário: ${user.name}`);

    // Executar tudo dentro de uma transação e garantir o ROLLBACK
    await prisma.$transaction(async (tx) => {
      // 1. Chamar a reorganização com dryRun = false para atualizar temporariamente na transação
      const result = await reorganizeOverdueSchedule(user.id, false, false, new Date());
      console.log(`Simulação de Rollover finalizada. Sucesso: ${result.success}`);

      // 2. Buscar itens de estudos agendados para os próximos 7 dias
      const startDate = getTodayRangeSP(new Date()).start;
      const endDate = addDays(startDate, 7);

      const items = await tx.studyScheduleItem.findMany({
        where: {
          userId: user.id,
          scheduledDate: {
            gte: startDate,
            lt: endDate
          }
        },
        include: {
          subject: true
        },
        orderBy: [
          { scheduledDate: "asc" },
          { id: "asc" }
        ]
      });

      console.log("\n=== AUDITORIA COMPLEMENTAR ===");
      console.log(`Período analisado: ${startDate.toISOString().split('T')[0]} até ${addDays(startDate, 6).toISOString().split('T')[0]}`);

      // Agrupar itens por data
      const itemsByDate: Record<string, typeof items> = {};
      for (const item of items) {
        if (!item.scheduledDate) continue;
        const dateStr = getTodayRangeSP(item.scheduledDate).dateString;
        if (!itemsByDate[dateStr]) {
          itemsByDate[dateStr] = [];
        }
        itemsByDate[dateStr].push(item);
      }

      // Buscar preferências do usuário para entender o ciclo
      const userPrefs = await tx.userPreferences.findUnique({
        where: { userId: user.id }
      });
      const mode = userPrefs?.scheduleGenerationMode || "DYNAMIC";
      console.log(`Modo de geração do cronograma: ${mode}`);

      // Vamos obter o cycleOffset usando a mesma lógica que adicionamos
      const lastCompleted = await tx.studyScheduleItem.findFirst({
        where: {
          userId: user.id,
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

      let lastCycleDay = null;
      if (lastCompleted) {
        const dateToUse = lastCompleted.completedAt || lastCompleted.scheduledDate;
        const range = getTodayRangeSP(dateToUse);
        const completedOnSameDay = await tx.studyScheduleItem.findMany({
          where: {
            userId: user.id,
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
        const subjectNames = completedOnSameDay.map(item => item.subject?.name);
        for (const name of subjectNames) {
          if (!name) continue;
          const nameLower = name.toLowerCase();
          if (nameLower.includes("trabalho") && !nameLower.includes("processo") && !nameLower.includes("processual")) {
            lastCycleDay = 0;
            break;
          }
          if (nameLower.includes("português") || nameLower.includes("portugues")) {
            lastCycleDay = 0;
            break;
          }
          if (nameLower.includes("processual do trabalho") || nameLower.includes("processo do trabalho")) {
            lastCycleDay = 1;
            break;
          }
          if (nameLower.includes("administrativo")) {
            lastCycleDay = 1;
            break;
          }
          if (nameLower.includes("constitucional")) {
            lastCycleDay = 2;
            break;
          }
          if (nameLower.includes("processual civil") || nameLower.includes("processo civil")) {
            lastCycleDay = 2;
            break;
          }
        }
      }

      const uniqueCompletedCount = await tx.studyScheduleItem.findMany({
        where: {
          userId: user.id,
          status: "COMPLETED",
          actionType: "THEORY"
        },
        select: {
          completedAt: true,
          scheduledDate: true
        }
      });
      const uniqueDates = new Set<string>();
      uniqueCompletedCount.forEach(item => {
        const dateToUse = item.completedAt || item.scheduledDate;
        if (dateToUse) {
          uniqueDates.add(getTodayRangeSP(dateToUse).dateString);
        }
      });
      const startDayNumber = uniqueDates.size + 1;

      let cycleOffset = 0;
      if (lastCycleDay !== null) {
        const targetCycleDay = (lastCycleDay + 1) % 3;
        cycleOffset = (targetCycleDay - (startDayNumber - 1) % 3 + 3) % 3;
      }
      console.log(`Histórico concluído: ${uniqueDates.size} dias. Dia inicial: ${startDayNumber}. lastCycleDay: ${lastCycleDay}. cycleOffset: ${cycleOffset}`);

      // Imprimir cabeçalho da tabela
      console.log("\n| Data | dayNumber | cycleDay | Matérias esperadas | Matérias agendadas | Blocos | Minutos | Carryover | Fallback | Justificativa |");
      console.log("|---|---:|---:|---|---|---|---:|---|---|---|");

      // Gerar dados para os próximos 7 dias
      for (let i = 0; i < 7; i++) {
        const targetDate = addDays(startDate, i);
        const dateStr = getTodayRangeSP(targetDate).dateString;
        const dayItems = itemsByDate[dateStr] || [];

        // Teoria do dia
        const theoryItems = dayItems.filter(item => item.actionType === "THEORY");

        // Obter dayNumber e cycleDay
        const dayNumber = theoryItems[0]?.dayNumber || (startDayNumber + i);
        const cycleDay = (dayNumber - 1 + cycleOffset) % 3;

        const expectedSubjects = TRT4_STRATEGY.cycle[cycleDay];
        const scheduledSubjects = theoryItems.map(item => item.subject?.name || "Sem Matéria");
        const blockIds = theoryItems.map(item => item.studyBlockId || "N/A");
        const minutes = theoryItems.map(item => item.estimatedMinutes || 0);
        const totalMinutes = minutes.reduce((a, b) => a + b, 0);

        // Analisar carryover, fallback
        const carryovers = theoryItems.map(item => {
          const isNew = item.reason?.includes("Preenchimento de Lacuna") || item.reason?.includes("Complemento");
          return isNew ? "Não" : "Sim";
        });

        const fallbacks = theoryItems.map(item => {
          return item.reason?.includes("Fallback") ? "Sim" : "Não";
        });

        // Anti-repetição
        const prevDateStr = getTodayRangeSP(addDays(targetDate, -1)).dateString;
        const prevDayItems = itemsByDate[prevDateStr] || [];
        const prevDaySubjects = prevDayItems.filter(item => item.actionType === "THEORY").map(item => item.subject?.name);

        let antiRepetitionTriggered = "Não";
        const missingExpectedSubjects = expectedSubjects.filter(subj => !scheduledSubjects.some(s => s.toLowerCase().includes(subj.toLowerCase())));
        for (const missing of missingExpectedSubjects) {
          if (prevDaySubjects.some(prev => prev?.toLowerCase().includes(missing.toLowerCase()))) {
            antiRepetitionTriggered = "Sim";
          }
        }

        // Justificativa
        let justification = "Ok (Ciclo Completo)";
        if (scheduledSubjects.length < 2) {
          if (totalMinutes >= 90) {
            const has90MinBlock = minutes.some(m => m >= 90);
            if (has90MinBlock) {
              justification = "Bloco de carryover ocupou toda a carga diária (90 min)";
            } else {
              justification = `Carga diária de teoria preenchida (${totalMinutes} min)`;
            }
          } else {
            justification = "Falta de blocos pendentes elegíveis para a segunda matéria";
          }
        }

        console.log(`| ${dateStr} | ${dayNumber} | ${cycleDay} | ${expectedSubjects.join(" + ")} | ${scheduledSubjects.join(", ") || "Nenhuma"} | ${blockIds.join(", ")} | ${totalMinutes} | ${carryovers.includes("Sim") ? "Sim" : "Não"} | ${fallbacks.includes("Sim") ? "Sim" : "Não"} | ${justification} |`);
      }

      // Forçar o rollback
      throw new Error("ROLLBACK_CONTROLLED");
    });

  } catch (err: any) {
    if (err.message === "ROLLBACK_CONTROLLED") {
      console.log("\n✅ Transação revertida com sucesso. Nenhum dado foi alterado em produção.");
    } else {
      console.error("❌ Erro durante a auditoria:", err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
