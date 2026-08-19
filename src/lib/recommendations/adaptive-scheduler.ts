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
export interface AdaptiveSchedulerConfig {
  maxNewTheoryPerDay?: number;     // Padrão: 2 inéditos/dia
  maxBlockReviewsPerDay?: number;  // Padrão: 3 revisões/dia
  blockReviewTimeFactor?: number;
}

// Alias para retrocompatibilidade
export const getAdaptiveStudyQueue = getAdaptiveStudyPlan;

export async function getAdaptiveStudyPlan(
  userId: string,
  configOrLimit?: number | AdaptiveSchedulerConfig
): Promise<StudyTask[]> {
  const config = typeof configOrLimit === "number" 
    ? { maxNewTheoryPerDay: configOrLimit, maxBlockReviewsPerDay: 3 }
    : configOrLimit;

  const maxNewTheoryPerDay = config?.maxNewTheoryPerDay ?? 2;
  const maxBlockReviewsPerDay = config?.maxBlockReviewsPerDay ?? 3;
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

    // 1. D3: Revisões de bloco por fila de vencimento (D+5 → D+15 → D+30)
    // Apenas blocos do CFC (sourceV1BlockId: null) com teoria concluída e material oficial CFC
    const cfcFileNames = [
      "1 - Direito Administrativo_compressed.pdf",
      "3 - Direito Constitucional_compressed.pdf",
      "3 - Direito Constitucional.pdf",
      "Direito Processual Civil_compressed.pdf",
      "4 - Direito Processual do Trabalho.pdf",
      "2 - Direito do Trabalho.pdf"
    ];

    const completedAnchorBlocks = await prisma.studyBlock.findMany({
      where: {
        subjectId: subject.id,
        userId,
        theoryStatus: "COMPLETED",
        sourceV1BlockId: null,
        material: {
          originalFileName: { in: cfcFileNames }
        }
      },
      select: {
        id: true,
        title: true,
        theoryCompletedAt: true,
        lastStudiedAt: true,
        createdAt: true,
        estimatedStudyMinutes: true,
        review1dCompletedAt: true,
        review7dCompletedAt: true,
        review15dCompletedAt: true,
        review30dCompletedAt: true,
      }
    });

    const pendingReviews: { block: (typeof completedAnchorBlocks)[0]; dueDate: Date; stageName: string }[] = [];

    for (const b of completedAnchorBlocks) {
      // D0 é estritamente a data em que a teoria foi concluída (ou confirmada)
      const d0 = b.theoryCompletedAt;
      if (!d0) continue; // Sem data de conclusão de teoria, NÃO entra na fila de revisão

      const d0Date = new Date(d0);

      // Stage 1: D+5 (Grava em review1dCompletedAt)
      if (!b.review1dCompletedAt) {
        const d5 = new Date(d0Date);
        d5.setDate(d5.getDate() + 5);
        if (d5 <= now) {
          pendingReviews.push({ block: b, dueDate: d5, stageName: "D+5" });
          continue;
        }
      }

      // Stage 2: D+15 (Elegível após Stage 1 D+5 concluído, Grava em review15dCompletedAt)
      if (b.review1dCompletedAt && !b.review15dCompletedAt) {
        const d15 = new Date(d0Date);
        d15.setDate(d15.getDate() + 15);
        if (d15 <= now) {
          pendingReviews.push({ block: b, dueDate: d15, stageName: "D+15" });
          continue;
        }
      }

      // Stage 3: D+30 (Elegível após Stage 2 D+15 concluído, Grava em review30dCompletedAt)
      if (b.review15dCompletedAt && !b.review30dCompletedAt) {
        const d30 = new Date(d0Date);
        d30.setDate(d30.getDate() + 30);
        if (d30 <= now) {
          pendingReviews.push({ block: b, dueDate: d30, stageName: "D+30" });
          continue;
        }
      }
    }

    // Ordenar por data de vencimento mais antiga primeiro (mais antigo tem prioridade)
    pendingReviews.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    const topBlockReviews = pendingReviews.slice(0, maxBlockReviewsPerDay);
    const blockReviewTimeFactor = config?.blockReviewTimeFactor ?? 0.35; // Padrão 35% (~12 min para bloco de 35 min)

    for (const { block, stageName } of topBlockReviews) {
      tasks.push({
        type: "REVIEW_BLOCK",
        subjectId: subject.id,
        subjectName: subject.name,
        studyBlockId: block.id,
        blockTitle: block.title,
        estimatedMinutes: Math.max(5, Math.round((block.estimatedStudyMinutes ?? 35) * blockReviewTimeFactor)),
        priorityScore: calcPriorityScore({
          ...baseParams,
          actionType: "REVIEW_BLOCK",
          isOverdueReview: true,
        }),
        reason: `Revisão de bloco ${stageName} vencida: "${block.title}" precisa ser revisada para consolidar o aprendizado.`,
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

    // 5. Blocos não iniciados → THEORY (D1: apenas inéditos sourceV1BlockId = null e possivelmente já estudado = false; D2: domingo = 0 THEORY)
    const spDay = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
    const isSunday = spDay === 0;

    if (!isSunday) {
      const notStartedBlocks = await (prisma as any).studyBlock.findMany({
        where: {
          subjectId: subject.id,
          userId,
          theoryStatus: "NOT_STARTED",
          sourceV1BlockId: null,
          possiblyAlreadyStudied: false,
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

      const topNotStartedBlocks = notStartedBlocks.slice(0, maxNewTheoryPerDay);

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
  }

  // Ordenar por score decrescente e limitar se limite numérico fornecido
  const sorted = tasks.sort((a, b) => b.priorityScore - a.priorityScore);
  return typeof configOrLimit === "number" ? sorted.slice(0, configOrLimit) : sorted;
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
