import { prisma } from "./prisma";
import { TRT4_STRATEGY } from "./strategies/trt4";

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

// Enforça 7 dias por semana de estudo conforme regras da cliente
function isStudyDay(date: Date, studyDays: number[] = [0, 1, 2, 3, 4, 5, 6]): boolean {
  return true;
}

function getNextStudyDay(from: Date, studyDays: number[] = [0, 1, 2, 3, 4, 5, 6]): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
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

  const studyDays = [0, 1, 2, 3, 4, 5, 6]; // 7 dias por semana

  const startDate = options.startDate ?? new Date();
  startDate.setHours(0, 0, 0, 0);

  // Calcular dias pendentes de forma rígida até 30/11/2026
  const deadline = new Date("2026-11-30T23:59:59");
  const diffTime = deadline.getTime() - startDate.getTime();
  const daysAhead = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

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

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const candidateDate = addDays(startDate, dayOffset);
    const cycleDay = dayOffset % 6;
    const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];
    const dayNumber = dayOffset + 1;

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
    let subName1 = subjectsTodayNames[0];
    let subName2 = subjectsTodayNames[1];

    if (activeSecondarySubjects.length > 0 && dayOffset % 3 === 0) {
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

  // 5. Salvar em batch
  if (scheduleItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: scheduleItemsData,
    });
  }

  return { schedule, itemsCount: scheduleItemsData.length };
}

export async function reorganizeActiveSchedule(userId: string, daysAheadParam = 30) {
  const now = new Date();
  const studyDays = [0, 1, 2, 3, 4, 5, 6]; // 7 dias por semana

  // 1. Obter matérias do usuário
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId },
  });

  if (userSubjects.length === 0) return null;

  // Filtrar apenas PRIMARY e ACTIVE
  const eligibleSubjects = userSubjects.filter(
    s => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE"
  );
  const eligibleSubjectIds = eligibleSubjects.map(s => s.id);

  // 2. Encontrar o cronograma ativo atual
  const activeSchedule = await (prisma as any).studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: true
    }
  });

  if (!activeSchedule) {
    return generateSmartSchedule(userId);
  }

  // Calcular dias pendentes até 30/11/2026 a partir de hoje
  const deadline = new Date("2026-11-30T23:59:59");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const daysAhead = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // 3. Identificar itens concluídos
  let completedItems = activeSchedule.items.filter((item: any) => item.status === "COMPLETED");

  const completedBlockIdsFromSchedule = new Set<string>();
  completedItems.forEach((item: any) => {
    if (item.studyBlockId) {
      completedBlockIdsFromSchedule.add(item.studyBlockId);
    }
  });

  const dbCompletedBlocks = await (prisma as any).studyBlock.findMany({
    where: { userId, status: "COMPLETED" },
    select: { id: true, subjectId: true, materialId: true, theoryCompletedAt: true, lastStudiedAt: true }
  });

  const missingCompletedItemsData: any[] = [];
  for (const block of dbCompletedBlocks) {
    if (!completedBlockIdsFromSchedule.has(block.id)) {
      missingCompletedItemsData.push({
        userId,
        scheduleId: activeSchedule.id,
        subjectId: block.subjectId,
        materialId: block.materialId,
        studyBlockId: block.id,
        actionType: "THEORY",
        priorityScore: 90,
        reason: "Sincronizado na reorganização (bloco concluído)",
        dayNumber: 1,
        scheduledDate: block.theoryCompletedAt || block.lastStudiedAt || now,
        completedAt: block.theoryCompletedAt || block.lastStudiedAt || now,
        status: "COMPLETED",
      });
    }
  }

  if (missingCompletedItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: missingCompletedItemsData,
    });
    const newItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        scheduleId: activeSchedule.id,
        status: "COMPLETED",
        studyBlockId: { in: missingCompletedItemsData.map(d => d.studyBlockId) }
      }
    });
    completedItems = [...completedItems, ...newItems];
  }

  const completedBlockIds = new Set<string>();
  completedItems.forEach((item: any) => {
    if (item.studyBlockId) {
      completedBlockIds.add(item.studyBlockId);
    }
  });
  dbCompletedBlocks.forEach((b: any) => completedBlockIds.add(b.id));

  // 4. Deletar itens não concluídos
  await (prisma as any).studyScheduleItem.deleteMany({
    where: {
      scheduleId: activeSchedule.id,
      status: { not: "COMPLETED" }
    }
  });

  const completedDays = new Set<number>(completedItems.map((item: any) => item.dayNumber));
  const scheduleItemsData: any[] = [];

  // Buscar todos os blocos pendentes das matérias elegíveis
  const allPendingBlocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: { not: "COMPLETED" },
      id: { notIn: Array.from(completedBlockIds) },
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

  allPendingBlocks.sort((a: any, b: any) => {
    const fileA = a.material?.fileName || "";
    const fileB = b.material?.fileName || "";
    const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    if (fileCompare !== 0) return fileCompare;
    return a.orderIndex - b.orderIndex;
  });

  const scheduledBlockIds = new Set<string>(completedBlockIds);
  let nextAvailableDate = new Date();
  nextAvailableDate.setHours(0, 0, 0, 0);

  let activeSecondaryIndex = 0;
  const activeSecondarySubjects = eligibleSubjects.filter(s => s.studyPriority === "ACTIVE");

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dayNumber = dayOffset + 1;
    
    if (completedDays.has(dayNumber)) continue;

    const candidateDate = new Date(nextAvailableDate);
    nextAvailableDate = addDays(nextAvailableDate, 1);

    const cycleDay = dayOffset % 6;
    const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];

    // A. Lembrete SRS
    scheduleItemsData.push({
      userId,
      scheduleId: activeSchedule.id,
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
    let subName1 = subjectsTodayNames[0];
    let subName2 = subjectsTodayNames[1];

    if (activeSecondarySubjects.length > 0 && dayOffset % 3 === 0) {
      const secSubject = activeSecondarySubjects[activeSecondaryIndex % activeSecondarySubjects.length];
      subName2 = secSubject.name;
      activeSecondaryIndex++;
    }

    const subject1 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName1.toLowerCase()));
    const subject2 = eligibleSubjects.find(s => s.name.toLowerCase().includes(subName2.toLowerCase()));

    const subjectsToSchedule = [subject1, subject2].filter((s): s is typeof eligibleSubjects[number] => !!s);
    const dailyMinutes = activeSchedule.dailyStudyMinutes || 120;
    const theoryMinutes = dailyMinutes - 30;
    const targetPerSubject = theoryMinutes / 2;
    let remainingTheoryMinutes = theoryMinutes;

    for (let i = 0; i < subjectsToSchedule.length; i++) {
      const subject = subjectsToSchedule[i];
      const targetForThisSubject = i === 0 ? Math.min(targetPerSubject, remainingTheoryMinutes) : remainingTheoryMinutes;
      let scheduledMinutesForThisSubject = 0;

      while (scheduledMinutesForThisSubject < targetForThisSubject) {
        let nextBlock = allPendingBlocks.find((b: any) =>
          b.subjectId === subject.id &&
          !scheduledBlockIds.has(b.id)
        );

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
          scheduleId: activeSchedule.id,
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

  if (scheduleItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: scheduleItemsData,
    });
  }

  return { schedule: activeSchedule, itemsCount: completedItems.length + scheduleItemsData.length };
}
