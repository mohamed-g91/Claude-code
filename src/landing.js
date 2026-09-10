/* Landing page enhancement.
 *
 * The page is complete and correct with this file blocked -- the counts are
 * written into the markup as the same numbers. This only keeps them true
 * without anyone remembering to edit HTML when a case is added, and offers a
 * returning learner their place back.
 */

// One entry per open batch. The tag must match `batch` in cases.json and the
// `data-batch` on the deck page, because those are what game.js filters and
// namespaces on; `fact` and `ctas` are the ids this page carries for it.
// Adding a batch means adding a row here and the markup it names -- not
// touching the logic below.
const BATCHES = [
  {
    tag: "stable-angina",
    fact: "factBatch",
    ctas: ["startBatch01", "batch01Cta"],
    label: (n, total) => `Resume Batch 01 — case ${n} of ${total}`,
    labelAr: (n, total) => `تابع المجموعة الأولى — الحالة ${n} من ${total}`,
  },
  {
    tag: "type-2-diabetes",
    fact: "factBatch02",
    ctas: ["batch02Cta"],
    label: (n, total) => `Resume Batch 02 — case ${n} of ${total}`,
    labelAr: (n, total) => `تابع المجموعة الثانية — الحالة ${n} من ${total}`,
  },
];

// Mirrors the key game.js builds for a batch page, so the landing page can
// read progress without owning a second copy of the scheme.
const storageKey = (tag) => `findthepivot.v1:${tag}`;

// Stamped with the deploy's commit by tools/build-site.mjs; empty in the repo,
// where files are read straight off disk and there is no cache to get past.
const BUILD_VERSION = "";
const versioned = (path) => (BUILD_VERSION ? `${path}?v=${BUILD_VERSION}` : path);

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

// A returning reader should not have to remember where they stopped. Reads
// the same record game.js writes; a solved-through deck offers a fresh start
// rather than dropping them on the last case they already answered.
function offerResume(batch, batchSize) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey(batch.tag)) ?? "null");
  } catch {
    return; // Private browsing or blocked site data -- the default label stands.
  }
  if (!saved || !Number.isInteger(saved.index) || saved.index <= 0) return;
  if (saved.index >= batchSize) return;

  const solved = Object.values(saved.progress ?? {}).filter((p) => p?.solved).length;
  if (solved >= batchSize) return;

  // The only strings this file writes, so each batch carries both languages
  // rather than dropping English onto the Arabic page.
  const label = document.documentElement.lang === "ar"
    ? batch.labelAr(saved.index + 1, batchSize)
    : batch.label(saved.index + 1, batchSize);

  for (const id of batch.ctas) {
    const cta = document.getElementById(id);
    if (cta) cta.textContent = label;
  }
}

// The numbers, from whichever file the site being served actually has.
//
//   deployed: src/counts.json -- totals and a per-batch count, no case text.
//             The published site claims "48 cases written" and "11 specialties
//             covered" and both stay true without shipping 48 cases to say so.
//   repo:     no build step runs locally, so counts.json does not exist and the
//             same numbers are counted from src/cases.json as before.
async function loadCounts() {
  const r = await fetch(versioned("src/counts.json"));
  if (r.ok) return await r.json();

  const full = await fetch(versioned("src/cases.json"));
  if (!full.ok) return null;
  return countCases((await full.json()).cases);
}

function countCases(cases) {
  if (!Array.isArray(cases)) return null;
  const batches = {};
  for (const c of cases) {
    if (c.batch) batches[c.batch] = (batches[c.batch] ?? 0) + 1;
  }
  return {
    total: cases.length,
    topics: new Set(cases.map((c) => c.topic)).size,
    batches,
  };
}

loadCounts()
  .then((counts) => {
    if (!counts) return;

    // Each number is written only if it really is one. A malformed counts file
    // must leave the correct static markup alone rather than replace it with
    // "undefined" -- this file is an enhancement, and a broken enhancement
    // should be invisible, not visible and wrong.
    if (Number.isFinite(counts.total)) setText("factTotal", counts.total);
    if (Number.isFinite(counts.topics)) setText("factSpecialties", counts.topics);

    for (const batch of BATCHES) {
      const size = counts.batches?.[batch.tag];
      if (!size) continue;
      setText(batch.fact, size);
      offerResume(batch, size);
    }
  })
  .catch(() => {
    // The static numbers in the markup are already correct; a failed fetch
    // must not blank them or throw a console error onto a marketing page.
    // This file is enhancement only -- the page is right with it blocked.
  });
