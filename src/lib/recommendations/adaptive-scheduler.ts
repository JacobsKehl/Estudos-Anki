import { prisma } from "@/lib/prisma";
import { getSubjectMetrics } from "@/lib/services/subject-metrics";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionType =
  | "THEORY"
  | "QUESTIONS"
  | "GENERATE_FLASHCARDS"
  | "REVIEW_BLOCK"
  | "REVIEW_FLASHCARDS"
  | "REINFORCEMENT";

export interface StudyTask {
  type: ActionType;
  subjectId: string;
  subjectName: string;
  studyBlockId?: string;
  blockTitle?: string;
  priorityScore: number;
  estimatedMinutes: number;
  reason: string;
}

export interface StudyRecommendation {
  blockId: string;
  subjectId: string;
  subjectName: string;
  blockTitle: string;
  priorityScore: number;
  reason: string;
  health: "EXCELLENT" | "GOOD" | "ATTENTION" | "CRITICAL";
}

// ─── Priority Formula ─────────────────────────────────────────────────────────

const HEALTH_SCORES = {
  CRITICAL: 100,
  ATTENTION: 70,
  GOOD: 30,
  EXCELLENT: 10,
} as const;

function calcPriorityScore(params: {
  health: keyof typeof HEALTH_SCORES;
  dueReviews: number;
  accuracyRate: number;
  examWeight: number;
  actionType: ActionType;
  lastStudiedAt: Date | null;
  isOverdueReview?: boolean;
}): number {
  const now = new Date();
  let score = 0;

  // 1. Saúde da matéria
  score += HEALTH_SCORES[params.health];

  // 2. Peso no edital (preparado para usar examWeight quando existir)
  const examWeight = params.examWeight ?? 1.0;
  score += Math.round(examWeight * 10);

  // 3. Flashcards vencidos
  if (params.dueReviews > 20) score += 50;
  else if (params.dueReviews > 10) score += 35;
  else if (params.dueReviews > 0) score += 20;

  // 4. Taxa de acerto baixa
  if (params.accuracyRate < 50) score += 40;
  else if (params.accuracyRate < 60) score += 30;
  else if (params.accuracyRate < 75) score += 15;

  // 5. Tipo de ação
  if (params.actionType === "REVIEW_BLOCK") {
    if (params.isOverdueReview) score += 40; // vencida = urgente
    else score += 20;
  }
  if (params.actionType === "REVIEW_FLASHCARDS") score += 30;
  if (params.actionType === "GENERATE_FLASHCARDS") score += 25;
  if (params.actionType === "REINFORCEMENT") score += 35;
  if (params.actionType === "THEORY") score += 20;

  // 6. Tempo sem contato (> 7 dias)
  if (params.lastStudiedAt) {
    const daysSinceStudied =
      (now.getTime() - params.lastStudiedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceStudied > 14) score += 30;
    else if (daysSinceStudied > 7) score += 20;
  }

  return score;
}

// ─── Main Queue Generator ─────────────────────────────────────────────────────

/**
 * Returns a ranked list of study tasks for a user.
 * Replaces getAdaptiveStudyRecommendation (single block) with a full queue.
 */
export async function getAdaptiveStudyQueue(
  userId: string,
  limit = 20
): Promise<StudyTask[]> {
  const now = new Date();
  const tasks: StudyTask[] = [];

  const subjects = await prisma.studySubject.findMany({
    where: {
      userId,
      studyPriority: { notIn: ["SECONDARY", "EXCLUDED"] }
    },
    select: { id: true, name: true, examWeight: true },
  });

  if (subjects.length === 0) return [];

  for (const subject of subjects) {
    const metrics = await getSubjectMetrics(subject.id, userId);
    const examWeight = (subject.examWeight as number) ?? 1.0;
    const baseParams = {
      health: metrics.health,
      dueReviews: metrics.dueReviews,
      accuracyRate: metrics.accuracyRate,
      examWeight,
      lastStudiedAt: metrics.lastStudiedAt,
    };

    // 1. Revisões de bloco vencidas (D+1, D+7, D+15, D+30)
    const overdueBlockReviews = await (prisma as any).studyBlock.findMany({
      where: {
        subjectId: subject.id,
        userId,
        status: "COMPLETED",
        OR: [
          { review1dScheduledAt: { lte: now }, review1dCompletedAt: null },
          { review7dScheduledAt: { lte: now }, review7dCompletedAt: null },
          { review15dScheduledAt: { lte: now }, review15dCompletedAt: null },
          { review30dScheduledAt: { lte: now }, review30dCompletedAt: null },
        ],
      },
      orderBy: { lastStudiedAt: "asc" },
      take: 3,
    });

    for (const block of overdueBlockReviews) {
      tasks.push({
        type: "REVIEW_BLOCK",
        subjectId: subject.id,
        subjectName: subject.name,
        studyBlockId: block.id,
        blockTitle: block.title,
        estimatedMinutes: Math.round((block.estimatedStudyMinutes ?? 60) * 0.5),
        priorityScore: calcPriorityScore({
          ...baseParams,
          actionType: "REVIEW_BLOCK",
          isOverdueReview: true,
        }),
        reason: `Revisão de bloco vencida: "${block.title}" precisa ser revisada para consolidar o aprendizado.`,
      });
    }

    // 2. Flashcards vencidos (task de revisão de cards)
    if (metrics.dueReviews > 0) {
      tasks.push({
        type: "REVIEW_FLASHCARDS",
        subjectId: subject.id,
        subjectName: subject.name,
        estimatedMinutes: Math.min(metrics.dueReviews * 1, 30), // ~1 min/card, máx 30
        priorityScore: calcPriorityScore({
          ...baseParams,
          actionType: "REVIEW_FLASHCARDS",
        }),
        reason: `${metrics.dueReviews} flashcard(s) vencido(s) em ${subject.name}. Revise agora para não perder o ritmo do SRS.`,
      });
    }

    // 3. Blocos com teoria feita, mas sem flashcards → GENERATE_FLASHCARDS
    const blocksWithoutFlashcards = await (prisma as any).studyBlock.findMany({
      where: {
        subjectId: subject.id,
        userId,
        theoryStatus: "COMPLETED",
        flashcardsStatus: "NOT_STARTED",
      },
      orderBy: { theoryCompletedAt: "asc" },
      take: 2,
    });

    for (const block of blocksWithoutFlashcards) {
      tasks.push({
        type: "GENERATE_FLASHCARDS",
        subjectId: subject.id,
        subjectName: subject.name,
        studyBlockId: block.id,
        blockTitle: block.title,
        estimatedMinutes: 15,
        priorityScore: calcPriorityScore({
          ...baseParams,
          actionType: "GENERATE_FLASHCARDS",
        }),
        reason: `"${block.title}" foi estudado, mas ainda não tem flashcards. Gere agora para consolidar com SRS.`,
      });
    }

    // 4. Reforço: blocos com baixo desempenho (taxa de acerto < 60%)
    if (metrics.accuracyRate < 60 && metrics.completedBlocks > 0) {
      const weakBlock = await (prisma as any).studyBlock.findFirst({
        where: {
          subjectId: subject.id,
          userId,
          theoryStatus: "COMPLETED",
        },
        orderBy: { lastStudiedAt: "asc" },
      });

      if (weakBlock) {
        tasks.push({
          type: "REINFORCEMENT",
          subjectId: subject.id,
          subjectName: subject.name,
          studyBlockId: weakBlock.id,
          blockTitle: weakBlock.title,
          estimatedMinutes: weakBlock.estimatedStudyMinutes ?? 60,
          priorityScore: calcPriorityScore({
            ...baseParams,
            actionType: "REINFORCEMENT",
          }),
          reason: `Taxa de acerto em ${subject.name} está em ${metrics.accuracyRate}%. Reforce "${weakBlock.title}".`,
        });
      }
    }

    // 5. Blocos não iniciados → THEORY (ignoring support materials)
    const notStartedBlocks = await (prisma as any).studyBlock.findMany({
      where: {
        subjectId: subject.id,
        userId,
        theoryStatus: "NOT_STARTED",
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
    notStartedBlocks.sort((a: any, b: any) => {
      const fileA = a.material?.fileName || "";
      const fileB = b.material?.fileName || "";
      const fileCompare = fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' });
      if (fileCompare !== 0) return fileCompare;
      return a.orderIndex - b.orderIndex;
    });

    const topNotStartedBlocks = notStartedBlocks.slice(0, 2);

    for (const block of topNotStartedBlocks) {
      tasks.push({
        type: "THEORY",
        subjectId: subject.id,
        subjectName: subject.name,
        studyBlockId: block.id,
        blockTitle: block.title,
        estimatedMinutes: block.estimatedStudyMinutes ?? 60,
        priorityScore: calcPriorityScore({
          ...baseParams,
          actionType: "THEORY",
        }),
        reason: buildTheoryReason(subject.name, metrics.health),
      });
    }
  }

  // Ordenar por score decrescente e limitar
  return tasks.sort((a, b) => b.priorityScore - a.priorityScore).slice(0, limit);
}

function buildTheoryReason(
  subjectName: string,
  health: "EXCELLENT" | "GOOD" | "ATTENTION" | "CRITICAL"
): string {
  const reasonMap = {
    CRITICAL: `${subjectName} está em estado crítico. Priorize este bloco imediatamente.`,
    ATTENTION: `${subjectName} precisa de atenção. Avance no conteúdo para melhorar.`,
    GOOD: `Bloco ainda não iniciado em ${subjectName}. Bom momento para avançar.`,
    EXCELLENT: `Continue avançando em ${subjectName}, que está indo bem.`,
  };
  return reasonMap[health];
}

/**
 * Legacy: retorna a recomendação singular (mantida para compatibilidade)
 */
export async function getAdaptiveStudyRecommendation(
  userId: string
): Promise<StudyRecommendation | null> {
  const queue = await getAdaptiveStudyQueue(userId, 1);
  if (!queue.length || !queue[0].studyBlockId) return null;
  const task = queue[0];
  return {
    blockId: task.studyBlockId!,
    subjectId: task.subjectId,
    subjectName: task.subjectName,
    blockTitle: task.blockTitle ?? "",
    priorityScore: task.priorityScore,
    reason: task.reason,
    health: "GOOD",
  };
}
