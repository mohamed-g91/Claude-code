#!/usr/bin/env node
// Validates src/cases.json. A malformed case fails silently in the browser --
// a case with no pivot is unwinnable, one with two pivots hides the second --
// so every case is checked here before it ships.
//
// Usage: node tools/validate-cases.mjs [path-to-cases.json]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROLES = ["pivot", "contributory", "noise"];
const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(here, "..", "src", "cases.json");

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const budget = (where, what, count, max) => {
  if (count > max) {
    warnings.push(`${where}: ${what} is ${count} words (budget ${max})`);
  }
};

const isFilled = (v) => typeof v === "string" && v.trim().length > 0;
const wordCount = (v) => v.trim().split(/\s+/).length;

// Budgets, not limits: candidates said the old paragraph-long resolutions were
// too much to read, but a genuinely tangled case is allowed to need the words,
// so going over is a warning the author can weigh rather than a gate.
const BUDGET = { lead: 45, point: 25, trap: 55, total: 130, feedback: 25 };
const STATES = ["met", "failed"];

// `resolution` is either one paragraph (the cases written before the split) or
// the structured lead/points/trap form, and both ship from this one file --
// so a shape that is neither has to be caught here rather than rendering as a
// blank panel after the learner has already solved the case.
function checkResolution(where, r) {
  if (isFilled(r)) {
    budget(where, "resolution", wordCount(r), BUDGET.total);
    return;
  }
  if (r === null || typeof r !== "object" || Array.isArray(r)) {
    fail(where, "missing `resolution`");
    return;
  }

  let total = 0;

  if (!isFilled(r.lead)) fail(`${where} resolution`, "missing `lead`");
  else {
    total += wordCount(r.lead);
    budget(where, "resolution lead", wordCount(r.lead), BUDGET.lead);
  }

  if (!Array.isArray(r.points)) {
    fail(`${where} resolution`, "`points` must be an array");
  } else {
    // Fewer than two and there is nothing to compare; more than four and the
    // list is back to being a wall of text with bullets in front of it.
    if (r.points.length < 2 || r.points.length > 4) {
      fail(
        `${where} resolution`,
        `\`points\` must have 2-4 entries, got ${r.points.length}`
      );
    }
    r.points.forEach((point, k) => {
      const pw = `${where} resolution point[${k}]`;
      const text = typeof point === "string" ? point : point?.text;
      if (!isFilled(text)) {
        fail(pw, "must be a non-empty string or an object with a filled `text`");
        return;
      }
      total += wordCount(text);
      budget(where, `resolution point[${k}]`, wordCount(text), BUDGET.point);
      // `state` is optional: plenty of cases turn on no met/not-met axis at
      // all. A misspelt one is not, since it renders as no chip at all.
      const state = typeof point === "object" ? point.state : undefined;
      if (state !== undefined && !STATES.includes(state)) {
        fail(pw, `state must be one of ${STATES.join(" | ")}, got ${JSON.stringify(state)}`);
      }
    });
  }

  if (!isFilled(r.trap)) fail(`${where} resolution`, "missing `trap`");
  else {
    total += wordCount(r.trap);
    budget(where, "resolution trap", wordCount(r.trap), BUDGET.trap);
  }

  budget(where, "resolution", total, BUDGET.total);
}

let data;
try {
  data = JSON.parse(readFileSync(target, "utf8"));
} catch (err) {
  console.error(`Could not read or parse ${target}\n  ${err.message}`);
  process.exit(1);
}

if (!isFilled(data.prompt)) {
  fail("root", "`prompt` must be a non-empty string");
}

if (!Array.isArray(data.cases) || data.cases.length === 0) {
  console.error("root: `cases` must be a non-empty array");
  process.exit(1);
}

const seenIds = new Set();
const pivotPositions = new Map();

data.cases.forEach((c, i) => {
  const where = `case[${i}]${isFilled(c?.id) ? ` (${c.id})` : ""}`;

  if (!isFilled(c.id)) fail(where, "missing `id`");
  else if (seenIds.has(c.id)) fail(where, `duplicate id "${c.id}"`);
  else seenIds.add(c.id);

  if (!isFilled(c.topic)) fail(where, "missing `topic`");
  checkResolution(where, c.resolution);

  if (!Array.isArray(c.clauses) || c.clauses.length < 2) {
    fail(where, "`clauses` must be an array of at least 2 entries");
    return;
  }

  let pivots = 0;
  c.clauses.forEach((clause, j) => {
    const cw = `${where} clause[${j}]`;
    if (!isFilled(clause?.text)) fail(cw, "missing `text`");
    if (!isFilled(clause?.feedback)) fail(cw, "missing `feedback`");
    else budget(where, `clause[${j}] feedback`, wordCount(clause.feedback), BUDGET.feedback);
    if (!ROLES.includes(clause?.role)) {
      fail(cw, `role must be one of ${ROLES.join(" | ")}, got ${JSON.stringify(clause?.role)}`);
    }
    if (clause?.role === "pivot") {
      pivots += 1;
      pivotPositions.set(c.id ?? i, j + 1);
    }
  });

  // The None option is a virtual clause -- same three roles, same scoring --
  // so it counts toward the one-pivot rule. A case whose plan is correct makes
  // None the pivot and carries no pivot clause.
  if (c.none !== undefined) {
    const nw = `${where} none`;
    if (!isFilled(c.none?.feedback)) fail(nw, "missing `feedback`");
    if (!ROLES.includes(c.none?.role)) {
      fail(nw, `role must be one of ${ROLES.join(" | ")}, got ${JSON.stringify(c.none?.role)}`);
    }
    if (c.none?.role === "pivot") {
      pivots += 1;
      pivotPositions.set(c.id ?? i, "none");
    }
  }

  if (pivots === 0) fail(where, "no pivot -- the case is unwinnable");
  if (pivots > 1) fail(where, `${pivots} pivots -- only one can be reached`);

  // Not fatal, but a case with nothing in between is just a binary MCQ again.
  if (!c.clauses.some((cl) => cl?.role === "contributory")) {
    warnings.push(`${where}: no contributory clause -- reverts to right/wrong scoring`);
  }
});

// Learners quickly notice if the pivot always sits in the same place.
const total = data.cases.length;
const buckets = new Map();
for (const pos of pivotPositions.values()) {
  buckets.set(pos, (buckets.get(pos) ?? 0) + 1);
}
const byPosition = (a, b) =>
  String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true });

for (const [pos, n] of [...buckets].sort(byPosition)) {
  if (n / total > 0.4) {
    warnings.push(
      `pivot sits at position ${pos} in ${n}/${total} cases -- learners will pattern-match on position`
    );
  }
}

const spread = [...buckets]
  .sort(byPosition)
  .map(([pos, n]) => `${pos}:${n}`)
  .join("  ");

console.log(`Checked ${total} case(s) in ${target}`);
console.log(`Pivot position spread  ${spread}`);

for (const w of warnings) console.warn(`  warn  ${w}`);
for (const e of errors) console.error(`  FAIL  ${e}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s). Not shippable.`);
  process.exit(1);
}
console.log(warnings.length ? `\nOK with ${warnings.length} warning(s).` : "\nAll good.");
