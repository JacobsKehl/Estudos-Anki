import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";
import { QuestionReviewStatus, QuestionReviewTask, Prisma, QuestionReviewOrigin } from "@prisma/client";

// Constantes conforme regras do plano
const REVIEW_DELAY_DAYS = 15;
const MAX_DAILY_REVIEWS = 2;
const DEFAULT_QUESTION_COUNT = 15;

/**
 * Retorna o dia da semana da data no fuso de São Paulo (0 = Domingo, 1 = Segunda, etc.)
 */
function getSPDayOfWeek(date: Date): number {
  const tzString = date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(tzString).getDay();
}

/**
 * Adiciona dias a uma data
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calcula a data de agendamento ideal respeitando o limite diário de 2 revisões
 * e os dias de estudo configurados do usuário (studyDaysOfWeek).
 */
export async function calculateScheduledDate(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string,
  baseDate: Date
): Promise<Date> {
  // 1. Obter preferências de dias de estudo do usuário
  const prefs = await tx.userPreferences.findUnique({
    where: { userId },
    select: { studyDaysOfWeek: true }
  });

  const activeDays = prefs?.studyDaysOfWeek
    ? prefs.studyDaysOfWeek.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
    : [1, 2, 3, 4, 5]; // Segunda a sexta por padrão

  // Se nenhum dia estiver ativo por algum motivo, ativa todos
  const studyDays = activeDays.length > 0 ? activeDays : [0, 1, 2, 3, 4, 5, 6];

  // 2. Data alvo inicial (D+15 dias)
  let targetDate = addDays(baseDate, REVIEW_DELAY_DAYS);

  // Loop de busca por uma data elegível (limite de segurança de 365 iterações)
  for (let i = 0; i < 365; i++) {
    // A. Validar se cai em dia de estudo do usuário
    const dayOfWeek = getSPDayOfWeek(targetDate);
    if (!studyDays.includes(dayOfWeek)) {
      targetDate = addDays(targetDate, 1);
      continue;
    }

    // Obter o range do dia no fuso horário de São Paulo
    const dayRange = getTodayRangeSP(targetDate);

    // B. Contar revisões PENDING agendadas para este dia
    const pendingCount = await tx.questionReviewTask.count({
      where: {
        userId,
        status: QuestionReviewStatus.PENDING,
        scheduledDate: {
          gte: dayRange.start,
          lt: dayRange.end
        }
      }
    });

    // Se houver espaço (máximo 2 por dia), esta é a data final
    if (pendingCount < MAX_DAILY_REVIEWS) {
      return dayRange.start; // Retorna o início do dia no fuso de SP (como UTC)
    }

    // Senão (overflow), empurra para o dia seguinte e repete
    targetDate = addDays(targetDate, 1);
  }

  // Fallback caso ultrapasse 365 dias (evita loop infinito)
  return targetDate;
}

/**
 * Cria/agenda uma tarefa de revisão por questões para um bloco de teoria específico.
 */
export async function scheduleQuestionReview(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string,
  blockId: string,
  theoryCompletedAt: Date,
  origin: QuestionReviewOrigin = QuestionReviewOrigin.AUTOMATIC
): Promise<QuestionReviewTask | null> {
  // 1. Verificar se já existe uma tarefa de revisão para esse bloco e usuário
  const existing = await tx.questionReviewTask.findFirst({
    where: { userId, studyBlockId: blockId }
  });

  if (existing) {
    console.info(`[scheduleQuestionReview] Já existe revisão por questões para o bloco ${blockId}. Ignorando.`);
    return null;
  }

  // 2. Buscar o bloco e matéria para popular snapshots históricos
  const block = await tx.studyBlock.findUnique({
    where: { id: blockId },
    include: {
      subject: true,
      material: true
    }
  });

  if (!block) {
    throw new Error(`Bloco ${blockId} não encontrado.`);
  }

  // 3. Calcular data agendada com overflow e dias úteis
  const scheduledDate = await calculateScheduledDate(tx, userId, theoryCompletedAt);

  // 4. Criar tarefa com snapshot dos dados originais
  return await tx.questionReviewTask.create({
    data: {
      userId,
      studyBlockId: blockId,
      subjectId: block.subjectId,
      sourceBlockTitle: block.title,
      sourceMaterialName: block.material?.fileName || null,
      sourcePageStart: block.pageStart,
      sourcePageEnd: block.pageEnd,
      sourceSubjectName: block.subject.name,
      sourceStudyDate: theoryCompletedAt,
      scheduledDate,
      status: QuestionReviewStatus.PENDING,
      recommendedQuestionCount: DEFAULT_QUESTION_COUNT,
      origin
    }
  });
}

/**
 * Lista as tarefas de revisão pendentes para o dia especificado (com limite de 2).
 * Aplica a lógica de priorização de matérias diferentes:
 * - 1 assunto de cada matéria por dia, se possível.
 * - Se só houver pendências de uma matéria, lista 2 dela.
 */
export async function getTodayQuestionReviews(
  userId: string,
  date: Date = new Date()
): Promise<QuestionReviewTask[]> {
  const dayRange = getTodayRangeSP(date);

  // 1. Buscar todas as revisões pendentes agendadas até o fim do dia especificado
  // Isso inclui tarefas atrasadas de dias anteriores (scheduledDate <= dayRange.end)
  const pendingTasks = await prisma.questionReviewTask.findMany({
    where: {
      userId,
      status: QuestionReviewStatus.PENDING,
      scheduledDate: {
        lt: dayRange.end
      }
    },
    include: {
      studyBlock: {
        include: {
          material: true
        }
      },
      subject: true
    },
    orderBy: {
      scheduledDate: "asc" // Mais antigas primeiro
    }
  });

  if (pendingTasks.length === 0) {
    return [];
  }

  // 2. Aplicar a lógica de distribuição diária (limite de 2 tarefas, preferindo matérias distintas)
  const selectedTasks: QuestionReviewTask[] = [];
  const subjectIdsSelected = new Set<string>();

  // Passo A: Selecionar a primeira tarefa disponível de cada matéria (priorizando matérias distintas)
  for (const task of pendingTasks) {
    if (selectedTasks.length >= MAX_DAILY_REVIEWS) break;
    if (!subjectIdsSelected.has(task.subjectId)) {
      selectedTasks.push(task);
      subjectIdsSelected.add(task.subjectId);
    }
  }

  // Passo B: Se ainda houver vagas e houver pendências, preencher com o restante
  if (selectedTasks.length < MAX_DAILY_REVIEWS) {
    for (const task of pendingTasks) {
      if (selectedTasks.length >= MAX_DAILY_REVIEWS) break;
      // Se a tarefa ainda não foi selecionada (mesmo que seja de matéria duplicada)
      if (!selectedTasks.some(t => t.id === task.id)) {
        selectedTasks.push(task);
      }
    }
  }

  return selectedTasks;
}

/**
 * Conclui uma tarefa de revisão, salvando métricas do banco de questões.
 */
export async function completeQuestionReview(
  userId: string,
  taskId: string,
  data: {
    questionsAttempted?: number;
    correctCount?: number;
    wrongCount?: number;
    notes?: string;
  }
): Promise<QuestionReviewTask> {
  const task = await prisma.questionReviewTask.findFirst({
    where: { id: taskId, userId }
  });

  if (!task) {
    throw new Error("Tarefa de revisão não encontrada ou acesso não autorizado.");
  }

  return await prisma.questionReviewTask.update({
    where: { id: taskId },
    data: {
      status: QuestionReviewStatus.COMPLETED,
      completedAt: new Date(),
      questionsAttempted: data.questionsAttempted ?? null,
      correctCount: data.correctCount ?? null,
      wrongCount: data.wrongCount ?? null,
      notes: data.notes ?? null
    }
  });
}

/**
 * Pula uma tarefa de revisão (SKIPPED).
 */
export async function skipQuestionReview(
  userId: string,
  taskId: string,
  notes?: string
): Promise<QuestionReviewTask> {
  const task = await prisma.questionReviewTask.findFirst({
    where: { id: taskId, userId }
  });

  if (!task) {
    throw new Error("Tarefa de revisão não encontrada ou acesso não autorizado.");
  }

  return await prisma.questionReviewTask.update({
    where: { id: taskId },
    data: {
      status: QuestionReviewStatus.SKIPPED,
      completedAt: new Date(),
      notes: notes ?? null
    }
  });
}

/**
 * Associa informações do material CFC à revisão de questões (Manual).
 */
export async function updateCfcMapping(
  userId: string,
  taskId: string,
  data: {
    cfcPdfName?: string;
    cfcStartPage?: number;
    cfcEndPage?: number;
    cfcTopic?: string;
    cfcNotes?: string;
  }
): Promise<QuestionReviewTask> {
  const task = await prisma.questionReviewTask.findFirst({
    where: { id: taskId, userId }
  });

  if (!task) {
    throw new Error("Tarefa de revisão não encontrada ou acesso não autorizado.");
  }

  return await prisma.questionReviewTask.update({
    where: { id: taskId },
    data: {
      cfcPdfName: data.cfcPdfName !== undefined ? data.cfcPdfName : task.cfcPdfName,
      cfcStartPage: data.cfcStartPage !== undefined ? data.cfcStartPage : task.cfcStartPage,
      cfcEndPage: data.cfcEndPage !== undefined ? data.cfcEndPage : task.cfcEndPage,
      cfcTopic: data.cfcTopic !== undefined ? data.cfcTopic : task.cfcTopic,
      cfcNotes: data.cfcNotes !== undefined ? data.cfcNotes : task.cfcNotes
    }
  });
}

/**
 * Retorna estatísticas de revisão por questões para o usuário.
 */
export async function getQuestionReviewStats(userId: string) {
  const counts = await prisma.questionReviewTask.groupBy({
    by: ["status"],
    where: { userId },
    _count: { _all: true }
  });

  let totalScheduled = 0;
  let totalCompleted = 0;
  let totalSkipped = 0;

  counts.forEach(c => {
    if (c.status === QuestionReviewStatus.PENDING) totalScheduled += c._count._all;
    if (c.status === QuestionReviewStatus.COMPLETED) {
      totalCompleted += c._count._all;
      totalScheduled += c._count._all;
    }
    if (c.status === QuestionReviewStatus.SKIPPED) {
      totalSkipped += c._count._all;
      totalScheduled += c._count._all;
    }
  });

  // Calcular aproveitamento das questões
  const aggregate = await prisma.questionReviewTask.aggregate({
    where: {
      userId,
      status: QuestionReviewStatus.COMPLETED,
      correctCount: { not: null },
      wrongCount: { not: null }
    },
    _sum: {
      correctCount: true,
      wrongCount: true
    }
  });

  const totalCorrect = aggregate._sum.correctCount || 0;
  const totalWrong = aggregate._sum.wrongCount || 0;
  const totalQuestions = totalCorrect + totalWrong;
  const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Pendentes por matéria
  const pendingTasks = await prisma.questionReviewTask.findMany({
    where: { userId, status: QuestionReviewStatus.PENDING },
    select: { sourceSubjectName: true }
  });

  const subjectCounts: Record<string, number> = {};
  pendingTasks.forEach(t => {
    subjectCounts[t.sourceSubjectName] = (subjectCounts[t.sourceSubjectName] || 0) + 1;
  });

  const pendingBySubject = Object.entries(subjectCounts).map(([subjectName, count]) => ({
    subjectName,
    count
  })).sort((a, b) => b.count - a.count);

  return {
    totalScheduled,
    totalCompleted,
    totalSkipped,
    totalPending: totalScheduled - totalCompleted - totalSkipped,
    averageAccuracy,
    pendingBySubject
  };
}

/**
 * Calcula a data de agendamento ideal para o backfill (começando de amanhã D+1).
 */
export async function calculateBackfillScheduledDate(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string,
  baseDate: Date
): Promise<Date> {
  const prefs = await tx.userPreferences.findUnique({
    where: { userId },
    select: { studyDaysOfWeek: true }
  });

  const activeDays = prefs?.studyDaysOfWeek
    ? prefs.studyDaysOfWeek.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
    : [1, 2, 3, 4, 5];

  const studyDays = activeDays.length > 0 ? activeDays : [0, 1, 2, 3, 4, 5, 6];

  let targetDate = addDays(baseDate, 1);

  for (let i = 0; i < 365; i++) {
    const dayOfWeek = getSPDayOfWeek(targetDate);
    if (!studyDays.includes(dayOfWeek)) {
      targetDate = addDays(targetDate, 1);
      continue;
    }

    const dayRange = getTodayRangeSP(targetDate);

    const pendingCount = await tx.questionReviewTask.count({
      where: {
        userId,
        status: QuestionReviewStatus.PENDING,
        scheduledDate: {
          gte: dayRange.start,
          lt: dayRange.end
        }
      }
    });

    if (pendingCount < MAX_DAILY_REVIEWS) {
      return dayRange.start;
    }

    targetDate = addDays(targetDate, 1);
  }

  return targetDate;
}

export interface BackfillOptions {
  apply?: boolean;
  distributionDays?: number;
  maxPerDay?: number;
}

export interface BackfillResult {
  dryRun: boolean;
  totalEligible: number;
  scheduledCount: number;
  preview: Array<{
    blockTitle: string;
    subjectName: string;
    completedAt: Date | null;
    scheduledDate: Date;
  }>;
}

/**
 * Executa ou simula (dry-run) a carga inicial de revisões por questões do histórico já estudado.
 */
export async function backfillQuestionReviews(
  userId: string,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const apply = options.apply ?? false;
  const maxPerDay = options.maxPerDay ?? MAX_DAILY_REVIEWS;

  // 1. Obter todos os blocos concluídos elegíveis
  const completedBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      status: "COMPLETED",
      theoryStatus: "COMPLETED",
      theoryCompletedAt: { not: null },
      subject: {
        studyPriority: { in: ["PRIMARY", "ACTIVE"] }
      },
      questionReviewTask: null, // Sem tarefa ainda
      material: {
        materialRole: { not: "SUPPORT_MATERIAL" }
      }
    },
    include: {
      subject: true,
      material: true
    }
  });

  // 2. Ordenar por prioridade
  const priorityMap: Record<string, number> = { PRIMARY: 2, ACTIVE: 1 };
  const sortedBlocks = [...completedBlocks].sort((a, b) => {
    const priorityA = priorityMap[a.subject.studyPriority] || 0;
    const priorityB = priorityMap[b.subject.studyPriority] || 0;
    if (priorityA !== priorityB) return priorityB - priorityA;

    const weightA = a.subject.examWeight ?? 1.0;
    const weightB = b.subject.examWeight ?? 1.0;
    if (weightA !== weightB) return weightB - weightA;

    const dateA = a.theoryCompletedAt ? new Date(a.theoryCompletedAt).getTime() : 0;
    const dateB = b.theoryCompletedAt ? new Date(b.theoryCompletedAt).getTime() : 0;
    return dateA - dateB;
  });

  // Limite estrito de 30 itens na carga inicial
  const eligibleBlocks = sortedBlocks.slice(0, 30);

  const preview: BackfillResult["preview"] = [];
  const baseDate = new Date();
  
  // Rastreamento simulado para agendamento dia a dia
  const simulatedTasksPerDay: Record<string, number> = {};

  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { studyDaysOfWeek: true }
  });
  const activeDays = prefs?.studyDaysOfWeek
    ? prefs.studyDaysOfWeek.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n))
    : [1, 2, 3, 4, 5];
  const studyDays = activeDays.length > 0 ? activeDays : [0, 1, 2, 3, 4, 5, 6];

  const getNextAvailableDate = async (tx: any, targetDate: Date): Promise<Date> => {
    for (let i = 0; i < 365; i++) {
      const dayOfWeek = getSPDayOfWeek(targetDate);
      if (!studyDays.includes(dayOfWeek)) {
        targetDate = addDays(targetDate, 1);
        continue;
      }

      const dayRange = getTodayRangeSP(targetDate);
      const dateKey = dayRange.dateString;

      const existingInDb = await tx.questionReviewTask.count({
        where: {
          userId,
          status: QuestionReviewStatus.PENDING,
          scheduledDate: {
            gte: dayRange.start,
            lt: dayRange.end
          }
        }
      });

      const simulatedCount = simulatedTasksPerDay[dateKey] || 0;
      const totalCount = existingInDb + simulatedCount;

      if (totalCount < maxPerDay) {
        simulatedTasksPerDay[dateKey] = simulatedCount + 1;
        return dayRange.start;
      }

      targetDate = addDays(targetDate, 1);
    }
    return targetDate;
  };

  if (apply) {
    await prisma.$transaction(async (tx) => {
      const currentTargetDate = addDays(baseDate, 0);
      for (const block of eligibleBlocks) {
        const scheduledDate = await getNextAvailableDate(tx, currentTargetDate);
        
        await tx.questionReviewTask.create({
          data: {
            userId,
            studyBlockId: block.id,
            subjectId: block.subjectId,
            sourceBlockTitle: block.title,
            sourceMaterialName: block.material?.fileName || null,
            sourcePageStart: block.pageStart,
            sourcePageEnd: block.pageEnd,
            sourceSubjectName: block.subject.name,
            sourceStudyDate: block.theoryCompletedAt || new Date(),
            scheduledDate,
            status: QuestionReviewStatus.PENDING,
            recommendedQuestionCount: DEFAULT_QUESTION_COUNT,
            origin: QuestionReviewOrigin.BACKFILL
          }
        });

        preview.push({
          blockTitle: block.title,
          subjectName: block.subject.name,
          completedAt: block.theoryCompletedAt,
          scheduledDate
        });
      }
    });
  } else {
    const currentTargetDate = addDays(baseDate, 0);
    for (const block of eligibleBlocks) {
      const scheduledDate = await getNextAvailableDate(prisma, currentTargetDate);
      preview.push({
        blockTitle: block.title,
        subjectName: block.subject.name,
        completedAt: block.theoryCompletedAt,
        scheduledDate
      });
    }
  }

  return {
    dryRun: !apply,
    totalEligible: completedBlocks.length,
    scheduledCount: eligibleBlocks.length,
    preview
  };
}

