/* Find the Pivot -- clinical reasoning drill.
 *
 * Three answer states rather than right/wrong: a learner who taps a
 * contributory finding is reasoning correctly and is told so. Marks stay on
 * screen once made, because the trail of what you tried is the useful part.
 *
 * All content is written with textContent, never innerHTML -- cases.json is
 * data, and it stays data.
 */

const STORAGE_KEY = "findthepivot.v1";
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
  notes: document.getElementById("notes"),
  resolution: document.getElementById("resolution"),
  next: document.getElementById("next"),
  score: document.getElementById("score"),
  exportBtn: document.getElementById("export-notes"),
  exportOutput: document.getElementById("export-output"),
};

let deck = null;   // { prompt, cases }
let index = 0;
let progress = {}; // caseId -> { firstAttempt: role, solved: bool }
let notes = {};    // caseId -> free-text review comment

/* ---------- persistence ---------- */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { index: 0, progress: {}, notes: {} };
    const parsed = JSON.parse(raw);
    return {
      index: Number.isInteger(parsed.index) ? parsed.index : 0,
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  } catch {
    // Private browsing, cleared storage, blocked site data -- start clean.
    return { index: 0, progress: {}, notes: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, progress, notes }));
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
  setFeedback("", null);
  el.resolution.replaceChildren();
  el.next.hidden = true;
  el.next.textContent = "Next case";
  el.next.disabled = false;

  el.meta.textContent = `${c.topic}  ·  ${index + 1} of ${deck.cases.length}`;
  el.prompt.textContent = deck.prompt;

  el.notes.value = notes[c.id] ?? "";
  el.notes.setAttribute("aria-label", `Comments for case ${index + 1}: ${c.topic}`);

  // Sentences flow into one paragraph, separated by ordinary spaces, so the
  // stem reads the way a real stem reads.
  c.clauses.forEach((clause, i) => {
    const span = document.createElement("span");
    span.className = "clause";
    span.setAttribute("role", "button");
    span.tabIndex = 0;
    span.textContent = clause.text;

    const choose = () => selectClause(span, clause, c);
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
    const hasNote = !!notes[c.id]?.trim();
    btn.classList.toggle("solved", solved);
    btn.classList.toggle("has-note", hasNote);
    btn.setAttribute(
      "aria-label",
      `Case ${i + 1}: ${c.topic}` +
        (solved ? ", solved" : "") +
        (hasNote ? ", has a comment" : "")
    );
    if (i === index) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
}

/* ---------- interaction ---------- */

function selectClause(span, clause, c) {
  // Solved cases stay readable and focusable, but inert.
  if (span.getAttribute("aria-disabled") === "true") return;

  const record = progress[c.id] ?? (progress[c.id] = {});
  if (!record.firstAttempt) record.firstAttempt = clause.role;

  span.classList.remove("pivot", "contributory", "noise");
  span.classList.add(clause.role);
  setFeedback(clause.feedback, clause.role);

  if (clause.role === "pivot") {
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
}

function showResolution(c) {
  el.resolution.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = "Why it turns on that finding";
  const p = document.createElement("p");
  p.style.margin = "0";
  p.textContent = c.resolution;
  el.resolution.append(h, p);
}

function showNext() {
  const last = index >= deck.cases.length - 1;
  el.next.textContent = last ? "Start again from the top" : "Next case";
  el.next.hidden = false;
  el.next.focus();
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

/* ---------- review comments (not shown on the published game) ---------- */

el.notes.addEventListener("input", () => {
  const c = deck.cases[index];
  notes[c.id] = el.notes.value;
  saveProgress();
  syncNav();
});

el.exportBtn.addEventListener("click", async () => {
  const entries = deck.cases
    .map((c, i) => ({ n: i + 1, c, note: (notes[c.id] ?? "").trim() }))
    .filter((x) => x.note)
    .map((x) => `Case ${x.n} (${x.c.topic}) — ${x.c.id}:\n${x.note}`);

  const revert = () => {
    el.exportBtn.textContent = "Copy all notes";
  };

  if (entries.length === 0) {
    el.exportBtn.textContent = "No notes yet";
    setTimeout(revert, 1500);
    return;
  }

  const text = entries.join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
    el.exportBtn.textContent = "Copied!";
    setTimeout(revert, 1500);
  } catch {
    // Clipboard permission denied or unavailable -- fall back to a
    // selectable box rather than a silent dead end.
    el.exportOutput.value = text;
    el.exportOutput.hidden = false;
    el.exportOutput.focus();
    el.exportOutput.select();
  }
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
    buildNav();
    const saved = loadProgress();
    progress = saved.progress;
    notes = saved.notes;
    index = saved.index < deck.cases.length ? saved.index : 0;
    renderCase();
  })
  .catch(showLoadError);
