import { prisma } from "./prisma";
import { getAdaptiveStudyQueue, StudyTask, ActionType } from "./recommendations/adaptive-scheduler";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Dias úteis: segunda (1) a sábado (6)
function isStudyDay(date: Date): boolean {
  const day = date.getDay(); // 0=Dom, 6=Sab
  return day >= 1 && day <= 6;
}

function getNextStudyDay(from: Date): Date {
  let d = new Date(from);
  while (!isStudyDay(d)) {
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

  const startDate = options.startDate ?? getNextStudyDay(new Date());

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
  
  // Rastrear IDs de blocos já agendados (no banco ou nesta sessão) para evitar duplicidade
  const alreadyScheduledItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId,
      status: { notIn: ["CANCELLED", "ARCHIVED"] },
      studyBlockId: { not: null }
    },
    select: { studyBlockId: true }
  });
  
  const scheduledBlockIds = new Set<string>(
    alreadyScheduledItems.map((i: any) => i.studyBlockId)
  );

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const candidateDate = addDays(startDate, dayOffset);
    if (!isStudyDay(candidateDate)) continue;

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
      const subject = userSubjects.find(s => s.name.toLowerCase().includes(subName.toLowerCase()));
      
      if (subject) {
        // Verificar regra dos 90 dias
        const strategySub = TRT4_STRATEGY.subjects.find(s => s.name === subName);
        if (strategySub?.cycleStartAfterDays) {
          const daysSinceSubjectCreated = (now.getTime() - subject.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceSubjectCreated < strategySub.cycleStartAfterDays) {
            continue;
          }
        }

        // Buscar o próximo bloco pendente desta matéria que NÃO esteja agendado
        const nextBlock = await (prisma as any).studyBlock.findFirst({
          where: {
            subjectId: subject.id,
            userId,
            theoryStatus: "NOT_STARTED",
            id: { notIn: Array.from(scheduledBlockIds) }
          },
          orderBy: { orderIndex: "asc" },
        });

        if (nextBlock) {
          scheduleItemsData.push({
            userId,
            scheduleId: schedule.id,
            subjectId: subject.id,
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
  const completedItems = activeSchedule.items.filter((item: any) => item.status === "COMPLETED");

  // Rastrear todos os blocos concluídos ou já agendados em itens concluídos para evitar duplicidade
  const completedBlockIds = new Set<string>();
  completedItems.forEach((item: any) => {
    if (item.studyBlockId) {
      completedBlockIds.add(item.studyBlockId);
    }
  });

  // Rastrear também blocos concluídos de fato no banco
  const dbCompletedBlocks = await (prisma as any).studyBlock.findMany({
    where: { userId, theoryStatus: "COMPLETED" },
    select: { id: true }
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
  const startDate = activeSchedule.startDate ?? getNextStudyDay(new Date());

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dayNumber = dayOffset + 1;
    
    // Se o dia já possui tarefas concluídas, mantemos intocado!
    if (completedDays.has(dayNumber)) continue;

    const candidateDate = addDays(startDate, dayOffset);
    if (!isStudyDay(candidateDate)) continue;

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

        // Buscar próximo bloco pendente desta matéria que NÃO esteja nas listas de concluídos
        const nextBlock = await (prisma as any).studyBlock.findFirst({
          where: {
            subjectId: subject.id,
            userId,
            theoryStatus: "NOT_STARTED",
            id: { notIn: Array.from(completedBlockIds) }
          },
          orderBy: { orderIndex: "asc" },
        });

        if (nextBlock) {
          scheduleItemsData.push({
            userId,
            scheduleId: activeSchedule.id,
            subjectId: subject.id,
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
          completedBlockIds.add(nextBlock.id);
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
