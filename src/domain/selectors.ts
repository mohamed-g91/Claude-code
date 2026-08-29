// Pure item-selection logic per mode. Takes plain data in, plain data out —
// no storage or React here, so it's directly unit-testable.

import type { CardState } from './srs';
import { isDue } from './srs';
import type { Question } from '../content/types';

export interface SrsEntry {
  question: Question;
  cardState: CardState;
}

/** Review mode: strictly due-first, oldest due date first. */
export function selectDue(entries: SrsEntry[], now: Date = new Date(), limit = 20): SrsEntry[] {
  return entries
    .filter((e) => isDue(e.cardState, now))
    .sort((a, b) => new Date(a.cardState.dueDate).getTime() - new Date(b.cardState.dueDate).getTime())
    .slice(0, limit);
}

/** Deterministic PRNG so weighted-random selection is testable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rapid Fire: weighted-random, favouring cards with a lower ease factor
 * (i.e. ones the learner finds harder) without ever fully excluding easy
 * cards. `rng` defaults to Math.random but accepts a seeded function for
 * deterministic tests.
 */
export function selectWeightedRandom(entries: SrsEntry[], count: number, rng: () => number = Math.random): SrsEntry[] {
  if (entries.length === 0) return [];
  const pool = entries.map((e) => ({ entry: e, weight: 1 / Math.max(e.cardState.easeFactor, 1.3) }));
  const picked: SrsEntry[] = [];
  const remaining = pool.slice();

  while (picked.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, p) => sum + p.weight, 0);
    let r = rng() * totalWeight;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      r -= remaining[i].weight;
      if (r <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining[index].entry);
    remaining.splice(index, 1);
  }

  return picked;
}

/** Boss battles: only questions from the challenged group, weakest-first. */
export function selectForBoss(entries: SrsEntry[], group: string, count = 5): SrsEntry[] {
  return entries
    .filter((e) => e.question.group === group)
    .sort((a, b) => a.cardState.easeFactor - b.cardState.easeFactor)
    .slice(0, count);
}

/** Topic tree / practice picker: entries grouped by topic group, in stable order. */
export function groupByTopicGroup(entries: SrsEntry[]): Map<string, SrsEntry[]> {
  const map = new Map<string, SrsEntry[]>();
  for (const entry of entries) {
    const key = entry.question.group;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}
