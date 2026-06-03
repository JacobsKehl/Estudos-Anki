import { prisma } from "./prisma";
import { TRT4_STRATEGY } from "./strategies/trt4";
import { getTodayRangeSP } from "./date-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmartScheduleOptions {
  title?: string;
  dailyMinutes?: number;    // default: 120 (2 matérias × 60 min)
  startDate?: Date;         // default: hoje
  daysAhead?: number;       // default: calculado dinamicamente até 30/11/2026
  subjectsPerDay?: number;
  minutesPerSubject?: number;
}

const MAIN_7_SUBJECTS = [
  "Direito do Trabalho",
  "Direito Processual do Trabalho",
  "Direito Administrativo",
  "Direito Constitucional",
  "Direito Civil",
  "Direito Processual Civil",
  "Língua Portuguesa"
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Enforça os dias selecionados nas preferências do estudante
function isStudyDay(date: Date, studyDays: number[]): boolean {
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda...
  return studyDays.includes(day);
}

function getNextStudyDay(from: Date, studyDays: number[]): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (!isStudyDay(d, studyDays)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Calcula a estimativa de tempo de estudo do bloco baseado em palavras ou páginas
 */
export async function getOrComputeBlockMinutes(block: any, subjectName: string): Promise<number> {
  if (block.estimatedStudyMinutes && block.estimatedStudyMinutes > 0) {
    return block.estimatedStudyMinutes;
  }

  const DEFAULT_STUDY_WORDS_PER_MINUTE = 150;
  const STUDY_RETENTION_MULTIPLIER = 1.25;

  let totalWords = 0;
  try {
    const pages = await prisma.extractedContent.findMany({
      where: {
        materialId: block.materialId,
        pageNumber: {
          gte: block.pageStart,
          lte: block.pageEnd
        }
      },
      select: { text: true }
    });
    const combinedText = pages.map((p: any) => p.text).join(" ");
    totalWords = combinedText.trim().split(/\s+/).filter(Boolean).length;
  } catch (err) {
    console.error("Error reading page words for block:", err);
  }

  const nameLower = subjectName.toLowerCase();
  let densityMultiplier = 1.15; // MEDIUM default
  let isDense = false;
  if (
    nameLower.includes("direito") ||
    nameLower.includes("processo") ||
    nameLower.includes("processual") ||
    nameLower.includes("regimento") ||
    nameLower.includes("deficiência") ||
    nameLower.includes("legislação")
  ) {
    densityMultiplier = 1.3; // HIGH
    isDense = true;
  }

  let computedMinutes = 30; // default fallback if everything fails
  if (totalWords > 50) {
    computedMinutes = Math.ceil(
      (totalWords / DEFAULT_STUDY_WORDS_PER_MINUTE) *
      STUDY_RETENTION_MULTIPLIER *
      densityMultiplier
    );
  } else {
    const pageCount = block.pageEnd - block.pageStart + 1;
    const minPerPage = isDense ? 4 : 3;
    computedMinutes = pageCount * minPerPage;
  }

  // Cachear estimativa no banco de dados para evitar reprocessamentos
  try {
    await (prisma as any).studyBlock.update({
      where: { id: block.id },
      data: { estimatedStudyMinutes: computedMinutes }
    });
  } catch (err) {
    console.error("Error updating block estimated minutes:", err);
  }

  return computedMinutes;
}

// ─── Smart Schedule Generator ─────────────────────────────────────────────────

export async function generateSmartSchedule(userId: string, options: SmartScheduleOptions = {}) {
  const {
    title = "Meu Cronograma de Estudos",
    dailyMinutes = 120,
  } = options;

  // Buscar preferências de dias de estudo do usuário
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  const studyDaysStr = userPrefs?.studyDaysOfWeek || "1,2,3,4,5,6,0";
  const studyDays = studyDaysStr.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));

  const startDate = options.startDate ?? new Date();
  startDate.setHours(0, 0, 0, 0);

  // Calcular dias pendentes de forma rígida até 30/11/2026
  const deadline = new Date("2026-11-30T23:59:59");

  // 1. Obter matérias do usuário
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId },
  });

  // Filtrar apenas PRIMARY e ACTIVE
  const eligibleSubjects = userSubjects.filter(
    s => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE"
  );
  const eligibleSubjectIds = eligibleSubjects.map(s => s.id);

  // 2. Arquivar cronogramas ativos anteriores
  await (prisma as any).studySchedule.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  // 3. Criar o novo cronograma
  const schedule = await (prisma as any).studySchedule.create({
    data: {
      userId,
      title,
      dailyStudyMinutes: dailyMinutes,
      startDate,
      status: "ACTIVE",
    },
  });

  // 4. Distribuir tarefas
  const scheduleItemsData: any[] = [];
  const now = new Date();
  
  const dbCompletedBlocks = await (prisma as any).studyBlock.findMany({
    where: { userId, status: "COMPLETED" },
    select: { id: true }
  });
  
  const scheduledBlockIds = new Set<string>(
    dbCompletedBlocks.map((b: any) => b.id)
  );

  // Busca todos os blocos pendentes das matérias elegíveis
  const allPendingBlocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: { not: "COMPLETED" },
      subjectId: { in: eligibleSubjectIds },
      material: {
        materialRole: {
          not: "SUPPORT_MATERIAL"
        }
      }
    },
    include: {
      material: true,
      subject: true
    }
  });

  // Ordenação natural
  allPendingBlocks.sort((a: any, b: any) => {
    const fileA = a.material?.fileName || "";
    const fileB = b.material?.fileName || "";
    const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    if (fileCompare !== 0) return fileCompare;
    return a.orderIndex - b.orderIndex;
  });

  let activeSecondaryIndex = 0;
  const activeSecondarySubjects = eligibleSubjects.filter(s => s.studyPriority === "ACTIVE");

  let currentDate = new Date(startDate);
  let nextStudyDayNumber = 1;
  let cycleDayIndex = 0;

  while (currentDate.getTime() <= deadline.getTime()) {
    const isStudy = isStudyDay(currentDate, studyDays);
    
    if (isStudy) {
      const candidateDate = new Date(currentDate);
      const dayNumber = nextStudyDayNumber;
      nextStudyDayNumber++;
      
      const cycleDay = cycleDayIndex % 6;
      cycleDayIndex++;
      
      const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];

      // A. Lembrete SRS diário (30 min)
      scheduleItemsData.push({
        userId,
        scheduleId: schedule.id,
        subjectId: eligibleSubjects[0]?.id || "default",
        actionType: "REVIEW_FLASHCARDS",
        priorityScore: 100,
        reason: "Sessão diária de Revisão de Cards (SRS)",
        dayNumber,
        scheduledDate: candidateDate,
        estimatedMinutes: 30,
        status: "PENDING",
      });

      // B. Selecionar as 2 matérias do dia (Intercalando matérias ACTIVE se houver)
      const subName1 = subjectsTodayNames[0];
      let subName2 = subjectsTodayNames[1];

      if (activeSecondarySubjects.length > 0 && cycleDayIndex % 3 === 0) {
        const secSubject = activeSecondarySubjects[activeSecondaryIndex % activeSecondarySubjects.length];
        subName2 = secSubject.name;
        activeSecondaryIndex++;
      }

      const subject1 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName1.toLowerCase()));
      const subject2 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName2.toLowerCase()));

      const subjectsToSchedule = [subject1, subject2].filter((s): s is typeof eligibleSubjects[number] => !!s);
      const theoryMinutes = dailyMinutes - 30;
      const targetPerSubject = theoryMinutes / 2;
      let remainingTheoryMinutes = theoryMinutes;

      for (let i = 0; i < subjectsToSchedule.length; i++) {
        const subject = subjectsToSchedule[i];
        const targetForThisSubject = i === 0 ? Math.min(targetPerSubject, remainingTheoryMinutes) : remainingTheoryMinutes;
        let scheduledMinutesForThisSubject = 0;

        while (scheduledMinutesForThisSubject < targetForThisSubject) {
          // Encontra o próximo bloco
          let nextBlock = allPendingBlocks.find((b: any) =>
            b.subjectId === subject.id &&
            !scheduledBlockIds.has(b.id)
          );

          // Fallback para outra matéria ativa se não encontrar mais blocos
          if (!nextBlock) {
            const fallbackSubjects = eligibleSubjects.filter(s => s.id !== subject.id);
            for (const fs of fallbackSubjects) {
              nextBlock = allPendingBlocks.find((b: any) =>
                b.subjectId === fs.id &&
                !scheduledBlockIds.has(b.id)
              );
              if (nextBlock) break;
            }
          }

          if (!nextBlock) break;

          const blockMins = await getOrComputeBlockMinutes(nextBlock, subject.name);

          scheduleItemsData.push({
            userId,
            scheduleId: schedule.id,
            subjectId: nextBlock.subjectId,
            studyBlockId: nextBlock.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: `Roteiro: Teoria de ${subject.name}`,
            dayNumber,
            scheduledDate: candidateDate,
            estimatedMinutes: blockMins,
            status: "PENDING",
          });

          scheduledBlockIds.add(nextBlock.id);
          scheduledMinutesForThisSubject += blockMins;
          remainingTheoryMinutes -= blockMins;
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  // 5. Salvar em batch
  if (scheduleItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: scheduleItemsData,
    });
  }

  return { schedule, itemsCount: scheduleItemsData.length };
}

export async function reorganizeOverdueSchedule(
  userId: string,
  preserveToday = false,
  dryRun = false,
  now = new Date()
) {
  const todayRange = getTodayRangeSP(now);
  const todayStart = todayRange.start; // 00:00 SP time in UTC
  const todayStr = todayRange.dateString; // "YYYY-MM-DD"
  
  // 1. Encontrar o cronograma ativo atual
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        include: {
          subject: true,
          studyBlock: {
            include: {
              flashcards: {
                where: {
                  status: "APPROVED",
                  reviewState: { in: ["NEW", "LEARNING", "REVIEW", "RELEARNING"] }
                },
                select: { id: true }
              }
            }
          }
        }
      }
    }
  });

  if (!activeSchedule) {
    return {
      success: false,
      reason: "No active schedule found",
      preserveToday,
      todayDateSP: todayStr,
      allocationStartDateSP: todayStr,
      overdueItemsCount: 0,
      preservedTodayCount: 0,
      futureItemsShiftedCount: 0,
      completedItemsPreservedCount: 0,
      ignoredFlashcardsCount: 0,
      theoryDatesCount: 0,
      reviewOnlyDatesCount: 0,
      mergedReviewBlocksCount: 0,
      changes: [],
      lastDateAfterReorganization: todayStr
    };
  }

  const allItems = activeSchedule.items;

  // Filtros de contabilidade geral para o relatório
  const completedItemsPreservedCount = allItems.filter(item => item.status === "COMPLETED").length;
  
  // REVIEW_FLASHCARDS que estão no passado e não estão concluídos (serão ignorados)
  const ignoredFlashcardsCount = allItems.filter(
    item => item.actionType === "REVIEW_FLASHCARDS" &&
            item.status !== "COMPLETED" &&
            item.scheduledDate &&
            item.scheduledDate < todayStart
  ).length;

  // Itens elegíveis para o rollover:
  // actionType IN ["THEORY", "REVIEW_BLOCK", "SUPPORT"]
  // status IN ["PENDING", "IN_PROGRESS"]
  const eligibleTypes = ["THEORY", "REVIEW_BLOCK", "SUPPORT"];
  
  const eligiblePendingItems = allItems.filter(item => {
    if (item.status === "COMPLETED") return false;
    if (!item.actionType || !eligibleTypes.includes(item.actionType)) return false;

    if (item.actionType === "REVIEW_BLOCK") {
      const activeCards = item.studyBlock?.flashcards || [];
      return activeCards.length > 0;
    }
    return true;
  });

  // Separar em atrasados (< todayStart) e hoje/futuros (>= todayStart)
  const overdueItems = eligiblePendingItems.filter(
    item => item.scheduledDate && item.scheduledDate < todayStart
  );

  const overdueItemsCount = overdueItems.length;

  // IDEMPOTÊNCIA: Se não houver nenhum item pendente elegível no cronograma, não há nada a fazer!
  if (eligiblePendingItems.length === 0) {
    // Retorna no-op bem-sucedido
    let maxDateStr = todayStr;
    const validDates = allItems
      .map(item => item.scheduledDate)
      .filter((d): d is Date => !!d);
    if (validDates.length > 0) {
      const maxDate = new Date(Math.max(...validDates.map(d => d.getTime())));
      maxDateStr = getTodayRangeSP(maxDate).dateString;
    }

    return {
      success: true,
      reason: "No pending items found in schedule. (Idempotente)",
      preserveToday,
      todayDateSP: todayStr,
      allocationStartDateSP: preserveToday 
        ? getTodayRangeSP(now, 1).dateString 
        : todayStr,
      overdueItemsCount: 0,
      preservedTodayCount: 0,
      futureItemsShiftedCount: 0,
      completedItemsPreservedCount,
      ignoredFlashcardsCount,
      theoryDatesCount: 0,
      reviewOnlyDatesCount: 0,
      mergedReviewBlocksCount: 0,
      changes: [],
      lastDateAfterReorganization: maxDateStr
    };
  }

  // Se houver pendências passadas, precisamos reorganizar.
  // A data inicial a partir da qual as coisas serão agendadas:
  const allocationStartDate = preserveToday 
    ? getTodayRangeSP(now, 1).start 
    : todayStart;

  // Se preserveToday for true, contamos quantos itens de hoje (hojeStart <= scheduledDate < tomorrowStart) foram preservados
  const tomorrowStart = getTodayRangeSP(now, 1).start;
  const preservedTodayCount = preserveToday
    ? allItems.filter(
        item => item.scheduledDate &&
                item.scheduledDate >= todayStart &&
                item.scheduledDate < tomorrowStart
      ).length
    : 0;

  // Itens que serão realocados:
  const itemsToReschedule = eligiblePendingItems.filter(
    item => item.scheduledDate && (
      item.scheduledDate < todayStart ||
      item.scheduledDate >= allocationStartDate
    )
  );

  const futureItemsShiftedCount = itemsToReschedule.filter(
    item => item.scheduledDate && item.scheduledDate >= allocationStartDate
  ).length;

  // Agrupar itemsToReschedule pela sua scheduledDate original
  // E ordenar as datas originais em ordem ascendente para manter a sequência do cronograma
  const itemsByOriginalDate = new Map<string, typeof eligiblePendingItems>();
  
  for (const item of itemsToReschedule) {
    if (!item.scheduledDate) continue;
    const dateStr = getTodayRangeSP(item.scheduledDate).dateString;
    const list = itemsByOriginalDate.get(dateStr) || [];
    list.push(item);
    itemsByOriginalDate.set(dateStr, list);
  }

  const sortedOriginalDates = Array.from(itemsByOriginalDate.keys()).sort();

  // Buscar dias de estudo nas preferências do usuário
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  const studyDaysStr = userPrefs?.studyDaysOfWeek || "1,2,3,4,5,6,0";
  const studyDays = studyDaysStr.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));

  // Separar datas originais em dias de teoria e dias apenas de revisão
  const theoryDates: string[] = [];
  const reviewOnlyDates: string[] = [];

  for (const dateStr of sortedOriginalDates) {
    const items = itemsByOriginalDate.get(dateStr) || [];
    const hasTheory = items.some(item => item.actionType === "THEORY");
    if (hasTheory) {
      theoryDates.push(dateStr);
    } else {
      reviewOnlyDates.push(dateStr);
    }
  }

  // Encontrar o primeiro dia útil de estudos disponível para alocação (hoje ou amanhã dependendo de preserveToday)
  let firstStudyDate: Date = new Date();
  let checkOffset = preserveToday ? 1 : 0;
  let studyDayFound = false;
  while (!studyDayFound) {
    const range = getTodayRangeSP(now, checkOffset);
    if (isStudyDay(range.start, studyDays)) {
      firstStudyDate = range.start;
      studyDayFound = true;
    }
    checkOffset++;
  }

  // Mapear cada data original para a sua nova data útil de estudos disponível
  const dateMapping = new Map<string, Date>();
  
  // 1. Mapear dias de teoria de forma sequencial
  let daysOffset = preserveToday ? 1 : 0;
  for (const origDateStr of theoryDates) {
    let found = false;
    let allocatedDate: Date = new Date();
    while (!found) {
      const range = getTodayRangeSP(now, daysOffset);
      const dateToCheck = range.start;
      if (isStudyDay(dateToCheck, studyDays)) {
        allocatedDate = dateToCheck;
        found = true;
      }
      daysOffset++;
    }
    dateMapping.set(origDateStr, allocatedDate);
  }

  // 2. Mapear dias de apenas revisão/suporte para o primeiro dia útil de estudos (Today/Tomorrow), sem consumir slots extras
  for (const origDateStr of reviewOnlyDates) {
    dateMapping.set(origDateStr, firstStudyDate);
  }

  // Contar quantos itens de revisão foram mesclados no primeiro dia
  let mergedReviewBlocksCount = 0;
  for (const item of itemsToReschedule) {
    if (!item.scheduledDate) continue;
    const origDateStr = getTodayRangeSP(item.scheduledDate).dateString;
    if (reviewOnlyDates.includes(origDateStr) && item.actionType === "REVIEW_BLOCK") {
      mergedReviewBlocksCount++;
    }
  }

  // Gerar a lista de alterações e preparar as atualizações do banco
  const changesReport: Array<{
    itemId: string;
    actionType: string;
    subjectName: string;
    originalDate: string;
    newDate: string;
  }> = [];

  const updatesList: Array<{ id: string; scheduledDate: Date }> = [];

  for (const item of itemsToReschedule) {
    if (!item.scheduledDate) continue;
    const origDateStr = getTodayRangeSP(item.scheduledDate).dateString;
    const newAllocatedDate = dateMapping.get(origDateStr);
    
    if (newAllocatedDate) {
      const newDateStr = getTodayRangeSP(newAllocatedDate).dateString;
      
      // Apenas adiciona como alteração se a data realmente mudou
      if (origDateStr !== newDateStr) {
        changesReport.push({
          itemId: item.id,
          actionType: item.actionType || "UNKNOWN",
          subjectName: item.subject?.name || "Sem Matéria",
          originalDate: origDateStr,
          newDate: newDateStr
        });
        
        updatesList.push({
          id: item.id,
          scheduledDate: newAllocatedDate
        });
      }
    }
  }

  // Ordenar changesReport para exibição (por data original de forma ascendente)
  changesReport.sort((a, b) => a.originalDate.localeCompare(b.originalDate));

  // Obter a última data prevista após a reorganização
  let lastDateStr = todayStr;
  const mappedDates = Array.from(dateMapping.values());
  if (mappedDates.length > 0) {
    const maxDate = new Date(Math.max(...mappedDates.map(d => d.getTime())));
    lastDateStr = getTodayRangeSP(maxDate).dateString;
  } else {
    const preservedDates = allItems
      .filter(item => !itemsToReschedule.some(r => r.id === item.id))
      .map(item => item.scheduledDate)
      .filter((d): d is Date => !!d);
    if (preservedDates.length > 0) {
      const maxDate = new Date(Math.max(...preservedDates.map(d => d.getTime())));
      lastDateStr = getTodayRangeSP(maxDate).dateString;
    }
  }

  // Se não estiver em dryRun, executar as atualizações em uma transação Prisma
  if (!dryRun && updatesList.length > 0) {
    await prisma.$transaction(
      updatesList.map(up =>
        (prisma as any).studyScheduleItem.update({
          where: { id: up.id },
          data: { scheduledDate: up.scheduledDate }
        })
      )
    );
    
    // Atualizar o updatedAt do activeSchedule para hoje, para registrar que a reorganização ocorreu
    await (prisma as any).studySchedule.update({
      where: { id: activeSchedule.id },
      data: { updatedAt: now }
    });
  }

  return {
    success: true,
    preserveToday,
    todayDateSP: todayStr,
    allocationStartDateSP: getTodayRangeSP(allocationStartDate).dateString,
    overdueItemsCount,
    preservedTodayCount,
    futureItemsShiftedCount,
    completedItemsPreservedCount,
    ignoredFlashcardsCount,
    theoryDatesCount: theoryDates.length,
    reviewOnlyDatesCount: reviewOnlyDates.length,
    mergedReviewBlocksCount,
    changes: changesReport,
    lastDateAfterReorganization: lastDateStr
  };
}

export async function reorganizeActiveSchedule(userId: string, daysAheadParam = 30) {
  // Redireciona chamadas legadas de forma totalmente compatível
  const now = new Date();
  const result = await reorganizeOverdueSchedule(userId, false, false, now);
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" }
  });
  return {
    schedule: activeSchedule,
    itemsCount: result.success ? result.changes.length : 0
  };
}

// Otimização de deploy ativa: regiões de funções alinhadas para sao1 (São Paulo)

