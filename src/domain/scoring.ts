// XP, combo multiplier and level thresholds. Pure and mode-agnostic — every
// mode calls applyAnswer with its own base XP weight.

export type PlayMode = 'mcq' | 'rapidFire' | 'swipeSort' | 'pairMatch' | 'bucketMatch' | 'boss';

export const BASE_XP: Record<PlayMode, number> = {
  mcq: 10,
  rapidFire: 8,
  swipeSort: 6,
  pairMatch: 12,
  bucketMatch: 12,
  boss: 25
};

const MAX_COMBO_MULTIPLIER = 3;
const COMBO_STEP = 3; // every 3 in a row bumps the multiplier by 0.5

export interface ScoreState {
  xp: number;
  combo: number;
  bestCombo: number;
  level: number;
}

export function initScoreState(): ScoreState {
  return { xp: 0, combo: 0, bestCombo: 0, level: 1 };
}

export function comboMultiplier(combo: number): number {
  const steps = Math.floor(combo / COMBO_STEP);
  return Math.min(1 + steps * 0.5, MAX_COMBO_MULTIPLIER);
}

/** Triangular level thresholds: level N needs 100 * N * (N-1) / 2 total XP. */
export function xpForLevel(level: number): number {
  return 100 * ((level - 1) * level) / 2;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function xpToNextLevel(state: ScoreState): number {
  return Math.max(0, xpForLevel(state.level + 1) - state.xp);
}

export function xpForAnswer(mode: PlayMode, isCorrect: boolean, comboBeforeThisAnswer: number): number {
  if (!isCorrect) return 0;
  return Math.round(BASE_XP[mode] * comboMultiplier(comboBeforeThisAnswer));
}

/**
 * Applies one answer to the running score state. A wrong answer resets the
 * combo to 0 (it does not subtract XP already earned).
 */
export function applyAnswer(state: ScoreState, mode: PlayMode, isCorrect: boolean): ScoreState {
  const gained = xpForAnswer(mode, isCorrect, state.combo);
  const combo = isCorrect ? state.combo + 1 : 0;
  const xp = state.xp + gained;
  return {
    xp,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    level: levelForXp(xp)
  };
}
