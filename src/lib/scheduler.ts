import { prisma } from "./prisma";
import { StudyTask } from "./recommendations/adaptive-scheduler";
import { TRT4_STRATEGY } from "./strategies/trt4";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmartScheduleOptions {
  title?: string;
  dailyMinutes?: number;    // default: 120 (2 matérias × 60 min)
  startDate?: Date;         // default: hoje
  daysAhead?: number;       // default: 30
  subjectsPerDay?: number;  // default: 2
  minutesPerSubject?: number; // default: 60
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

// Dias úteis de acordo com as preferências do usuário
function isStudyDay(date: Date, studyDays: number[] = [1, 2, 3, 4, 5, 6]): boolean {
  const day = date.getDay(); // 0=Dom, 6=Sab
  return studyDays.includes(day);
}

function getNextStudyDay(from: Date, studyDays: number[] = [1, 2, 3, 4, 5, 6]): Date {
  let d = new Date(from);
  while (!isStudyDay(d, studyDays)) {
    d = addDays(d, 1);
  }
  return d;
}

// ─── Smart Schedule Generator ─────────────────────────────────────────────────

/**
 * Generates an intelligent study schedule based on the adaptive task queue.
 * - Archives existing active schedules
 * - Selects up to 2 subjects/day
 * - Puts overdue reviews first, then new content
 * - Saves actionType, reason, and priorityScore per item
 */
export async function generateSmartSchedule(userId: string, options: SmartScheduleOptions = {}) {
  const {
    title = "Meu Cronograma de Estudos",
    dailyMinutes = 120,
    daysAhead = 30,
    subjectsPerDay = 2,
    minutesPerSubject = 60,
  } = options;

  // Obter dias de estudo das preferências
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  const studyDays = userPrefs?.studyDaysOfWeek
    ? userPrefs.studyDaysOfWeek.split(",").map(Number)
    : [1, 2, 3, 4, 5, 6];

  const startDate = options.startDate ?? getNextStudyDay(new Date(), studyDays);

  // 1. Obter todas as matérias do usuário para mapeamento
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId },
  });

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

  // 4. Distribuir tarefas nos dias seguindo o ciclo TRT4
  const scheduleItemsData: any[] = [];
  const now = new Date();
  
  // Rastrear IDs de blocos já concluídos no banco de dados para evitar reagendar o que já foi estudado
  const dbCompletedBlocks = await (prisma as any).studyBlock.findMany({
    where: { userId, status: "COMPLETED" },
    select: { id: true }
  });
  
  const scheduledBlockIds = new Set<string>(
    dbCompletedBlocks.map((b: any) => b.id)
  );

  // Busca TODOS os blocos pendentes do usuário em uma única consulta rápida, ignorando materiais de apoio
  const allPendingBlocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: { not: "COMPLETED" },
      material: {
        materialRole: {
          not: "SUPPORT_MATERIAL"
        }
      }
    },
    include: {
      material: true
    }
  });

  // Ordenação lógica/natural por nome do PDF (ex: "pdf 0" antes de "pdf 1") e depois pelo orderIndex
  allPendingBlocks.sort((a: any, b: any) => {
    const fileA = a.material?.fileName || "";
    const fileB = b.material?.fileName || "";
    const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    if (fileCompare !== 0) return fileCompare;
    return a.orderIndex - b.orderIndex;
  });

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const candidateDate = addDays(startDate, dayOffset);
    if (!isStudyDay(candidateDate, studyDays)) continue;

    const cycleDay = dayOffset % 6;
    const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];
    const dayNumber = dayOffset + 1;

    // A. Adicionar Reserva de SRS (30 min)
    scheduleItemsData.push({
      userId,
      scheduleId: schedule.id,
      subjectId: userSubjects[0]?.id || "default",
      actionType: "REVIEW_FLASHCARDS",
      priorityScore: 100,
      reason: "Sessão diária de Revisão de Cards (SRS)",
      dayNumber,
      scheduledDate: candidateDate,
      estimatedMinutes: TRT4_STRATEGY.dailySrsMinutes,
      status: "PENDING",
    });

    // B. Adicionar 2 Blocos de Estudo (45 min cada)
    for (const subName of subjectsTodayNames) {
      // Garantir foco estrito nas 7 matérias principais
      const isMain = MAIN_7_SUBJECTS.some(m => m.toLowerCase() === subName.toLowerCase());
      if (!isMain) continue;

      const subject = userSubjects.find(s => s.name.toLowerCase().includes(subName.toLowerCase()));
      
      if (subject) {
        // Verificar regra de início do edital
        const strategySub = TRT4_STRATEGY.subjects.find(s => s.name === subName);
        if (strategySub?.cycleStartAfterDays) {
          const daysSinceSubjectCreated = (now.getTime() - subject.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceSubjectCreated < strategySub.cycleStartAfterDays) {
            continue;
          }
        }

        // Buscar o próximo bloco pendente desta matéria que NÃO esteja agendado (EM MEMÓRIA)
        let nextBlock = allPendingBlocks.find((b: any) =>
          b.subjectId === subject.id &&
          !scheduledBlockIds.has(b.id)
        );

        // Fallback Inteligente: Se não achar bloco para essa matéria do ciclo, busca de outra das 7 matérias principais (EM MEMÓRIA)
        if (!nextBlock) {
          const otherMainSubjects = userSubjects.filter(s => {
            const isOtherMain = MAIN_7_SUBJECTS.some(m => s.name.toLowerCase().includes(m.toLowerCase()));
            return isOtherMain && s.id !== subject.id;
          });

          // Ordenar outras matérias para dar prioridade às Trabalhistas (Trabalho e Processual do Trabalho)
          otherMainSubjects.sort((a, b) => {
            const isATrab = a.name.toLowerCase().includes("trabalho");
            const isBTrab = b.name.toLowerCase().includes("trabalho");
            if (isATrab && !isBTrab) return -1;
            if (!isATrab && isBTrab) return 1;
            return 0;
          });

          for (const otherSub of otherMainSubjects) {
            nextBlock = allPendingBlocks.find((b: any) =>
              b.subjectId === otherSub.id &&
              !scheduledBlockIds.has(b.id)
            );
            if (nextBlock) break;
          }
        }

        if (nextBlock) {
          scheduleItemsData.push({
            userId,
            scheduleId: schedule.id,
            subjectId: nextBlock.subjectId,
            studyBlockId: nextBlock.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: `Ciclo TRT4: Próximo conteúdo de ${subName}`,
            dayNumber,
            scheduledDate: candidateDate,
            estimatedMinutes: TRT4_STRATEGY.minutesPerStudyBlock,
            status: "PENDING",
          });
          
          // Marcar como agendado para não repetir
          scheduledBlockIds.add(nextBlock.id);
        }
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

function buildItem(
  userId: string,
  scheduleId: string,
  task: StudyTask,
  date: Date,
  dayNumber: number
) {
  return {
    userId,
    scheduleId,
    subjectId: task.subjectId,
    studyBlockId: task.studyBlockId ?? null,
    materialId: null,
    actionType: task.type,
    priorityScore: task.priorityScore,
    reason: task.reason,
    dayNumber,
    scheduledDate: date,
    estimatedMinutes: task.estimatedMinutes,
    status: "PENDING",
  };
}

/**
 * Mantém compatibilidade com o gerador anterior (simples).
 * Agora delega para generateSmartSchedule.
 */
export async function generateSimpleSchedule(
  userId: string,
  options: { title: string; dailyMinutes: number; startDate: Date }
) {
  return generateSmartSchedule(userId, {
    title: options.title,
    dailyMinutes: options.dailyMinutes,
    startDate: options.startDate,
  });
}

export async function reorganizeActiveSchedule(userId: string, daysAhead = 30) {
  const now = new Date();

  // Obter dias de estudo das preferências
  const userPrefs = await prisma.userPreferences.findUnique({
    where: { userId }
  });
  const studyDays = userPrefs?.studyDaysOfWeek
    ? userPrefs.studyDaysOfWeek.split(",").map(Number)
    : [1, 2, 3, 4, 5, 6];

  // 1. Obter todas as matérias do usuário para mapeamento
  const userSubjects = await prisma.studySubject.findMany({
    where: { userId },
  });

  if (userSubjects.length === 0) return null;

  // 2. Encontrar o cronograma ativo atual
  const activeSchedule = await (prisma as any).studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: true
    }
  });

  // Se não houver cronograma ativo, gera um novo do zero
  if (!activeSchedule) {
    return generateSmartSchedule(userId, { daysAhead });
  }

  // 3. Identificar os itens já concluídos no cronograma ativo
  let completedItems = activeSchedule.items.filter((item: any) => item.status === "COMPLETED");

  // Rastrear todos os blocos que já possuem itens concluídos no cronograma
  const completedBlockIdsFromSchedule = new Set<string>();
  completedItems.forEach((item: any) => {
    if (item.studyBlockId) {
      completedBlockIdsFromSchedule.add(item.studyBlockId);
    }
  });

  // Rastrear blocos concluídos de fato no banco de dados
  const dbCompletedBlocks = await (prisma as any).studyBlock.findMany({
    where: { userId, status: "COMPLETED" },
    select: { id: true, subjectId: true, materialId: true, theoryCompletedAt: true, lastStudiedAt: true }
  });

  // Para blocos que estão concluídos no banco de dados, mas não possuem um item correspondente
  // no cronograma ativo, criamos o item concluído para manter o histórico e a sincronização.
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
    
    // Atualizar nossa lista local de completedItems com os itens recém-criados
    const newItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        scheduleId: activeSchedule.id,
        status: "COMPLETED",
        studyBlockId: { in: missingCompletedItemsData.map(d => d.studyBlockId) }
      }
    });
    completedItems = [...completedItems, ...newItems];
  }

  // Rastrear todos os blocos concluídos (no banco e no cronograma) para evitar duplicidades
  const completedBlockIds = new Set<string>();
  completedItems.forEach((item: any) => {
    if (item.studyBlockId) {
      completedBlockIds.add(item.studyBlockId);
    }
  });
  dbCompletedBlocks.forEach((b: any) => completedBlockIds.add(b.id));

  // 4. Deletar todos os itens do cronograma ativo que NÃO estão concluídos
  await (prisma as any).studyScheduleItem.deleteMany({
    where: {
      scheduleId: activeSchedule.id,
      status: { not: "COMPLETED" }
    }
  });

  // Identificar quais números de dia já têm tarefas concluídas
  const completedDays = new Set<number>(completedItems.map((item: any) => item.dayNumber));

  // 5. Redistribuir novos blocos pendentes de teoria nos dias livres do ciclo
  const scheduleItemsData: any[] = [];
  const startDate = activeSchedule.startDate ?? getNextStudyDay(new Date(), studyDays);

  // Busca TODOS os blocos pendentes do usuário em uma única consulta rápida, ignorando materiais de apoio
  const allPendingBlocks = await (prisma as any).studyBlock.findMany({
    where: {
      userId,
      status: { not: "COMPLETED" },
      id: { notIn: Array.from(completedBlockIds) },
      material: {
        materialRole: {
          not: "SUPPORT_MATERIAL"
        }
      }
    },
    include: {
      material: true
    }
  });

  // Ordenação lógica/natural por nome do PDF (ex: "pdf 0" antes de "pdf 1") e depois pelo orderIndex
  allPendingBlocks.sort((a: any, b: any) => {
    const fileA = a.material?.fileName || "";
    const fileB = b.material?.fileName || "";
    const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
    if (fileCompare !== 0) return fileCompare;
    return a.orderIndex - b.orderIndex;
  });

  const scheduledBlockIds = new Set<string>(completedBlockIds);

  // A data de início para os novos blocos pendentes deve ser hoje
  let nextAvailableDate = getNextStudyDay(new Date(), studyDays);

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dayNumber = dayOffset + 1;
    
    // Se o dia já possui tarefas concluídas, mantemos intocado!
    if (completedDays.has(dayNumber)) continue;

    const candidateDate = new Date(nextAvailableDate);
    // Avança a data para a próxima iteração
    nextAvailableDate = addDays(nextAvailableDate, 1);

    if (!isStudyDay(candidateDate, studyDays)) continue;

    const cycleDay = dayOffset % 6;
    const subjectsTodayNames = TRT4_STRATEGY.cycle[cycleDay];

    // A. Adicionar Reserva de SRS (30 min) para o Hoje poder carregar
    scheduleItemsData.push({
      userId,
      scheduleId: activeSchedule.id,
      subjectId: userSubjects[0]?.id || "default",
      actionType: "REVIEW_FLASHCARDS",
      priorityScore: 100,
      reason: "Sessão diária de Revisão de Cards (SRS)",
      dayNumber,
      scheduledDate: candidateDate,
      estimatedMinutes: TRT4_STRATEGY.dailySrsMinutes,
      status: "PENDING",
    });

    // B. Adicionar Blocos de Estudo (teoria apenas, sem flashcards repetidos)
    for (const subName of subjectsTodayNames) {
      // Garantir foco estrito nas 7 matérias principais
      const isMain = MAIN_7_SUBJECTS.some(m => m.toLowerCase() === subName.toLowerCase());
      if (!isMain) continue;

      const subject = userSubjects.find(s => s.name.toLowerCase().includes(subName.toLowerCase()));
      
      if (subject) {
        // Verificar regra de início do edital
        const strategySub = TRT4_STRATEGY.subjects.find(s => s.name === subName);
        if (strategySub?.cycleStartAfterDays) {
          const daysSinceSubjectCreated = (now.getTime() - subject.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceSubjectCreated < strategySub.cycleStartAfterDays) {
            continue;
          }
        }

        // Buscar próximo bloco pendente desta matéria que NÃO esteja nas listas de concluídos (EM MEMÓRIA)
        let nextBlock = allPendingBlocks.find((b: any) =>
          b.subjectId === subject.id &&
          !scheduledBlockIds.has(b.id)
        );

        // Fallback Inteligente: Se não achar bloco para essa matéria do ciclo, busca de outra das 7 matérias principais (EM MEMÓRIA)
        if (!nextBlock) {
          const otherMainSubjects = userSubjects.filter(s => {
            const isOtherMain = MAIN_7_SUBJECTS.some(m => s.name.toLowerCase().includes(m.toLowerCase()));
            return isOtherMain && s.id !== subject.id;
          });

          // Ordenar outras matérias para dar prioridade às Trabalhistas (Trabalho e Processual do Trabalho)
          otherMainSubjects.sort((a, b) => {
            const isATrab = a.name.toLowerCase().includes("trabalho");
            const isBTrab = b.name.toLowerCase().includes("trabalho");
            if (isATrab && !isBTrab) return -1;
            if (!isATrab && isBTrab) return 1;
            return 0;
          });

          for (const otherSub of otherMainSubjects) {
            nextBlock = allPendingBlocks.find((b: any) =>
              b.subjectId === otherSub.id &&
              !scheduledBlockIds.has(b.id)
            );
            if (nextBlock) break;
          }
        }

        if (nextBlock) {
          scheduleItemsData.push({
            userId,
            scheduleId: activeSchedule.id,
            subjectId: nextBlock.subjectId,
            studyBlockId: nextBlock.id,
            actionType: "THEORY",
            priorityScore: 90,
            reason: `Ciclo TRT4: Próximo conteúdo de ${subName}`,
            dayNumber,
            scheduledDate: candidateDate,
            estimatedMinutes: TRT4_STRATEGY.minutesPerStudyBlock,
            status: "PENDING",
          });
          
          // Marcar como agendado para evitar duplicidade na mesma sessão
          scheduledBlockIds.add(nextBlock.id);
        }
      }
    }
  }

  // 6. Salvar em batch as novas tarefas pendentes
  if (scheduleItemsData.length > 0) {
    await (prisma as any).studyScheduleItem.createMany({
      data: scheduleItemsData,
    });
  }

  return { schedule: activeSchedule, itemsCount: completedItems.length + scheduleItemsData.length };
}
