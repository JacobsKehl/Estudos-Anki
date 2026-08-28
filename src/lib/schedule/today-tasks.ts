/**
 * src/lib/schedule/today-tasks.ts
 *
 * Derivação pura e canônica das tarefas de estudo do dia a partir dos itens de cronograma.
 * Garante que itens com status = 'SKIPPED' NUNCA sejam incluídos em studyTasks,
 * reviewTasks ou no somatório de totalMinutes da página inicial.
 */

export interface TodayTaskItem {
  id: string;
  actionType: string;
  status: string;
  estimatedMinutes?: number | null;
  dayNumber?: number | null;
  scheduledDate?: Date | string | null;
  studyBlockId?: string | null;
  studyBlock?: {
    id: string;
    title?: string;
    pageStart?: number;
    pageEnd?: number;
    theoryStatus?: string;
    flashcards?: { id: string }[];
    [key: string]: any;
  } | null;
  subject?: {
    id: string;
    name: string;
    studyPriority?: string;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

export interface TodayTasksResult {
  studyTasks: TodayTaskItem[];
  reviewTasks: TodayTaskItem[];
  pendingStudyTasks: TodayTaskItem[];
  completedStudyTasks: TodayTaskItem[];
  pendingReviewTasks: TodayTaskItem[];
  totalMinutes: number;
  completedMinutes: number;
  isDayCompleted: boolean;
}

export function selectTodayTasks(
  todayItems: TodayTaskItem[],
  srsReviewCount = 0
): TodayTasksResult {
  // 1. Apenas itens de THEORY não-SKIPPED compõem o estudo do dia
  const studyTasks = todayItems.filter(
    (item) => item.actionType === "THEORY" && item.status !== "SKIPPED"
  );

  // 2. Apenas itens de REVIEW_BLOCK não-SKIPPED com flashcards ativos compõem revisões
  const reviewTasks = todayItems.filter((item) => {
    if (item.status === "SKIPPED") return false;
    if (item.actionType === "REVIEW_BLOCK") {
      const activeCards = item.studyBlock?.flashcards || [];
      return activeCards.length > 0;
    }
    return false;
  });

  const pendingStudyTasks = studyTasks.filter(
    (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
  );

  const completedStudyTasks = studyTasks.filter(
    (item) => item.status === "COMPLETED"
  );

  const pendingReviewTasks = reviewTasks.filter(
    (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
  );

  const completedMinutes = completedStudyTasks.reduce(
    (acc, i) => acc + (i.estimatedMinutes ?? 60),
    0
  );
  const totalMinutes = studyTasks.reduce(
    (acc, i) => acc + (i.estimatedMinutes ?? 60),
    0
  );

  const isDayCompleted = pendingStudyTasks.length === 0 && srsReviewCount === 0;

  return {
    studyTasks,
    reviewTasks,
    pendingStudyTasks,
    completedStudyTasks,
    pendingReviewTasks,
    totalMinutes,
    completedMinutes,
    isDayCompleted,
  };
}
