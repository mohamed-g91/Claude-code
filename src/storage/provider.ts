// StorageProvider is the seam between the app and IndexedDB. Everything
// above this interface (screens, modes, domain wiring) only ever talks to
// a StorageProvider, so swapping Dexie for a future backend is an adapter
// change, not a rewrite.

import type { CardState } from '../domain/srs';
import type { ScoreState } from '../domain/scoring';
import type { StreakState } from '../domain/streak';
import type { GroupStats } from '../domain/mastery';
import type { AttemptRow, SessionRow } from './schema';

export interface Profile {
  score: ScoreState;
  streak: StreakState;
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
}

export interface StorageProvider {
  getCardState(questionId: string): Promise<CardState | undefined>;
  saveCardState(questionId: string, state: CardState): Promise<void>;
  getAllCardStates(): Promise<Record<string, CardState>>;

  recordAttempt(attempt: Omit<AttemptRow, 'id'>): Promise<void>;
  getAttempts(limit?: number): Promise<AttemptRow[]>;

  recordSession(session: Omit<SessionRow, 'id'>): Promise<void>;
  getSessions(limit?: number): Promise<SessionRow[]>;

  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;

  getGroupStats(group: string): Promise<GroupStats>;
  saveGroupStats(group: string, stats: GroupStats): Promise<void>;
  getAllGroupStats(): Promise<Record<string, GroupStats>>;

  resetAll(): Promise<void>;
}

export function defaultProfile(): Profile {
  return {
    score: { xp: 0, combo: 0, bestCombo: 0, level: 1 },
    streak: { current: 0, longest: 0, lastActiveDateKey: null },
    dailyGoal: 20,
    theme: 'system'
  };
}
