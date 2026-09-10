// Assembles the publishable site into _site/.
//
//   node tools/build-site.mjs [outDir]
//
// The deploy workflow runs this with no arguments; the browser suite runs it
// into a temp directory and inspects what came out. It used to be shell inside
// pages.yml, where a sed escaping bug was one dry run away from shipping a
// site whose scripts 404ed.
//
// Two rules the assembly exists to enforce:
//
//   1. Nothing unpublished reaches _site. play.html is not copied, and neither
//      is src/cases.json -- serving the full deck would hand every pivot and
//      resolution of the 28 unpublished cases to anyone who guessed the URL,
//      which is exactly what leaving play.html deployed would have done.
//   2. Every asset URL carries the deploy's commit, so a returning reader
//      cannot be served a stale script out of their cache. That is not
//      hypothetical: a scroll fix was deployed, verified, and reported still
//      broken, because the old game.js was coming from cache.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = join(import.meta.dirname, "..");

// Only what the site needs -- not the test harness, and not play.html: the
// mixed deck is in preparation. The file stays in the repo because the browser
// suite drives the full deck through it.
const PAGES = ["index.html", "ar.html", "angina.html", "diabetes.html"];

// The deck file a batch page fetches, and the aggregate file the landing pages
// fetch. Both names are shared with src/game.js and src/landing.js.
const batchFile = (batch) => `cases.${batch}.json`;
const COUNTS_FILE = "counts.json";

// Stamped into src/*.js by stampVersion(); the scripts build their own fetch
// URLs from it. Kept as one literal assignment per file so the replacement is
// a single unambiguous match rather than a sweep over every URL in the file.
const VERSION_DECL = /const BUILD_VERSION = "[^"]*";/;
const versionDecl = (sha) => `const BUILD_VERSION = "${sha}";`;

// Filenames under src/ are lowercase words and hyphens -- the same shape the
// old sed matched, and what every current asset is called.
const ASSET_REF = /"src\/([a-z-]+\.(?:js|css))"/g;

// og:image and twitter:image carry absolute URLs, because a scraper does not
// resolve relative ones. Stripping the origin gives the path the site must
// actually serve, which verify() then checks really exists.
const SITE_ORIGIN = "https://mohamed-g91.github.io/find-the-pivot/";
const SOCIAL_IMAGE_REF =
  /(?:property="og:image"|name="twitter:image") content="([^"]+)"/g;

/* ---------- inputs ---------- */

// Actions provides the commit; a hand run falls back to the checkout's HEAD so
// the output is the same shape either way, and to a timestamp in a tree with
// no git (a tarball, a container without the .git directory).
function buildSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 8);
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim().slice(0, 8);
  } catch {
    return Date.now().toString(36).slice(-8);
  }
}

// Derived from the pages the build actually copies, never from a list kept
// alongside them: adding a deck page publishes its cases, and forgetting to
// add the page keeps its cases private. A second list is a second thing to
// forget, and forgetting this one leaks answers.
function publishedBatches(pages) {
  const batches = [];
  for (const page of pages) {
    const html = readFileSync(join(ROOT, page), "utf8");
    for (const m of html.matchAll(/<script\b[^>]*\bdata-batch="([^"]+)"/g)) {
      if (!batches.includes(m[1])) batches.push(m[1]);
    }
  }
  return batches;
}

/* ---------- assembly ---------- */

function copyStaticFiles(out) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const page of PAGES) cpSync(join(ROOT, page), join(out, page));

  // cases.json is filtered out here rather than copied and deleted after --
  // the full deck never lands in the output directory at all, so an aborted
  // build cannot leave it behind for the upload step to find.
  cpSync(join(ROOT, "src"), join(out, "src"), {
    recursive: true,
    filter: (src) => src !== join(ROOT, "src", "cases.json"),
  });
}

// One file per published batch, same top-level shape as cases.json so the page
// reads it with no special casing, and counts.json for the landing pages:
// aggregate numbers only, no case text. The landing pages claim "48 cases" and
// "11 specialties" and those claims stay true without shipping the 48 cases.
function writeDeckFiles(out, batches) {
  const deck = JSON.parse(readFileSync(join(ROOT, "src", "cases.json"), "utf8"));
  const cases = Array.isArray(deck.cases) ? deck.cases : [];

  const counts = {
    total: cases.length,
    topics: new Set(cases.map((c) => c.topic)).size,
    // Published batches only. An unpublished batch's size is not needed by any
    // page that ships, and its tag is a fact about unreleased content.
    batches: {},
  };

  for (const batch of batches) {
    const inBatch = cases.filter((c) => c.batch === batch);
    if (inBatch.length === 0) {
      throw new Error(
        `No cases carry batch "${batch}", but a published page asks for it`
      );
    }
    counts.batches[batch] = inBatch.length;
    // Written compact: this file is a payload, not a file anyone edits, and
    // the indentation of the repo copy is a fifth of what a reader downloads.
    writeFileSync(
      join(out, "src", batchFile(batch)),
      JSON.stringify({ ...deck, cases: inBatch })
    );
  }

  writeFileSync(
    join(out, "src", COUNTS_FILE),
    `${JSON.stringify(counts, null, 2)}\n`
  );
  return counts;
}

/* ---------- cache stamping ---------- */

function stampVersion(out, sha) {
  for (const page of PAGES) {
    const path = join(out, page);
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(ASSET_REF, `"src/$1?v=${sha}"`)
    );
  }

  // The scripts fetch their own data, so those URLs need the same stamp. They
  // are built at runtime (a deck page's filename depends on its batch), so the
  // version goes in as a constant and each script versions its own URLs.
  for (const script of ["game.js", "landing.js"]) {
    const path = join(out, "src", script);
    const source = readFileSync(path, "utf8");
    if (!VERSION_DECL.test(source)) {
      throw new Error(`src/${script} has no BUILD_VERSION declaration to stamp`);
    }
    writeFileSync(path, source.replace(VERSION_DECL, versionDecl(sha)));
  }
}

/* ---------- guards ---------- */

// A stamp that silently failed to apply is worse than a broken build: the
// deploy goes green and readers keep the cached copy. So every one of them is
// checked, and anything unstamped fails the job.
function verify(out, sha, batches) {
  const problems = [];

  if (existsSync(join(out, "src", "cases.json"))) {
    problems.push("src/cases.json reached the site -- it carries unpublished cases");
  }

  for (const page of PAGES) {
    const html = readFileSync(join(out, page), "utf8");
    const unstamped = [...html.matchAll(ASSET_REF)].map((m) => m[1]);
    if (unstamped.length > 0) {
      problems.push(`${page}: ${unstamped.join(", ")} was not stamped`);
    }
    if (!html.includes(`?v=${sha}`)) {
      problems.push(`${page}: no asset reference carries ?v=${sha}`);
    }
  }

  for (const script of ["game.js", "landing.js"]) {
    const source = readFileSync(join(out, "src", script), "utf8");
    if (!source.includes(versionDecl(sha))) {
      problems.push(`src/${script}: BUILD_VERSION was not stamped`);
    }
  }

  for (const batch of batches) {
    if (!existsSync(join(out, "src", batchFile(batch)))) {
      problems.push(`src/${batchFile(batch)} is missing`);
    }
  }

  // A page can promise an image it does not ship, and nothing downstream
  // complains: the HTML is valid, the deploy is green, and the only symptom is
  // a 404 inside a chat app's scraper where nobody sees it. That is exactly how
  // the first card shipped -- .gitignore carried `*.png`, so `git add -A`
  // skipped the file without a word and the tag pointed at nothing for a whole
  // deploy. Every og:image and twitter:image must name a file that is really in
  // the output.
  for (const page of PAGES) {
    const html = readFileSync(join(out, page), "utf8");
    for (const [, url] of html.matchAll(SOCIAL_IMAGE_REF)) {
      const local = url.replace(SITE_ORIGIN, "").split("?")[0];
      if (!existsSync(join(out, local))) {
        problems.push(`${page}: names an image the site does not carry -- ${local}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`assembly failed:\n  ${problems.join("\n  ")}`);
  }
}

/* ---------- entry point ---------- */

export function buildSite(outDir = join(ROOT, "_site")) {
  const sha = buildSha();
  const batches = publishedBatches(PAGES);
  if (batches.length === 0) {
    throw new Error("no published deck page carries a data-batch attribute");
  }

  copyStaticFiles(outDir);
  const counts = writeDeckFiles(outDir, batches);
  stampVersion(outDir, sha);
  verify(outDir, sha, batches);

  return { out: outDir, sha, batches, counts };
}

// Only when run directly -- the browser suite imports buildSite() instead.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const result = buildSite(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(
    `built ${result.out} at ${result.sha}: ` +
      `${result.batches.length} published batch(es) [${result.batches.join(", ")}], ` +
      `${result.counts.total} cases counted, no full deck published`
  );
}
