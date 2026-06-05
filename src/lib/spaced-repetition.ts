/**
 * Spaced Repetition Algorithm (Simplified SM-2)
 */

export type ReviewRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

interface SpacedRepetitionData {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewAt: Date;
  reviewStatus: string;
}

export function calculateNextReview(
  currentData: {
    easeFactor: number;
    intervalDays: number;
    repetitionCount: number;
    reviewStatus: string;
  },
  rating: ReviewRating
): SpacedRepetitionData {
  let { easeFactor, intervalDays, repetitionCount, reviewStatus } = currentData;

  // 1. Handle "Again" (Rating 1)
  if (rating === 1) {
    repetitionCount = 0;
    intervalDays = 0; // Review again very soon (e.g., today/tomorrow)
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    reviewStatus = "LEARNING";
  } 
  // 2. Handle successful reviews (Ratings 2, 3, 4)
  else {
    if (repetitionCount === 0) {
      intervalDays = 1; // First review success = 1 day
    } else if (repetitionCount === 1) {
      intervalDays = 6; // Second review success = 6 days
    } else {
      // Standard SM-2 formula
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    // Apply rating-specific modifiers to the ease factor and interval
    if (rating === 2) { // Hard
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      intervalDays = Math.max(1, Math.round(intervalDays * 0.8)); // Reduce interval
    } else if (rating === 4) { // Easy
      easeFactor = easeFactor + 0.15;
      intervalDays = Math.round(intervalDays * 1.3); // Boost interval
    }

    intervalDays = Math.min(30, intervalDays);

    repetitionCount += 1;
    reviewStatus = intervalDays >= 21 ? "GRADUATED" : "REVIEW";
  }

  // Calculate next review date
  const nextReviewAt = new Date();
  // If interval is 0, set to 10 minutes from now (for same-day relearning simulation)
  if (intervalDays === 0) {
    nextReviewAt.setMinutes(nextReviewAt.getMinutes() + 10);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
    nextReviewAt.setHours(0, 0, 0, 0); // Start of day for daily reviews
  }

  return {
    easeFactor,
    intervalDays,
    repetitionCount,
    nextReviewAt,
    reviewStatus,
  };
}
