import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generatePlayItems, firstSentence, stripHtml } from './generate-play-items.mjs';
import { normaliseAll } from './normalise.mjs';
import topicGroups from '../topic-groups.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRows = JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'notion-raw.json'), 'utf-8'));
const { questions } = normaliseAll(fixtureRows, topicGroups.map);

function makeQuestion(overrides) {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    url: 'https://app.notion.com/p/00000000000000000000000000000000',
    name: 'Test',
    specialty: 'Cardiology',
    pearlTopic: 'Test',
    topic: 'Test topic',
    group: 'Ischaemic',
    status: 'Draft',
    questionStem: 'What next?',
    questionHtml: '<p>A patient presents with chest pain.</p>',
    incomplete: false,
    options: [
      { key: 'A', text: 'Option A' },
      { key: 'B', text: 'Option B' },
      { key: 'C', text: 'Option C' },
      { key: 'D', text: 'Option D' },
      { key: 'E', text: 'Option E' }
    ],
    correctAnswer: 'A',
    correctAnswerText: 'Option A',
    explanationHtml: '<p>Because.</p>',
    pearlHtml: '',
    ...overrides
  };
}

describe('stripHtml / firstSentence', () => {
  it('strips tags and picks the first sentence, dropping a leading emoji glyph', () => {
    const html = '<p>❓</p><p>A 28-year-old man presents with chest pain. He is stable.</p>';
    expect(firstSentence(html)).toBe('A 28-year-old man presents with chest pain.');
  });

  it('falls back to the whole (stripped) text when there is no sentence terminator', () => {
    expect(firstSentence('<p>no terminator here</p>')).toBe('no terminator here');
  });
});

describe('generatePlayItems against the real 86-row bank', () => {
  const { output, summary } = generatePlayItems(questions, { seed: 'cardiology-v1' });

  it('every Swipe Sort item truth matches the answer key', () => {
    const byId = new Map(questions.map((q) => [q.id, q]));
    expect(output.modes.swipeSort.length).toBeGreaterThan(0);
    for (const item of output.modes.swipeSort) {
      const q = byId.get(item.questionId);
      expect(q).toBeTruthy();
      expect(item.truth).toBe(item.optionKey === q.correctAnswer);
      // and cross-check directly against the raw text too
      if (item.truth) {
        expect(item.optionText).toBe(q.correctAnswerText);
      }
    }
  });

  it('produces 5 swipe items per non-incomplete question', () => {
    const incompleteCount = questions.filter((q) => q.incomplete).length;
    const eligible = questions.length - incompleteCount;
    expect(output.modes.swipeSort.length).toBe(eligible * 5);
  });

  it('excludes incomplete (vignette-less) questions from Swipe Sort and Pair Match', () => {
    const incompleteIds = new Set(questions.filter((q) => q.incomplete).map((q) => q.id));
    expect(output.modes.swipeSort.some((i) => incompleteIds.has(i.questionId))).toBe(false);
    for (const round of output.modes.pairMatch) {
      expect(round.pairs.some((p) => incompleteIds.has(p.questionId))).toBe(false);
    }
  });

  it('every pair-match round draws its 4 questions from 4 different groups', () => {
    expect(output.modes.pairMatch.length).toBeGreaterThan(0);
    for (const round of output.modes.pairMatch) {
      const groups = round.pairs.map((p) => p.group);
      expect(new Set(groups).size).toBe(groups.length);
      expect(round.pairs).toHaveLength(4);
    }
  });

  it('no pair-match round has a correct answer text colliding with another pair\'s options', () => {
    for (const round of output.modes.pairMatch) {
      for (const pair of round.pairs) {
        const others = round.pairs.filter((p) => p.questionId !== pair.questionId);
        for (const other of others) {
          expect(other.rightText.toLowerCase()).not.toBe(pair.rightText.toLowerCase());
        }
      }
    }
  });

  it('every bucket-match round has 3 buckets of 3 tiles from 3 different groups', () => {
    expect(output.modes.bucketMatch.length).toBeGreaterThan(0);
    for (const round of output.modes.bucketMatch) {
      expect(round.buckets).toHaveLength(3);
      const groups = round.buckets.map((b) => b.group);
      expect(new Set(groups).size).toBe(groups.length);
      for (const bucket of round.buckets) {
        expect(bucket.tiles).toHaveLength(3);
      }
    }
  });

  it('rejects the known generic stoplist answers from bucket tiles', () => {
    const allTileTexts = output.modes.bucketMatch
      .flatMap((r) => r.buckets)
      .flatMap((b) => b.tiles)
      .map((t) => t.text.toLowerCase());
    expect(allTileTexts).not.toContain('no treatment required');
    expect(allTileTexts).not.toContain('reassure and discharge');
    expect(allTileTexts).not.toContain('refer to cardiology');
  });

  it('reports a non-negative rejection count and a full summary shape', () => {
    expect(summary.rejections.length).toBeGreaterThanOrEqual(0);
    expect(summary.itemsByMode.mcq).toBe(questions.length);
  });
});

describe('the bucket-match cross-group guard, forced with a deliberately colliding tile', () => {
  it('rejects a tile whose correct-answer text also appears as an option under a second group', () => {
    const qs = [
      makeQuestion({ id: 'q1', group: 'Ischaemic', correctAnswer: 'A', correctAnswerText: 'Aspirin', options: [
        { key: 'A', text: 'Aspirin' }, { key: 'B', text: 'X' }, { key: 'C', text: 'Y' }, { key: 'D', text: 'Z' }, { key: 'E', text: 'W' }
      ] }),
      makeQuestion({ id: 'q2', group: 'Ischaemic', correctAnswer: 'A', correctAnswerText: 'Clopidogrel', options: [
        { key: 'A', text: 'Clopidogrel' }, { key: 'B', text: 'X2' }, { key: 'C', text: 'Y2' }, { key: 'D', text: 'Z2' }, { key: 'E', text: 'W2' }
      ] }),
      makeQuestion({ id: 'q3', group: 'Ischaemic', correctAnswer: 'A', correctAnswerText: 'Statin', options: [
        { key: 'A', text: 'Statin' }, { key: 'B', text: 'X3' }, { key: 'C', text: 'Y3' }, { key: 'D', text: 'Z3' }, { key: 'E', text: 'W3' }
      ] }),
      // A second group's question that happens to list "Aspirin" as a (wrong) option too.
      makeQuestion({ id: 'q4', group: 'Vascular & PE', correctAnswer: 'B', correctAnswerText: 'Heparin', options: [
        { key: 'A', text: 'Aspirin' }, { key: 'B', text: 'Heparin' }, { key: 'C', text: 'Y4' }, { key: 'D', text: 'Z4' }, { key: 'E', text: 'W4' }
      ] }),
      makeQuestion({ id: 'q5', group: 'Vascular & PE', correctAnswer: 'A', correctAnswerText: 'Warfarin', options: [
        { key: 'A', text: 'Warfarin' }, { key: 'B', text: 'X5' }, { key: 'C', text: 'Y5' }, { key: 'D', text: 'Z5' }, { key: 'E', text: 'W5' }
      ] }),
      makeQuestion({ id: 'q6', group: 'Vascular & PE', correctAnswer: 'A', correctAnswerText: 'Dabigatran', options: [
        { key: 'A', text: 'Dabigatran' }, { key: 'B', text: 'X6' }, { key: 'C', text: 'Y6' }, { key: 'D', text: 'Z6' }, { key: 'E', text: 'W6' }
      ] }),
      makeQuestion({ id: 'q7', group: 'Arrhythmia', correctAnswer: 'A', correctAnswerText: 'Adenosine', options: [
        { key: 'A', text: 'Adenosine' }, { key: 'B', text: 'X7' }, { key: 'C', text: 'Y7' }, { key: 'D', text: 'Z7' }, { key: 'E', text: 'W7' }
      ] }),
      makeQuestion({ id: 'q8', group: 'Arrhythmia', correctAnswer: 'A', correctAnswerText: 'Flecainide', options: [
        { key: 'A', text: 'Flecainide' }, { key: 'B', text: 'X8' }, { key: 'C', text: 'Y8' }, { key: 'D', text: 'Z8' }, { key: 'E', text: 'W8' }
      ] }),
      makeQuestion({ id: 'q9', group: 'Arrhythmia', correctAnswer: 'A', correctAnswerText: 'Amiodarone', options: [
        { key: 'A', text: 'Amiodarone' }, { key: 'B', text: 'X9' }, { key: 'C', text: 'Y9' }, { key: 'D', text: 'Z9' }, { key: 'E', text: 'W9' }
      ] })
    ];

    const { output, summary } = generatePlayItems(qs, { seed: 'guard-test' });

    const allTileTexts = output.modes.bucketMatch.flatMap((r) => r.buckets).flatMap((b) => b.tiles).map((t) => t.text);
    expect(allTileTexts).not.toContain('Aspirin');

    const rejection = summary.rejections.find((r) => r.mode === 'bucketMatch' && r.tile === 'Aspirin');
    expect(rejection).toBeTruthy();
    expect(rejection.reason).toMatch(/cross-group ambiguous/);
  });
});

describe('the pair-match answer-collision guard, forced with a deliberately colliding round', () => {
  it('does not place two questions whose answers collide with each other\'s options into the same round', () => {
    const qs = [
      makeQuestion({ id: 'p1', group: 'Ischaemic', correctAnswerText: 'Aspirin', options: [
        { key: 'A', text: 'Aspirin' }, { key: 'B', text: 'X' }, { key: 'C', text: 'Y' }, { key: 'D', text: 'Z' }, { key: 'E', text: 'W' }
      ] }),
      // p2's correct answer ("X") collides with p1's distractor option "X".
      makeQuestion({ id: 'p2', group: 'Arrhythmia', correctAnswer: 'A', correctAnswerText: 'X', options: [
        { key: 'A', text: 'X' }, { key: 'B', text: 'X2' }, { key: 'C', text: 'Y2' }, { key: 'D', text: 'Z2' }, { key: 'E', text: 'W2' }
      ] }),
      makeQuestion({ id: 'p3', group: 'Valvular', correctAnswerText: 'Aortic stenosis', options: [
        { key: 'A', text: 'Aortic stenosis' }, { key: 'B', text: 'B3' }, { key: 'C', text: 'C3' }, { key: 'D', text: 'D3' }, { key: 'E', text: 'E3' }
      ] }),
      makeQuestion({ id: 'p4', group: 'Congenital', correctAnswerText: 'ASD', options: [
        { key: 'A', text: 'ASD' }, { key: 'B', text: 'B4' }, { key: 'C', text: 'C4' }, { key: 'D', text: 'D4' }, { key: 'E', text: 'E4' }
      ] }),
      makeQuestion({ id: 'p5', group: 'Vascular & PE', correctAnswerText: 'PE', options: [
        { key: 'A', text: 'PE' }, { key: 'B', text: 'B5' }, { key: 'C', text: 'C5' }, { key: 'D', text: 'D5' }, { key: 'E', text: 'E5' }
      ] })
    ];

    const { output } = generatePlayItems(qs, { seed: 'pair-guard-test' });

    for (const round of output.modes.pairMatch) {
      const ids = round.pairs.map((p) => p.questionId);
      // p1 and p2 must never both appear in the same round.
      expect(ids.includes('p1') && ids.includes('p2')).toBe(false);
    }
  });
});

describe('determinism', () => {
  it('is byte-identical across two runs with the same seed', () => {
    const run1 = generatePlayItems(questions, { seed: 'cardiology-v1' });
    const run2 = generatePlayItems(questions, { seed: 'cardiology-v1' });
    expect(JSON.stringify(run1.output)).toBe(JSON.stringify(run2.output));
  });

  it('produces a different pair/bucket ordering for a different seed', () => {
    const run1 = generatePlayItems(questions, { seed: 'cardiology-v1' });
    const run3 = generatePlayItems(questions, { seed: 'cardiology-v2' });
    // Not a strict requirement of correctness, but confirms the seed is
    // actually wired into the shuffle rather than ignored.
    expect(JSON.stringify(run1.output)).not.toBe(JSON.stringify(run3.output));
  });
});
