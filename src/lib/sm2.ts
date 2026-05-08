export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export type Sm2Input = {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  rating: ReviewRating;
};

export type Sm2Output = {
  easeFactor: number;
  intervalDays: number;
  repetitionCount: number;
  nextReviewAt: Date;
};

const ratingQuality: Record<ReviewRating, number> = {
  AGAIN: 1,
  HARD: 3,
  GOOD: 4,
  EASY: 5,
};

export function calculateNextReview(input: Sm2Input): Sm2Output {
  const quality = ratingQuality[input.rating];
  let ease = input.easeFactor;
  let reps = input.repetitionCount;
  let interval = input.intervalDays;

  if (quality < 3) {
    reps = 0;
    interval = input.rating === "AGAIN" ? 0 : 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else {
      const multiplier = input.rating === "EASY" ? 1.35 : input.rating === "HARD" ? 0.85 : 1;
      interval = Math.max(1, Math.round(interval * ease * multiplier));
    }
  }

  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { easeFactor: Number(ease.toFixed(2)), intervalDays: interval, repetitionCount: reps, nextReviewAt };
}
