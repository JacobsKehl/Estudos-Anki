import { prisma } from "@/lib/prisma";
import { getTodayRangeSP } from "@/lib/date-utils";
import * as crypto from "crypto";

export type WeeklyReviewTopicPreview = {
  studyBlockId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  sourceStudyDate: string;
  materialName?: string;
  pageStart?: number;
  pageEnd?: number;
  selectionReason: "WEEK_CONTENT" | "OVERDUE" | "LONG_UNSEEN";
  carriedFromTopicId?: string;
  groupKey: string;
  suggestedQuestions?: number;
};

export type WeeklyReviewPreview = {
  userId: string;
  referenceDate: string;
  originalScheduledDate: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  timezone: string;
  activeStudyDates: string[];

  availableMinutes?: number;
  suggestedQuestionCount?: number;

  totals: {
    selected: number;
    weekContent: number;
    overdue: number;
    longUnseen: number;
    excessWeekContent: number;
    excessOverdue: number;
  };

  topics: WeeklyReviewTopicPreview[];

  excluded: Array<{
    studyBlockId: string;
    reason: string;
  }>;
};

// Função central da fonte canônica para verificar se um bloco de teoria está concluído
export function isTheoryBlockCompleted(block: any): boolean {
  return (
    block.theoryStatus === "COMPLETED" &&
    block.theoryCompletedAt !== null
  );
}

// Helper para calcular sha256
export function buildWeeklyReviewGroupKey(
  subjectId: string,
  studyBlockIds: string[],
  carriedFromTopicId?: string
): string {
  const sortedIds = [...studyBlockIds].sort();
  const baseString = carriedFromTopicId
    ? `${subjectId}:${sortedIds.join(",")}:${carriedFromTopicId}`
    : `${subjectId}:${sortedIds.join(",")}`;
  return crypto.createHash("sha256").update(baseString).digest("hex");
}

// Helper para sugestão de questões por tempo
export function suggestQuestionCount(availableMinutes?: number): number {
  if (availableMinutes === undefined || availableMinutes === null) return 15;
  const raw = Math.floor(availableMinutes / 3);
  return Math.max(5, Math.min(50, raw));
}

// 1. Calcular o período da revisão semanal (início e fim da semana cronológica original)
export async function getWeeklyReviewPeriod(
  userId: string,
  originalScheduledDate: Date,
  timezone: string,
  tx?: any
) {
  const client = tx || prisma;
  // Encontrar a última sessão concluída ou agendada
  const lastSession = await client.weeklyReviewSession.findFirst({
    where: { userId },
    orderBy: { originalScheduledDate: "desc" }
  });

  const rangeEnd = getTodayRangeSP(originalScheduledDate, -1); // Véspera da data agendada (ex: Sábado 23:59:59)
  let sourcePeriodStart: Date;
  let isFirstSession = false;
  let activeStudyDates: string[] = [];

  if (lastSession) {
    // Sessões posteriores: dia seguinte à última data agendada original
    const startRange = getTodayRangeSP(lastSession.originalScheduledDate, 1);
    sourcePeriodStart = startRange.start;

    // Obter todas as datas de conclusão de teoria que caem nesse período
    const blocksInPeriod = await client.studyBlock.findMany({
      where: {
        userId,
        theoryStatus: "COMPLETED",
        theoryCompletedAt: {
          gte: sourcePeriodStart,
          lte: rangeEnd.end
        }
      },
      select: { theoryCompletedAt: true },
      orderBy: { theoryCompletedAt: "asc" }
    });

    activeStudyDates = Array.from(
      new Set(
        blocksInPeriod
          .map((b: any) => b.theoryCompletedAt)
          .filter((d: any): d is Date => d !== null)
          .map((d: any) => getTodayRangeSP(d).dateString)
      )
    ).sort() as string[];
  } else {
    // Primeira sessão: buscar os últimos 6 dias de estudo ativos (dias com THEORY concluída)
    isFirstSession = true;
    const activeDays = await client.studyBlock.findMany({
      where: {
        userId,
        theoryStatus: "COMPLETED",
        theoryCompletedAt: { lt: originalScheduledDate }
      },
      select: { theoryCompletedAt: true },
      orderBy: { theoryCompletedAt: "desc" }
    });

    const uniqueDates = Array.from(
      new Set(
        activeDays
          .map((b: any) => b.theoryCompletedAt)
          .filter((d: any): d is Date => d !== null)
          .map((d: any) => getTodayRangeSP(d).dateString)
      )
    ).sort((a: any, b: any) => b.localeCompare(a)); // Ordenação decrescente (mais recentes primeiro)

    // Selecionar exatamente as 6 datas ativas mais recentes (ou todas se menos de 6)
    const selectedActiveDates = uniqueDates.slice(0, 6).sort();
    activeStudyDates = selectedActiveDates as string[];

    if (selectedActiveDates.length > 0) {
      const oldestActiveDayStr = selectedActiveDates[0];
      const startRange = getTodayRangeSP(new Date(oldestActiveDayStr + "T12:00:00Z"));
      sourcePeriodStart = startRange.start;
    } else {
      // Fallback para 30 dias atrás
      const fallbackRange = getTodayRangeSP(originalScheduledDate, -30);
      sourcePeriodStart = fallbackRange.start;
    }
  }

  const sourcePeriodEnd = rangeEnd.end;
  return {
    sourcePeriodStart,
    sourcePeriodEnd,
    isFirstSession,
    activeStudyDates
  };
}

// 2. Localizar blocos de teoria concluídos elegíveis
export async function getCompletedTheoryBlocks(userId: string, tx?: any) {
  const client = tx || prisma;
  const blocks = await client.studyBlock.findMany({
    where: {
      userId,
      theoryStatus: "COMPLETED",
      theoryCompletedAt: { not: null }
    },
    include: {
      subject: true,
      material: true,
      weeklyReviewTopicSources: {
        include: {
          weeklyReviewTopic: {
            include: {
              weeklyReviewSession: true
            }
          }
        }
      }
    },
    orderBy: { theoryCompletedAt: "asc" }
  });

  return blocks.filter(isTheoryBlockCompleted);
}

// 3. Montar a prévia da Revisão Semanal em modo Read-Only
export async function buildWeeklyReviewPreview(
  userId: string,
  referenceDateStr: string,
  timezone: string = "America/Sao_Paulo",
  availableMinutes?: number,
  tx?: any
): Promise<WeeklyReviewPreview> {
  const referenceDate = new Date(referenceDateStr + "T12:00:00Z");
  const client = tx || prisma;
  
  const originalScheduledDate = referenceDate;

  // Obter o período de teoria e a lista exata de datas ativas de estudo
  const { sourcePeriodStart, sourcePeriodEnd, activeStudyDates } = await getWeeklyReviewPeriod(
    userId,
    originalScheduledDate,
    timezone,
    tx
  );

  const startStr = getTodayRangeSP(sourcePeriodStart).dateString;
  const endStr = getTodayRangeSP(sourcePeriodEnd).dateString;

  // Buscar todas as sessões passadas do usuário (com originalScheduledDate anterior)
  const allPastSessions = await client.weeklyReviewSession.findMany({
    where: {
      userId,
      originalScheduledDate: { lt: originalScheduledDate }
    }
  });

  // Filtrar apenas sessões vencidas (finalizadas ou que não foram transferidas para o futuro)
  const pastSessions = allPastSessions.filter((s: any) => {
    const isFinalized = s.status === "COMPLETED" || s.status === "SKIPPED";
    const isPast = s.effectiveScheduledDate.getTime() < originalScheduledDate.getTime();
    return isFinalized || isPast;
  });

  // Obter todos os blocos concluídos
  const allCompletedBlocks = await getCompletedTheoryBlocks(userId, tx);

  // Classificar e auditar os blocos concluídos
  const excludedBlocks: Array<{ studyBlockId: string; reason: string }> = [];
  const eligibleBlocks = allCompletedBlocks.filter((block: any) => {
    // Validação de matéria
    const studyPriority = block.subject?.studyPriority;
    if (studyPriority === "EXCLUDED" || studyPriority === "SECONDARY") {
      excludedBlocks.push({
        studyBlockId: block.id,
        reason: `Matéria com prioridade ${studyPriority}`
      });
      return false;
    }
    return true;
  });

  // Identificar se o bloco já foi revisado com sucesso (DID_WELL ou HAD_DOUBTS)
  const isBlockReviewed = (block: any) => {
    return block.weeklyReviewTopicSources.some((source: any) => {
      const result = source.weeklyReviewTopic?.result;
      const status = source.weeklyReviewTopic?.weeklyReviewSession?.status;
      return (
        status === "COMPLETED" &&
        (result === "DID_WELL" || result === "HAD_DOUBTS")
      );
    });
  };

  // Identificar se a última revisão do bloco foi REVIEW_AGAIN
  const getMostRecentReviewState = (block: any) => {
    if (block.weeklyReviewTopicSources.length === 0) return null;
    const sortedSources = [...block.weeklyReviewTopicSources].sort((a: any, b: any) => {
      const dateA = a.weeklyReviewTopic?.weeklyReviewSession?.effectiveScheduledDate?.getTime() || 0;
      const dateB = b.weeklyReviewTopic?.weeklyReviewSession?.effectiveScheduledDate?.getTime() || 0;
      return dateB - dateA;
    });
    
    return sortedSources[0].weeklyReviewTopic;
  };

  // Filtrar apenas blocos que ainda não foram revisados (ou cuja última revisão foi REVIEW_AGAIN)
  const unreviewedBlocks = eligibleBlocks.filter((block: any) => !isBlockReviewed(block));

  // Função para verificar se o bloco tem um tópico associado que preenche as condições de OVERDUE
  const getTopicOverdueStatus = (block: any) => {
    return block.weeklyReviewTopicSources.some((source: any) => {
      const topic = source.weeklyReviewTopic;
      if (!topic) return false;
      const session = topic.weeklyReviewSession;
      if (!session) return false;

      // Ignorar sessões agendadas a partir do dia de referência
      if (session.originalScheduledDate.getTime() >= referenceDate.getTime()) return false;

      // 1. Marcado como REVIEW_AGAIN
      if (topic.result === "REVIEW_AGAIN") return true;

      // 2. Pertenceu a uma sessão SKIPPED
      if (session.status === "SKIPPED") return true;

      // 3. Tópico PENDING de sessão anterior vencida (não concluída/skipped e data efetiva < referenceDate)
      const isSessionVencida =
        session.status !== "COMPLETED" &&
        session.status !== "SKIPPED" &&
        session.effectiveScheduledDate.getTime() < referenceDate.getTime();
      
      const isTopicPending = topic.result === null || topic.result === undefined;

      if (isTopicPending && (session.status === "COMPLETED" || isSessionVencida)) {
        return true;
      }

      // 4. Sessão vencida e não concluída em geral
      if (isSessionVencida) return true;

      return false;
    });
  };

  // Função para verificar se a conclusão do bloco caiu dentro do período de cobertura de alguma sessão anterior
  const isBlockWithinPastSessionPeriod = (block: any) => {
    const T = block.theoryCompletedAt;
    if (!T) return false;
    const time = T.getTime();
    return pastSessions.some((session: any) => {
      if (!session.sourcePeriodStart || !session.sourcePeriodEnd) return false;
      const start = session.sourcePeriodStart.getTime();
      const end = session.sourcePeriodEnd.getTime();
      return time >= start && time <= end;
    });
  };

  // --- SELEÇÃO DO GRUPO B (OVERDUE - limite de 2) ---
  // Elegíveis para OVERDUE: blocos unreviewed que caíram dentro do período de sessões anteriores ou têm tópicos em estados elegíveis de atraso
  const overdueCandidates = unreviewedBlocks.filter((block: any) => {
    return isBlockWithinPastSessionPeriod(block) || getTopicOverdueStatus(block);
  });

  // Estrutura de priorização para OVERDUE
  const overdueWithPriority = overdueCandidates.map((block: any) => {
    const mostRecentTopic = getMostRecentReviewState(block);
    const isReviewAgain = mostRecentTopic?.result === "REVIEW_AGAIN";
    const carriedFromTopicId = isReviewAgain ? mostRecentTopic.id : undefined;

    return {
      block,
      isReviewAgain,
      carriedFromTopicId,
      ageMs: block.theoryCompletedAt ? block.theoryCompletedAt.getTime() : 0,
      examWeight: block.subject?.examWeight || 1.0,
      subjectPriority: block.subject?.priority || 1
    };
  });

  // Ordenar conforme regras do Grupo B
  overdueWithPriority.sort((a: any, b: any) => {
    if (a.isReviewAgain && !b.isReviewAgain) return -1;
    if (!a.isReviewAgain && b.isReviewAgain) return 1;
    if (a.ageMs !== b.ageMs) return a.ageMs - b.ageMs;
    if (b.examWeight !== a.examWeight) return b.examWeight - a.examWeight;
    return b.subjectPriority - a.subjectPriority;
  });

  const selectedOverdue = overdueWithPriority.slice(0, 2);
  const selectedOverdueIds = new Set(selectedOverdue.map((o: any) => o.block.id));

  // --- SELEÇÃO DO GRUPO A (WEEK_CONTENT - limite de 12) ---
  // Concluídos apenas nas datas ativas do período e que não foram selecionados como OVERDUE
  const weekCandidates = unreviewedBlocks.filter((block: any) => {
    if (!block.theoryCompletedAt) return false;
    const dateStr = getTodayRangeSP(block.theoryCompletedAt).dateString;
    return activeStudyDates.includes(dateStr) && !selectedOverdueIds.has(block.id);
  });

  // WEEK_CONTENT ordenado cronologicamente de estudo
  const selectedWeek = weekCandidates.slice(0, 12);

  // --- SELEÇÃO DO GRUPO C (LONG_UNSEEN - limite de 1) ---
  // Apenas matérias PRIMARY ou ACTIVE do usuário
  const userSubjects = Array.from(
    new Set(eligibleBlocks.map((b: any) => b.subject).filter((s: any): s is any => s !== null))
  ).filter((s: any) => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE");

  // Calcular última data de conclusão real de teoria por matéria (do histórico completo elegível sem filtros de semana)
  const subjectLastCompletions = userSubjects.map((subject: any) => {
    const subjectBlocks = eligibleBlocks.filter((b: any) => b.subjectId === subject.id);
    const completionTimes = subjectBlocks
      .map((b: any) => b.theoryCompletedAt?.getTime())
      .filter((t: any): t is number => t !== undefined);
    
    const lastTime = completionTimes.length > 0 ? Math.max(...completionTimes) : 0;
    return {
      subject,
      lastTime
    };
  }).filter((x: any) => x.lastTime > 0);

  // Regra de exclusão de LONG_UNSEEN:
  // 1. Matéria que possui qualquer teoria concluída dentro do sourcePeriod atual não pode ser selecionada.
  // 2. Matéria que já possui bloco selecionado como WEEK_CONTENT ou OVERDUE.
  const selectedSubjectIds = new Set<string>();
  selectedOverdue.forEach((o: any) => {
    if (o.block.subjectId) selectedSubjectIds.add(o.block.subjectId);
  });
  selectedWeek.forEach((w: any) => {
    if (w.subjectId) selectedSubjectIds.add(w.subjectId);
  });

  const distinctSubjectLastCompletions = subjectLastCompletions.filter((item: any) => {
    // Verificar se houve conclusão no período atual
    const hasTheoryInPeriod = eligibleBlocks.some((block: any) => {
      if (block.subjectId !== item.subject.id || !block.theoryCompletedAt) return false;
      const T = block.theoryCompletedAt.getTime();
      return T >= sourcePeriodStart.getTime() && T <= sourcePeriodEnd.getTime();
    });

    return !hasTheoryInPeriod && !selectedSubjectIds.has(item.subject.id);
  });

  // Escolher a matéria com a conclusão de teoria mais antiga
  distinctSubjectLastCompletions.sort((a: any, b: any) => a.lastTime - b.lastTime);

  let selectedLongUnseenBlock: typeof eligibleBlocks[0] | null = null;

  if (distinctSubjectLastCompletions.length > 0) {
    const targetSubjectItem = distinctSubjectLastCompletions[0];
    const candidateBlocks = eligibleBlocks.filter(
      (b: any) => b.subjectId === targetSubjectItem.subject.id
    );

    if (candidateBlocks.length > 0) {
      // Selecionar o bloco concluído mais recente desta matéria para dar contexto
      candidateBlocks.sort((a: any, b: any) => {
        const timeA = a.theoryCompletedAt?.getTime() || 0;
        const timeB = b.theoryCompletedAt?.getTime() || 0;
        return timeB - timeA;
      });
      selectedLongUnseenBlock = candidateBlocks[0];
    }
  }

  // --- MONTAGEM DOS TÓPICOS DA PRÉVIA ---
  const topics: WeeklyReviewTopicPreview[] = [];

  // 1. OVERDUE
  selectedOverdue.forEach(({ block, carriedFromTopicId }: any) => {
    topics.push({
      studyBlockId: block.id,
      subjectId: block.subjectId,
      subjectName: block.subject?.name || "Sem Matéria",
      title: block.title,
      sourceStudyDate: block.theoryCompletedAt ? getTodayRangeSP(block.theoryCompletedAt).dateString : "",
      materialName: block.material?.fileName,
      pageStart: block.pageStart,
      pageEnd: block.pageEnd,
      selectionReason: "OVERDUE",
      carriedFromTopicId,
      groupKey: buildWeeklyReviewGroupKey(block.subjectId, [block.id], carriedFromTopicId)
    });
  });

  // 2. WEEK_CONTENT
  selectedWeek.forEach((block: any) => {
    topics.push({
      studyBlockId: block.id,
      subjectId: block.subjectId,
      subjectName: block.subject?.name || "Sem Matéria",
      title: block.title,
      sourceStudyDate: block.theoryCompletedAt ? getTodayRangeSP(block.theoryCompletedAt).dateString : "",
      materialName: block.material?.fileName,
      pageStart: block.pageStart,
      pageEnd: block.pageEnd,
      selectionReason: "WEEK_CONTENT",
      groupKey: buildWeeklyReviewGroupKey(block.subjectId, [block.id])
    });
  });

  // 3. LONG_UNSEEN
  if (selectedLongUnseenBlock) {
    const block = selectedLongUnseenBlock;
    topics.push({
      studyBlockId: block.id,
      subjectId: block.subjectId,
      subjectName: block.subject?.name || "Sem Matéria",
      title: block.title,
      sourceStudyDate: block.theoryCompletedAt ? getTodayRangeSP(block.theoryCompletedAt).dateString : "",
      materialName: block.material?.fileName,
      pageStart: block.pageStart,
      pageEnd: block.pageEnd,
      selectionReason: "LONG_UNSEEN",
      groupKey: buildWeeklyReviewGroupKey(block.subjectId, [block.id])
    });
  }

  // --- DISTRIBUIÇÃO PRELIMINAR DAS QUESTÕES ---
  const totalQuestions = suggestQuestionCount(availableMinutes);
  let remaining = totalQuestions;

  const distOverdue = topics.filter((t) => t.selectionReason === "OVERDUE");
  distOverdue.sort((a, b) => a.sourceStudyDate.localeCompare(b.sourceStudyDate));

  const distLongUnseen = topics.filter((t) => t.selectionReason === "LONG_UNSEEN");

  const distWeek = topics.filter((t) => t.selectionReason === "WEEK_CONTENT");
  distWeek.sort((a, b) => a.sourceStudyDate.localeCompare(b.sourceStudyDate));

  const orderedTopics = [...distOverdue, ...distLongUnseen, ...distWeek];

  if (orderedTopics.length > 0) {
    while (remaining > 0) {
      let allocatedInRound = 0;
      for (const topic of orderedTopics) {
        if (remaining > 0) {
          topic.suggestedQuestions = (topic.suggestedQuestions || 0) + 1;
          remaining--;
          allocatedInRound++;
        }
      }
      if (allocatedInRound === 0) break;
    }
  }

  // --- TOTAIS E EXCEDENTES ---
  const excessWeekContent = Math.max(0, weekCandidates.length - 12);
  const excessOverdue = Math.max(0, overdueCandidates.length - 2);

  return {
    userId,
    referenceDate: referenceDateStr,
    originalScheduledDate: referenceDateStr,
    sourcePeriodStart: startStr,
    sourcePeriodEnd: endStr,
    timezone,
    activeStudyDates,
    availableMinutes,
    suggestedQuestionCount: totalQuestions,
    totals: {
      selected: topics.length,
      weekContent: selectedWeek.length,
      overdue: selectedOverdue.length,
      longUnseen: selectedLongUnseenBlock ? 1 : 0,
      excessWeekContent,
      excessOverdue
    },
    topics,
    excluded: excludedBlocks
  };
}

// Helper para executar transações Serializable com retry limitado
export async function runSerializableTransaction<T>(
  client: any,
  fn: (tx: any) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await client.$transaction(
        async (tx: any) => {
          return await fn(tx);
        },
        {
          isolationLevel: "Serializable",
          timeout: 15000 // 15s timeout para teste concorrente lento
        }
      );
    } catch (error: any) {
      attempt++;
      const isSerializationError =
        error.code === "P2034" ||
        error.message?.includes("serialization") ||
        error.message?.includes("40001");
      
      if (isSerializationError && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));
        continue;
      }
      throw error;
    }
  }
}

// Helper para validar ancestralidade de carryover
export async function validateCarriedFromTopic(
  client: any,
  userId: string,
  carriedFromTopicId: string,
  originalScheduledDate: Date
) {
  let currentAncestorId = carriedFromTopicId;
  const visited = new Set<string>();
  let depth = 0;
  const maxDepth = 100;

  while (currentAncestorId) {
    if (visited.has(currentAncestorId)) {
      throw new Error("CIRCULAR_CARRYOVER_DETECTED");
    }
    visited.add(currentAncestorId);
    depth++;
    if (depth > maxDepth) {
      throw new Error("MAX_CARRYOVER_DEPTH_EXCEEDED");
    }

    const ancestor = await client.weeklyReviewTopic.findUnique({
      where: { id: currentAncestorId },
      include: {
        weeklyReviewSession: true
      }
    });

    if (!ancestor) {
      throw new Error("CARRIED_TOPIC_NOT_FOUND");
    }

    if (ancestor.weeklyReviewSession.userId !== userId) {
      throw new Error("CARRIED_TOPIC_USER_MISMATCH");
    }

    if (ancestor.weeklyReviewSession.originalScheduledDate.getTime() >= originalScheduledDate.getTime()) {
      throw new Error("CARRIED_TOPIC_DATE_INVALID");
    }

    if (ancestor.result !== "REVIEW_AGAIN") {
      throw new Error("CARRIED_TOPIC_RESULT_NOT_REVIEW_AGAIN");
    }

    currentAncestorId = ancestor.carriedFromTopicId;
  }
}

// 1. Criar ou recuperar uma sessão semanal
export async function createOrGetWeeklyReviewSession(
  params: {
    userId: string;
    originalScheduledDate: Date;
    timezone: string;
  },
  tx?: any
) {
  const { userId, originalScheduledDate, timezone } = params;
  const client = tx || prisma;

  // 1. Buscar preferências
  const prefs = await client.userPreferences.findUnique({
    where: { userId }
  });
  if (!prefs) {
    throw new Error("USER_PREFERENCES_NOT_FOUND");
  }
  if (!prefs.weeklyReviewEnabled) {
    throw new Error("WEEKLY_REVIEW_DISABLED");
  }
  if (prefs.weeklyReviewDayOfWeek < 0 || prefs.weeklyReviewDayOfWeek > 6) {
    throw new Error("INVALID_DAY_OF_WEEK");
  }

  // 2. Normalizar data e validar correspondência com o dia da semana configurado
  const range = getTodayRangeSP(originalScheduledDate);
  const normalizedDate = new Date(range.dateString + "T12:00:00Z");
  const dayOfWeek = normalizedDate.getUTCDay();
  if (dayOfWeek !== prefs.weeklyReviewDayOfWeek) {
    throw new Error("SCHEDULED_DATE_MISMATCH");
  }

  const runTx = async (activeTx: any) => {
    // 3. Buscar sessão existente
    const existing = await activeTx.weeklyReviewSession.findFirst({
      where: { userId, originalScheduledDate: range.start },
      include: {
        topics: {
          include: {
            sources: true
          }
        }
      }
    });
    if (existing) {
      return { session: existing, created: false };
    }

    // 4. Gerar a prévia com o motor de seleção
    const preview = await buildWeeklyReviewPreview(userId, range.dateString, timezone, undefined, activeTx);
    if (preview.topics.length === 0) {
      throw new Error("NO_ELIGIBLE_TOPICS");
    }

    // 5. Validar ancestralidade se houver carriedFromTopicId
    for (const topic of preview.topics) {
      if (topic.carriedFromTopicId) {
        await validateCarriedFromTopic(activeTx, userId, topic.carriedFromTopicId, range.start);
      }
    }

    // 6. Criar a sessão
    const session = await activeTx.weeklyReviewSession.create({
      data: {
        userId,
        originalScheduledDate: range.start,
        effectiveScheduledDate: range.start,
        sourcePeriodStart: preview.sourcePeriodStart ? new Date(preview.sourcePeriodStart + "T12:00:00Z") : range.start,
        sourcePeriodEnd: preview.sourcePeriodEnd ? new Date(preview.sourcePeriodEnd + "T12:00:00Z") : range.start,
        status: "PENDING",
        missedBehavior: prefs.weeklyReviewMissedBehavior
      }
    });

    // 7. Criar os tópicos e fontes
    for (let i = 0; i < preview.topics.length; i++) {
      const topicData = preview.topics[i];
      const createdTopic = await activeTx.weeklyReviewTopic.create({
        data: {
          weeklyReviewSessionId: session.id,
          subjectId: topicData.subjectId,
          sourceSubjectName: topicData.subjectName,
          displayTitle: topicData.title,
          groupKey: topicData.groupKey,
          carriedFromTopicId: topicData.carriedFromTopicId,
          priorityRank: i + 1,
          suggestedQuestions: topicData.suggestedQuestions,
          selectionReason: topicData.selectionReason,
          result: "PENDING"
        }
      });

      await activeTx.weeklyReviewTopicSource.create({
        data: {
          weeklyReviewTopicId: createdTopic.id,
          studyBlockId: topicData.studyBlockId,
          sourceBlockTitle: topicData.title,
          sourceMaterialName: topicData.materialName || null,
          sourcePageStart: topicData.pageStart || null,
          sourcePageEnd: topicData.pageEnd || null,
          sourceStudyDate: new Date(topicData.sourceStudyDate + "T12:00:00Z")
        }
      });
    }

    const finalSession = await activeTx.weeklyReviewSession.findFirst({
      where: { id: session.id },
      include: {
        topics: {
          include: {
            sources: true
          }
        }
      }
    });

    return { session: finalSession, created: true };
  };

  try {
    if (typeof (client as any).$transaction !== "function") {
      return await runTx(client);
    } else {
      return await runSerializableTransaction(client, runTx);
    }
  } catch (error: any) {
    if (error.code === "P2002") {
      const existing = await client.weeklyReviewSession.findFirst({
        where: { userId, originalScheduledDate: range.start },
        include: {
          topics: {
            include: {
              sources: true
            }
          }
        }
      });
      if (existing) {
        return { session: existing, created: false };
      }
    }
    throw error;
  }
}

// 2. Iniciar a sessão semanal
export async function startWeeklyReviewSession(
  params: {
    userId: string;
    sessionId: string;
    availableMinutes: number;
    targetQuestionCount: number;
  },
  tx?: any
) {
  const { userId, sessionId, availableMinutes, targetQuestionCount } = params;
  const client = tx || prisma;

  if (availableMinutes < 5 || availableMinutes > 480) {
    throw new Error("INVALID_AVAILABLE_MINUTES");
  }
  if (targetQuestionCount < 1 || targetQuestionCount > 500) {
    throw new Error("INVALID_TARGET_QUESTION_COUNT");
  }

  const runTx = async (activeTx: any) => {
    const session = await activeTx.weeklyReviewSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.status === "COMPLETED" || session.status === "SKIPPED") {
      throw new Error("INVALID_SESSION_STATUS");
    }

    if (session.status === "IN_PROGRESS") {
      if (
        session.availableMinutes === availableMinutes &&
        session.targetQuestionCount === targetQuestionCount
      ) {
        return session;
      }
      throw new Error("SESSION_ALREADY_IN_PROGRESS_WITH_DIFFERENT_PARAMS");
    }

    const suggestedQuestionCount = suggestQuestionCount(availableMinutes);

    return await activeTx.weeklyReviewSession.update({
      where: { id: sessionId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
        availableMinutes,
        suggestedQuestionCount,
        targetQuestionCount
      }
    });
  };

  return tx ? await runTx(client) : await client.$transaction(runTx);
}

// 3. Registrar o resultado de cada tópico
export async function recordWeeklyReviewTopicResult(
  params: {
    userId: string;
    sessionId: string;
    topicId: string;
    result: "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN";
    notes?: string;
  },
  tx?: any
) {
  const { userId, sessionId, topicId, result, notes } = params;
  const client = tx || prisma;

  if (result === ("PENDING" as any)) {
    throw new Error("INVALID_RESULT");
  }

  if (notes && notes.length > 5000) {
    throw new Error("NOTES_TOO_LONG");
  }

  const runTx = async (activeTx: any) => {
    const session = await activeTx.weeklyReviewSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new Error("SESSION_NOT_IN_PROGRESS");
    }

    const topic = await activeTx.weeklyReviewTopic.findFirst({
      where: { id: topicId, weeklyReviewSessionId: sessionId }
    });
    if (!topic) {
      throw new Error("TOPIC_NOT_FOUND_IN_SESSION");
    }

    if (topic.result === result && topic.notes === (notes || null)) {
      return topic;
    }

    return await activeTx.weeklyReviewTopic.update({
      where: { id: topicId },
      data: {
        result,
        notes: notes || null,
        resultRecordedAt: new Date()
      }
    });
  };

  return tx ? await runTx(client) : await client.$transaction(runTx);
}

// 4. Concluir a sessão
export async function completeWeeklyReviewSession(
  params: {
    userId: string;
    sessionId: string;
    actualQuestionCount?: number;
  },
  tx?: any
) {
  const { userId, sessionId, actualQuestionCount } = params;
  const client = tx || prisma;

  if (actualQuestionCount !== undefined && (actualQuestionCount < 0 || actualQuestionCount > 500)) {
    throw new Error("INVALID_ACTUAL_QUESTION_COUNT");
  }

  const runTx = async (activeTx: any) => {
    const session = await activeTx.weeklyReviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        topics: true
      }
    });
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new Error("SESSION_NOT_IN_PROGRESS");
    }

    const hasResults = session.topics.some((t: any) => t.result !== "PENDING");
    if (!hasResults) {
      throw new Error("NO_RESULTS_RECORDED");
    }

    return await activeTx.weeklyReviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        actualQuestionCount: actualQuestionCount !== undefined ? actualQuestionCount : null
      }
    });
  };

  return tx ? await runTx(client) : await client.$transaction(runTx);
}

// 5. Pular a sessão
export async function skipWeeklyReviewSession(
  params: {
    userId: string;
    sessionId: string;
  },
  tx?: any
) {
  const { userId, sessionId } = params;
  const client = tx || prisma;

  const runTx = async (activeTx: any) => {
    const session = await activeTx.weeklyReviewSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.status !== "PENDING") {
      throw new Error("SESSION_NOT_PENDING");
    }

    return await activeTx.weeklyReviewSession.update({
      where: { id: sessionId },
      data: {
        status: "SKIPPED",
        skippedAt: new Date()
      }
    });
  };

  return tx ? await runTx(client) : await client.$transaction(runTx);
}

// 6. Transferir uma sessão pendente para o próximo dia
export async function carryWeeklyReviewSession(
  params: {
    userId: string;
    sessionId: string;
    newEffectiveScheduledDate: Date;
  },
  tx?: any
) {
  const { userId, sessionId, newEffectiveScheduledDate } = params;
  const client = tx || prisma;

  const runTx = async (activeTx: any) => {
    const session = await activeTx.weeklyReviewSession.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.status !== "PENDING") {
      throw new Error("SESSION_NOT_PENDING");
    }

    if (session.missedBehavior !== "MOVE_TO_NEXT_AVAILABLE_DAY") {
      throw new Error("CARRYOVER_NOT_ALLOWED_BY_BEHAVIOR");
    }

    const rangeNew = getTodayRangeSP(newEffectiveScheduledDate);
    const normalizedNew = new Date(rangeNew.dateString + "T12:00:00Z");

    const rangeCurrent = getTodayRangeSP(session.effectiveScheduledDate);
    const normalizedCurrent = new Date(rangeCurrent.dateString + "T12:00:00Z");

    if (normalizedNew.getTime() <= normalizedCurrent.getTime()) {
      throw new Error("INVALID_CARRYOVER_DATE");
    }

    return await activeTx.weeklyReviewSession.update({
      where: { id: sessionId },
      data: {
        effectiveScheduledDate: rangeNew.start
      }
    });
  };

  return tx ? await runTx(client) : await client.$transaction(runTx);
}

// 7. Consultar uma sessão pertencente ao usuário autenticado
export async function getWeeklyReviewSessionForUser(
  userId: string,
  sessionId: string,
  tx?: any
) {
  const client = tx || prisma;
  return await client.weeklyReviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      topics: {
        include: {
          sources: true
        }
      }
    }
  });
}

