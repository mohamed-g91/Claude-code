import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseTopicString, toPageId, stripAnswerPrefix, stripTelegramArtifacts, repairMangledLinks, normaliseRow, normaliseAll } from './normalise.mjs';
import topicGroups from '../topic-groups.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRows = JSON.parse(readFileSync(path.join(here, '..', 'fixtures', 'notion-raw.json'), 'utf-8'));

function rowByName(prefix) {
  const row = fixtureRows.find((r) => r.Name.startsWith(prefix));
  if (!row) throw new Error(`fixture row not found: ${prefix}`);
  return row;
}

describe('parseTopicString', () => {
  it('takes position 2 (index) as the fine/question topic', () => {
    const { specialty, pearlTopic, fineTopic } = parseTopicString('Cardiology,Prosthetic heart valves,Pericarditis');
    expect(specialty).toBe('Cardiology');
    expect(pearlTopic).toBe('Prosthetic heart valves');
    expect(fineTopic).toBe('Pericarditis');
  });

  it('falls back to the last element when fewer than three parts are present', () => {
    expect(parseTopicString('Cardiology,Heart failure').fineTopic).toBe('Heart failure');
    expect(parseTopicString('Cardiology').fineTopic).toBe('Cardiology');
  });

  it('trims whitespace around parts', () => {
    expect(parseTopicString(' Cardiology , Foo , Bar ').fineTopic).toBe('Bar');
  });
});

describe('the D016 regression (highest-risk detail in the plan)', () => {
  it('D016 lands under Pericarditis, not Prosthetic heart valves, despite the page Name', () => {
    const row = rowByName('D016');
    expect(row.Name).toContain('Prosthetic heart valves');
    const { fineTopic } = parseTopicString(row.Topic);
    expect(fineTopic).toBe('Pericarditis');
    expect(fineTopic).not.toBe('Prosthetic heart valves');

    const question = normaliseRow(row, topicGroups.map);
    expect(question.topic).toBe('Pericarditis');
    expect(question.correctAnswerText).toBe('Ibuprofen and colchicine');
  });

  it('D017 lands under Prosthetic heart valves', () => {
    const row = rowByName('D017');
    expect(parseTopicString(row.Topic).fineTopic).toBe('Prosthetic heart valves');
  });

  it('D018 lands under Pulmonary arterial hypertension', () => {
    const row = rowByName('D018');
    expect(parseTopicString(row.Topic).fineTopic).toBe('Pulmonary arterial hypertension');
  });

  it('D030 lands under Atrial septal defect', () => {
    const row = rowByName('D030');
    expect(parseTopicString(row.Topic).fineTopic).toBe('Atrial septal defect');
  });
});

describe('toPageId', () => {
  it('extracts and dashes the 32-hex-char Notion page id from the url', () => {
    expect(toPageId('https://app.notion.com/p/9c34ac8ede768291bdb8014d430d0afc')).toBe(
      '9c34ac8e-de76-8291-bdb8-014d430d0afc'
    );
  });

  it('handles a query string after the id', () => {
    expect(toPageId('https://app.notion.com/p/9c34ac8ede768291bdb8014d430d0afc?pvs=4')).toBe(
      '9c34ac8e-de76-8291-bdb8-014d430d0afc'
    );
  });

  it('throws on an unrecognisable url', () => {
    expect(() => toPageId('not-a-url')).toThrow();
  });

  it('is stable, not derived from the D0xx drip-slot number', () => {
    const row = rowByName('D016');
    expect(toPageId(row.url)).not.toMatch(/d016/i);
  });
});

describe('stripAnswerPrefix', () => {
  it('strips shape 1: <p><b>✅ Answer: X. ...</b></p>', () => {
    const html = '<p><b>✅ Answer: C. Ibuprofen and colchicine</b></p><p>The clinical presentation...</p>';
    expect(stripAnswerPrefix(html)).toBe('<p>The clinical presentation...</p>');
  });

  it('strips shape 2: <p>✅ <b>Answer: X. ...</b></p>, including a trailing <br>', () => {
    const html = '<p>✅ <b>Answer: E. Insert an inferior vena caval filter</b></p><br><p><b>Why this is correct</b></p>';
    expect(stripAnswerPrefix(html)).toBe('<p><b>Why this is correct</b></p>');
  });

  it('never leaves the reveal-spoiling answer line in any of the 86 real rows', () => {
    for (const row of fixtureRows) {
      const stripped = stripAnswerPrefix(row.Answer);
      expect(stripped).not.toMatch(/✅/);
      expect(stripped.toLowerCase()).not.toMatch(/^<p>\s*<b>?\s*answer:/i);
    }
  });
});

describe('normaliseRow', () => {
  it('marks the 5 vignette-less rows incomplete and keeps them MCQ-playable', () => {
    const row = rowByName('D017');
    const q = normaliseRow(row, topicGroups.map);
    expect(q.incomplete).toBe(true);
    expect(q.questionHtml).toBeNull();
    expect(q.options).toHaveLength(5);
    expect(q.correctAnswer).toBe('D');
    expect(q.correctAnswerText).toBe('3.5');
  });

  it('produces a stable id independent of the D0xx name', () => {
    const row = rowByName('D016');
    const q = normaliseRow(row, topicGroups.map);
    expect(q.id).toBe('9c34ac8e-de76-8291-bdb8-014d430d0afc');
  });

  it('leaves group null (not throwing) for an unmapped topic when called directly', () => {
    const q = normaliseRow({ ...rowByName('D016'), Topic: 'Cardiology,Foo,TotallyUnmappedTopic' }, topicGroups.map);
    expect(q.group).toBeNull();
    expect(q.topic).toBe('TotallyUnmappedTopic');
  });
});

describe('normaliseAll against the full 86-row fixture', () => {
  const { questions, unmappedTopics } = normaliseAll(fixtureRows, topicGroups.map, { strict: false });

  it('produces exactly 86 questions', () => {
    expect(questions).toHaveLength(86);
  });

  it('has 0 unmapped topics against the authored topic-groups.json', () => {
    expect(unmappedTopics).toEqual([]);
  });

  it('has exactly 5 incomplete rows', () => {
    expect(questions.filter((q) => q.incomplete)).toHaveLength(5);
  });

  it('has a valid A-E correct answer on every row', () => {
    for (const q of questions) {
      expect(['A', 'B', 'C', 'D', 'E']).toContain(q.correctAnswer);
      expect(q.correctAnswerText.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });

  it('throws in strict mode if a topic is deliberately unmapped', () => {
    expect(() => normaliseAll(fixtureRows, {}, { strict: true })).toThrow(/unmapped/i);
  });
});

// Regression: the Notion view-mode extraction path substituted a literal <br> for every
// source newline, so `</p>\n<p>` arrived as `</p><br><p>` and rendered double-spaced.
// Verified against a direct SQL query of the same rows, which returns real newlines.
describe('fixture fidelity to the Notion source', () => {
  it('carries no literal <br> tags — source newlines must stay newlines', () => {
    const offenders = fixtureRows
      .filter((r) =>
        ['Question', 'Answer', 'MRCP Pearl', 'Question stem', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5']
          .some((f) => typeof r[f] === 'string' && r[f].includes('<br>')),
      )
      .map((r) => r.Name);
    expect(offenders).toEqual([]);
  });

  it('matches SQL-verified text for D019 and D021 byte for byte', () => {
    expect(rowByName('D019').Answer).toContain(
      '<p>✅ <b>Answer: E. Insert an inferior vena caval filter</b></p>\n<p><b>Why this is correct</b></p>',
    );
    expect(rowByName('D021').Answer).toContain(
      '<p>✅ <b>Answer: C. Bradykinin</b></p>\n<p><b>Why this is correct</b></p>',
    );
  });

  it('preserves HTML entities rather than unescaping them into stray tags', () => {
    expect(rowByName('D016').Question).toContain('<b>CRP</b> 78 mg/L (&lt; 5)');
  });
});

describe('Telegram artifact stripping', () => {
  it('removes the trailing hashtag line and the lone marker paragraph', () => {
    expect(stripTelegramArtifacts('<p>❓</p><p>A vignette.</p><p>#MRCP #Question</p>')).toBe('<p>A vignette.</p>');
    expect(stripTelegramArtifacts('<p>Because X.</p><p>#MRCP #Answer</p>')).toBe('<p>Because X.</p>');
  });

  it('leaves a hashtag that is part of real prose alone', () => {
    const kept = '<p>Grade #3 murmur on examination.</p>';
    expect(stripTelegramArtifacts(kept)).toBe(kept);
  });

  it('clears every artifact across the whole bank', () => {
    const { questions } = normaliseAll(fixtureRows, topicGroups.map, { strict: false });
    const leaks = questions.filter((q) =>
      ['questionHtml', 'explanationHtml', 'pearlHtml'].some((f) => (q[f] || '').includes('#MRCP')),
    );
    expect(leaks.map((q) => q.name)).toEqual([]);
  });
});

// The Notion source itself carries mangled auto-links on D070/D071/D081, where a
// markdown link is followed by a parenthesised duplicate of the HTML after it.
describe('repairMangledLinks', () => {
  it('collapses the duplicated chunk and keeps one copy', () => {
    const mangled = '[t](http://x) ([http://x)</li></ul><p>#MRCP](http://x)</li></ul><p>#MRCP) #Answer</p>';
    const out = repairMangledLinks(mangled);
    expect(out).toBe('<a href="http://x" target="_blank" rel="noopener noreferrer">t</a></li></ul><p>#MRCP #Answer</p>');
  });

  it('does not rewrite a well-formed markdown link beyond turning it into an anchor', () => {
    expect(repairMangledLinks('see [docs](https://e.com) now')).toBe(
      'see <a href="https://e.com" target="_blank" rel="noopener noreferrer">docs</a> now',
    );
  });

  it('leaves content with no links untouched', () => {
    const plain = '<p>No links here (just parentheses).</p>';
    expect(repairMangledLinks(plain)).toBe(plain);
  });

  it('leaves no raw markdown links anywhere in the bank', () => {
    const { questions } = normaliseAll(fixtureRows, topicGroups.map, { strict: false });
    const leaks = questions.filter((q) =>
      ['questionHtml', 'explanationHtml', 'pearlHtml'].some((f) => (q[f] || '').includes('](http')),
    );
    expect(leaks.map((q) => q.name)).toEqual([]);
  });
});
