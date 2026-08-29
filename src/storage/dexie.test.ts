import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { MrcpDatabase, DexieStorageProvider } from './dexie';
import { createInitialCardState } from '../domain/srs';
import { defaultProfile } from './provider';

describe('DexieStorageProvider', () => {
  let provider: DexieStorageProvider;

  beforeEach(() => {
    // Fresh in-memory database per test.
    const db = new MrcpDatabase(`test-db-${Math.random()}`);
    provider = new DexieStorageProvider(db);
  });

  it('round-trips a card state', async () => {
    const state = createInitialCardState(new Date('2026-01-01T00:00:00Z'));
    await provider.saveCardState('q1', state);
    const read = await provider.getCardState('q1');
    expect(read).toEqual(state);
  });

  it('returns undefined for a card that was never saved', async () => {
    expect(await provider.getCardState('nope')).toBeUndefined();
  });

  it('records and lists attempts, newest first', async () => {
    await provider.recordAttempt({ questionId: 'q1', mode: 'mcq', isCorrect: true, answeredAt: '2026-01-01T00:00:00Z' });
    await provider.recordAttempt({ questionId: 'q2', mode: 'mcq', isCorrect: false, answeredAt: '2026-01-02T00:00:00Z' });
    const attempts = await provider.getAttempts();
    expect(attempts).toHaveLength(2);
    expect(attempts[0].questionId).toBe('q2');
  });

  it('returns the default profile before anything is saved, then persists updates', async () => {
    const initial = await provider.getProfile();
    expect(initial).toEqual(defaultProfile());

    const updated = { ...initial, score: { ...initial.score, xp: 42 } };
    await provider.saveProfile(updated);
    expect(await provider.getProfile()).toEqual(updated);
  });

  it('round-trips group stats and lists them all', async () => {
    await provider.saveGroupStats('Ischaemic', { attempts: 5, correct: 4 });
    await provider.saveGroupStats('Arrhythmia', { attempts: 2, correct: 1 });
    expect(await provider.getGroupStats('Ischaemic')).toEqual({ attempts: 5, correct: 4 });
    expect(await provider.getGroupStats('Unseen')).toEqual({ attempts: 0, correct: 0 });
    const all = await provider.getAllGroupStats();
    expect(Object.keys(all).sort()).toEqual(['Arrhythmia', 'Ischaemic']);
  });

  it('resetAll clears every table', async () => {
    await provider.saveCardState('q1', createInitialCardState());
    await provider.recordAttempt({ questionId: 'q1', mode: 'mcq', isCorrect: true, answeredAt: new Date().toISOString() });
    await provider.saveGroupStats('Ischaemic', { attempts: 1, correct: 1 });
    await provider.saveProfile({ ...defaultProfile(), dailyGoal: 99 });

    await provider.resetAll();

    expect(await provider.getCardState('q1')).toBeUndefined();
    expect(await provider.getAttempts()).toHaveLength(0);
    expect(await provider.getAllGroupStats()).toEqual({});
    expect(await provider.getProfile()).toEqual(defaultProfile());
  });
});
