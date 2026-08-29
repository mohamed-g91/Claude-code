import { describe, it, expect } from 'vitest';
import {
  emptyGroupStats,
  recordGroupAnswer,
  classifyMastery,
  isBossEligible,
  gradeBossBattle
} from './mastery';

describe('boss battle grading', () => {
  it('passes at 4/5', () => {
    const result = gradeBossBattle(4, 5);
    expect(result.passed).toBe(true);
  });

  it('fails at 3/5', () => {
    const result = gradeBossBattle(3, 5);
    expect(result.passed).toBe(false);
  });

  it('passes at exactly the 80% threshold and fails just under it', () => {
    expect(gradeBossBattle(8, 10).passed).toBe(true);
    expect(gradeBossBattle(7, 10).passed).toBe(false);
  });
});

describe('mastery classification', () => {
  it('starts locked with no attempts', () => {
    expect(classifyMastery(emptyGroupStats())).toBe('locked');
  });

  it('is learning with some attempts below the mastery bar', () => {
    let stats = emptyGroupStats();
    for (let i = 0; i < 5; i++) stats = recordGroupAnswer(stats, i < 2);
    expect(classifyMastery(stats)).toBe('learning');
  });

  it('is mastered once attempts and accuracy both clear the bar', () => {
    let stats = emptyGroupStats();
    for (let i = 0; i < 5; i++) stats = recordGroupAnswer(stats, true);
    expect(classifyMastery(stats)).toBe('mastered');
  });

  it('does not call a 1-attempt 100% streak mastered (needs the minimum sample size)', () => {
    const stats = recordGroupAnswer(emptyGroupStats(), true);
    expect(classifyMastery(stats)).toBe('learning');
  });
});

describe('boss eligibility', () => {
  it('locks the boss until the group has been practiced enough', () => {
    let stats = emptyGroupStats();
    expect(isBossEligible(stats)).toBe(false);
    stats = recordGroupAnswer(stats, true);
    stats = recordGroupAnswer(stats, false);
    expect(isBossEligible(stats)).toBe(false);
    stats = recordGroupAnswer(stats, true);
    expect(isBossEligible(stats)).toBe(true);
  });
});
