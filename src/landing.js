/* Landing page enhancement.
 *
 * The page is complete and correct with this file blocked -- the counts are
 * written into the markup as the same numbers. This only keeps them true
 * without anyone remembering to edit HTML when a case is added, and offers a
 * returning learner their place back.
 */

// Mirrors the key game.js builds for a batch page, so the landing page can
// read progress without owning a second copy of the scheme.
const BATCH = "stable-angina";
const STORAGE_KEY = `findthepivot.v1:${BATCH}`;

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

// A returning reader should not have to remember where they stopped. Reads
// the same record game.js writes; a solved-through deck offers a fresh start
// rather than dropping them on the last case they already answered.
function offerResume(batchSize) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return; // Private browsing or blocked site data -- the default label stands.
  }
  if (!saved || !Number.isInteger(saved.index) || saved.index <= 0) return;
  if (saved.index >= batchSize) return;

  const solved = Object.values(saved.progress ?? {}).filter((p) => p?.solved).length;
  if (solved >= batchSize) return;

  // The only string this file writes, so it carries both languages rather
  // than dropping English onto the Arabic page.
  const label = document.documentElement.lang === "ar"
    ? `تابع المجموعة الأولى — الحالة ${saved.index + 1} من ${batchSize}`
    : `Resume Batch 01 — case ${saved.index + 1} of ${batchSize}`;

  for (const id of ["startBatch01", "batch01Cta"]) {
    const cta = document.getElementById(id);
    if (cta) cta.textContent = label;
  }
}

fetch("src/cases.json")
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
  .then((data) => {
    const cases = Array.isArray(data.cases) ? data.cases : [];
    if (cases.length === 0) return;

    const batch = cases.filter((c) => c.batch === BATCH);
    setText("factTotal", cases.length);
    setText("factSpecialties", new Set(cases.map((c) => c.topic)).size);
    if (batch.length > 0) {
      setText("factBatch", batch.length);
      offerResume(batch.length);
    }
  })
  .catch(() => {
    // The static numbers in the markup are already correct; a failed fetch
    // must not blank them or throw a console error onto a marketing page.
  });
