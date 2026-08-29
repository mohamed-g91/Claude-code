import { describe, it, expect } from 'vitest';
import { initStreakState, recordActivity, effectiveDateKey, isStreakAtRisk } from './streak';

describe('streak across a day boundary', () => {
  it('increments on the next calendar day at a normal hour', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T21:00:00'));
    expect(state.current).toBe(1);

    state = recordActivity(state, new Date('2026-03-02T09:00:00'));
    expect(state.current).toBe(2);
  });

  it('a session just after midnight (grace window) continues the prior effective day rather than double-counting', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T23:30:00'));
    expect(state.current).toBe(1);

    // 00:30 the "next" calendar day, but inside the grace window -> same effective day as the 23:30 session.
    const before = state;
    state = recordActivity(state, new Date('2026-03-02T00:30:00'));
    expect(state).toEqual(before);
    expect(state.current).toBe(1);

    // The legitimate next evening still correctly advances the streak.
    state = recordActivity(state, new Date('2026-03-02T21:00:00'));
    expect(state.current).toBe(2);
  });

  it('resets to 1 after a real gap of more than one day', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T21:00:00'));
    state = recordActivity(state, new Date('2026-03-04T21:00:00'));
    expect(state.current).toBe(1);
    expect(state.longest).toBe(1);
  });

  it('tracks the longest streak independently of the current one after a break', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T21:00:00'));
    state = recordActivity(state, new Date('2026-03-02T21:00:00'));
    state = recordActivity(state, new Date('2026-03-03T21:00:00'));
    expect(state.longest).toBe(3);

    state = recordActivity(state, new Date('2026-03-10T21:00:00'));
    expect(state.current).toBe(1);
    expect(state.longest).toBe(3);
  });

  it('does not change state when called twice within the same effective day', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T09:00:00'));
    const after1 = recordActivity(state, new Date('2026-03-01T20:00:00'));
    expect(after1).toEqual(state);
  });
});

describe('effectiveDateKey', () => {
  it('shifts times before 04:00 back to the previous calendar day', () => {
    expect(effectiveDateKey(new Date('2026-03-02T02:00:00'))).toBe('2026-03-01');
    expect(effectiveDateKey(new Date('2026-03-02T04:00:00'))).toBe('2026-03-02');
  });
});

describe('isStreakAtRisk', () => {
  it('is false right after recording today, true once the effective day has moved on', () => {
    let state = initStreakState();
    state = recordActivity(state, new Date('2026-03-01T09:00:00'));
    expect(isStreakAtRisk(state, new Date('2026-03-01T20:00:00'))).toBe(false);
    expect(isStreakAtRisk(state, new Date('2026-03-02T09:00:00'))).toBe(true);
  });
});
