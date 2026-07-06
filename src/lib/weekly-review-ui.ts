/**
 * Funções puras utilitárias para a interface da Revisão Semanal.
 * Sem dependência de React, Prisma ou qualquer I/O.
 */

export type TopicResult = "PENDING" | "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN";
export type SelectionReason = "WEEK_CONTENT" | "OVERDUE" | "LONG_UNSEEN";
export type SessionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

/**
 * Sugere a quantidade de questões com base no tempo disponível.
 * Regra: 1 questão a cada 3 minutos, com piso de 5 e teto de 50.
 */
export function suggestQuestionCount(minutes: number): number {
  const raw = Math.floor(minutes / 3);
  return Math.max(5, Math.min(50, raw));
}

/**
 * Mapeia o motivo de seleção para uma label amigável em português.
 */
export function mapSelectionReason(reason: SelectionReason): string {
  const map: Record<SelectionReason, string> = {
    WEEK_CONTENT: "Conteúdo da semana",
    OVERDUE: "Pendente de revisão anterior",
    LONG_UNSEEN: "Longo tempo sem revisão",
  };
  return map[reason] ?? reason;
}

/**
 * Mapeia o resultado de um tópico para uma label amigável.
 */
export function mapResultText(result: TopicResult): string {
  const map: Record<TopicResult, string> = {
    PENDING: "Pendente",
    DID_WELL: "Dominei bem",
    HAD_DOUBTS: "Tive dúvidas",
    REVIEW_AGAIN: "Revisar novamente",
  };
  return map[result] ?? result;
}

/**
 * Calcula o progresso de uma sessão com base nos tópicos avaliados.
 */
export function calculateProgress(
  topics: Array<{ result: string }>
): { count: number; total: number; percent: number } {
  const total = topics.length;
  if (total === 0) return { count: 0, total: 0, percent: 0 };

  const count = topics.filter((t) => t.result !== "PENDING").length;
  const percent = Math.round((count / total) * 100);
  return { count, total, percent };
}

/**
 * Distribui questões equilibradamente entre tópicos ordenados por priorityRank ASC.
 * Cada rodada atribui 1 questão por tópico até atingir targetQuestionCount.
 * A soma total distribuída será exatamente targetQuestionCount.
 */
export function distributeQuestionsAcrossTopics(
  targetQuestionCount: number,
  orderedTopics: Array<{ id: string }>
): Record<string, number> {
  const result: Record<string, number> = {};
  const topicCount = orderedTopics.length;

  if (topicCount === 0 || targetQuestionCount <= 0) return result;

  // Inicializar todas as contagens em 0
  for (const topic of orderedTopics) {
    result[topic.id] = 0;
  }

  let remaining = targetQuestionCount;
  let index = 0;

  // Distribuir round-robin respeitando a ordem de prioridade
  while (remaining > 0) {
    const topicId = orderedTopics[index % topicCount].id;
    result[topicId] += 1;
    remaining -= 1;
    index += 1;
  }

  return result;
}

/**
 * Mapeia o status da sessão para uma label amigável.
 */
export function mapSessionStatus(status: SessionStatus): string {
  const map: Record<SessionStatus, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    SKIPPED: "Pulada",
  };
  return map[status] ?? status;
}

/**
 * Retorna classes CSS temáticas para o badge de status.
 */
export function getStatusBadgeClasses(status: SessionStatus): string {
  const map: Record<SessionStatus, string> = {
    PENDING: "bg-warning-bg text-warning-text",
    IN_PROGRESS: "bg-sage-light text-accent",
    COMPLETED: "bg-success-bg text-success-text",
    SKIPPED: "bg-muted text-muted-foreground",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

/**
 * Retorna classes CSS temáticas para o badge de resultado do tópico.
 */
export function getResultBadgeClasses(result: TopicResult): string {
  const map: Record<TopicResult, string> = {
    PENDING: "bg-muted text-muted-foreground",
    DID_WELL: "bg-success-bg text-success-text",
    HAD_DOUBTS: "bg-warning-bg text-warning-text",
    REVIEW_AGAIN: "bg-error-bg text-error-text",
  };
  return map[result] ?? "bg-muted text-muted-foreground";
}

/**
 * Formata uma data ISO para exibição no formato brasileiro.
 */
export function formatDateBR(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formata uma data ISO para exibição curta (dd/mm).
 */
export function formatDateShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
