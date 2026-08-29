import Dexie, { type Table } from 'dexie';
import type { CardState } from '../domain/srs';
import type { GroupStats } from '../domain/mastery';
import type { StorageProvider, Profile } from './provider';
import { defaultProfile } from './provider';
import { PROFILE_SINGLETON_KEY } from './schema';
import type { AttemptRow, CardStateRow, SessionRow, ProfileRow, GroupStatsRow } from './schema';

export class MrcpDatabase extends Dexie {
  attempts!: Table<AttemptRow, number>;
  cardStates!: Table<CardStateRow, string>;
  sessions!: Table<SessionRow, number>;
  profile!: Table<ProfileRow, string>;
  groupStats!: Table<GroupStatsRow, string>;

  constructor(name = 'mrcp-cardio-revision') {
    super(name);
    this.version(1).stores({
      attempts: '++id, questionId, mode, answeredAt',
      cardStates: 'questionId, dueDate',
      sessions: '++id, mode, startedAt',
      profile: 'key',
      groupStats: 'group'
    });
  }
}

export class DexieStorageProvider implements StorageProvider {
  private db: MrcpDatabase;

  constructor(db: MrcpDatabase = new MrcpDatabase()) {
    this.db = db;
  }

  async getCardState(questionId: string): Promise<CardState | undefined> {
    const row = await this.db.cardStates.get(questionId);
    if (!row) return undefined;
    const { questionId: _unused, ...state } = row;
    return state;
  }

  async saveCardState(questionId: string, state: CardState): Promise<void> {
    await this.db.cardStates.put({ questionId, ...state });
  }

  async getAllCardStates(): Promise<Record<string, CardState>> {
    const rows = await this.db.cardStates.toArray();
    const out: Record<string, CardState> = {};
    for (const row of rows) {
      const { questionId, ...state } = row;
      out[questionId] = state;
    }
    return out;
  }

  async recordAttempt(attempt: Omit<AttemptRow, 'id'>): Promise<void> {
    await this.db.attempts.add(attempt as AttemptRow);
  }

  async getAttempts(limit = 100): Promise<AttemptRow[]> {
    return this.db.attempts.orderBy('answeredAt').reverse().limit(limit).toArray();
  }

  async recordSession(session: Omit<SessionRow, 'id'>): Promise<void> {
    await this.db.sessions.add(session as SessionRow);
  }

  async getSessions(limit = 50): Promise<SessionRow[]> {
    return this.db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
  }

  async getProfile(): Promise<Profile> {
    const row = await this.db.profile.get(PROFILE_SINGLETON_KEY);
    if (!row) return defaultProfile();
    const { key: _unused, ...profile } = row;
    return profile;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put({ key: PROFILE_SINGLETON_KEY, ...profile });
  }

  async getGroupStats(group: string): Promise<GroupStats> {
    const row = await this.db.groupStats.get(group);
    if (!row) return { attempts: 0, correct: 0 };
    const { group: _unused, ...stats } = row;
    return stats;
  }

  async saveGroupStats(group: string, stats: GroupStats): Promise<void> {
    await this.db.groupStats.put({ group, ...stats });
  }

  async getAllGroupStats(): Promise<Record<string, GroupStats>> {
    const rows = await this.db.groupStats.toArray();
    const out: Record<string, GroupStats> = {};
    for (const row of rows) {
      const { group, ...stats } = row;
      out[group] = stats;
    }
    return out;
  }

  async resetAll(): Promise<void> {
    await this.db.transaction('rw', [this.db.attempts, this.db.cardStates, this.db.sessions, this.db.profile, this.db.groupStats], async () => {
      await this.db.attempts.clear();
      await this.db.cardStates.clear();
      await this.db.sessions.clear();
      await this.db.profile.clear();
      await this.db.groupStats.clear();
    });
  }
}

let singleton: DexieStorageProvider | null = null;

/** App-wide singleton so every screen shares one IndexedDB connection. */
export function getStorage(): StorageProvider {
  if (!singleton) singleton = new DexieStorageProvider();
  return singleton;
}
