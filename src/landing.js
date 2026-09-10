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

/* ---------- the demo panel, playing ----------
 *
 * The panel in the markup is the case already solved, which is what a reader
 * with this file blocked sees and is an honest still of the product. This
 * rewinds it and plays the solve: noise, then contributory, then pivot, then a
 * hold on all three at once.
 *
 * The hold is the point. Any drill can show a right answer; what this one does
 * differently is answer a wrong tap rather than punish it, and the only way to
 * see that is the amber beat followed by all three marks on screen together.
 * The trail never clears between them.
 *
 * Two things here are about being *noticed*, which an earlier version was not.
 * A pointer travels to each finding and taps it, so a mark always has a
 * visible cause and the panel cannot be mistaken for a screenshot -- it idles
 * with a pulse from the first frame, before it has moved at all. And the
 * rewound opening beat is short: it is dead air, and a reader who arrives
 * during it sees a still panel and scrolls on. Reading the stem is what the
 * deck itself is for; this panel only has to show what tapping does.
 */

// Cumulative: each beat adds a mark without taking away the one before it.
// `hold` runs from the moment the mark lands, so the pointer's travel and
// press are on top of it.
const DEMO_BEATS = [
  { role: null, hold: 700 },            // rewound: nothing marked, pointer idle
  { role: "noise", hold: 1800 },
  { role: "contributory", hold: 2000 },
  { role: "pivot", hold: 3400 },
];
const DEMO_TRAVEL = 520; // pointer flight; also written to CSS as --demo-travel
const DEMO_PRESS = 130;  // finger down, before the mark lands
const MARK_CLASSES = ["show-noise", "show-contributory", "show-pivot"];
const FB_CLASSES = ["fb-noise", "fb-contributory", "fb-pivot"];

function playDemo() {
  const panel = document.querySelector(".demo");
  if (!panel) return;

  const lines = [...panel.querySelectorAll(".demo-fb")];
  const stem = panel.querySelector(".demo-stem");
  if (lines.length < 3 || !stem) return; // markup predates this

  // Someone who asked for less motion gets the still they would have had
  // anyway -- the solved panel -- not a faster version of the cycle.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (still.matches) return;

  const caption = document.querySelector(".demo-caption");
  const captionSolved = caption?.textContent ?? "";

  // Created here rather than shipped in the markup: a page with this file
  // blocked shows the solved still, and a pointer resting on a panel that
  // never moves would be a lie about it.
  const cursor = document.createElement("span");
  cursor.className = "demo-cursor is-idle";
  cursor.setAttribute("aria-hidden", "true");
  cursor.style.setProperty("--demo-travel", `${DEMO_TRAVEL}ms`);
  panel.appendChild(cursor);

  let beat = 0;
  let timer = null;
  let started = false;
  let aim = null; // what the pointer is currently over, so a resize can re-aim

  /* --- where the pointer goes --- */

  // The centre of the mark's widest line box, not of its bounding box: a
  // finding that wraps across lines has a bounding-box centre that can fall in
  // the gap between them, and the pointer would tap visibly beside the text.
  function pointAt(target) {
    const box = panel.getBoundingClientRect();
    const rects = [...target.getClientRects()];
    if (!rects.length) return null;
    const line = rects.reduce((a, b) => (b.width > a.width ? b : a));
    return {
      x: line.x - box.x + line.width / 2,
      y: line.y - box.y + line.height / 2,
    };
  }

  // Resting place between cycles: under the stem, centred, where a thumb sits.
  function restPoint() {
    const box = panel.getBoundingClientRect();
    return { x: box.width / 2, y: stem.getBoundingClientRect().bottom - box.y + 12 };
  }

  function place(point, instant) {
    if (!point) return;
    if (instant) cursor.style.transition = "none";
    cursor.style.transform = `translate(${point.x}px, ${point.y}px)`;
    if (instant) {
      void cursor.offsetWidth; // commit the jump before the transition returns
      cursor.style.transition = "";
    }
  }

  /* --- the panel's state at a given beat --- */

  // Derived from the index alone, so entering a beat mid-cycle -- which is what
  // scrolling back to the panel does -- restores the marks it should already
  // be carrying instead of replaying from an empty stem.
  function show(upto) {
    panel.classList.remove(...MARK_CLASSES, ...FB_CLASSES);
    for (let i = 1; i <= upto; i++) {
      panel.classList.add(`show-${DEMO_BEATS[i].role}`);
    }
    const role = upto >= 1 ? DEMO_BEATS[upto].role : null;
    if (role) panel.classList.add(`fb-${role}`);
    for (const line of lines) {
      line.classList.toggle("is-shown", line.dataset.role === role);
    }
  }

  function enter(i) {
    beat = i;
    const { role, hold } = DEMO_BEATS[i];
    show(i - 1); // whatever the earlier beats already marked stays marked

    if (!role) {
      cursor.classList.add("is-idle");
      cursor.classList.remove("is-press");
      place(restPoint());
      timer = setTimeout(() => enter((i + 1) % DEMO_BEATS.length), hold);
      return;
    }

    const target = stem.querySelector(`mark.${role}`);
    aim = target;
    cursor.classList.remove("is-idle", "is-press");
    place(pointAt(target));

    timer = setTimeout(() => {
      cursor.classList.add("is-press");
      timer = setTimeout(() => {
        show(i);
        cursor.classList.remove("is-press");
        timer = setTimeout(() => enter((i + 1) % DEMO_BEATS.length), hold);
      }, DEMO_PRESS);
    }, DEMO_TRAVEL);
  }

  // Deferred to the first time the panel is actually on screen. Blanking it up
  // front looked fine on a desktop, where the panel is fully in view on load --
  // but on a phone it sits below the hero, so until it is worth playing the
  // panel stays the solved still the markup ships, which is the same thing a
  // blocked script leaves behind.
  function start() {
    if (!started) {
      started = true;
      panel.classList.add("is-animated");
      place(restPoint(), true); // no flight in from the corner on the first frame
      // The shipped caption says the case is shown solved. Once it is playing
      // that is no longer true, and the replacement doubles as the plainest
      // possible signal that the panel is moving. Both strings live in the
      // markup, so each language carries its own.
      if (caption?.dataset.playing) caption.textContent = caption.dataset.playing;
    }
    if (timer === null) enter(beat);
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
  }

  // A panel scrolled past should not keep the tab busy. The threshold is low
  // on purpose: a phone shows this panel a sliver at a time under the hero, and
  // a reader who can see it moving is the whole point of it moving.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.15 }
    ).observe(panel);
  } else {
    start();
  }

  // Rotating a phone rewraps the stem, which moves the finding the pointer is
  // sitting on. Re-aim without a flight, so it stays on its target rather than
  // sliding across the panel to catch up.
  addEventListener("resize", () => {
    if (!started) return;
    place(aim && !cursor.classList.contains("is-idle") ? pointAt(aim) : restPoint(), true);
  });

  // A reader who turns motion off mid-visit gets the solved panel back.
  still.addEventListener?.("change", (e) => {
    if (!e.matches) return;
    stop();
    cursor.remove();
    panel.classList.remove("is-animated", ...MARK_CLASSES, ...FB_CLASSES);
    for (const line of lines) line.classList.remove("is-shown");
    if (caption) caption.textContent = captionSolved;
  });
}

playDemo();

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
