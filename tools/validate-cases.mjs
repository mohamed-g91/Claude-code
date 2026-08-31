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

const isFilled = (v) => typeof v === "string" && v.trim().length > 0;

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
  if (!isFilled(c.resolution)) fail(where, "missing `resolution`");

  if (!Array.isArray(c.clauses) || c.clauses.length < 2) {
    fail(where, "`clauses` must be an array of at least 2 entries");
    return;
  }

  let pivots = 0;
  c.clauses.forEach((clause, j) => {
    const cw = `${where} clause[${j}]`;
    if (!isFilled(clause?.text)) fail(cw, "missing `text`");
    if (!isFilled(clause?.feedback)) fail(cw, "missing `feedback`");
    if (!ROLES.includes(clause?.role)) {
      fail(cw, `role must be one of ${ROLES.join(" | ")}, got ${JSON.stringify(clause?.role)}`);
    }
    if (clause?.role === "pivot") {
      pivots += 1;
      pivotPositions.set(c.id ?? i, j + 1);
    }
  });

  if (pivots === 0) fail(where, "no pivot clause -- the case is unwinnable");
  if (pivots > 1) fail(where, `${pivots} pivot clauses -- only one can be reached`);

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
for (const [pos, n] of [...buckets].sort((a, b) => a[0] - b[0])) {
  if (n / total > 0.4) {
    warnings.push(
      `pivot sits at position ${pos} in ${n}/${total} cases -- learners will pattern-match on position`
    );
  }
}

const spread = [...buckets]
  .sort((a, b) => a[0] - b[0])
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
