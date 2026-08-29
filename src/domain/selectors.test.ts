import { describe, it, expect } from 'vitest';
import { selectDue, selectWeightedRandom, selectForBoss, groupByTopicGroup, mulberry32 } from './selectors';
import { createInitialCardState } from './srs';
import type { Question } from '../content/types';
import type { SrsEntry } from './selectors';

function makeQuestion(id: string, group: string): Question {
  return {
    id,
    url: `https://app.notion.com/p/${id}`,
    name: id,
    specialty: 'Cardiology',
    pearlTopic: group,
    topic: group,
    group,
    status: 'Posted',
    questionStem: 'stem',
    questionHtml: '<p>vignette</p>',
    incomplete: false,
    options: [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
      { key: 'C', text: 'c' },
      { key: 'D', text: 'd' },
      { key: 'E', text: 'e' }
    ],
    correctAnswer: 'A',
    correctAnswerText: 'a',
    explanationHtml: '<p>because</p>',
    pearlHtml: ''
  };
}

function makeEntry(id: string, group: string, dueOffsetDays: number, easeFactor = 2.5): SrsEntry {
  const now = new Date('2026-01-01T00:00:00Z');
  const due = new Date(now.getTime() + dueOffsetDays * 24 * 3600 * 1000);
  return {
    question: makeQuestion(id, group),
    cardState: { ...createInitialCardState(now), dueDate: due.toISOString(), easeFactor }
  };
}

describe('selectDue', () => {
  it('returns only due cards, oldest due date first', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const entries = [
      makeEntry('future', 'Ischaemic', 50),
      makeEntry('overdue-old', 'Ischaemic', -10),
      makeEntry('overdue-new', 'Ischaemic', -1)
    ];
    const due = selectDue(entries, now, 10);
    expect(due.map((e) => e.question.id)).toEqual(['overdue-old', 'overdue-new']);
  });

  it('respects the limit', () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const entries = [makeEntry('a', 'X', -1), makeEntry('b', 'X', -2), makeEntry('c', 'X', -3)];
    expect(selectDue(entries, now, 2)).toHaveLength(2);
  });
});

describe('selectWeightedRandom', () => {
  it('is deterministic for a seeded rng', () => {
    const entries = [makeEntry('a', 'X', 0, 2.5), makeEntry('b', 'X', 0, 1.3), makeEntry('c', 'X', 0, 2.5)];
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const pick1 = selectWeightedRandom(entries, 2, rng1).map((e) => e.question.id);
    const pick2 = selectWeightedRandom(entries, 2, rng2).map((e) => e.question.id);
    expect(pick1).toEqual(pick2);
  });

  it('never returns more than the available entries', () => {
    const entries = [makeEntry('a', 'X', 0)];
    expect(selectWeightedRandom(entries, 5, mulberry32(1))).toHaveLength(1);
  });

  it('never duplicates an entry within one selection', () => {
    const entries = ['a', 'b', 'c', 'd'].map((id) => makeEntry(id, 'X', 0));
    const picked = selectWeightedRandom(entries, 4, mulberry32(7));
    const ids = picked.map((e) => e.question.id);
    expect(new Set(ids).size).toBe(4);
  });
});

describe('selectForBoss', () => {
  it('only returns questions from the challenged group', () => {
    const entries = [makeEntry('a', 'Ischaemic', 0), makeEntry('b', 'Arrhythmia', 0), makeEntry('c', 'Ischaemic', 0)];
    const boss = selectForBoss(entries, 'Ischaemic', 5);
    expect(boss.every((e) => e.question.group === 'Ischaemic')).toBe(true);
    expect(boss).toHaveLength(2);
  });

  it('prefers the weakest (lowest ease factor) cards first', () => {
    const entries = [
      makeEntry('strong', 'Ischaemic', 0, 2.8),
      makeEntry('weak', 'Ischaemic', 0, 1.3)
    ];
    const boss = selectForBoss(entries, 'Ischaemic', 1);
    expect(boss[0].question.id).toBe('weak');
  });
});

describe('groupByTopicGroup', () => {
  it('buckets entries by their question group', () => {
    const entries = [makeEntry('a', 'Ischaemic', 0), makeEntry('b', 'Arrhythmia', 0), makeEntry('c', 'Ischaemic', 0)];
    const grouped = groupByTopicGroup(entries);
    expect(grouped.get('Ischaemic')).toHaveLength(2);
    expect(grouped.get('Arrhythmia')).toHaveLength(1);
  });
});
