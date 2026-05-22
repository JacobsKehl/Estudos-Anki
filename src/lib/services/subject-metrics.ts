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
  // Fetch subject counts/details, reviews, and last studied block in parallel to avoid sequential query waterfall
  const [subject, reviews, lastBlock] = await Promise.all([
    prisma.studySubject.findUnique({
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
            easeFactor: true,
          }
        }
      }
    }),
    prisma.flashcardReview.findMany({
      where: {
        userId,
        flashcard: { subjectId }
      },
      select: { rating: true },
      orderBy: { reviewedAt: 'desc' },
      take: 100 // Last 100 reviews for health calculation
    }),
    (prisma as any).studyBlock.findFirst({
      where: { subjectId, status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    })
  ]);

  if (!subject) throw new Error("Subject not found");

  const now = new Date();
  
  // 2. Process metrics
  const completedBlocks = subject.studyBlocks.filter(b => b.status === 'COMPLETED').length;
  const approvedFlashcards = subject.flashcards.filter(f => f.status === 'APPROVED').length;
  const pendingFlashcards = subject.flashcards.filter(f => f.status === 'PENDING_APPROVAL').length;
  const dueReviews = subject.flashcards.filter(f => 
    f.status === 'APPROVED' && f.nextReviewAt && f.nextReviewAt <= now
  ).length;

  const correctReviews = reviews.filter(r => r.rating >= 3).length; // 3=Good, 4=Easy
  const accuracyRate = reviews.length > 0 ? (correctReviews / reviews.length) * 100 : 100;

  // 4. Progress calculation
  const progress = subject.studyBlocks.length > 0 
    ? (completedBlocks / subject.studyBlocks.length) * 100 
    : 0;

  // 5. Health Logic
  let health: SubjectHealth = 'GOOD';
  
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

/**
 * Get global study metrics for the user
 */
export async function getGlobalMetrics(userId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Fetch subject metrics, reviews heatmap, and mastery breakdown in parallel
  const [subjectsMetrics, reviews, flashcards] = await Promise.all([
    getAllSubjectsMetrics(userId),
    prisma.flashcardReview.findMany({
      where: {
        userId,
        reviewedAt: { gte: thirtyDaysAgo }
      },
      select: {
        reviewedAt: true
      }
    }),
    (prisma as any).flashcard.groupBy({
      by: ['reviewState'],
      where: { userId, status: 'APPROVED' },
      _count: { _all: true }
    })
  ]);
  
  // Total summary
  const summary = {
    totalSubjects: subjectsMetrics.length,
    totalBlocks: subjectsMetrics.reduce((acc, s) => acc + s.metrics.totalBlocks, 0),
    completedBlocks: subjectsMetrics.reduce((acc, s) => acc + s.metrics.completedBlocks, 0),
    totalFlashcards: subjectsMetrics.reduce((acc, s) => acc + s.metrics.totalFlashcards, 0),
    approvedFlashcards: subjectsMetrics.reduce((acc, s) => acc + s.metrics.approvedFlashcards, 0),
    dueReviews: subjectsMetrics.reduce((acc, s) => acc + s.metrics.dueReviews, 0),
    averageAccuracy: subjectsMetrics.length > 0 
      ? Math.round(subjectsMetrics.reduce((acc, s) => acc + s.metrics.accuracyRate, 0) / subjectsMetrics.length) 
      : 0,
    globalProgress: subjectsMetrics.length > 0
      ? Math.round(subjectsMetrics.reduce((acc, s) => acc + s.metrics.progress, 0) / subjectsMetrics.length)
      : 0
  };

  // Group by date (ignoring time)
  const heatmap: Record<string, number> = {};
  reviews.forEach(review => {
    try {
      const dateStr = review.reviewedAt.toISOString().split('T')[0];
      heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;
    } catch (e) {
      // Ignore
    }
  });

  const mastery = {
    NEW: 0,
    LEARNING: 0,
    REVIEW: 0,
    RELEARNING: 0
  };
  flashcards.forEach((f: any) => {
    if (f.reviewState in mastery) {
      (mastery as any)[f.reviewState] = f._count._all;
    }
  });

  return {
    summary,
    subjects: subjectsMetrics,
    heatmap,
    mastery
  };
}

