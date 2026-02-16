/**
 * SM-2 spaced repetition algorithm.
 *
 * Quality scale:
 *   0 – complete blackout
 *   1 – incorrect, but remembered upon seeing the answer
 *   2 – incorrect, but the answer felt easy to recall
 *   3 – correct with serious difficulty
 *   4 – correct after hesitation
 *   5 – perfect response
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
export type CardStatus = "new" | "learning" | "review";

export const GRADUATION_THRESHOLD = 3;

export interface SrsState {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  status: CardStatus;
}

export interface SrsResult extends SrsState {
  nextReviewAt: Date;
}

export function calculateNextReview(
  state: SrsState,
  quality: Quality
): SrsResult {
  let { easeFactor, interval, repetitions, status } = state;

  if (quality >= 3) {
    // Correct response – advance the schedule
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect – reset to the beginning
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor (applied regardless of correctness)
  easeFactor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easeFactor = Math.max(1.3, easeFactor);

  // Status transitions
  if (status === "new") {
    status = "learning";
  } else if (status === "learning" && repetitions >= GRADUATION_THRESHOLD) {
    status = "review";
  } else if (status === "review" && quality < 3) {
    status = "learning";
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { easeFactor, interval, repetitions, status, nextReviewAt };
}
