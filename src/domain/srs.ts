// SM-2 spaced repetition, adapted so every play mode can grade the same
// underlying card. A Swipe Sort answer, an MCQ tap and a Bucket Match
// placement all funnel through `review()` with a 0-5 quality score.

export interface CardState {
  /** Number of consecutive successful (quality >= 3) reviews. */
  repetitions: number;
  /** SM-2 ease factor, floor 1.3. */
  easeFactor: number;
  /** Current interval in whole days. 0 means "never scheduled forward yet". */
  interval: number;
  /** ISO timestamp of when this card is next due. */
  dueDate: string;
  /** ISO timestamp of the last review, or null if never reviewed. */
  lastReviewed: string | null;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

export function createInitialCardState(now: Date = new Date()): CardState {
  return {
    repetitions: 0,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    dueDate: now.toISOString(),
    lastReviewed: null
  };
}

function clampQuality(quality: number): number {
  return Math.max(0, Math.min(5, quality));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Maps a simple right/wrong grade (what every game mode actually produces)
 * onto an SM-2 quality score. `fast` marks an unusually quick correct
 * answer as a stronger recall signal.
 */
export function gradeFromCorrectness(isCorrect: boolean, fast = false): number {
  if (!isCorrect) return 2;
  return fast ? 5 : 4;
}

/** Classic SM-2: `review(state, quality, now) -> state`. */
export function review(state: CardState, quality: number, now: Date = new Date()): CardState {
  const q = clampQuality(quality);

  const easeFactor = Math.max(MIN_EASE_FACTOR, state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let repetitions: number;
  let interval: number;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(state.interval * easeFactor);
  }

  return {
    repetitions,
    easeFactor,
    interval,
    dueDate: addDays(now, interval).toISOString(),
    lastReviewed: now.toISOString()
  };
}

export function isDue(state: CardState, now: Date = new Date()): boolean {
  return new Date(state.dueDate).getTime() <= now.getTime();
}
