/* Find the Pivot -- clinical reasoning drill.
 *
 * Three answer states rather than right/wrong: a learner who taps a
 * contributory finding is reasoning correctly and is told so. Marks stay on
 * screen once made, because the trail of what you tried is the useful part.
 *
 * All content is written with textContent, never innerHTML -- cases.json is
 * data, and it stays data.
 */

// document.currentScript is only valid while this script is executing
// synchronously, which is why it is read here at module scope rather than
// inside a later callback where it would already be null.
const BATCH = document.currentScript?.dataset.batch ?? null;

// Same-origin pages share localStorage, so an unnamespaced key would let a
// saved index from the full 33-case deck restore onto a 9-case filtered
// deck and point past its end.
const STORAGE_KEY = BATCH ? `findthepivot.v1:${BATCH}` : "findthepivot.v1";

// The learner has to be able to say "nothing here changes it", or every case
// silently promises that something does and the exercise loses half its
// difficulty. It is a virtual clause: same three roles, same scoring. A case
// whose plan is genuinely correct gives it role "pivot" and carries no pivot
// clause of its own, so the one-pivot-per-case rule still holds.
const NONE_LABEL = "None — the management is right";
const DEFAULT_NONE = {
  role: "noise",
  feedback: "Something in this stem does change what you do next.",
};
const ROLE_LABEL = {
  pivot: "Pivot",
  contributory: "Contributory",
  noise: "Not decisive",
};

const el = {
  meta: document.getElementById("meta"),
  nav: document.getElementById("nav"),
  prompt: document.getElementById("prompt"),
  stem: document.getElementById("stem"),
  feedback: document.getElementById("feedback"),
  resolution: document.getElementById("resolution"),
  none: document.getElementById("noneOption"),
  next: document.getElementById("next"),
  score: document.getElementById("score"),
};

let deck = null;   // { prompt, cases }
let index = 0;
let progress = {}; // caseId -> { firstAttempt: role, solved: bool }

/* ---------- persistence ---------- */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { index: 0, progress: {} };
    const parsed = JSON.parse(raw);
    return {
      index: Number.isInteger(parsed.index) ? parsed.index : 0,
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
    };
  } catch {
    // Private browsing, cleared storage, blocked site data -- start clean.
    return { index: 0, progress: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, progress }));
  } catch {
    // Storage is a convenience here; the game works without it.
  }
}

/* ---------- rendering ---------- */

function renderCase() {
  const c = deck.cases[index];

  // Reset every piece of per-case state. Forgetting the button here is how
  // the old version got permanently stuck on its end-of-deck label.
  el.stem.replaceChildren();
  el.none.className = "none-option";
  el.none.textContent = NONE_LABEL;
  el.none.removeAttribute("aria-disabled");
  setFeedback("", null);
  el.resolution.replaceChildren();
  el.next.hidden = true;
  el.next.textContent = "Next case";
  el.next.disabled = false;

  el.meta.textContent = `${c.topic}  ·  ${index + 1} of ${deck.cases.length}`;
  el.prompt.textContent = deck.prompt;

  // Sentences flow into one paragraph, separated by ordinary spaces, so the
  // stem reads the way a real stem reads.
  c.clauses.forEach((clause, i) => {
    const span = document.createElement("span");
    span.className = "clause";
    span.setAttribute("role", "button");
    span.tabIndex = 0;
    span.textContent = clause.text;

    const choose = () => selectOption(span, clause, c);
    span.addEventListener("click", choose);
    span.addEventListener("keydown", (e) => {
      // A real button responds to both; a span has to be told.
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        choose();
      }
    });

    el.stem.appendChild(span);
    if (i < c.clauses.length - 1) {
      el.stem.appendChild(document.createTextNode(" "));
    }
  });

  el.none.onclick = () => selectOption(el.none, c.none ?? DEFAULT_NONE, c);

  renderScore();
}

function setFeedback(text, role) {
  el.feedback.replaceChildren();
  el.feedback.className = "feedback" + (role ? ` ${role}` : "");
  if (!text) return;

  if (role) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = ROLE_LABEL[role];
    el.feedback.appendChild(tag);
  }
  el.feedback.appendChild(document.createTextNode(text));
}

function renderScore() {
  syncNav();

  const seen = Object.values(progress);
  if (seen.length === 0) {
    el.score.textContent = "";
    return;
  }
  const clean = seen.filter((p) => p.firstAttempt === "pivot").length;
  const pct = Math.round((clean / seen.length) * 100);
  el.score.textContent =
    `First-attempt pivots: ${clean} of ${seen.length} (${pct}%)`;
}

/* ---------- navigator ---------- */

// Built once, from the fixed case list -- only the current/solved marks
// change after that, handled by syncNav().
function buildNav() {
  deck.cases.forEach((c, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item";
    btn.textContent = String(i + 1);
    btn.addEventListener("click", () => jumpTo(i));
    el.nav.appendChild(btn);
  });
}

// Runs on every render: marks which case is open and which are solved, so
// the strip stays a truthful map of progress without needing its own
// separate render pass.
function syncNav() {
  [...el.nav.children].forEach((btn, i) => {
    const c = deck.cases[i];
    const solved = !!progress[c.id]?.solved;
    btn.classList.toggle("solved", solved);
    btn.setAttribute(
      "aria-label",
      `Case ${i + 1}: ${c.topic}${solved ? ", solved" : ""}`
    );
    if (i === index) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
}

/* ---------- interaction ---------- */

// Shared by the stem clauses and the None option -- they answer the same
// question, so they score and lock identically.
function selectOption(target, option, c) {
  // Solved cases stay readable and focusable, but inert.
  if (target.getAttribute("aria-disabled") === "true") return;

  const record = progress[c.id] ?? (progress[c.id] = {});
  if (!record.firstAttempt) record.firstAttempt = option.role;

  target.classList.remove("pivot", "contributory", "noise");
  target.classList.add(option.role);
  setFeedback(option.feedback, option.role);

  if (option.role === "pivot") {
    record.solved = true;
    lockCase();
    showResolution(c);
    showNext();
  }

  saveProgress();
  renderScore();
}

function lockCase() {
  for (const span of el.stem.querySelectorAll(".clause")) {
    span.setAttribute("aria-disabled", "true");
  }
  el.none.setAttribute("aria-disabled", "true");
}

function showResolution(c) {
  el.resolution.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Why it turns on that finding";
  el.resolution.appendChild(h);

  const r = c?.resolution;

  // Two shapes ship at once: the mixed deck still carries a single paragraph,
  // while newer cases carry the structured lead/points/trap form candidates
  // asked for. Anything that is not an object is treated as the old shape, so
  // a missing or malformed resolution degrades to an empty paragraph instead
  // of throwing and leaving the learner with a blank panel.
  if (r === null || typeof r !== "object") {
    const p = document.createElement("p");
    p.style.margin = "0";
    p.textContent = typeof r === "string" ? r : "";
    el.resolution.appendChild(p);
    return;
  }

  if (isFilledText(r.lead)) el.resolution.appendChild(resPara("res-lead", r.lead));

  const list = document.createElement("ul");
  list.className = "res-points";
  for (const point of Array.isArray(r.points) ? r.points : []) {
    // A point is either a bare string or { text, state } -- and an entry that
    // is neither is dropped rather than rendered as "undefined".
    const text = typeof point === "string" ? point : point?.text;
    if (!isFilledText(text)) continue;

    const li = document.createElement("li");
    const state = typeof point === "object" ? point?.state : undefined;
    if (state === "met" || state === "failed") {
      const chip = document.createElement("span");
      chip.className = `res-state ${state}`;
      chip.textContent = state === "met" ? "met" : "not met";
      li.appendChild(chip);
    }
    li.appendChild(document.createTextNode(text));
    list.appendChild(li);
  }
  if (list.children.length > 0) el.resolution.appendChild(list);

  if (isFilledText(r.trap)) el.resolution.appendChild(resPara("res-trap", r.trap));
}

function isFilledText(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function resPara(className, text) {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  return p;
}

function showNext() {
  const last = index >= deck.cases.length - 1;
  el.next.textContent = last ? "Start again from the top" : "Next case";
  el.next.hidden = false;
  // Deliberately does not take focus. Focusing the button scrolled the
  // viewport down to it, which jumped the reader straight past the
  // resolution they had just earned -- the one thing the pivot is for.
  // Focus stays on the clause they activated, and Tab still reaches the
  // button from there.
}

// Shared by the "Next case" button and the navigator -- both just move to
// a case index and render it.
function jumpTo(i) {
  index = i;
  saveProgress();
  renderCase();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

el.next.addEventListener("click", () => {
  jumpTo(index >= deck.cases.length - 1 ? 0 : index + 1);
});

/* ---------- boot ---------- */

function showLoadError(err) {
  const box = document.createElement("div");
  box.className = "error";
  box.textContent =
    "Could not load the cases. If you opened this file directly, the browser " +
    "blocks reading JSON from disk -- serve the folder over HTTP instead:";
  const code = document.createElement("code");
  code.textContent = "python3 -m http.server 8000";
  box.appendChild(code);
  if (err?.message) {
    const detail = document.createElement("code");
    detail.textContent = err.message;
    box.appendChild(detail);
  }
  el.stem.replaceChildren(box);
}

fetch("src/cases.json")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((data) => {
    deck = data;

    // A standalone-page filter, not a second data file -- cases.json stays
    // the single source of truth and this page just narrows the deck.
    if (BATCH) {
      deck = { ...deck, cases: deck.cases.filter((c) => c.batch === BATCH) };
      if (deck.cases.length === 0) {
        // Wrong tag or an empty batch is a build-time mistake, not something
        // to paper over with an empty deck -- surface it instead of leaving
        // a blank page that looks merely slow to load.
        throw new Error(`No cases found for batch "${BATCH}"`);
      }
    }

    buildNav();
    const saved = loadProgress();
    progress = saved.progress;
    // Defends against a stale/out-of-range stored index (e.g. left over from
    // a longer deck, or the deck shrinking) breaking the render below.
    index = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < deck.cases.length
      ? saved.index
      : 0;
    renderCase();
  })
  .catch(showLoadError);
