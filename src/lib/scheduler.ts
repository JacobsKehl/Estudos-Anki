import { prisma } from "./prisma";
import { getAdaptiveStudyQueue, StudyTask, ActionType } from "./recommendations/adaptive-scheduler";

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

  // 1. Obter a fila inteligente de tarefas (até 200 para cobrir 30 dias)
  const taskQueue = await getAdaptiveStudyQueue(userId, 200);
  if (taskQueue.length === 0) return null;

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

  // 4. Distribuir tarefas nos dias
  const scheduleItemsData: object[] = [];

  // Separar filas: revisões têm prioridade garantida sobre conteúdo novo
  const reviewTasks = taskQueue.filter(
    (t) => t.type === "REVIEW_BLOCK" || t.type === "REVIEW_FLASHCARDS"
  );
  const contentTasks = taskQueue.filter(
    (t) => !["REVIEW_BLOCK", "REVIEW_FLASHCARDS"].includes(t.type)
  );

  let reviewIdx = 0;
  let contentIdx = 0;

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const candidateDate = addDays(startDate, dayOffset);
    if (!isStudyDay(candidateDate)) continue;

    let dayMinutes = 0;
    const subjectsThisDay = new Set<string>();
    const dayItems: object[] = [];

    // Prioridade 1: revisões de bloco e flashcards (não contam no limite de matérias/dia)
    while (reviewIdx < reviewTasks.length && dayMinutes < dailyMinutes) {
      const task = reviewTasks[reviewIdx];
      if (dayMinutes + task.estimatedMinutes > dailyMinutes) break;

      dayItems.push(buildItem(userId, schedule.id, task, candidateDate, dayOffset + 1));
      dayMinutes += task.estimatedMinutes;
      reviewIdx++;
    }

    // Prioridade 2: conteúdo novo (até subjectsPerDay matérias diferentes)
    let contentScanned = contentIdx;
    while (
      contentScanned < contentTasks.length &&
      subjectsThisDay.size < subjectsPerDay &&
      dayMinutes < dailyMinutes
    ) {
      const task = contentTasks[contentScanned];
      const mins = task.estimatedMinutes > minutesPerSubject
        ? minutesPerSubject
        : task.estimatedMinutes;

      if (
        !subjectsThisDay.has(task.subjectId) &&
        dayMinutes + mins <= dailyMinutes
      ) {
        const cloned = { ...task, estimatedMinutes: mins };
        dayItems.push(buildItem(userId, schedule.id, cloned, candidateDate, dayOffset + 1));
        dayMinutes += mins;
        subjectsThisDay.add(task.subjectId);

        // Marcar como consumida removendo do índice principal
        contentTasks.splice(contentScanned, 1);
      } else {
        contentScanned++;
      }
    }

    scheduleItemsData.push(...dayItems);

    // Parar se não há mais tarefas
    if (reviewIdx >= reviewTasks.length && contentTasks.length === 0) break;
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
