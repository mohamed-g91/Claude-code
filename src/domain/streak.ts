// Daily streak tracking in local time, with a small-hours grace window so a
// late-night session (e.g. 1am, still "tonight" for the user) doesn't count
// as a separate day and doesn't wrongly break tomorrow's streak either.

const GRACE_HOURS = 4;

export interface StreakState {
  current: number;
  longest: number;
  /** Local-time "effective" date key (YYYY-MM-DD) of the last counted activity. */
  lastActiveDateKey: string | null;
}

export function initStreakState(): StreakState {
  return { current: 0, longest: 0, lastActiveDateKey: null };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Anything before 04:00 local time counts toward the previous calendar day,
 * so a session that runs past midnight is treated as a continuation of the
 * evening before rather than a new day.
 */
export function effectiveDateKey(now: Date): string {
  const shifted = new Date(now.getTime());
  if (shifted.getHours() < GRACE_HOURS) {
    shifted.setDate(shifted.getDate() - 1);
  }
  return dateKey(shifted);
}

function daysBetweenKeys(a: string, b: string): number {
  const toUtcNoon = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d, 12);
  };
  return Math.round((toUtcNoon(b) - toUtcNoon(a)) / (24 * 3600 * 1000));
}

/**
 * Records one day's activity. Calling it more than once on the same
 * effective day is a no-op (does not inflate the streak). A gap of more
 * than one effective day restarts the streak at 1.
 */
export function recordActivity(state: StreakState, now: Date = new Date()): StreakState {
  const today = effectiveDateKey(now);

  if (state.lastActiveDateKey === today) {
    return state;
  }

  let current: number;
  if (state.lastActiveDateKey === null) {
    current = 1;
  } else {
    const gap = daysBetweenKeys(state.lastActiveDateKey, today);
    current = gap === 1 ? state.current + 1 : 1;
  }

  return {
    current,
    longest: Math.max(state.longest, current),
    lastActiveDateKey: today
  };
}

/** True if today's (grace-adjusted) activity has not yet been recorded, i.e. the streak is at risk. */
export function isStreakAtRisk(state: StreakState, now: Date = new Date()): boolean {
  if (state.lastActiveDateKey === null) return false;
  return state.lastActiveDateKey !== effectiveDateKey(now);
}
