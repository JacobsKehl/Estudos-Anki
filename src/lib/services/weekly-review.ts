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
    block.status === "COMPLETED" &&
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
        status: "COMPLETED",
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
        status: "COMPLETED",
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
      status: "COMPLETED",
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
  
  // A data original da sessão é o domingo/dia de revisão.
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

  // Buscar sessões passadas (com data de agendamento estritamente anterior à data de referência)
  const pastSessions = await client.weeklyReviewSession.findMany({
    where: {
      userId,
      originalScheduledDate: { lt: originalScheduledDate }
    }
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
    // Encontrar o tópico mais recente com base no effectiveScheduledDate da sessão
    const sortedSources = [...block.weeklyReviewTopicSources].sort((a: any, b: any) => {
      const dateA = a.weeklyReviewTopic?.weeklyReviewSession?.effectiveScheduledDate?.getTime() || 0;
      const dateB = b.weeklyReviewTopic?.weeklyReviewSession?.effectiveScheduledDate?.getTime() || 0;
      return dateB - dateA;
    });
    
    const mostRecentTopic = sortedSources[0].weeklyReviewTopic;
    return mostRecentTopic;
  };

  // Filtrar apenas blocos que ainda não foram revisados (ou cuja última revisão foi REVIEW_AGAIN)
  const unreviewedBlocks = eligibleBlocks.filter((block: any) => !isBlockReviewed(block));

  // --- SELEÇÃO DO GRUPO B (OVERDUE - limite de 2) ---
  // Elegíveis para OVERDUE: blocos unreviewed que foram concluídos antes de pelo menos uma sessão semanal passada
  const overdueCandidates = unreviewedBlocks.filter((block: any) => {
    const T = block.theoryCompletedAt;
    if (!T) return false;
    return pastSessions.some(
      (session: any) => session.originalScheduledDate.getTime() > T.getTime()
    );
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
      // Quanto menor a data de conclusão, mais antigo é o bloco
      ageMs: block.theoryCompletedAt ? block.theoryCompletedAt.getTime() : 0,
      // Pesos das matérias
      examWeight: block.subject?.examWeight || 1.0,
      subjectPriority: block.subject?.priority || 1
    };
  });

  // Ordenar conforme regras do Grupo B:
  // 1. REVIEW_AGAIN primeiro.
  // 2. Mais antigo primeiro (ageMs menor primeiro).
  // 3. Maior peso de prova desc.
  // 4. Maior prioridade de matéria desc.
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
  const selectedWeekIds = new Set(selectedWeek.map((w: any) => w.id));

  // --- SELEÇÃO DO GRUPO C (LONG_UNSEEN - limite de 1) ---
  // Apenas matérias PRIMARY ou ACTIVE do usuário
  const userSubjects = Array.from(
    new Set(eligibleBlocks.map((b: any) => b.subject).filter((s: any): s is any => s !== null))
  ).filter((s: any) => s.studyPriority === "PRIMARY" || s.studyPriority === "ACTIVE");

  // Coletar IDs de matérias já selecionadas no Grupo A ou Grupo B
  const selectedSubjectIds = new Set<string>();
  selectedOverdue.forEach((o: any) => {
    if (o.block.subjectId) selectedSubjectIds.add(o.block.subjectId);
  });
  selectedWeek.forEach((w: any) => {
    if (w.subjectId) selectedSubjectIds.add(w.subjectId);
  });

  // Calcular última data de conclusão real de teoria por matéria (do histórico completo elegível)
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
  }).filter((x: any) => x.lastTime > 0); // Excluir matérias sem nenhuma conclusão histórica

  // Filtrar apenas matérias distintas das selecionadas em A e B
  const distinctSubjectLastCompletions = subjectLastCompletions.filter(
    (item: any) => !selectedSubjectIds.has(item.subject.id)
  );

  // Escolher a matéria com a conclusão de teoria mais antiga
  distinctSubjectLastCompletions.sort((a: any, b: any) => a.lastTime - b.lastTime);

  let selectedLongUnseenBlock: typeof eligibleBlocks[0] | null = null;

  for (const item of distinctSubjectLastCompletions) {
    const candidateBlocks = unreviewedBlocks.filter(
      (b: any) =>
        b.subjectId === item.subject.id &&
        !selectedOverdueIds.has(b.id) &&
        !selectedWeekIds.has(b.id)
    );

    if (candidateBlocks.length > 0) {
      // Selecionar o bloco mais recentemente concluído desta matéria para dar contexto
      candidateBlocks.sort((a: any, b: any) => {
        const timeA = a.theoryCompletedAt?.getTime() || 0;
        const timeB = b.theoryCompletedAt?.getTime() || 0;
        return timeB - timeA;
      });
      selectedLongUnseenBlock = candidateBlocks[0];
      break;
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

  // Ordem de prioridade para distribuição de questões:
  // 1. OVERDUE (ordenados por idade: antigos primeiro)
  const distOverdue = topics.filter((t) => t.selectionReason === "OVERDUE");
  distOverdue.sort((a, b) => a.sourceStudyDate.localeCompare(b.sourceStudyDate));

  // 2. LONG_UNSEEN
  const distLongUnseen = topics.filter((t) => t.selectionReason === "LONG_UNSEEN");

  // 3. WEEK_CONTENT (ordenados por idade: antigos primeiro)
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
