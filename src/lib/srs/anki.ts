/**
 * Anki-style Spaced Repetition System (SRS) algorithm implementation.
 * Based on SM-2 variant used by Anki.
 */

export type FlashcardRating = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy
export type FlashcardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING" | "SUSPENDED";

interface SRSInput {
  state: FlashcardState;
  learningStep: number;
  easeFactor: number;
  intervalDays: number;
  lapseCount: number;
}

interface SRSOutput {
  state: FlashcardState;
  learningStep: number;
  easeFactor: number;
  intervalDays: number;
  lapseCount: number;
  nextReviewAt: Date;
}

const LEARNING_STEPS_MINUTES = [1, 10];
const RELEARNING_STEPS_MINUTES = [10];
const MIN_EASE_FACTOR = 1.3;
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;

export function calculateNextReview(input: SRSInput, rating: FlashcardRating): SRSOutput {
  const { state, learningStep, easeFactor, intervalDays, lapseCount } = input;
  const now = new Date();

  // --- NEW STATE ---
  if (state === "NEW") {
    if (rating === 1) { // AGAIN
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, LEARNING_STEPS_MINUTES[0]),
      };
    }
    if (rating === 2) { // HARD
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 6), // Anki logic: halfway between 1m and 10m
      };
    }
    if (rating === 3) { // GOOD
      return {
        state: "LEARNING",
        learningStep: 1,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, LEARNING_STEPS_MINUTES[1]),
      };
    }
    if (rating === 4) { // EASY
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor,
        intervalDays: EASY_INTERVAL,
        lapseCount,
        nextReviewAt: addDays(now, EASY_INTERVAL),
      };
    }
  }

  // --- LEARNING STATE ---
  if (state === "LEARNING") {
    if (rating === 1) { // AGAIN
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, LEARNING_STEPS_MINUTES[0]),
      };
    }
    if (rating === 2) { // HARD
      return {
        state: "LEARNING",
        learningStep,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, LEARNING_STEPS_MINUTES[learningStep]),
      };
    }
    if (rating === 3) { // GOOD
      if (learningStep < LEARNING_STEPS_MINUTES.length - 1) {
        return {
          state: "LEARNING",
          learningStep: learningStep + 1,
          easeFactor,
          intervalDays: 0,
          lapseCount,
          nextReviewAt: addMinutes(now, LEARNING_STEPS_MINUTES[learningStep + 1]),
        };
      } else {
        // Graduate to REVIEW
        return {
          state: "REVIEW",
          learningStep: 0,
          easeFactor,
          intervalDays: GRADUATING_INTERVAL,
          lapseCount,
          nextReviewAt: addDays(now, GRADUATING_INTERVAL),
        };
      }
    }
    if (rating === 4) { // EASY
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor,
        intervalDays: EASY_INTERVAL,
        lapseCount,
        nextReviewAt: addDays(now, EASY_INTERVAL),
      };
    }
  }

  // --- REVIEW STATE ---
  if (state === "REVIEW") {
    let newEase = easeFactor;
    let newInterval = intervalDays;

    if (rating === 1) { // AGAIN
      return {
        state: "RELEARNING",
        learningStep: 0,
        easeFactor: Math.max(MIN_EASE_FACTOR, easeFactor - 0.2),
        intervalDays: 0,
        lapseCount: lapseCount + 1,
        nextReviewAt: addMinutes(now, RELEARNING_STEPS_MINUTES[0]),
      };
    }
    if (rating === 2) { // HARD
      newEase = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15);
      newInterval = Math.max(1, Math.round(intervalDays * 1.2));
    } else if (rating === 3) { // GOOD
      newInterval = Math.max(1, Math.round(intervalDays * easeFactor));
    } else if (rating === 4) { // EASY
      newEase = easeFactor + 0.15;
      newInterval = Math.max(1, Math.round(intervalDays * easeFactor * 1.3));
    }

    return {
      state: "REVIEW",
      learningStep: 0,
      easeFactor: newEase,
      intervalDays: newInterval,
      lapseCount,
      nextReviewAt: addDays(now, newInterval),
    };
  }

  // --- RELEARNING STATE ---
  if (state === "RELEARNING") {
    if (rating === 1 || rating === 2) { // AGAIN or HARD
      return {
        state: "RELEARNING",
        learningStep: 0,
        easeFactor,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, RELEARNING_STEPS_MINUTES[0]),
      };
    }
    if (rating === 3) { // GOOD
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor,
        intervalDays: Math.max(1, intervalDays),
        lapseCount,
        nextReviewAt: addDays(now, 1),
      };
    }
    if (rating === 4) { // EASY
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor,
        intervalDays: Math.max(1, Math.round(intervalDays * 1.3)),
        lapseCount,
        nextReviewAt: addDays(now, 1),
      };
    }
  }

  return { ...input, nextReviewAt: addDays(now, 1) };
}

// Helper functions
function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0); // Start of day for daily intervals
  result.setDate(result.getDate() + days);
  return result;
}
