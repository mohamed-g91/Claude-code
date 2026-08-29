// Per-group mastery state and boss-battle grading. A "group" here is a
// topic group (Ischaemic, Arrhythmia, ...), not a single fine topic.

export type MasteryLevel = 'locked' | 'learning' | 'mastered';

export interface GroupStats {
  attempts: number;
  correct: number;
}

export const BOSS_UNLOCK_ATTEMPTS = 3;
export const MASTERY_MIN_ATTEMPTS = 5;
export const MASTERY_ACCURACY_THRESHOLD = 0.8;
export const BOSS_PASS_THRESHOLD = 0.8;
export const BOSS_QUESTION_COUNT = 5;

export function emptyGroupStats(): GroupStats {
  return { attempts: 0, correct: 0 };
}

export function recordGroupAnswer(stats: GroupStats, isCorrect: boolean): GroupStats {
  return {
    attempts: stats.attempts + 1,
    correct: stats.correct + (isCorrect ? 1 : 0)
  };
}

export function accuracy(stats: GroupStats): number {
  return stats.attempts === 0 ? 0 : stats.correct / stats.attempts;
}

export function classifyMastery(stats: GroupStats): MasteryLevel {
  if (stats.attempts === 0) return 'locked';
  if (stats.attempts >= MASTERY_MIN_ATTEMPTS && accuracy(stats) >= MASTERY_ACCURACY_THRESHOLD) {
    return 'mastered';
  }
  return 'learning';
}

/** A group's boss battle unlocks once the learner has practiced it at all. */
export function isBossEligible(stats: GroupStats): boolean {
  return stats.attempts >= BOSS_UNLOCK_ATTEMPTS;
}

export interface BossResult {
  passed: boolean;
  correctCount: number;
  totalCount: number;
  accuracy: number;
}

/** Boss battles pass at >=80% (4/5 passes, 3/5 fails). */
export function gradeBossBattle(correctCount: number, totalCount: number = BOSS_QUESTION_COUNT): BossResult {
  const acc = totalCount === 0 ? 0 : correctCount / totalCount;
  return {
    passed: acc >= BOSS_PASS_THRESHOLD,
    correctCount,
    totalCount,
    accuracy: acc
  };
}
