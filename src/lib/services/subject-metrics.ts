import { prisma } from "@/lib/prisma";

export type SubjectHealth = 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL';

export interface SubjectMetrics {
  totalMaterials: number;
  totalBlocks: number;
  completedBlocks: number;
  totalFlashcards: number;
  approvedFlashcards: number;
  pendingFlashcards: number;
  dueReviews: number;
  accuracyRate: number; // Percentage 0-100
  health: SubjectHealth;
  progress: number; // Percentage 0-100
  archivedFlashcards: number;
  criticalCards: number; // Cards with ease factor < 1.3 or many lapses
  lastStudiedAt: Date | null;
}

/**
 * Service to calculate metrics and health for a specific subject
 */
export async function getSubjectMetrics(subjectId: string, userId: string): Promise<SubjectMetrics> {
  // 1. Fetch counts
  const subject = await prisma.studySubject.findUnique({
    where: { id: subjectId },
    include: {
      _count: {
        select: {
          materials: true,
          studyBlocks: true,
          flashcards: true,
        }
      },
      studyBlocks: {
        select: { status: true }
      },
      flashcards: {
        select: { 
          status: true,
          nextReviewAt: true,
        }
      }
    }
  });

  if (!subject) throw new Error("Subject not found");

  const now = new Date();
  
  // 2. Process metrics
  const completedBlocks = subject.studyBlocks.filter(b => b.status === 'COMPLETED').length;
  const approvedFlashcards = subject.flashcards.filter(f => f.status === 'APPROVED').length;
  const pendingFlashcards = subject.flashcards.filter(f => f.status === 'PENDING_APPROVAL').length;
  const dueReviews = subject.flashcards.filter(f => 
    f.status === 'APPROVED' && f.nextReviewAt && f.nextReviewAt <= now
  ).length;

  // 3. Accuracy Rate (from actual reviews)
  const reviews = await prisma.flashcardReview.findMany({
    where: {
      userId,
      flashcard: { subjectId }
    },
    select: { rating: true },
    orderBy: { reviewedAt: 'desc' },
    take: 100 // Last 100 reviews for health calculation
  });

  const correctReviews = reviews.filter(r => r.rating >= 3).length; // 3=Good, 4=Easy
  const accuracyRate = reviews.length > 0 ? (correctReviews / reviews.length) * 100 : 100;

  // 4. Progress calculation
  const progress = subject.studyBlocks.length > 0 
    ? (completedBlocks / subject.studyBlocks.length) * 100 
    : 0;

  // 5. Health Logic
  let health: SubjectHealth = 'GOOD';
  
  // Weights for health
  // - High due reviews (>10) -> Attention
  // - High due reviews (>30) -> Critical
  // - Accuracy < 70% -> Attention
  // - Accuracy < 50% -> Critical
  // - Progress = 100% AND Accuracy > 90% AND Due = 0 -> Excellent
  
  if (dueReviews > 30 || accuracyRate < 50) {
    health = 'CRITICAL';
  } else if (dueReviews > 10 || accuracyRate < 75) {
    health = 'ATTENTION';
  } else if (progress > 80 && accuracyRate > 90 && dueReviews === 0) {
    health = 'EXCELLENT';
  } else {
    health = 'GOOD';
  }

  const archivedFlashcards = subject.flashcards.filter(f => f.status === 'ARCHIVED').length;
  const criticalCards = subject.flashcards.filter(f => 
    f.status === 'APPROVED' && (f as any).easeFactor < 1.3
  ).length;

  const lastBlock = await (prisma as any).studyBlock.findFirst({
    where: { subjectId, status: 'COMPLETED' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true }
  });

  return {
    totalMaterials: subject._count.materials,
    totalBlocks: subject._count.studyBlocks,
    completedBlocks,
    totalFlashcards: subject._count.flashcards,
    approvedFlashcards,
    pendingFlashcards,
    dueReviews,
    accuracyRate: Math.round(accuracyRate),
    health,
    progress: Math.round(progress),
    archivedFlashcards,
    criticalCards,
    lastStudiedAt: lastBlock?.updatedAt || null
  };
}

/**
 * Get metrics for all subjects of a user
 */
export async function getAllSubjectsMetrics(userId: string) {
  const subjects = await prisma.studySubject.findMany({
    where: { userId },
    select: { id: true, name: true }
  });

  const metricsPromises = subjects.map(s => getSubjectMetrics(s.id, userId));
  const metrics = await Promise.all(metricsPromises);

  return subjects.map((s, i) => ({
    ...s,
    metrics: metrics[i]
  }));
}
