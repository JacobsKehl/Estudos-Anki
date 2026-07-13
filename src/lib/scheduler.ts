import { prisma } from "./prisma";
import { TRT4_STRATEGY } from "./strategies/trt4";
import { getTodayRangeSP } from "./date-utils";
import { calculateHybridMinutes, isHybridTimeError } from "./study/hybrid-estimated-time";

export class HybridScheduleIntegrityError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "HybridScheduleIntegrityError";
    this.code = code;
  }
}

export interface SchedulerWarning {
  code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE";
  blockId: string;
  message: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmartScheduleOptions {
  title?: string;
  dailyMinutes?: number;    // default: 120 (2 matérias × 60 min)
  startDate?: Date;         // default: hoje
  daysAhead?: number;       // default: calculado dinamicamente até 30/11/2026
  subjectsPerDay?: number;
  minutesPerSubject?: number;
}

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

/**
 * Calcula a estimativa de tempo de estudo do bloco baseado em palavras ou páginas
 */
export async function getOrComputeBlockMinutes(block: any, subjectName: string): Promise<number> {
  if (block.methodology === "HYBRID_8020") {
    if (block.estimatedStudyMinutes && block.estimatedStudyMinutes > 0) {
      return block.estimatedStudyMinutes;
    }

    try {
      const meta = block.aiAuditMetadata as any;
      const availableMinutes = meta?.timeEstimation?.availableMinutes;
      if (!availableMinutes || availableMinutes <= 0) {
        throw new HybridScheduleIntegrityError(
          "HYBRID_ESTIMATED_MINUTES_UNAVAILABLE",
          `availableMinutes ausente nos metadados do bloco híbrido ${block.id}.`
        );
      }

      const sources = await prisma.studyBlockSource.findMany({
        where: { studyBlockId: block.id },
        include: {
          segments: {
            where: { disposition: "READ" }
          }
        }
      });

      if (!sources || sources.length === 0) {
        throw new HybridScheduleIntegrityError(
          "HYBRID_ESTIMATED_MINUTES_UNAVAILABLE",
          `Nenhuma fonte encontrada no banco para o bloco híbrido ${block.id}.`
        );
      }

      let cfcReadWords = 0;
      let deepeningReadWords = 0;

      for (const source of sources) {
        if (!source.segments || source.segments.length === 0) continue;

        const pageConditions = source.segments.map((seg: any) => ({
          materialId: source.materialId,
          pageNumber: {
            gte: seg.pageStart,
            lte: seg.pageEnd
          }
        }));

        const pages = await prisma.extractedContent.findMany({
          where: { OR: pageConditions },
          select: { text: true }
        });

        const combinedText = pages.map((p: any) => p.text).join(" ");
        const wordsCount = combinedText.trim().split(/\s+/).filter(Boolean).length;

        if (source.sourceRole === "ANCHOR_8020") {
          cfcReadWords += wordsCount;
        } else if (source.sourceRole === "DEEPENING") {
          deepeningReadWords += wordsCount;
        }
      }

      const result = calculateHybridMinutes({
        cfcReadWords,
        deepeningReadWords,
        availableMinutes
      });

      if (!isHybridTimeError(result)) {
        return result.finalMinutes;
      }

      throw new HybridScheduleIntegrityError(
        "HYBRID_ESTIMATED_MINUTES_UNAVAILABLE",
        `Erro ao calcular tempo estimado híbrido para o bloco ${block.id}: ${result.code}`
      );
    } catch (err) {
      if (err instanceof HybridScheduleIntegrityError) {
        throw err;
      }
      throw new HybridScheduleIntegrityError(
        "HYBRID_ESTIMATED_MINUTES_UNAVAILABLE",
        `Erro interno ao calcular minutos do bloco híbrido ${block.id}: ${(err as Error).message}`
      );
    }
  }

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

async function getUniqueCompletedTheoryDaysCount(userId: string): Promise<number> {
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

  return uniqueDates.size;
}

async function getLastCompletedTheorySubjectIds(userId: string): Promise<string[]> {
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

  if (!lastCompleted) return [];

  const dateToUse = lastCompleted.completedAt || lastCompleted.scheduledDate;
  if (!dateToUse) return [];

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
    select: {
      subjectId: true
    }
  });

  return Array.from(new Set(completedOnSameDay.map(item => item.subjectId)));
}

async function getCycleOffset(userId: string, currentDayNumber: number): Promise<number> {
  const lastCompletedSubjects = await getLastCompletedTheorySubjectIds(userId);
  if (lastCompletedSubjects.length === 0) return 0;

  const subjects = await prisma.studySubject.findMany({
    where: { id: { in: lastCompletedSubjects } },
    select: { name: true }
  });
  const subjectNames = subjects.map(s => s.name);

  let lastCycleDay = null;
  for (const name of subjectNames) {
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

  if (lastCycleDay === null) return 0;

  const targetCycleDay = (lastCycleDay + 1) % 3;
  return (targetCycleDay - (currentDayNumber - 1) % 3 + 3) % 3;
}

function getFallbackSubjectForSlot(
  eligibleSubjects: any[],
  allPendingBlocks: any[],
  scheduledBlockIds: Set<string>,
  scheduleItemsData: any[],
  newItemsToCreate: any[],
  updatesList: any[],
  dayNumber: number,
  lastCompletedSubjectIds: string[] = []
) {
  const fallbackCandidates = eligibleSubjects.filter(s => {
    return allPendingBlocks.some((b: any) =>
      b.subjectId === s.id &&
      !scheduledBlockIds.has(b.id)
    );
  });

  if (fallbackCandidates.length === 0) return null;

  // Encontrar matérias estudadas no dia anterior (em memória ou no histórico do banco)
  let prevDayWithTheory = dayNumber - 1;
  let prevDaySubjects: string[] = [];
  while (prevDayWithTheory > 0 && prevDaySubjects.length === 0) {
    prevDaySubjects = [
      ...scheduleItemsData.filter((item: any) => item.dayNumber === prevDayWithTheory && item.actionType === "THEORY").map((item: any) => item.subjectId),
      ...newItemsToCreate.filter((item: any) => item.dayNumber === prevDayWithTheory && item.actionType === "THEORY").map((item: any) => item.subjectId),
      ...updatesList.filter((item: any) => item.dayNumber === prevDayWithTheory && item.actionType === "THEORY").map((item: any) => item.subjectId)
    ];
    if (prevDaySubjects.length === 0) {
      prevDayWithTheory--;
    }
  }

  if (prevDaySubjects.length === 0) {
    prevDaySubjects = lastCompletedSubjectIds || [];
  }

  // Filtrar candidatos que não foram estudados no dia anterior
  const nonRepeatedCandidates = fallbackCandidates.filter(s => !prevDaySubjects.includes(s.id));
  
  // Se existirem matérias não repetidas com blocos pendentes, usamos apenas elas.
  // Caso contrário, recorre a todos os candidatos (exceção se todas estiverem indisponíveis).
  const finalCandidates = nonRepeatedCandidates.length > 0 ? nonRepeatedCandidates : fallbackCandidates;

  const flattenedCycle = TRT4_STRATEGY.cycle.flat();
  const getCycleOrder = (name: string) => {
    const idx = flattenedCycle.findIndex(cName => 
      cName.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(cName.toLowerCase())
    );
    return idx === -1 ? 999 : idx;
  };

  const getPriorityRank = (priority: string) => {
    if (priority === "PRIMARY") return 2;
    if (priority === "ACTIVE") return 1;
    return 0;
  };

  const candidatesWithScores = finalCandidates.map(s => {
    const recentTheoryItems = [
      ...scheduleItemsData.filter((item: any) => item.subjectId === s.id && item.actionType === "THEORY"),
      ...newItemsToCreate.filter((item: any) => item.subjectId === s.id && item.actionType === "THEORY"),
      ...updatesList.filter((item: any) => item.subjectId === s.id && item.actionType === "THEORY")
    ];

    const windowStartDay = Math.max(1, dayNumber - 10);
    const occurrencesInWindow = recentTheoryItems.filter((item: any) => 
      item.dayNumber >= windowStartDay && 
      item.dayNumber < dayNumber
    ).length;

    let lastDayStudied = 0;
    recentTheoryItems.forEach((item: any) => {
      if (item.dayNumber < dayNumber && item.dayNumber > lastDayStudied) {
        lastDayStudied = item.dayNumber;
      }
    });

    const daysSinceLastStudy = lastDayStudied > 0 ? (dayNumber - lastDayStudied) : 14;

    const studiedYesterday = (lastDayStudied === dayNumber - 1);
    const penaltyYesterday = studiedYesterday ? 15 : 0;

    const last7DaysStart = Math.max(1, dayNumber - 7);
    const occurrencesLast7Days = recentTheoryItems.filter((item: any) => 
      item.dayNumber >= last7DaysStart && 
      item.dayNumber < dayNumber
    ).length;
    const penaltySaturated = occurrencesLast7Days >= 2 ? 10 : 0;

    const score = (daysSinceLastStudy * 3) - (occurrencesInWindow * 4) - penaltyYesterday - penaltySaturated;

    return {
      subject: s,
      score,
      occurrencesInWindow,
      daysSinceLastStudy
    };
  });

  candidatesWithScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.occurrencesInWindow !== b.occurrencesInWindow) {
      return a.occurrencesInWindow - b.occurrencesInWindow;
    }
    if (b.daysSinceLastStudy !== a.daysSinceLastStudy) {
      return b.daysSinceLastStudy - a.daysSinceLastStudy;
    }
    const pA = getPriorityRank(a.subject.studyPriority);
    const pB = getPriorityRank(b.subject.studyPriority);
    if (pB !== pA) {
      return pB - pA;
    }
    const cOrderA = getCycleOrder(a.subject.name);
    const cOrderB = getCycleOrder(b.subject.name);
    if (cOrderA !== cOrderB) {
      return cOrderA - cOrderB;
    }
    return a.subject.id.localeCompare(b.subject.id);
  });

  return candidatesWithScores[0]?.subject || null;
}

// ─── Smart Schedule Generator ─────────────────────────────────────────────────

export interface ScheduleGenerationResult {
  schedule: any;
  itemsCount: number;
  warning?: {
    message: string;
    unallocatedBlocksCount: number;
    exceededMinutes: number;
    suggestion: string;
  } | null;
  schedulerWarnings?: SchedulerWarning[];
}

export async function generateSmartSchedule(
  userId: string,
  options: SmartScheduleOptions = {}
): Promise<ScheduleGenerationResult> {
  // Buscar preferências de dias de estudo do usuário
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });

  const mode = userPrefs?.scheduleGenerationMode || "DYNAMIC";

  if (mode === "LEGACY_TRT4") {
    return generateLegacyTrt4Schedule(userId, options, userPrefs);
  } else {
    return generateDynamicSchedule(userId, options, userPrefs);
  }
}

export async function generateLegacyTrt4Schedule(
  userId: string,
  options: SmartScheduleOptions,
  userPrefs: any
): Promise<ScheduleGenerationResult> {
  const {
    title = "Meu Cronograma de Estudos",
    dailyMinutes = 120,
  } = options;

  const schedulerWarnings: SchedulerWarning[] = [];

  const studyDaysStr = userPrefs?.studyDaysOfWeek || "1,2,3,4,5,6,0";
  const studyDays = studyDaysStr.split(",").map((d: any) => parseInt(d.trim(), 10)).filter((n: any) => !isNaN(n));

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

  // Frente B: Buscar matérias e contagem real de dias de estudo concluídos do histórico
  const lastCompletedSubjectIds = await getLastCompletedTheorySubjectIds(userId);
  const uniqueCompletedCount = await getUniqueCompletedTheoryDaysCount(userId);

  let currentDate = new Date(startDate);
  let nextStudyDayNumber = uniqueCompletedCount + 1;
  const cycleOffset = await getCycleOffset(userId, nextStudyDayNumber);

  while (currentDate.getTime() <= deadline.getTime()) {
    const isStudy = isStudyDay(currentDate, studyDays);
    
    if (isStudy) {
      const candidateDate = new Date(currentDate);
      const dayNumber = nextStudyDayNumber;
      nextStudyDayNumber++;
      
      const cycleDay = (dayNumber - 1 + cycleOffset) % TRT4_STRATEGY.cycle.length;
      
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

      if (activeSecondarySubjects.length > 0 && cycleDay === 0) {
        const secSubject = activeSecondarySubjects[activeSecondaryIndex % activeSecondarySubjects.length];
        subName2 = secSubject.name;
        activeSecondaryIndex++;
      }

      const subject1 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName1.toLowerCase()));
      const subject2 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName2.toLowerCase()));

      const subjectsToSchedule = [subject1, subject2].filter((s): s is typeof eligibleSubjects[number] => !!s);
      const theoryMinutes = dailyMinutes - 30;
      let remainingTheoryMinutes = theoryMinutes;

      for (let i = 0; i < subjectsToSchedule.length; i++) {
        const targetSubject = subjectsToSchedule[i];

        // Encontra o próximo bloco
        let nextBlock = allPendingBlocks.find((b: any) =>
          b.subjectId === targetSubject.id &&
          !scheduledBlockIds.has(b.id)
        );

        // Se não encontrar, aciona fallback balanceado para preencher o slot obrigatório
        if (!nextBlock) {
          const fallbackSubject = getFallbackSubjectForSlot(
            eligibleSubjects,
            allPendingBlocks,
            scheduledBlockIds,
            scheduleItemsData,
            [],
            [],
            dayNumber,
            lastCompletedSubjectIds
          );
          if (fallbackSubject) {
            nextBlock = allPendingBlocks.find((b: any) =>
              b.subjectId === fallbackSubject.id &&
              !scheduledBlockIds.has(b.id)
            );
          }
        }

        if (nextBlock) {
          // Evitar duplicidade de studyBlockId no mesmo dia
          const dayBlockIds = scheduleItemsData
            .filter((item: any) => item.dayNumber === dayNumber && item.studyBlockId)
            .map((item: any) => item.studyBlockId);

          if (dayBlockIds.includes(nextBlock.id)) {
            // Para evitar loop infinito, marca como agendado em memória temporária
            scheduledBlockIds.add(nextBlock.id);
            continue;
          }

          const blockSubject = nextBlock.subject || eligibleSubjects.find((s: any) => s.id === nextBlock.subjectId) || targetSubject;
          let blockMins = 0;
          try {
            blockMins = await getOrComputeBlockMinutes(nextBlock, blockSubject.name);
          } catch (err) {
            if (err instanceof HybridScheduleIntegrityError) {
              // Loop-prevention: add to scheduledBlockIds so this block is not retried
              // in the current run. This does NOT represent a successful schedule entry.
              scheduledBlockIds.add(nextBlock.id);
              schedulerWarnings.push({
                code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
                blockId: nextBlock.id,
                message: err.message,
              });
              continue;
            }
            throw err;
          }
          const isFallback = nextBlock.subjectId !== targetSubject.id;
          const reasonText = isFallback 
            ? `Roteiro: Teoria de ${blockSubject.name} (Fallback)` 
            : `Roteiro: Teoria de ${blockSubject.name}`;

          scheduleItemsData.push({
            userId,
            scheduleId: schedule.id,
            subjectId: nextBlock.subjectId,
            studyBlockId: nextBlock.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: reasonText,
            dayNumber,
            scheduledDate: candidateDate,
            estimatedMinutes: blockMins,
            status: "PENDING",
          });

          scheduledBlockIds.add(nextBlock.id);
          remainingTheoryMinutes -= blockMins;
        }
      }

      // C. Terceiro bloco complementar por capacidade (Direito Civil ou fallback)
      if (remainingTheoryMinutes >= 30) {
        const civilSubject = eligibleSubjects.find(s => s.name.toLowerCase().includes("direito civil"));
        let thirdBlock = null;

        if (civilSubject) {
          thirdBlock = allPendingBlocks.find((b: any) =>
            b.subjectId === civilSubject.id &&
            !scheduledBlockIds.has(b.id)
          );
        }

        // Se Direito Civil não tiver blocos, aciona fallback balanceado
        if (!thirdBlock) {
          const fallbackSubject = getFallbackSubjectForSlot(
            eligibleSubjects,
            allPendingBlocks,
            scheduledBlockIds,
            scheduleItemsData,
            [],
            [],
            dayNumber,
            lastCompletedSubjectIds
          );
          if (fallbackSubject) {
            thirdBlock = allPendingBlocks.find((b: any) =>
              b.subjectId === fallbackSubject.id &&
              !scheduledBlockIds.has(b.id)
            );
          }
        }

        if (thirdBlock) {
          // Evitar duplicidade de studyBlockId no mesmo dia
          const dayBlockIds = scheduleItemsData
            .filter((item: any) => item.dayNumber === dayNumber && item.studyBlockId)
            .map((item: any) => item.studyBlockId);

          if (!dayBlockIds.includes(thirdBlock.id)) {
            const blockSubject = thirdBlock.subject || eligibleSubjects.find((s: any) => s.id === thirdBlock.subjectId) || civilSubject;
            let blockMins = 0;
            try {
              blockMins = await getOrComputeBlockMinutes(thirdBlock, blockSubject?.name || "Complementar");
            } catch (err) {
              if (err instanceof HybridScheduleIntegrityError) {
                schedulerWarnings.push({
                  code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
                  blockId: thirdBlock.id,
                  message: err.message,
                });
                continue;
              }
              throw err;
            }

            // Só adiciona se o bloco complementar não estourar de forma relevante
            if (blockMins <= remainingTheoryMinutes + 15) {
              scheduleItemsData.push({
                userId,
                scheduleId: schedule.id,
                subjectId: thirdBlock.subjectId,
                studyBlockId: thirdBlock.id,
                actionType: "THEORY",
                priorityScore: 80, // prioridade complementar
                reason: `Roteiro: Teoria de ${blockSubject?.name || "Complementar"} (Complemento)`,
                dayNumber,
                scheduledDate: candidateDate,
                estimatedMinutes: blockMins,
                status: "PENDING",
              });

              scheduledBlockIds.add(thirdBlock.id);
              remainingTheoryMinutes -= blockMins;
            }
          }
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

  return { schedule, itemsCount: scheduleItemsData.length, schedulerWarnings };
}

async function generateDynamicSchedule(
  userId: string,
  options: SmartScheduleOptions,
  userPrefs: any
): Promise<ScheduleGenerationResult> {
  const {
    title = "Meu Cronograma de Estudos",
    dailyMinutes = 120,
  } = options;

  const schedulerWarnings: SchedulerWarning[] = [];

  const studyDaysStr = userPrefs?.studyDaysOfWeek || "1,2,3,4,5,6,0";
  const studyDays = studyDaysStr.split(",").map((d: any) => parseInt(d.trim(), 10)).filter((n: any) => !isNaN(n));

  const startDate = options.startDate ?? new Date();
  startDate.setHours(0, 0, 0, 0);

  // 1. Obter matérias do usuário (Ignorando EXCLUDED e SECONDARY)
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId },
  });
  const eligibleSubjects = userSubjects.filter(
    s => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE"
  );

  // 2. Buscar todos os blocos pendentes das matérias elegíveis
  const allPendingBlocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: { not: "COMPLETED" },
      subjectId: { in: eligibleSubjects.map(s => s.id) },
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

  // Agrupar blocos pendentes por matéria e filtrar apenas matérias que POSSUEM blocos pendentes
  const blocksBySubject: Record<string, typeof allPendingBlocks> = {};
  const subjectsWithBlocks = eligibleSubjects.filter(s => {
    const pending = allPendingBlocks.filter((b: any) => b.subjectId === s.id);
    if (pending.length > 0) {
      // Ordenação natural
      pending.sort((a: any, b: any) => {
        const fileA = a.material?.fileName || "";
        const fileB = b.material?.fileName || "";
        const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
        if (fileCompare !== 0) return fileCompare;
        return a.orderIndex - b.orderIndex;
      });
      blocksBySubject[s.id] = pending;
      return true;
    } else {
      console.log(`Matéria ignorada na geração: sem blocos pendentes - ${s.name}`);
      return false;
    }
  });

  // Se não houver matérias com blocos pendentes, criar o cronograma vazio
  if (subjectsWithBlocks.length === 0) {
    await (prisma as any).studySchedule.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
    const schedule = await (prisma as any).studySchedule.create({
      data: {
        userId,
        title,
        dailyStudyMinutes: dailyMinutes,
        startDate,
        status: "ACTIVE",
      },
    });
    return { schedule, itemsCount: 0 };
  }

  // 3. Arquivar cronogramas ativos anteriores
  await (prisma as any).studySchedule.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });

  // 4. Criar o novo cronograma
  const schedule = await (prisma as any).studySchedule.create({
    data: {
      userId,
      title,
      dailyStudyMinutes: dailyMinutes,
      startDate,
      status: "ACTIVE",
    },
  });

  // 5. Mapeamento de Pesos
  const PRIORITY_WEIGHTS: Record<string, number> = {
    PRIMARY: 3,
    ACTIVE: 2,
    SECONDARY: 1,
  };

  // 6. Preparar controle de distribuição
  const scheduledMinutesBySubject: Record<string, number> = {};
  for (const s of subjectsWithBlocks) {
    scheduledMinutesBySubject[s.id] = 0;
  }

  // 7. Definir Deadline de Estudos
  let deadline = new Date("2026-11-30T23:59:59");
  if (userPrefs?.deadline) {
    deadline = new Date(userPrefs.deadline);
  } else if (options.daysAhead) {
    deadline = addDays(startDate, options.daysAhead);
  } else {
    // 30 dias por padrão
    deadline = addDays(startDate, 30);
  }
  deadline.setHours(23, 59, 59, 999);

  // 8. Distribuir tarefas
  const scheduleItemsData: any[] = [];
  let currentDate = new Date(startDate);
  let nextStudyDayNumber = 1;

  while (currentDate.getTime() <= deadline.getTime()) {
    const isStudy = isStudyDay(currentDate, studyDays);

    if (isStudy) {
      const candidateDate = new Date(currentDate);
      const dayNumber = nextStudyDayNumber;
      nextStudyDayNumber++;

      // A. Lembrete SRS diário (30 min)
      scheduleItemsData.push({
        userId,
        scheduleId: schedule.id,
        subjectId: subjectsWithBlocks[0]?.id || "default",
        actionType: "REVIEW_FLASHCARDS",
        priorityScore: 100,
        reason: "Sessão diária de Revisão de Cards (SRS)",
        dayNumber,
        scheduledDate: candidateDate,
        estimatedMinutes: 30,
        status: "PENDING",
      });

      // B. Selecionar as 2 matérias do dia com base no menor quociente: minutosEstudados / peso
      const getCandidates = () => {
        return subjectsWithBlocks
          .filter(s => (blocksBySubject[s.id]?.length || 0) > 0)
          .map(s => {
            const priorityKey = s.studyPriority as keyof typeof PRIORITY_WEIGHTS;
            const weight = PRIORITY_WEIGHTS[priorityKey] || 1;
            const mins = scheduledMinutesBySubject[s.id] || 0;
            return { subject: s, ratio: mins / weight, weight };
          })
          .sort((a, b) => a.ratio - b.ratio || b.weight - a.weight);
      };

      const candidates = getCandidates();
      
      // Se não houver candidatos com blocos pendentes, paramos a geração antecipadamente
      if (candidates.length === 0) {
        break;
      }

      // Escolher até 2 matérias
      const subjectsToSchedule = candidates.slice(0, 2).map(c => c.subject);

      const theoryMinutes = dailyMinutes - 30;
      const targetPerSubject = theoryMinutes / subjectsToSchedule.length;
      let remainingTheoryMinutes = theoryMinutes;
      let scheduledTodayCount = 0;

      for (let i = 0; i < subjectsToSchedule.length; i++) {
        if (remainingTheoryMinutes <= 0) break;

        const subject = subjectsToSchedule[i];
        const targetForThisSubject = i === subjectsToSchedule.length - 1 
          ? remainingTheoryMinutes 
          : Math.min(targetPerSubject, remainingTheoryMinutes);

        let scheduledMinsForSubject = 0;

        while (scheduledMinsForSubject < targetForThisSubject && remainingTheoryMinutes > 0) {
          const nextBlock = blocksBySubject[subject.id]?.[0];
          if (!nextBlock) break;

          let blockMins = 0;
          try {
            blockMins = await getOrComputeBlockMinutes(nextBlock, subject.name);
          } catch (err) {
            if (err instanceof HybridScheduleIntegrityError) {
              blocksBySubject[subject.id].shift();
              schedulerWarnings.push({
                code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
                blockId: nextBlock.id,
                message: err.message,
              });
              continue;
            }
            throw err;
          }

          // Regra de limite: se já agendamos algum bloco hoje, o próximo bloco deve caber no tempo restante
          if (scheduledTodayCount > 0 && blockMins > remainingTheoryMinutes) {
            break;
          }

          // Agendar
          scheduleItemsData.push({
            userId,
            scheduleId: schedule.id,
            subjectId: subject.id,
            studyBlockId: nextBlock.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: `Roteiro: Teoria de ${subject.name}`,
            dayNumber,
            scheduledDate: candidateDate,
            estimatedMinutes: blockMins,
            status: "PENDING",
          });

          blocksBySubject[subject.id].shift();

          scheduledMinsForSubject += blockMins;
          scheduledMinutesBySubject[subject.id] = (scheduledMinutesBySubject[subject.id] || 0) + blockMins;
          remainingTheoryMinutes -= blockMins;
          scheduledTodayCount++;
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  // 9. Salvar em batch
  if (scheduleItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: scheduleItemsData,
    });
  }

  // 10. Processar avisos de deadline insuficiente
  const unallocatedBlocks: any[] = [];
  let exceededMinutes = 0;

  for (const subjectId in blocksBySubject) {
    const remaining = blocksBySubject[subjectId];
    if (remaining.length > 0) {
      for (const block of remaining) {
        unallocatedBlocks.push({
          id: block.id,
          title: block.title,
          subjectName: block.subject?.name
        });
        let mins = 0;
        try {
          mins = await getOrComputeBlockMinutes(block, block.subject?.name || "");
        } catch (err) {
          if (err instanceof HybridScheduleIntegrityError) {
            schedulerWarnings.push({
              code: "HYBRID_BLOCK_SKIPPED_INVALID_ESTIMATE",
              blockId: block.id,
              message: err.message,
            });
            continue;
          }
          throw err;
        }
        exceededMinutes += mins;
      }
    }
  }

  const warning = unallocatedBlocks.length > 0 ? {
    message: "O volume de conteúdo excede a disponibilidade até o prazo informado.",
    unallocatedBlocksCount: unallocatedBlocks.length,
    exceededMinutes,
    suggestion: "Considere aumentar sua meta diária de estudos, ampliar o prazo final (deadline) ou reduzir a prioridade de algumas matérias."
  } : null;

  return { 
    schedule, 
    itemsCount: scheduleItemsData.length,
    warning,
    schedulerWarnings,
  };
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

  // Buscar matérias EXCLUDED ou SECONDARY do usuário para purga
  const excludedSubjects = await prisma.studySubject.findMany({
    where: { userId, studyPriority: { in: ["EXCLUDED", "SECONDARY"] } },
    select: { id: true }
  });
  const excludedSubjectIds = excludedSubjects.map(s => s.id);

  let excludedItemsPurgedCount = 0;
  if (excludedSubjectIds.length > 0) {
    excludedItemsPurgedCount = await (prisma as any).studyScheduleItem.count({
      where: {
        userId,
        subjectId: { in: excludedSubjectIds },
        status: { in: ["PENDING", "IN_PROGRESS"] }
      }
    });

    if (!dryRun) {
      await (prisma as any).studyScheduleItem.deleteMany({
        where: {
          userId,
          subjectId: { in: excludedSubjectIds },
          status: { in: ["PENDING", "IN_PROGRESS"] }
        }
      });
    }
  }
  
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
      lastDateAfterReorganization: todayStr,
      excludedItemsPurgedCount
    };
  }

  // Se dryRun for true, ignoramos itens pendentes/em andamento de matérias EXCLUDED em memória
  const allItems = activeSchedule.items.filter(
    (item: any) => !(excludedSubjectIds.includes(item.subjectId) && (item.status === "PENDING" || item.status === "IN_PROGRESS"))
  );

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

  // IDEMPOTÊNCIA: Se não houver nenhum item pendente elegível no cronograma, não há nada a fazer!
  if (eligiblePendingItems.length === 0) {
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
      lastDateAfterReorganization: maxDateStr,
      excludedItemsPurgedCount
    };
  }

  // A data inicial a partir da qual as coisas serão agendadas:
  const allocationStartDate = preserveToday 
    ? getTodayRangeSP(now, 1).start 
    : todayStart;

  const tomorrowStart = getTodayRangeSP(now, 1).start;
  const preservedTodayCount = preserveToday
    ? allItems.filter(
        item => item.scheduledDate &&
                item.scheduledDate >= todayStart &&
                item.scheduledDate < tomorrowStart
      ).length
    : 0;

  // Buscar dias de estudo nas preferências do usuário
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  const studyDaysStr = userPrefs?.studyDaysOfWeek || "1,2,3,4,5,6,0";
  const studyDays = studyDaysStr.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));

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

  // --- ALGORITMO DE FILA DE CARRYOVER COM META DE TEORIA (90 MIN) ---

  // 1. Obter matérias elegíveis do usuário (Ignorando EXCLUDED e SECONDARY)
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId }
  });
  const eligibleSubjects = userSubjects.filter(
    s => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE"
  );
  const eligibleSubjectIds = eligibleSubjects.map(s => s.id);
  let activeSecondaryIndex = 0;
  const activeSecondarySubjects = eligibleSubjects.filter(s => s.studyPriority === "ACTIVE");

  // Filtrar itens apenas das matérias elegíveis
  const activeEligiblePendingItems = eligiblePendingItems.filter(
    item => eligibleSubjectIds.includes(item.subjectId)
  );

  // Separar THEORY de outros tipos (como REVIEW_BLOCK)
  const eligiblePendingTheory = activeEligiblePendingItems.filter(item => item.actionType === "THEORY");
  const eligiblePendingOther = activeEligiblePendingItems.filter(item => item.actionType !== "THEORY");

  // THEORY: Pendentes atrasados (< todayStart) e futuros (>= allocationStartDate)
  const overdueTheory = eligiblePendingTheory.filter(
    item => item.scheduledDate && item.scheduledDate < todayStart
  );
  const futureTheory = eligiblePendingTheory.filter(
    item => item.scheduledDate && item.scheduledDate >= allocationStartDate
  );

  // Ordenar de forma determinística
  const sortItems = (list: typeof eligiblePendingTheory) => {
    list.sort((a, b) => {
      if (a.scheduledDate!.getTime() !== b.scheduledDate!.getTime()) {
        return a.scheduledDate!.getTime() - b.scheduledDate!.getTime();
      }
      return (a.dayNumber || 0) - (b.dayNumber || 0);
    });
  };
  sortItems(overdueTheory);
  sortItems(futureTheory);

  // Fila principal de teoria: dívida/atrasados primeiro
  const theoryQueue = [...overdueTheory, ...futureTheory];

  // Outros tipos (REVIEW_BLOCK / SUPPORT):
  // Atrasados: movidos para firstStudyDate (não consomem slot de teoria, não bloqueiam)
  const overdueOther = eligiblePendingOther.filter(
    item => item.scheduledDate && item.scheduledDate < todayStart
  );

  // Configurar conjunto de blocos agendados para evitar duplicações
  const scheduledBlockIds = new Set<string>(
    allItems.filter(item => item.status === "COMPLETED" && item.studyBlockId).map(item => item.studyBlockId!)
  );
  for (const item of theoryQueue) {
    if (item.studyBlockId) {
      scheduledBlockIds.add(item.studyBlockId);
    }
  }

  // Buscar todos os blocos pendentes das matérias elegíveis no banco de dados para gap-filling
  const dbPendingBlocks = await (prisma as any).studyBlock.findMany({
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

  dbPendingBlocks.sort((a: any, b: any) => {
    const fileA = a.material?.fileName || "";
    const fileB = b.material?.fileName || "";
    const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    if (fileCompare !== 0) return fileCompare;
    return a.orderIndex - b.orderIndex;
  });

  // Blocos novos que podem ser agendados
  const availableNewBlocks = dbPendingBlocks.filter((block: any) => !scheduledBlockIds.has(block.id));
  const blocksBySubject: Record<string, typeof dbPendingBlocks> = {};
  for (const block of availableNewBlocks) {
    if (!blocksBySubject[block.subjectId]) {
      blocksBySubject[block.subjectId] = [];
    }
    blocksBySubject[block.subjectId].push(block);
  }

  // Identificar a data limite original do cronograma
  const allDates = allItems.map(item => item.scheduledDate).filter((d): d is Date => !!d);
  const maxOriginalDate = allDates.length > 0 ? new Date(Math.max(...allDates.map(d => d.getTime()))) : addDays(now, 30);

  // Frente B: Determinar o dayNumber inicial de realocação com base no histórico real de estudos concluídos
  const lastCompletedSubjectIds = await getLastCompletedTheorySubjectIds(userId);
  const uniqueCompletedCount = await getUniqueCompletedTheoryDaysCount(userId);
  const currentDayNumber = uniqueCompletedCount + 1;
  const cycleOffset = await getCycleOffset(userId, currentDayNumber);

  const updatesList: Array<{ id: string; scheduledDate: Date; dayNumber: number; subjectId?: string; actionType?: string }> = [];
  const newItemsToCreate: any[] = [];
  const changesReport: Array<{
    itemId: string;
    actionType: string;
    subjectName: string;
    originalDate: string;
    newDate: string;
  }> = [];

  const assignedDates = new Set<string>();
  const dailyMinutes = activeSchedule.dailyStudyMinutes || 120;
  const targetTheoryMinutes = dailyMinutes - 30; // 90 min

  let currentDate = new Date(firstStudyDate);
  let dayNumber = currentDayNumber;
  let nextItemIndex = 1;
  let iterations = 0;
  const maxIterations = 500; // Safety guard to prevent infinite loops

  // Realocação de outros itens atrasados (REVIEW_BLOCK / SUPPORT)
  for (const item of overdueOther) {
    const origDateStr = getTodayRangeSP(item.scheduledDate!).dateString;
    const destDateStr = getTodayRangeSP(firstStudyDate).dateString;
    const isDateChanged = origDateStr !== destDateStr;
    const isDayChanged = item.dayNumber !== currentDayNumber;

    if (isDateChanged || isDayChanged) {
      updatesList.push({
        id: item.id,
        scheduledDate: new Date(firstStudyDate),
        dayNumber: currentDayNumber,
        subjectId: item.subjectId,
        actionType: item.actionType || undefined
      });
    }

    if (isDateChanged) {
      changesReport.push({
        itemId: item.id,
        actionType: item.actionType || "UNKNOWN",
        subjectName: item.subject?.name || "Sem Matéria",
        originalDate: origDateStr,
        newDate: destDateStr
      });
    }
  }

  // Loop principal de preenchimento dos dias úteis
  while ((theoryQueue.length > 0 || currentDate.getTime() <= maxOriginalDate.getTime()) && iterations < maxIterations) {
    iterations++;
    if (!isStudyDay(currentDate, studyDays)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dateStr = getTodayRangeSP(currentDate).dateString;
    assignedDates.add(dateStr);

    // 1. Somar teoria já agendada e preservada neste dia (se houver, ex: preserveToday)
    let theoryMinutesOnDay = 0;
    const preservedTheoryOnDay = allItems.filter(item => 
      item.scheduledDate && 
      getTodayRangeSP(item.scheduledDate).dateString === dateStr &&
      item.actionType === "THEORY" &&
      !theoryQueue.some(q => q.id === item.id)
    );
    theoryMinutesOnDay = preservedTheoryOnDay.reduce((sum, item) => sum + (item.estimatedMinutes || 45), 0);

    // 2. Alocar teoria pendente da Fila (Frente C: com regra de anti-repetição no carryover)
    const prevDaySubjects = [
      ...preservedTheoryOnDay.filter((item: any) => item.dayNumber === dayNumber - 1).map((item: any) => item.subjectId),
      ...updatesList.filter((item: any) => item.dayNumber === dayNumber - 1 && item.actionType === "THEORY").map((item: any) => item.subjectId),
      ...newItemsToCreate.filter((item: any) => item.dayNumber === dayNumber - 1 && item.actionType === "THEORY").map((item: any) => item.subjectId)
    ];
    if (prevDaySubjects.length === 0) {
      prevDaySubjects.push(...lastCompletedSubjectIds);
    }

    const mode = userPrefs?.scheduleGenerationMode || "DYNAMIC";
    let cycleSubjects: string[] = [];
    if (mode === "LEGACY_TRT4") {
      const cycleDay = (dayNumber - 1 + cycleOffset) % TRT4_STRATEGY.cycle.length;
      cycleSubjects = TRT4_STRATEGY.cycle[cycleDay].map(s => s.toLowerCase());
    }

    // Tentativa 1: Alocar itens da fila principal que correspondem às matérias do ciclo de hoje (prioridade)
    if (mode === "LEGACY_TRT4" && cycleSubjects.length > 0) {
      let queueIndex = 0;
      while (queueIndex < theoryQueue.length && theoryMinutesOnDay < targetTheoryMinutes) {
        const nextItem = theoryQueue[queueIndex];
        const nextItemSubjectName = nextItem.subject?.name?.toLowerCase() || "";
        const nextItemSubjectId = nextItem.subjectId;

        // Verificar se pertence ao ciclo de hoje
        const matchesCycle = cycleSubjects.some(subName => nextItemSubjectName.includes(subName));
        if (!matchesCycle) {
          queueIndex++;
          continue;
        }

        const isRepeated = prevDaySubjects.includes(nextItemSubjectId);
        const hasNonRepeatedInQueue = theoryQueue.slice(queueIndex).some(item => 
          cycleSubjects.some(subName => (item.subject?.name?.toLowerCase() || "").includes(subName)) && 
          !prevDaySubjects.includes(item.subjectId)
        );

        if (isRepeated && hasNonRepeatedInQueue) {
          queueIndex++;
          continue;
        }

        // Remover da fila e agendar
        theoryQueue.splice(queueIndex, 1);
        const origDateStr = getTodayRangeSP(nextItem.scheduledDate!).dateString;
        const isDateChanged = origDateStr !== dateStr;
        const isDayChanged = nextItem.dayNumber !== dayNumber;

        if (isDateChanged || isDayChanged) {
          updatesList.push({
            id: nextItem.id,
            scheduledDate: new Date(currentDate),
            dayNumber,
            subjectId: nextItem.subjectId,
            actionType: nextItem.actionType || undefined
          });
        }

        if (isDateChanged) {
          changesReport.push({
            itemId: nextItem.id,
            actionType: "THEORY",
            subjectName: nextItem.subject?.name || "Sem Matéria",
            originalDate: origDateStr,
            newDate: dateStr
          });
        }

        theoryMinutesOnDay += nextItem.estimatedMinutes || 45;
      }
    }

    // Tentativa 2: Alocar qualquer outro item da fila (fallback/carryover)
    let queueIndex = 0;
    while (queueIndex < theoryQueue.length && theoryMinutesOnDay < targetTheoryMinutes) {
      const nextItem = theoryQueue[queueIndex];
      const nextItemSubjectId = nextItem.subjectId;

      const isRepeated = prevDaySubjects.includes(nextItemSubjectId);
      const hasNonRepeatedInQueue = theoryQueue.slice(queueIndex).some(item => !prevDaySubjects.includes(item.subjectId));

      if (isRepeated && hasNonRepeatedInQueue) {
        queueIndex++;
        continue;
      }

      // Remover da fila e agendar
      theoryQueue.splice(queueIndex, 1);
      const origDateStr = getTodayRangeSP(nextItem.scheduledDate!).dateString;
      const isDateChanged = origDateStr !== dateStr;
      const isDayChanged = nextItem.dayNumber !== dayNumber;

      if (isDateChanged || isDayChanged) {
        updatesList.push({
          id: nextItem.id,
          scheduledDate: new Date(currentDate),
          dayNumber,
          subjectId: nextItem.subjectId,
          actionType: nextItem.actionType || undefined
        });
      }

      if (isDateChanged) {
        changesReport.push({
          itemId: nextItem.id,
          actionType: "THEORY",
          subjectName: nextItem.subject?.name || "Sem Matéria",
          originalDate: origDateStr,
          newDate: dateStr
        });
      }

      theoryMinutesOnDay += nextItem.estimatedMinutes || 45;
    }

    // 3. Gap-filling: Preencher lacunas se theoryMinutesOnDay < targetTheoryMinutes
    if (theoryMinutesOnDay < targetTheoryMinutes) {
      if (mode === "LEGACY_TRT4") {
        const cycleDay = (dayNumber - 1 + cycleOffset) % TRT4_STRATEGY.cycle.length;
        const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];

        // 1. Obter as duas matérias do ciclo
        const subName1 = subjectsTodayNames[0];
        let subName2 = subjectsTodayNames[1];

        // Intercalação de matéria ativa se aplicável
        if (activeSecondarySubjects.length > 0 && cycleDay === 0) {
          const secSubject = activeSecondarySubjects[activeSecondaryIndex % activeSecondarySubjects.length];
          subName2 = secSubject.name;
          activeSecondaryIndex++;
        }

        const subject1 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName1.toLowerCase()));
        const subject2 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName2.toLowerCase()));
        const subjectsToSchedule = [subject1, subject2].filter((s): s is typeof eligibleSubjects[number] => !!s);

        // Para cada uma das duas matérias obrigatórias, tentar agendar um bloco
        for (const targetSubject of subjectsToSchedule) {
          if (theoryMinutesOnDay >= targetTheoryMinutes) break;

          let nextBlock = (blocksBySubject[targetSubject.id] || []).shift();

          // Fallback se não houver mais blocos pendentes para a matéria do ciclo
          if (!nextBlock) {
            const fallbackSubject = getFallbackSubjectForSlot(
              eligibleSubjects,
              dbPendingBlocks, // todos os blocos pendentes da DB
              scheduledBlockIds,
              [], // itens gerados
              newItemsToCreate, // novos itens
              updatesList, // itens atualizados
              dayNumber,
              lastCompletedSubjectIds
            );
            if (fallbackSubject) {
              nextBlock = (blocksBySubject[fallbackSubject.id] || []).shift();
            }
          }

          if (nextBlock) {
            // Evitar duplicidade de studyBlockId no mesmo dia
            const dayBlockIds = [
              ...preservedTheoryOnDay.map((item: any) => item.studyBlockId),
              ...updatesList.filter((item: any) => item.dayNumber === dayNumber).map((item: any) => item.studyBlockId),
              ...newItemsToCreate.filter((item: any) => item.dayNumber === dayNumber).map((item: any) => item.studyBlockId)
            ].filter(Boolean);

            if (dayBlockIds.includes(nextBlock.id)) {
              // Se já foi agendado hoje, marcamos como agendado em memória para evitar loop infinito
              scheduledBlockIds.add(nextBlock.id);
              continue;
            }

            scheduledBlockIds.add(nextBlock.id);
            const blockSubject = nextBlock.subject || eligibleSubjects.find((s: any) => s.id === nextBlock.subjectId) || targetSubject;
            const blockMins = nextBlock.estimatedStudyMinutes || 45;
            const isFallback = nextBlock.subjectId !== targetSubject.id;
            const reasonText = isFallback
              ? `Roteiro: Teoria de ${blockSubject.name} (Fallback — Preenchimento de Lacuna)`
              : `Roteiro: Teoria de ${blockSubject.name} (Preenchimento de Lacuna)`;

            newItemsToCreate.push({
              userId,
              scheduleId: activeSchedule.id,
              subjectId: nextBlock.subjectId,
              studyBlockId: nextBlock.id,
              actionType: "THEORY",
              priorityScore: 90,
              reason: reasonText,
              dayNumber,
              scheduledDate: new Date(currentDate),
              estimatedMinutes: blockMins,
              status: "PENDING"
            });

            changesReport.push({
              itemId: `NEW_${nextItemIndex++}`,
              actionType: "THEORY",
              subjectName: blockSubject.name,
              originalDate: "LACUNA",
              newDate: dateStr
            });

            theoryMinutesOnDay += blockMins;
          }
        }

        // 2. Avaliar terceiro bloco complementar se ainda houver capacidade (>= 30 min e < 90 min)
        const remainingCapacity = targetTheoryMinutes - theoryMinutesOnDay;
        if (remainingCapacity >= 30) {
          const civilSubject = eligibleSubjects.find(s => s.name.toLowerCase().includes("direito civil"));
          let thirdBlock = civilSubject ? (blocksBySubject[civilSubject.id] || []).shift() : null;

          // Se Direito Civil não tiver blocos, aciona fallback
          if (!thirdBlock) {
            const fallbackSubject = getFallbackSubjectForSlot(
              eligibleSubjects,
              dbPendingBlocks,
              scheduledBlockIds,
              [],
              newItemsToCreate,
              updatesList,
              dayNumber,
              lastCompletedSubjectIds
            );
            if (fallbackSubject) {
              thirdBlock = (blocksBySubject[fallbackSubject.id] || []).shift();
            }
          }

          if (thirdBlock) {
            const blockSubject = thirdBlock.subject || eligibleSubjects.find((s: any) => s.id === thirdBlock.subjectId) || civilSubject;
            const blockMins = thirdBlock.estimatedStudyMinutes || 45;

            // Evitar duplicidade de studyBlockId no mesmo dia
            const dayBlockIds = [
              ...preservedTheoryOnDay.map((item: any) => item.studyBlockId),
              ...updatesList.filter((item: any) => item.dayNumber === dayNumber).map((item: any) => item.studyBlockId),
              ...newItemsToCreate.filter((item: any) => item.dayNumber === dayNumber).map((item: any) => item.studyBlockId)
            ].filter(Boolean);

            if (!dayBlockIds.includes(thirdBlock.id)) {
              if (blockMins <= remainingCapacity + 15) {
                scheduledBlockIds.add(thirdBlock.id);

                newItemsToCreate.push({
                  userId,
                  scheduleId: activeSchedule.id,
                  subjectId: thirdBlock.subjectId,
                  studyBlockId: thirdBlock.id,
                  actionType: "THEORY",
                  priorityScore: 80,
                  reason: `Roteiro: Teoria de ${blockSubject?.name || "Complementar"} (Complemento)`,
                  dayNumber,
                  scheduledDate: new Date(currentDate),
                  estimatedMinutes: blockMins,
                  status: "PENDING"
                });

                changesReport.push({
                  itemId: `NEW_${nextItemIndex++}`,
                  actionType: "THEORY",
                  subjectName: blockSubject?.name || "Complementar",
                  originalDate: "LACUNA",
                  newDate: dateStr
                });

                theoryMinutesOnDay += blockMins;
              } else {
                // Devolver o bloco para a fila se estourou muito
                if (civilSubject && thirdBlock.subjectId === civilSubject.id) {
                  blocksBySubject[civilSubject.id].unshift(thirdBlock);
                } else if (thirdBlock.subjectId) {
                  blocksBySubject[thirdBlock.subjectId].unshift(thirdBlock);
                }
              }
            }
          }
        }

      } else {
        // Modo DYNAMIC original
        const subjectsToday = eligibleSubjects;
        let blockFound = true;
        while (theoryMinutesOnDay < targetTheoryMinutes && blockFound) {
          blockFound = false;
          for (const subject of subjectsToday) {
            const subjectBlocks = blocksBySubject[subject.id] || [];
            const nextBlock = subjectBlocks.shift();

            if (nextBlock) {
              blockFound = true;
              scheduledBlockIds.add(nextBlock.id);
              
              newItemsToCreate.push({
                userId,
                scheduleId: activeSchedule.id,
                subjectId: nextBlock.subjectId,
                studyBlockId: nextBlock.id,
                actionType: "THEORY",
                priorityScore: 90,
                reason: `Roteiro: Teoria de ${subject.name} (Preenchimento de Lacuna)`,
                dayNumber,
                scheduledDate: new Date(currentDate),
                estimatedMinutes: nextBlock.estimatedStudyMinutes || 45,
                status: "PENDING"
              });

              changesReport.push({
                itemId: `NEW_${nextItemIndex++}`,
                actionType: "THEORY",
                subjectName: subject.name,
                originalDate: "LACUNA",
                newDate: dateStr
              });

              theoryMinutesOnDay += nextBlock.estimatedStudyMinutes || 45;
              if (theoryMinutesOnDay >= targetTheoryMinutes) break;
            }
          }
        }
      }
    }

    currentDate = addDays(currentDate, 1);
    dayNumber++;
  }

  // Executar transações no banco se dryRun for false
  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      // 1. Atualizar itens existentes
      for (const up of updatesList) {
        await (tx as any).studyScheduleItem.update({
          where: { id: up.id },
          data: {
            scheduledDate: up.scheduledDate,
            dayNumber: up.dayNumber
          }
        });
      }

      // 2. Criar novos itens
      if (newItemsToCreate.length > 0) {
        await (tx as any).studyScheduleItem.createMany({
          data: newItemsToCreate
        });
      }

      // 3. Atualizar cronograma
      await (tx as any).studySchedule.update({
        where: { id: activeSchedule.id },
        data: { updatedAt: now }
      });
    });
  }

  const finalLastDateStr = getTodayRangeSP(addDays(currentDate, -1)).dateString;
  const overdueItemsCount = overdueTheory.length + overdueOther.length;
  const futureItemsShiftedCount = futureTheory.length;
  const mergedReviewBlocksCount = overdueOther.filter(i => i.actionType === "REVIEW_BLOCK").length;

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
    theoryDatesCount: assignedDates.size,
    reviewOnlyDatesCount: 0,
    mergedReviewBlocksCount,
    changes: changesReport,
    lastDateAfterReorganization: finalLastDateStr,
    excludedItemsPurgedCount
  };
}

export async function reorganizeActiveSchedule(userId: string, _daysAheadParam = 30) {
  void _daysAheadParam;
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

