import { describe, it, expect } from 'vitest';
import { initScoreState, applyAnswer, comboMultiplier, levelForXp, xpForLevel } from './scoring';

describe('scoring combo', () => {
  it('climbs the multiplier every 3 consecutive correct answers, capped at 3x', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(2)).toBe(1);
    expect(comboMultiplier(3)).toBe(1.5);
    expect(comboMultiplier(6)).toBe(2);
    expect(comboMultiplier(30)).toBe(3);
  });

  it('resets the combo to 0 on a wrong answer', () => {
    let state = initScoreState();
    state = applyAnswer(state, 'mcq', true);
    state = applyAnswer(state, 'mcq', true);
    expect(state.combo).toBe(2);

    state = applyAnswer(state, 'mcq', false);
    expect(state.combo).toBe(0);
  });

  it('keeps bestCombo as the running high-water mark even after a reset', () => {
    let state = initScoreState();
    for (let i = 0; i < 4; i++) state = applyAnswer(state, 'mcq', true);
    expect(state.bestCombo).toBe(4);
    state = applyAnswer(state, 'mcq', false);
    expect(state.combo).toBe(0);
    expect(state.bestCombo).toBe(4);
  });

  it('awards no XP for a wrong answer', () => {
    const state = applyAnswer(initScoreState(), 'mcq', false);
    expect(state.xp).toBe(0);
  });

  it('awards more XP per correct answer as the combo climbs', () => {
    let state = initScoreState();
    const gains: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = state.xp;
      state = applyAnswer(state, 'mcq', true);
      gains.push(state.xp - before);
    }
    // gains[0..2] at 1x, gains[3..5] at 1.5x, gains[6] at 2x
    expect(gains[0]).toBe(10);
    expect(gains[3]).toBe(15);
    expect(gains[6]).toBe(20);
  });
});

describe('levels', () => {
  it('levelForXp is the inverse of the triangular xpForLevel thresholds', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2))).toBe(2);
    expect(levelForXp(xpForLevel(3) - 1)).toBe(2);
    expect(levelForXp(xpForLevel(5))).toBe(5);
  });
});
