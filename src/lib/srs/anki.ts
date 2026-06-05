/**
 * Anki-style Spaced Repetition System (SRS) algorithm implementation.
 * Based on standard Anki behavior (v2 scheduler style).
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

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;
const MAX_INTERVAL_DAYS = 30;

/**
 * Calculates the next review date and state for a flashcard based on a user rating.
 */
export function calculateNextReview(input: SRSInput, rating: FlashcardRating): SRSOutput {
  const { state, learningStep, easeFactor, intervalDays, lapseCount } = input;
  const now = new Date();
  const currentEase = easeFactor || DEFAULT_EASE_FACTOR;

  // --- NEW STATE ---
  if (state === "NEW") {
    if (rating === 1) { // AGAIN (Errei)
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 1),
      };
    }
    if (rating === 2) { // HARD (Difícil)
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 6),
      };
    }
    if (rating === 3) { // GOOD (Bom)
      return {
        state: "LEARNING",
        learningStep: 1,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 10),
      };
    }
    if (rating === 4) { // EASY (Fácil)
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: EASY_INTERVAL,
        lapseCount,
        nextReviewAt: addDaysAtStartOfDay(now, EASY_INTERVAL),
      };
    }
  }

  // --- LEARNING STATE ---
  if (state === "LEARNING") {
    if (rating === 1) { // AGAIN (Errei)
      return {
        state: "LEARNING",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 1),
      };
    }
    if (rating === 2) { // HARD (Difícil)
      // Repeat current step: 6m if step 0, 10m if step 1
      const hardMinutes = learningStep === 0 ? 6 : 10;
      return {
        state: "LEARNING",
        learningStep,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, hardMinutes),
      };
    }
    if (rating === 3) { // GOOD (Bom)
      if (learningStep === 0) {
        // Move to step 1 (10 min)
        return {
          state: "LEARNING",
          learningStep: 1,
          easeFactor: currentEase,
          intervalDays: 0,
          lapseCount,
          nextReviewAt: addMinutes(now, 10),
        };
      } else {
        // Graduate to REVIEW (1 day)
        return {
          state: "REVIEW",
          learningStep: 0,
          easeFactor: currentEase,
          intervalDays: GRADUATING_INTERVAL,
          lapseCount,
          nextReviewAt: addDaysAtStartOfDay(now, GRADUATING_INTERVAL),
        };
      }
    }
    if (rating === 4) { // EASY (Fácil)
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: EASY_INTERVAL,
        lapseCount,
        nextReviewAt: addDaysAtStartOfDay(now, EASY_INTERVAL),
      };
    }
  }

  // --- REVIEW STATE ---
  if (state === "REVIEW") {
    if (rating === 1) { // AGAIN (Errei)
      return {
        state: "RELEARNING",
        learningStep: 0,
        easeFactor: currentEase, // Anki doesn't typically change ease on Again in Review, just interval
        intervalDays: 0,
        lapseCount: lapseCount + 1,
        nextReviewAt: addMinutes(now, 10),
      };
    }
    
    let newEase = currentEase;
    let newInterval = intervalDays;

    if (rating === 2) { // HARD (Difícil)
      newEase = Math.max(MIN_EASE_FACTOR, currentEase - 0.15);
      newInterval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(intervalDays * 1.2)));
    } else if (rating === 3) { // GOOD (Bom)
      newInterval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(intervalDays * currentEase)));
    } else if (rating === 4) { // EASY (Fácil)
      newEase = currentEase + 0.15;
      newInterval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(intervalDays * currentEase * 1.3)));
    }

    return {
      state: "REVIEW",
      learningStep: 0,
      easeFactor: newEase,
      intervalDays: newInterval,
      lapseCount,
      nextReviewAt: addDaysAtStartOfDay(now, newInterval),
    };
  }

  // --- RELEARNING STATE ---
  if (state === "RELEARNING") {
    if (rating === 1 || rating === 2) { // AGAIN (Errei) or HARD (Difícil)
      return {
        state: "RELEARNING",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: 0,
        lapseCount,
        nextReviewAt: addMinutes(now, 10),
      };
    }
    if (rating === 3) { // GOOD (Bom)
      const nextInterval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays));
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: nextInterval,
        lapseCount,
        nextReviewAt: addDaysAtStartOfDay(now, 1),
      };
    }
    if (rating === 4) { // EASY (Fácil)
      const boostedInterval = Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(Math.max(intervalDays, 1) * 1.3)));
      return {
        state: "REVIEW",
        learningStep: 0,
        easeFactor: currentEase,
        intervalDays: boostedInterval,
        lapseCount,
        nextReviewAt: addDaysAtStartOfDay(now, boostedInterval),
      };
    }
  }

  // Fallback
  return { ...input, nextReviewAt: addDaysAtStartOfDay(now, 1) };
}

// Helper functions
function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Adds days to a date and returns the resulting date at 00:00:00.
 */
function addDaysAtStartOfDay(date: Date, days: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0); // Start of day
  result.setDate(result.getDate() + days);
  return result;
}
