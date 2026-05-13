import { prisma } from "@/lib/prisma";
import { getSubjectMetrics, SubjectHealth } from "@/lib/services/subject-metrics";

export interface StudyRecommendation {
  blockId: string;
  subjectId: string;
  subjectName: string;
  blockTitle: string;
  priorityScore: number;
  reason: string;
  health: SubjectHealth;
}

/**
 * Calculates the best study block for a user based on performance metrics.
 */
export async function getAdaptiveStudyRecommendation(userId: string): Promise<StudyRecommendation | null> {
  // 1. Get all subjects and their health
  const subjects = await prisma.studySubject.findMany({
    where: { userId },
    select: { id: true, name: true }
  });

  if (subjects.length === 0) return null;

  const recommendations: StudyRecommendation[] = [];

  for (const subject of subjects) {
    const metrics = await getSubjectMetrics(subject.id, userId);
    
    // 2. Find pending blocks for this subject
    const pendingBlocks = await (prisma as any).studyBlock.findMany({
      where: { 
        subjectId: subject.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      orderBy: { orderIndex: 'asc' },
      take: 1
    });

    if (pendingBlocks.length === 0) continue;

    const block = pendingBlocks[0];

    // 3. Calculate priority score
    // Base scores for health
    const healthScores = {
      CRITICAL: 100,
      ATTENTION: 60,
      GOOD: 20,
      EXCELLENT: 0
    };

    let score = healthScores[metrics.health];
    let reason = `Recomendado pois ${subject.name} está em estado ${metrics.health.toLowerCase()}.`;

    // Bonus for due reviews
    if (metrics.dueReviews > 20) {
      score += 40;
      reason = `${subject.name} precisa de atenção imediata devido a ${metrics.dueReviews} revisões vencidas.`;
    } else if (metrics.dueReviews > 0) {
      score += 20;
    }

    // Bonus for low accuracy
    if (metrics.accuracyRate < 60) {
      score += 30;
      reason = `Sua taxa de acerto em ${subject.name} está baixa (${metrics.accuracyRate}%). Reforce este conteúdo.`;
    }

    // Bonus for blocks without flashcards
    const flashcardsCount = await (prisma as any).flashcard.count({
      where: { studyBlockId: block.id }
    });
    if (flashcardsCount === 0 && block.status === 'COMPLETED') {
      // This case shouldn't happen with the PENDING filter but good for logic
      score += 25;
    }

    recommendations.push({
      blockId: block.id,
      subjectId: subject.id,
      subjectName: subject.name,
      blockTitle: block.title,
      priorityScore: score,
      reason: reason,
      health: metrics.health
    });
  }

  if (recommendations.length === 0) return null;

  // Return the one with the highest score
  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore)[0];
}
