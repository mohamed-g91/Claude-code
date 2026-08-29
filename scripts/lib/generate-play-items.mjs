// Deterministic, seeded generator: normalised Questions -> play items for
// MCQ, Swipe Sort, Pair Match and Bucket Match. Every item carries its source
// question id, so a bad item can be traced back to Notion and fixed.
//
// No wall-clock time or other non-deterministic input ever enters the
// output — two runs with the same questions and the same seed must produce
// byte-identical JSON (see generate-play-items.test.mjs).

const STOPLIST = [
  'no treatment required',
  'reassure and discharge',
  'refer to cardiology'
];

// ---- deterministic RNG -----------------------------------------------

function hashSeed(str) {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(array, rng) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---- text helpers -------------------------------------------------------

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deterministic "first sentence" extraction for Pair Match left cards. */
export function firstSentence(html) {
  const text = stripHtml(html).replace(/^[^\p{L}\p{N}]+/u, '');
  const match = text.match(/^.*?[.!?](?=\s|$)/);
  const sentence = match ? match[0] : text;
  return sentence.trim();
}

function normaliseForCompare(text) {
  return String(text ?? '').trim().toLowerCase();
}

// ---- MCQ ------------------------------------------------------------------

function buildMcqItems(questions) {
  return questions.map((q) => ({
    id: `${q.id}-mcq`,
    mode: 'mcq',
    questionId: q.id,
    group: q.group,
    topic: q.topic
  }));
}

// ---- Swipe Sort -------------------------------------------------------

function buildSwipeSortItems(questions, summary) {
  const items = [];
  const eligible = questions.filter((q) => !q.incomplete);
  for (const q of eligible) {
    for (const opt of q.options) {
      if (opt.text === '') continue;
      items.push({
        id: `${q.id}-swipe-${opt.key}`,
        mode: 'swipeSort',
        questionId: q.id,
        optionKey: opt.key,
        optionText: opt.text,
        truth: opt.key === q.correctAnswer,
        group: q.group,
        topic: q.topic
      });
    }
  }
  summary.rowsIn.swipeSort = eligible.length;
  summary.rejections.push(
    ...questions
      .filter((q) => q.incomplete)
      .map((q) => ({ mode: 'swipeSort', questionId: q.id, reason: 'incomplete: no vignette to swipe' }))
  );
  return items;
}

// ---- Pair Match --------------------------------------------------------

function buildPairMatchRounds(questions, rng, summary) {
  const eligible = questions.filter((q) => !q.incomplete && q.group);
  summary.rowsIn.pairMatch = eligible.length;

  const byGroup = new Map();
  for (const q of eligible) {
    if (!byGroup.has(q.group)) byGroup.set(q.group, []);
    byGroup.get(q.group).push(q);
  }
  // Deterministic order within each group, then shuffle by seed.
  for (const [group, list] of byGroup) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    byGroup.set(group, seededShuffle(list, rng));
  }

  const remaining = new Map(byGroup);
  const rounds = [];
  let roundIndex = 0;

  const groupsWithStock = () =>
    [...remaining.entries()].filter(([, list]) => list.length > 0).map(([g]) => g);

  while (groupsWithStock().length >= 4) {
    // Prefer the groups with the most remaining stock so no single small
    // group starves the whole generator.
    const orderedGroups = groupsWithStock().sort(
      (a, b) => remaining.get(b).length - remaining.get(a).length || a.localeCompare(b)
    );
    const candidateGroups = orderedGroups.slice(0, 4);

    const picked = [];
    const pickedAnswerTexts = [];
    let ok = true;

    for (const group of candidateGroups) {
      const pool = remaining.get(group);
      let chosenIndex = -1;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        const candidateAnswer = normaliseForCompare(candidate.correctAnswerText);
        // Guard: reject if this candidate's correct answer collides with
        // another already-picked question's options, or vice versa.
        const collidesForward = picked.some((p) =>
          p.options.some((o) => normaliseForCompare(o.text) === candidateAnswer)
        );
        const collidesBackward = candidate.options.some((o) =>
          pickedAnswerTexts.includes(normaliseForCompare(o.text))
        );
        if (!collidesForward && !collidesBackward) {
          chosenIndex = i;
          break;
        }
      }
      if (chosenIndex === -1) {
        ok = false;
        summary.rejections.push({
          mode: 'pairMatch',
          reason: `round ${roundIndex}: no answer-collision-free candidate left in group "${group}"`
        });
        break;
      }
      const [chosen] = pool.splice(chosenIndex, 1);
      picked.push(chosen);
      pickedAnswerTexts.push(normaliseForCompare(chosen.correctAnswerText));
    }

    if (!ok || picked.length < 4) {
      // Put back anything we pulled for this failed round attempt, and stop
      // — the remaining stock can't form another clean round.
      for (const q of picked) {
        remaining.get(q.group).push(q);
      }
      break;
    }

    rounds.push({
      id: `pair-round-${roundIndex}`,
      mode: 'pairMatch',
      pairs: picked.map((q) => ({
        questionId: q.id,
        leftText: firstSentence(q.questionHtml),
        rightText: q.correctAnswerText,
        group: q.group,
        topic: q.topic
      }))
    });
    roundIndex++;
  }

  return rounds;
}

// ---- Bucket Match -------------------------------------------------------

function buildBucketMatchRounds(questions, rng, summary) {
  summary.rowsIn.bucketMatch = questions.length;

  // Map normalised answer text -> set of groups it appears in as ANY option.
  const textToGroups = new Map();
  for (const q of questions) {
    if (!q.group) continue;
    for (const opt of q.options) {
      if (opt.text === '') continue;
      const key = normaliseForCompare(opt.text);
      if (!textToGroups.has(key)) textToGroups.set(key, new Set());
      textToGroups.get(key).add(q.group);
    }
  }

  const byGroup = new Map();
  const seenTilePerGroup = new Map();

  for (const q of questions) {
    if (!q.group) continue;
    const text = q.correctAnswerText;
    if (text === '') continue;
    const key = normaliseForCompare(text);

    if (STOPLIST.includes(key)) {
      summary.rejections.push({
        mode: 'bucketMatch',
        questionId: q.id,
        tile: text,
        reason: 'stoplist: generic answer text, ambiguous across every group'
      });
      continue;
    }

    const groupsForText = textToGroups.get(key);
    if (groupsForText && groupsForText.size > 1) {
      summary.rejections.push({
        mode: 'bucketMatch',
        questionId: q.id,
        tile: text,
        reason: `cross-group ambiguous: appears as an option under ${groupsForText.size} groups (${[...groupsForText].sort().join(', ')})`
      });
      continue;
    }

    if (!byGroup.has(q.group)) {
      byGroup.set(q.group, []);
      seenTilePerGroup.set(q.group, new Set());
    }
    // Avoid duplicate tile text within the same group's pool.
    if (seenTilePerGroup.get(q.group).has(key)) continue;
    seenTilePerGroup.get(q.group).add(key);
    byGroup.get(q.group).push({ questionId: q.id, text });
  }

  for (const [group, list] of byGroup) {
    list.sort((a, b) => a.questionId.localeCompare(b.questionId));
    byGroup.set(group, seededShuffle(list, rng));
  }

  const remaining = new Map(byGroup);
  const rounds = [];
  let roundIndex = 0;

  const groupsWithStock = () =>
    [...remaining.entries()].filter(([, list]) => list.length >= 3).map(([g]) => g);

  while (groupsWithStock().length >= 3) {
    const orderedGroups = groupsWithStock().sort(
      (a, b) => remaining.get(b).length - remaining.get(a).length || a.localeCompare(b)
    );
    const chosenGroups = orderedGroups.slice(0, 3);

    const buckets = chosenGroups.map((group) => {
      const tiles = remaining.get(group).splice(0, 3);
      return { group, tiles };
    });

    rounds.push({
      id: `bucket-round-${roundIndex}`,
      mode: 'bucketMatch',
      buckets
    });
    roundIndex++;
  }

  return rounds;
}

// ---- entry point ----------------------------------------------------------

export function generatePlayItems(questions, { seed = 'cardiology-v1' } = {}) {
  const rng = mulberry32(hashSeed(seed));
  const summary = { rowsIn: {}, itemsByMode: {}, rejections: [] };

  const sortedQuestions = questions.slice().sort((a, b) => a.id.localeCompare(b.id));

  const mcq = buildMcqItems(sortedQuestions);
  const swipeSort = buildSwipeSortItems(sortedQuestions, summary);
  const pairMatch = buildPairMatchRounds(sortedQuestions, mulberry32(hashSeed(seed + ':pairMatch')), summary);
  const bucketMatch = buildBucketMatchRounds(sortedQuestions, mulberry32(hashSeed(seed + ':bucketMatch')), summary);

  summary.rowsIn.mcq = sortedQuestions.length;
  summary.itemsByMode = {
    mcq: mcq.length,
    swipeSort: swipeSort.length,
    pairMatch: { rounds: pairMatch.length, pairs: pairMatch.length * 4 },
    bucketMatch: { rounds: bucketMatch.length, tiles: bucketMatch.length * 9 }
  };

  const output = {
    version: 1,
    seed,
    modes: { mcq, swipeSort, pairMatch, bucketMatch }
  };

  return { output, summary };
}

export function printSummary(summary) {
  console.log('Play-item generator summary');
  console.log('  rows in:', JSON.stringify(summary.rowsIn));
  console.log('  items out:', JSON.stringify(summary.itemsByMode));
  if (summary.rejections.length === 0) {
    console.log('  rejections: none');
  } else {
    console.log(`  rejections: ${summary.rejections.length}`);
    for (const r of summary.rejections) {
      console.log(`    - [${r.mode}]${r.questionId ? ` ${r.questionId}` : ''}${r.tile ? ` "${r.tile}"` : ''}: ${r.reason}`);
    }
  }
}

// Allow running standalone against the committed content JSON for a quick
// manual summary: `node scripts/lib/generate-play-items.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const contentPath = path.join(here, '..', '..', 'public', 'content', 'cardiology.v1.json');
  const content = JSON.parse(readFileSync(contentPath, 'utf-8'));
  const { summary } = generatePlayItems(content.questions, { seed: 'cardiology-v1' });
  printSummary(summary);
}
