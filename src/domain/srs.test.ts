import { describe, it, expect } from 'vitest';
import { createInitialCardState, review, gradeFromCorrectness, isDue } from './srs';

describe('SM-2 srs.review', () => {
  it('produces the classic 1 day -> 6 days -> ease-scaled interval sequence for consecutive good answers', () => {
    const now = new Date('2026-01-01T09:00:00Z');
    let state = createInitialCardState(now);

    state = review(state, 4, now);
    expect(state.repetitions).toBe(1);
    expect(state.interval).toBe(1);

    const day1 = new Date('2026-01-02T09:00:00Z');
    state = review(state, 4, day1);
    expect(state.repetitions).toBe(2);
    expect(state.interval).toBe(6);

    const day2 = new Date('2026-01-08T09:00:00Z');
    state = review(state, 4, day2);
    expect(state.repetitions).toBe(3);
    // third+ repetition scales by ease factor, and must grow past the flat 6-day step.
    expect(state.interval).toBeGreaterThan(6);
  });

  it('resets repetitions and interval to 1 day on a failing grade (quality < 3)', () => {
    const now = new Date('2026-01-01T09:00:00Z');
    let state = createInitialCardState(now);
    state = review(state, 5, now);
    state = review(state, 5, new Date('2026-01-02T09:00:00Z'));
    expect(state.repetitions).toBe(2);

    const failed = review(state, 1, new Date('2026-01-08T09:00:00Z'));
    expect(failed.repetitions).toBe(0);
    expect(failed.interval).toBe(1);
  });

  it('never lets the ease factor drop below 1.3', () => {
    let state = createInitialCardState(new Date('2026-01-01T00:00:00Z'));
    let day = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < 20; i++) {
      day = new Date(day.getTime() + 24 * 3600 * 1000);
      state = review(state, 0, day);
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('gradeFromCorrectness maps wrong answers to a failing SM-2 quality and correct ones to a passing one', () => {
    expect(gradeFromCorrectness(false)).toBeLessThan(3);
    expect(gradeFromCorrectness(true)).toBeGreaterThanOrEqual(3);
    expect(gradeFromCorrectness(true, true)).toBeGreaterThan(gradeFromCorrectness(true, false));
  });

  it('isDue is true once the due date has passed', () => {
    const now = new Date('2026-01-01T09:00:00Z');
    const state = review(createInitialCardState(now), 4, now);
    expect(isDue(state, now)).toBe(false);
    expect(isDue(state, new Date('2026-01-03T09:00:00Z'))).toBe(true);
  });
});
