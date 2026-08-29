// IndexedDB table row shapes (Dexie). Kept separate from the domain types so
// the domain layer never has to know it's being persisted.

import type { CardState } from '../domain/srs';
import type { ScoreState } from '../domain/scoring';
import type { StreakState } from '../domain/streak';
import type { GroupStats } from '../domain/mastery';

export interface AttemptRow {
  id?: number;
  questionId: string;
  mode: string;
  isCorrect: boolean;
  optionKey?: string;
  answeredAt: string; // ISO
}

export interface CardStateRow extends CardState {
  questionId: string; // primary key
}

export interface SessionRow {
  id?: number;
  mode: string;
  startedAt: string;
  endedAt: string;
  xpEarned: number;
  correctCount: number;
  totalCount: number;
}

export const PROFILE_SINGLETON_KEY = 'singleton';

export interface ProfileRow {
  key: string; // always PROFILE_SINGLETON_KEY
  score: ScoreState;
  streak: StreakState;
  dailyGoal: number;
  theme: 'light' | 'dark' | 'system';
}

export interface GroupStatsRow extends GroupStats {
  group: string; // primary key
}
