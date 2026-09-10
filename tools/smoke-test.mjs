// End-to-end checks for the three-state interaction, accessibility and
// persistence. Needs the site served over HTTP (fetch is blocked on file://):
//
//   python3 -m http.server 8000 &
//   node tools/smoke-test.mjs
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { globSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildSite } from "./build-site.mjs";

const URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8000/play.html";

// Deck size and the last case's pivot come from the data, never hardcoded --
// otherwise adding a case fails the suite on a count rather than on a bug.
// join(), not new URL() -- the page address below shadows the global URL.
const DECK = JSON.parse(readFileSync(
  join(import.meta.dirname, "..", "src", "cases.json"), "utf8"));
const CASES = DECK.cases;
const N = CASES.length;
// The last case's pivot may live on a stem clause, or (for a case whose plan
// is already right) on `none` instead -- there is never both, so exactly one
// of these resolves to a usable target for solving the last case below.
const LAST_PIVOT = CASES[N - 1].clauses.findIndex((c) => c.role === "pivot");
const LAST_PIVOT_IS_NONE = LAST_PIVOT === -1 && CASES[N - 1].none?.role === "pivot";
const results = [];
const check = (name, ok, detail = "") =>
  results.push({ name, ok, detail });

// A page served straight from the repo asks for its build-time deck file
// first -- src/cases.<batch>.json, or src/counts.json on a landing page --
// and falls back to src/cases.json when it is not there. Only a built _site
// carries those files, so that first request is a 404 by design here, and it
// is the one 404 the suite tolerates: anything else is a broken reference.
// Note the dot in the name -- a 404 on src/cases.json itself is real breakage
// and still fails, because the fallback is what the whole site rests on.
const BUILT_DECK_FILE = /\/src\/(?:cases\.[a-z0-9-]+\.json|counts\.json)(?:\?|$)/;
const expectedProbe = (url) => BUILT_DECK_FILE.test(url ?? "");

// Console errors and >=400 responses, minus that probe. Every page in the
// suite watches the same way, so a new page cannot quietly watch for less.
function watch(target, errors, responses) {
  target.on("pageerror", (e) => errors.push(String(e)));
  target.on("console", (m) => {
    if (m.type() === "error" && !expectedProbe(m.location()?.url)) errors.push(m.text());
  });
  target.on("response", (r) => {
    if (r.status() >= 400 && !expectedProbe(r.url())) {
      responses.push(`${r.status()} ${r.url()}`);
    }
  });
}

// Prefer an explicitly provided binary, then a preinstalled one, then whatever
// Playwright downloaded for itself.
const executablePath =
  process.env.PW_CHROMIUM ??
  globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")[0];

const browser = await chromium.launch(
  executablePath ? { executablePath } : {}
);
// 360px: the phone width this audience actually uses.
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } });
const page = await ctx.newPage();

const consoleErrors = [];
const badResponses = [];
watch(page, consoleErrors, badResponses);

await page.goto(URL);
await page.waitForSelector(".clause");

// --- content loaded ---
const clauseCount = await page.locator(".clause").count();
check("cases load over HTTP", clauseCount === 5, `${clauseCount} clauses on case 1`);

const promptText = await page.locator("#prompt").innerText();
check(
  "prompt is generic (no answer leak)",
  promptText === "Tap the finding that most changes immediate management, or None if it is already right.",
  promptText
);

// --- the deck page is reachable back from itself ---
// A learner who lands straight on a deck link (shared, bookmarked, search
// result) has no other way back to the batch list, so the shared brand bar
// must carry a wordmark that points at the landing page.
const wordmarkHref = await page.locator("a.wordmark").getAttribute("href");
check(
  "deck page links back to the landing page from the brand bar",
  wordmarkHref === "index.html",
  String(wordmarkHref)
);

// --- no horizontal scroll at 360px ---
// The navigator has its own contained overflow-x, so this also confirms
// that scroll strip isn't leaking into the page's own scrollWidth.
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal scroll at 360px", overflow <= 0, `overflow ${overflow}px`);

// --- navigator ---
const navCount = await page.locator(".nav-item").count();
check("nav renders one button per case", navCount === N, `${navCount} nav buttons`);

const firstCurrent = await page.locator('.nav-item[aria-current="true"]').innerText();
check("case 1 marked current on load", firstCurrent === "1", firstCurrent);

const navSizes = await page.locator(".nav-item").evaluateAll((els) =>
  els.map((e) => e.getBoundingClientRect()));
check(
  "nav buttons are >= 44px tap targets",
  navSizes.every((r) => r.width >= 44 && r.height >= 44),
  `min ${Math.round(Math.min(...navSizes.map((r) => Math.min(r.width, r.height))))}px`
);

// The deck page opens with the skip link, then the shared brand bar, so the
// first tab stop is the skip link rather than the game. What still matters is
// the order inside the game itself: the navigator comes before the stem, so a
// keyboard user reaches "jump to another case" without walking the clauses of
// this one first.
await page.keyboard.press("Tab");
const firstStop = await page.evaluate(() => document.activeElement?.className);
check("first tab stop is the skip link", String(firstStop).includes("skip"), String(firstStop));

let gameStop = firstStop;
let gameGuard = 0;
while (
  !String(gameStop).includes("nav-item") &&
  !String(gameStop).includes("clause") &&
  gameGuard++ < N + 16
) {
  await page.keyboard.press("Tab");
  gameStop = await page.evaluate(() => document.activeElement?.className);
}
check(
  "Tab reaches the navigator before any clause",
  String(gameStop).includes("nav-item"),
  String(gameStop)
);

// --- the stem must read as prose, not as a stack of options ---
// If clauses were block-level each would start its own line; sharing a line
// with the next one is what proves they are flowing inline.
const sharesLines = await page.locator(".clause").evaluateAll((els) => {
  for (let i = 0; i < els.length - 1; i++) {
    const a = [...els[i].getClientRects()].pop();
    const b = els[i + 1].getClientRects()[0];
    if (a && b && Math.abs(a.top - b.top) < 2) return true;
  }
  return false;
});
check("stem flows as prose, not stacked options", sharesLines);

// --- a wrapped sentence must keep its highlight on every line ---
const clone = await page.locator(".clause").first().evaluate((e) => {
  const s = getComputedStyle(e);
  return s.boxDecorationBreak ?? s.webkitBoxDecorationBreak;
});
check("wrapped highlight does not tear", clone === "clone", String(clone));

// Sentences do wrap here -- confirm the case actually exercises that.
const anyWraps = await page.locator(".clause").evaluateAll((els) =>
  els.some((e) => e.getClientRects().length > 1));
check("sentences wrap at this width (so the above matters)", anyWraps);

// --- each line band gives enough vertical room for a thumb ---
// A full 44px is not reachable for inline prose: the hit area of an inline
// span is its font box plus padding, and padding beyond the line box makes
// adjacent lines overlap. 40px with near-zero gaps is the practical ceiling,
// and each target is a whole sentence wide.
const lineHeights = await page.locator(".clause").evaluateAll((els) =>
  els.flatMap((e) => [...e.getClientRects()].map((r) => r.height)));
check(
  "line bands >= 40px tall",
  lineHeights.every((h) => h >= 40),
  `min ${Math.round(Math.min(...lineHeights))}px`
);

// Dead space between consecutive lines means taps land on nothing.
const maxGap = await page.locator(".clause").evaluateAll((els) => {
  const rects = els
    .flatMap((e) => [...e.getClientRects()])
    .sort((a, b) => a.top - b.top);
  let worst = 0;
  for (let i = 1; i < rects.length; i++) {
    const gap = rects[i].top - (rects[i - 1].top + rects[i - 1].height);
    if (gap > worst) worst = gap;
  }
  return worst;
});
check("no dead space between lines", maxGap <= 4, `${Math.round(maxGap)}px`);

// --- three states ---
// case 1 (RV infarct): clause 0 = noise, 1 = contributory, 4 = pivot
await page.locator(".clause").nth(0).click();
const noiseCls = await page.locator(".clause").nth(0).getAttribute("class");
const fb1 = await page.locator("#feedback").innerText();
check("noise tap marks noise", noiseCls.includes("noise"), noiseCls);
check("noise tap shows feedback", fb1.length > 20, fb1.slice(0, 40));

await page.locator(".clause").nth(1).click();
const contribCls = await page.locator(".clause").nth(1).getAttribute("class");
check("contributory tap marks contributory", contribCls.includes("contributory"), contribCls);

// --- the previous wrong mark must still be visible ---
const stillNoise = await page.locator(".clause").nth(0).getAttribute("class");
check("earlier mark persists after next tap", stillNoise.includes("noise"), stillNoise);

// --- pivot locks ---
await page.locator(".clause").nth(4).click();
const pivotCls = await page.locator(".clause").nth(4).getAttribute("class");
check("pivot tap marks pivot", pivotCls.includes("pivot"), pivotCls);

const disabledAll = await page.locator(".clause").evaluateAll((els) =>
  els.every((e) => e.getAttribute("aria-disabled") === "true"));
check("case locks after pivot", disabledAll);

const trailIntact = await page.locator(".clause").evaluateAll((els) =>
  els[0].className.includes("noise") && els[1].className.includes("contributory"));
check("full reasoning trail survives locking", trailIntact);

const resolution = await page.locator("#resolution").innerText();
check("resolution shown", resolution.includes("right ventricular"), resolution.slice(0, 50));

// --- locked clauses are inert ---
// Playwright's own actionability check refuses aria-disabled elements, which
// is itself the signal that tooling reads them as disabled. Force the click
// through to prove the JS guard also holds.
await page.locator(".clause").nth(2).click({ force: true });
const inert = await page.locator(".clause").nth(2).getAttribute("class");
check("locked clause ignores clicks", inert === "clause", inert);

// --- score reflects first attempt, not eventual success ---
const score = await page.locator("#score").innerText();
check("first-attempt scoring counts the miss", score.includes("0 of 1"), score);

// --- navigator reflects a solved case immediately, without navigating away ---
const navSolvedNow = await page.locator(".nav-item").first().getAttribute("class");
check(
  "nav marks case 1 solved as soon as its pivot is found",
  navSolvedNow.includes("solved"),
  navSolvedNow
);

// --- next button ---
await page.locator("#next").click();
await page.waitForFunction(
  (n) => document.getElementById("meta").textContent.includes(`2 of ${n}`), N);
const meta2 = await page.locator("#meta").innerText();
check("next advances", meta2.includes(`2 of ${N}`), meta2);

const cleanReset = await page.evaluate(() => ({
  fb: document.getElementById("feedback").textContent,
  res: document.getElementById("resolution").textContent,
  nextHidden: document.getElementById("next").hidden,
  marks: [...document.querySelectorAll(".clause")].filter(
    (e) => e.className !== "clause").length,
}));
check("feedback/resolution/button reset on new case",
  cleanReset.fb === "" && cleanReset.res === "" && cleanReset.nextHidden &&
  cleanReset.marks === 0, JSON.stringify(cleanReset));

// --- None option ---
// Case 2 carries no `none` override, so DEFAULT_NONE (role noise, since its
// plan is in fact wrong) is what answering None resolves to.
const noneText = await page.locator("#noneOption").innerText();
check("None button renders with a label", noneText.trim().length > 0, noneText);

const noneBox = await page.locator("#noneOption").boundingBox();
check(
  "None button meets 44px tap target at 360px",
  !!noneBox && noneBox.width >= 44 && noneBox.height >= 44,
  noneBox ? `${Math.round(noneBox.width)}x${Math.round(noneBox.height)}` : "no box"
);

await page.locator("#noneOption").click();
const noneCls = await page.locator("#noneOption").getAttribute("class");
const noneFb = await page.locator("#feedback").innerText();
check("tapping None on a wrong-plan case marks it noise", noneCls.includes("noise"), noneCls);
check(
  "tapping None shows the default feedback",
  noneFb.endsWith("Something in this stem does change what you do next."),
  noneFb
);

const noneAriaDisabled = await page.locator("#noneOption").getAttribute("aria-disabled");
check("a noise None tap does not lock the case", noneAriaDisabled !== "true", String(noneAriaDisabled));

const clausesTappableAfterNone = await page.locator(".clause").evaluateAll((els) =>
  els.every((e) => e.getAttribute("aria-disabled") !== "true"));
check("clauses remain tappable after tapping None", clausesTappableAfterNone);

// --- navigator jump ---
// Jump to case 5 directly, skipping cases 3-4 entirely -- something only
// the navigator makes possible.
await page.locator(".nav-item").nth(4).click();
await page.waitForFunction(
  (n) => document.getElementById("meta").textContent.includes(`5 of ${n}`), N);
const meta5 = await page.locator("#meta").innerText();
check("nav jump moves to the clicked case", meta5.includes(`5 of ${N}`), meta5);

// --- moving to another case resets the None button ---
// Case 2's None was just marked noise; landing on a fresh case must clear it.
const noneAfterJump = await page.evaluate(() => {
  const b = document.getElementById("noneOption");
  return { cls: b.className, ariaDisabled: b.getAttribute("aria-disabled") };
});
check(
  "None button resets to bare class on a new case",
  noneAfterJump.cls === "none-option" && noneAfterJump.ariaDisabled === null,
  JSON.stringify(noneAfterJump)
);

const navReset = await page.evaluate(() => ({
  fb: document.getElementById("feedback").textContent,
  res: document.getElementById("resolution").textContent,
  nextHidden: document.getElementById("next").hidden,
  marks: [...document.querySelectorAll(".clause")].filter(
    (e) => e.className !== "clause").length,
}));
check("nav jump resets per-case state same as next",
  navReset.fb === "" && navReset.res === "" && navReset.nextHidden &&
  navReset.marks === 0, JSON.stringify(navReset));

const currentAfterJump = await page.locator('.nav-item[aria-current="true"]').innerText();
check("aria-current follows the nav jump", currentAfterJump === "5", currentAfterJump);

const case1StillSolved = await page.locator(".nav-item").first().getAttribute("class");
check("solved mark survives navigating away", case1StillSolved.includes("solved"), case1StillSolved);

// Jump back to case 2 so the rest of the flow continues from where the
// existing checks below expect to be.
await page.locator(".nav-item").nth(1).click();
await page.waitForFunction(
  (n) => document.getElementById("meta").textContent.includes(`2 of ${n}`), N);

// --- keyboard only ---
// The navigator's buttons come before the clauses in tab order, so the guard
// needs enough headroom to walk past all of them first.
await page.keyboard.press("Tab");
let focused = await page.evaluate(() => document.activeElement?.className);
let guard = 0;
while (!String(focused).includes("clause") && guard++ < N + 16) {
  await page.keyboard.press("Tab");
  focused = await page.evaluate(() => document.activeElement?.className);
}
check("Tab reaches a clause", String(focused).includes("clause"), String(focused));

const hasRing = await page.evaluate(() => {
  const s = getComputedStyle(document.activeElement);
  return s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
});
check("focus ring visible", hasRing);

await page.keyboard.press("Enter");
const kbFeedback = await page.locator("#feedback").innerText();
check("Enter selects a clause", kbFeedback.length > 20, kbFeedback.slice(0, 40));

// --- persistence across reload ---
await page.reload();
await page.waitForSelector(".clause");
const metaAfter = await page.locator("#meta").innerText();
const scoreAfter = await page.locator("#score").innerText();
check("case index persists across reload", metaAfter.includes(`2 of ${N}`), metaAfter);
check("score persists across reload", /of \d/.test(scoreAfter), scoreAfter);

const navAfterReload = await page.locator('.nav-item[aria-current="true"]').innerText();
check("nav current-case marker restores after reload", navAfterReload === "2", navAfterReload);

// --- end of deck wraps rather than dead-ends ---
await page.evaluate((n) => {
  localStorage.setItem("findthepivot.v1",
    JSON.stringify({ index: n - 1, progress: {} }));
}, N);
await page.reload();
await page.waitForSelector(".clause");
const lastCase = await page.locator("#meta").innerText();
check("can resume at last case", lastCase.includes(`${N} of ${N}`), lastCase);

// The last case's pivot position comes from cases.json, so this keeps working
// whichever case ends up last -- click the pivot clause if it has one,
// otherwise the last case's answer is None, so click that instead.
if (LAST_PIVOT_IS_NONE) {
  await page.locator("#noneOption").click();
} else {
  await page.locator(".clause").nth(LAST_PIVOT).click();
}
const nextLabel = await page.locator("#next").innerText();
check("last case offers restart, not a dead button", /again/i.test(nextLabel), nextLabel);

const lastNavSolved = await page.locator(".nav-item").nth(N - 1).getAttribute("class");
check("last case marked solved in nav after completion", lastNavSolved.includes("solved"), lastNavSolved);

await page.locator("#next").click();
await page.waitForFunction(
  (n) => document.getElementById("meta").textContent.includes(`1 of ${n}`), N);
const wrapped = await page.locator("#next").evaluate((e) => e.disabled);
check("restart re-enables the button", wrapped === false);

const navAfterWrap = await page.locator('.nav-item[aria-current="true"]').innerText();
check("nav current marker wraps to case 1", navAfterWrap === "1", navAfterWrap);

// --- storage-blocked fallback ---
const ctx2 = await browser.newContext({ viewport: { width: 360, height: 740 } });
const p2 = await ctx2.newPage();
await p2.addInitScript(() => {
  Object.defineProperty(window, "localStorage", {
    get() { throw new Error("blocked"); },
  });
});
await p2.goto(URL);
await p2.waitForSelector(".clause", { timeout: 5000 }).catch(() => {});
const survives = await p2.locator(".clause").count();
check("works with localStorage blocked", survives === 5, `${survives} clauses`);

check("no console/page errors", consoleErrors.length === 0, consoleErrors.join(" | "));
check("no failed requests", badResponses.length === 0, badResponses.join(" | "));

// --- the structured resolution renders as three separate beats ---
// A resolution is either one paragraph (the older cases) or
// { lead, points, trap }, and both shapes ship from the same file. Only the
// structure is asserted here -- which elements exist and how many -- because
// the copy of any individual case is still being rewritten, and a test pinned
// to its wording would fail on an edit rather than on a bug.
//
// The case is found in the data rather than named, for the same reason the
// deck size is: retagging or reordering must not break the suite. An assertion
// that quietly passes because it found nothing to assert on is not coverage,
// so a deck carrying no structured resolution at all is a failure here rather
// than a skip.
const STATE_LABEL = { met: "met", failed: "not met" };

const structuredAt = CASES.findIndex(
  (c) => c.resolution !== null && typeof c.resolution === "object");
check("the deck carries a structured resolution to test", structuredAt >= 0,
  structuredAt >= 0 ? CASES[structuredAt].id : "none found");
const structuredCase = CASES[structuredAt];
const expectedPoints = structuredCase.resolution.points;
const expectedChips = expectedPoints
  .filter((p) => p && typeof p === "object" && STATE_LABEL[p.state])
  .map((p) => STATE_LABEL[p.state]);

const resCtx = await browser.newContext({ viewport: { width: 360, height: 740 } });
const resPage = await resCtx.newPage();
const resErrors = [];
resPage.on("pageerror", (e) => resErrors.push(String(e)));
resPage.on("console", (m) => { if (m.type() === "error") resErrors.push(m.text()); });
await resPage.goto(URL);
await resPage.waitForSelector(".clause");
await resPage.locator(".nav-item").nth(structuredAt).click();
await resPage.waitForFunction(
  (n) => document.getElementById("meta").textContent.includes(`${n} of `),
  structuredAt + 1);

const structuredPivot = structuredCase.clauses.findIndex((c) => c.role === "pivot");
if (structuredPivot === -1) {
  await resPage.locator("#noneOption").click();
} else {
  await resPage.locator(".clause").nth(structuredPivot).click();
}

const parts = await resPage.evaluate(() => {
  const box = document.getElementById("resolution");
  const text = (e) => (e?.textContent ?? "").trim();
  return {
    heading: text(box.querySelector("h2")),
    leads: box.querySelectorAll("p.res-lead").length,
    lead: text(box.querySelector("p.res-lead")),
    lists: box.querySelectorAll("ul.res-points").length,
    items: box.querySelectorAll("ul.res-points > li").length,
    chips: [...box.querySelectorAll("li .res-state")].map(text),
    traps: box.querySelectorAll("p.res-trap").length,
    trap: text(box.querySelector("p.res-trap")),
    // The whole point of the split: no single run of prose swallows the lot.
    strayParagraphs: box.querySelectorAll("p:not(.res-lead):not(.res-trap)").length,
  };
});

check(
  "structured resolution keeps the heading",
  parts.heading === "Why it turns on that finding",
  parts.heading
);
check(
  "structured resolution renders one lead paragraph",
  parts.leads === 1 && parts.lead.length > 0,
  `${parts.leads} lead(s), "${parts.lead.slice(0, 40)}"`
);
check(
  "structured resolution renders one bullet per point",
  parts.lists === 1 && parts.items === expectedPoints.length,
  `${parts.items} items in ${parts.lists} list(s), expected ${expectedPoints.length}`
);
check(
  "structured resolution renders one trap paragraph",
  parts.traps === 1 && parts.trap.length > 0,
  `${parts.traps} trap(s), "${parts.trap.slice(0, 40)}"`
);
check(
  "structured resolution adds no undifferentiated paragraph",
  parts.strayParagraphs === 0,
  `${parts.strayParagraphs} unclassed paragraph(s)`
);
// The chip carries the verdict as a word, so colour is never the only thing
// separating a met criterion from an unmet one.
check(
  "met/not-met chips match the points that declare a state",
  parts.chips.join(",") === expectedChips.join(","),
  `[${parts.chips.join(", ")}] expected [${expectedChips.join(", ")}]`
);

const resOverflow = await resPage.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(
  "structured resolution does not scroll sideways at 360px",
  resOverflow <= 0,
  `overflow ${resOverflow}px`
);
check("no console/page errors rendering a structured resolution",
  resErrors.length === 0, resErrors.join(" | "));

await resCtx.close();

// --- contrast of the primary button in both schemes (WCAG AA >= 4.5) ---
const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const parse = (s) => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ colorScheme: scheme });
  const pg = await c.newPage();
  await pg.goto(URL);
  await pg.waitForSelector(".clause");
  const { fg, bg } = await pg.evaluate(() => {
    const s = getComputedStyle(document.getElementById("next"));
    return { fg: s.color, bg: s.backgroundColor };
  });
  const [l1, l2] = [lum(parse(fg)), lum(parse(bg))].sort((a, b) => b - a);
  const ratio = (l1 + 0.05) / (l2 + 0.05);
  check(`next button contrast (${scheme})`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  await c.close();
}

// --- the batch pages: each batch served as its own deck ---
// One page per open batch, each filtering cases.json by its own `data-batch`.
// They share every line of game.js, which is exactly why both are driven here
// rather than only the first: a page whose tag is misspelled, or whose storage
// key collides with another deck, renders perfectly and fails silently.
//
// Batch sizes come from the data, same reasoning as N above -- otherwise
// retagging a case silently breaks this suite instead of a real bug.
const BATCH_PAGES = [
  { file: "angina.html", tag: "stable-angina" },
  { file: "diabetes.html", tag: "type-2-diabetes" },
];

for (const { file, tag } of BATCH_PAGES) {
  const batchUrl = URL.replace(/play\.html$/, file);
  const batchCases = CASES.filter((c) => c.batch === tag);
  const batchN = batchCases.length;
  const firstPivot = batchCases[0]?.clauses.findIndex((c) => c.role === "pivot");
  const firstPivotIsNone = firstPivot === -1 && batchCases[0]?.none?.role === "pivot";

  // A page whose tag matches nothing would throw in game.js rather than render
  // an empty deck, but the count is asserted here too so the failure names the
  // cause instead of surfacing as a console error.
  check(`${file} has cases tagged "${tag}"`, batchN > 0, `${batchN} cases`);
  if (batchN === 0) continue;

  const batchConsoleErrors = [];
  const batchBadResponses = [];
  const batchCtx = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const batchPage = await batchCtx.newPage();
  watch(batchPage, batchConsoleErrors, batchBadResponses);

  await batchPage.goto(batchUrl);
  await batchPage.waitForSelector(".clause");

  const navCount = await batchPage.locator(".nav-item").count();
  check(
    `${file} renders exactly the ${tag} batch`,
    navCount === batchN,
    `${navCount} nav buttons, expected ${batchN}`
  );

  const batchMeta = await batchPage.locator("#meta").innerText();
  check(
    `${file} meta line reports the batch size`,
    batchMeta.includes(`of ${batchN}`),
    batchMeta
  );

  check(`no console/page errors on ${file}`, batchConsoleErrors.length === 0, batchConsoleErrors.join(" | "));
  check(`no failed requests on ${file}`, batchBadResponses.length === 0, batchBadResponses.join(" | "));

  // Solve the first case, then confirm its progress lands under a
  // batch-namespaced key rather than the shared one play.html uses.
  if (firstPivotIsNone) {
    await batchPage.locator("#noneOption").click();
  } else {
    await batchPage.locator(".clause").nth(firstPivot).click();
  }
  const storageKeys = await batchPage.evaluate(() => Object.keys(localStorage));
  check(
    `${file} progress is namespaced under its own storage key`,
    storageKeys.includes(`findthepivot.v1:${tag}`) &&
      !storageKeys.includes("findthepivot.v1"),
    storageKeys.join(", ")
  );

  // Same origin, same browser context -- play.html and the batch pages share
  // localStorage. The point of namespacing the key is that solving a case on
  // one batch must not perturb the mixed deck's own (unrelated, larger) case
  // count or index restoration.
  await batchPage.goto(URL);
  await batchPage.waitForSelector(".clause");
  const indexMetaAfterBatch = await batchPage.locator("#meta").innerText();
  check(
    `play.html still reports its own case count after ${file} writes to shared localStorage`,
    indexMetaAfterBatch.includes(`of ${N}`),
    indexMetaAfterBatch
  );

  await batchCtx.close();
}

// The two batch pages must not share a storage key with each other either:
// progress on one deck reappearing on the other is the failure namespacing
// exists to prevent, and it only shows up when a second batch exists.
check(
  "the batch pages use distinct storage keys",
  new Set(BATCH_PAGES.map((b) => b.tag)).size === BATCH_PAGES.length,
  BATCH_PAGES.map((b) => `findthepivot.v1:${b.tag}`).join(", ")
);

// --- solving a case has to reach a screen reader, without moving the viewport ---
// Two failures pulling against each other, so they are measured together.
//
// The first is what shipped: the resolution -- the rule sentence, its bullets
// and the closing paragraph, which is the whole teaching payload of the site --
// appeared with nothing announcing it. #feedback's role="status" read the
// one-line pivot feedback, then silence, and the explanation had to be found by
// hunting with reader navigation keys. game.js now moves focus to the
// resolution's heading, so the reader lands at the top of the explanation and
// reads it at their own pace instead of having it fired at them.
//
// The second is that fix going wrong, which it already did once: solving a case
// used to focus the "Next case" button, and focusing an element scrolls it into
// view -- a 1282px jump on a 360px phone, landing the reader below the very
// explanation they had earned. Reported twice, removed in 2b29a16. The focus
// call is therefore focus({ preventScroll: true }), and these are the numbers
// that hold it there: scrollY recorded at a known offset, the pivot tapped,
// then read again after any smooth scroll would have settled. Both deck pages
// at both widths, because the jump was measured at both.
const PIVOT_VIEWPORTS = [
  { label: "360x740", width: 360, height: 740 },
  { label: "1280x720", width: 1280, height: 720 },
];
const SCROLL_SETTLE_MS = 700;

// Which case and which clause come from the data, never named -- retagging or
// reordering a batch must not break the suite. The case picked is the first in
// the batch whose pivot sits on a stem clause, so the tap under test is the
// ordinary one rather than the None button.
function pivotTargetIn(batchCases) {
  const at = batchCases.findIndex((c) => c.clauses.some((x) => x.role === "pivot"));
  if (at === -1) return null;
  return { at, clause: batchCases[at].clauses.findIndex((x) => x.role === "pivot") };
}

for (const { file, tag } of BATCH_PAGES) {
  const pageUrl = URL.replace(/play\.html$/, file);
  const target = pivotTargetIn(CASES.filter((c) => c.batch === tag));
  check(`${file} has a case whose pivot is a stem clause`, target !== null,
    target ? `case ${target.at + 1}, clause ${target.clause + 1}` : "none found");
  if (!target) continue;

  for (const vp of PIVOT_VIEWPORTS) {
    const c = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const pg = await c.newPage();
    await pg.goto(pageUrl);
    await pg.waitForSelector(".clause");
    await pg.locator(".nav-item").nth(target.at).click();
    await pg.waitForFunction(
      (n) => document.getElementById("meta").textContent.includes(`${n} of `),
      target.at + 1);

    // jumpTo() scrolls the new stem to the top, smoothly -- let that finish
    // before parking the viewport where the assertion needs it.
    await pg.waitForTimeout(SCROLL_SETTLE_MS);
    await pg.evaluate(() => window.scrollTo(0, 300));
    await pg.waitForTimeout(SCROLL_SETTLE_MS);
    const before = await pg.evaluate(() => window.scrollY);

    await pg.locator(".clause").nth(target.clause).click();
    await pg.waitForSelector("#resolution h2");
    await pg.waitForTimeout(SCROLL_SETTLE_MS);
    const after = await pg.evaluate(() => window.scrollY);

    // A page parked at 0 would pass the comparison below without proving
    // anything, so the offset itself is asserted first.
    check(
      `${file} at ${vp.label} is scrolled away from the top before the pivot tap`,
      before > 0,
      `scrollY ${before}`
    );
    check(
      `${file} at ${vp.label}: solving a case does not move the viewport`,
      after === before,
      `scrollY ${before} -> ${after}`
    );

    // The mechanism that replaces the silence: focus lands on the resolution's
    // own heading, inside the resolution panel, not on the button below it.
    const landed = await pg.evaluate(() => {
      const a = document.activeElement;
      const box = document.getElementById("resolution");
      return {
        tag: a?.tagName,
        inside: !!a && box.contains(a) && a !== box,
        text: (a?.textContent ?? "").trim(),
      };
    });
    check(
      `${file} at ${vp.label}: focus lands on the resolution heading`,
      landed.inside && landed.tag === "H2" &&
        landed.text === "Why it turns on that finding",
      `${landed.tag} "${landed.text}"`
    );

    await c.close();
  }
}

// The focus move is programmatic and follows a tap, so it must announce the
// explanation without painting a ring on a heading nobody focused. Chromium
// decides :focus-visible from how the previous focus was reached, so this can
// only be answered by clicking rather than by reading the stylesheet.
{
  const { file, tag } = BATCH_PAGES[0];
  const pageUrl = URL.replace(/play\.html$/, file);
  const target = pivotTargetIn(CASES.filter((c) => c.batch === tag));
  const c = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const pg = await c.newPage();
  await pg.goto(pageUrl);
  await pg.waitForSelector(".clause");
  await pg.locator(".nav-item").nth(target.at).click();
  await pg.waitForFunction(
    (n) => document.getElementById("meta").textContent.includes(`${n} of `),
    target.at + 1);
  await pg.locator(".clause").nth(target.clause).click();
  await pg.waitForSelector("#resolution h2");

  const mouse = await pg.evaluate(() => {
    const a = document.activeElement;
    const s = getComputedStyle(a);
    return {
      focusVisible: a.matches(":focus-visible"),
      outline: `${s.outlineStyle} ${s.outlineWidth}`,
      drawn: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
    };
  });
  check(
    "no focus ring on the resolution heading after a mouse tap",
    mouse.focusVisible === false && mouse.drawn === false,
    `:focus-visible ${mouse.focusVisible}, outline ${mouse.outline}`
  );

  // The panel is a named landmark as well, so a reader who has moved on can
  // come back to the explanation in one keystroke. The name is the heading, so
  // an empty panel between cases is not announced as a landmark at all.
  const region = await pg.evaluate(() => {
    const box = document.getElementById("resolution");
    const labelledBy = box.getAttribute("aria-labelledby");
    return {
      role: box.getAttribute("role"),
      name: (document.getElementById(labelledBy)?.textContent ?? "").trim(),
    };
  });
  check(
    "the resolution is a region named by its heading",
    region.role === "region" && region.name === "Why it turns on that finding",
    `role=${region.role}, name="${region.name}"`
  );

  await c.close();
}

// Same move from the keyboard: the ring has to come back, because a sighted
// keyboard user needs to see where the caret went, and the viewport still must
// not move under them.
{
  const { file, tag } = BATCH_PAGES[0];
  const pageUrl = URL.replace(/play\.html$/, file);
  const target = pivotTargetIn(CASES.filter((c) => c.batch === tag));
  const c = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const pg = await c.newPage();
  await pg.goto(pageUrl);
  await pg.waitForSelector(".clause");

  // Tab in from the top of the document -- the navigator's buttons come before
  // the clauses, so it takes a while to walk there, and programmatic focus
  // would not tell Chromium the keyboard was used.
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await pg.keyboard.press("Tab");
    reached = await pg.evaluate(
      (n) => [...document.querySelectorAll(".clause")].indexOf(document.activeElement) === n,
      target.clause);
  }
  check(`Tab reaches the pivot clause on ${file}`, reached);

  const beforeKb = await pg.evaluate(() => window.scrollY);
  await pg.keyboard.press("Enter");
  await pg.waitForSelector("#resolution h2");
  await pg.waitForTimeout(SCROLL_SETTLE_MS);

  const kb = await pg.evaluate(() => {
    const a = document.activeElement;
    const s = getComputedStyle(a);
    return {
      id: a.id,
      focusVisible: a.matches(":focus-visible"),
      drawn: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0,
      outline: `${s.outlineStyle} ${s.outlineWidth}`,
      scrollY: window.scrollY,
    };
  });
  check(
    "focus ring visible on the resolution heading after keyboard activation",
    kb.focusVisible === true && kb.drawn === true,
    `:focus-visible ${kb.focusVisible}, outline ${kb.outline}`
  );
  check(
    "keyboard activation does not move the viewport either",
    kb.scrollY === beforeKb,
    `scrollY ${beforeKb} -> ${kb.scrollY}`
  );

  await c.close();
}

// --- index.html: the landing page ---
// index.html no longer carries a deck; it is the marketing page that sends
// people to the two deck pages. It has its own failure modes (a broken CTA,
// counts that drift from the data, a page that needs JS to say anything), so
// it gets its own checks rather than riding on the deck suite above.
const LANDING_URL = URL.replace(/play\.html$/, "index.html");
const LANDING_BATCH = CASES.filter((c) => c.batch === "stable-angina").length;
const LANDING_BATCH_02 = CASES.filter((c) => c.batch === "type-2-diabetes").length;
const LANDING_TOTAL = N;                     // every case in the bank
const LANDING_SPECIALTIES = new Set(CASES.map((c) => c.topic)).size;

const landingConsoleErrors = [];
const landingBadResponses = [];
const ctx4 = await browser.newContext({ viewport: { width: 360, height: 740 } });
const landingPage = await ctx4.newPage();
watch(landingPage, landingConsoleErrors, landingBadResponses);

await landingPage.goto(LANDING_URL);
// landing.js fetches cases.json, so the counted numbers land after load.
await landingPage.waitForLoadState("networkidle");

check("no console/page errors on index.html", landingConsoleErrors.length === 0, landingConsoleErrors.join(" | "));
check("no failed requests on index.html", landingBadResponses.length === 0, landingBadResponses.join(" | "));

// The landing page must not have quietly acquired a deck: if a .clause shows
// up here it means game.js got wired back in and the page is doing two jobs.
const landingClauses = await landingPage.locator(".clause").count();
check("index.html is a landing page, not a deck", landingClauses === 0, `${landingClauses} clauses`);

// --- the primary CTAs actually go somewhere ---
// A landing page whose buttons 404 is worse than no landing page, and a
// renamed deck file would break silently otherwise.
for (const target of ["angina.html", "diabetes.html"]) {
  const hrefs = await landingPage.locator(`a[href="${target}"]`).evaluateAll((els) =>
    els.map((e) => e.href));
  check(`index.html links to ${target}`, hrefs.length > 0, `${hrefs.length} links`);
  if (hrefs.length > 0) {
    const res = await ctx4.request.get(hrefs[0]);
    check(`${target} resolves with 200 from the landing page link`, res.status() === 200, `${res.status()} ${hrefs[0]}`);
  }
}

// --- the mixed deck is in preparation, so nothing may point a reader at it ---
// play.html still exists in the repo (the deck suite above drives the full
// bank through it) but it is not published and not offered. Counting resolved
// hrefs rather than the literal attribute is what catches a link that comes
// back as "./play.html", "play.html?x" or an absolute URL.
const mixedDeckLinks = await landingPage.locator("a[href]").evaluateAll((els) =>
  els.map((e) => e.href).filter((h) => h.split(/[?#]/)[0].endsWith("/play.html")));
check(
  "index.html does not link to the mixed deck (in preparation)",
  mixedDeckLinks.length === 0,
  mixedDeckLinks.length ? mixedDeckLinks.join(", ") : "0 links to play.html"
);

// --- "in preparation" must be visible, not just absent ---
// Deleting the card would also pass the link check above while quietly losing
// the promise that a mixed deck is coming. The card has to still be there,
// still say it is closed, and carry no anchor at all -- an anchor inside it is
// how "in preparation" decays back into a live button.
const mixedDeckCard = await landingPage.evaluate(() => {
  const card = document.querySelector("article.batch.upcoming");
  if (!card) return null;
  return {
    status: (card.querySelector(".batch-status")?.textContent ?? "").trim(),
    anchors: card.querySelectorAll("a").length,
  };
});
check(
  "index.html shows the mixed deck as closed, with a status and no link",
  !!mixedDeckCard && mixedDeckCard.status.length > 0 && mixedDeckCard.anchors === 0,
  mixedDeckCard
    ? `status "${mixedDeckCard.status}", ${mixedDeckCard.anchors} anchors`
    : "no article.batch.upcoming"
);

// --- no horizontal scroll at 360px ---
// Same phone width as the deck. The hero grid and the fact row are the two
// places a stray fixed width would push the page sideways.
const landingOverflow = await landingPage.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal scroll on index.html at 360px", landingOverflow <= 1, `overflow ${landingOverflow}px`);

// --- tap targets ---
// Every standalone control (brand bar links, skip link, CTA buttons) must be
// thumb-sized. Links sitting inline in a sentence are excluded: their height
// is fixed by the line-height of the prose around them, which is exactly the
// inline exception in WCAG 2.5.8, and padding them out would tear the
// paragraph apart. Controls that are not rendered at all are excluded too:
// below 620px the bar drops its in-page anchors (see brand.css), and a
// display:none element measures 0px without ever being a target to miss.
const landingTargets = await landingPage.locator("a, button").evaluateAll((els) =>
  els
    .filter((e) => e.getClientRects().length > 0)
    .filter((e) => getComputedStyle(e).display !== "inline")
    .map((e) => ({
      label: (e.textContent || "").trim().slice(0, 24),
      height: e.getBoundingClientRect().height,
    })));
const shortTargets = landingTargets.filter((t) => t.height < 44);
check(
  "index.html controls are >= 44px tall",
  landingTargets.length > 0 && shortTargets.length === 0,
  shortTargets.length
    ? shortTargets.map((t) => `${t.label} ${Math.round(t.height)}px`).join(", ")
    : `${landingTargets.length} controls, min ${Math.round(
        Math.min(...landingTargets.map((t) => t.height)))}px`
);

// --- the counted facts match the data ---
// These three numbers are the page's only factual claims. They are counted
// from cases.json by landing.js, so this both proves the script ran and that
// the marketing copy cannot drift away from the bank behind it.
const facts = await landingPage.evaluate(() => ({
  batch: document.getElementById("factBatch")?.textContent.trim(),
  batch02: document.getElementById("factBatch02")?.textContent.trim(),
  total: document.getElementById("factTotal")?.textContent.trim(),
  specialties: document.getElementById("factSpecialties")?.textContent.trim(),
}));
check(
  "index.html counts Batch 01 from cases.json",
  facts.batch === String(LANDING_BATCH),
  `${facts.batch}, expected ${LANDING_BATCH}`
);
check(
  "index.html counts Batch 02 from cases.json",
  facts.batch02 === String(LANDING_BATCH_02),
  `${facts.batch02}, expected ${LANDING_BATCH_02}`
);
check(
  "index.html counts the total deck from cases.json",
  facts.total === String(LANDING_TOTAL),
  `${facts.total}, expected ${LANDING_TOTAL}`
);
check(
  "index.html counts distinct specialties from cases.json",
  facts.specialties === String(LANDING_SPECIALTIES),
  `${facts.specialties}, expected ${LANDING_SPECIALTIES}`
);

// --- the page still says something with JavaScript off ---
// The same numbers are written into the markup, so a blocked or failed
// landing.js must leave a complete page rather than three empty slots.
const ctxNoJs = await browser.newContext({
  viewport: { width: 360, height: 740 },
  javaScriptEnabled: false,
});
const noJsPage = await ctxNoJs.newPage();
await noJsPage.goto(LANDING_URL);
const noJsText = {
  batch: (await noJsPage.locator("#factBatch").innerText()).trim(),
  batch02: (await noJsPage.locator("#factBatch02").innerText()).trim(),
  total: (await noJsPage.locator("#factTotal").innerText()).trim(),
  specialties: (await noJsPage.locator("#factSpecialties").innerText()).trim(),
};
check(
  "index.html renders its counts with JavaScript disabled",
  Object.values(noJsText).every((v) => v !== ""),
  JSON.stringify(noJsText)
);
// The static markup is the fallback, so it has to be the *right* number, not
// merely a number -- a stale hardcoded count is invisible with JS enabled
// because landing.js overwrites it on load.
check(
  "index.html hardcoded counts match the data (JavaScript disabled)",
  noJsText.batch === String(LANDING_BATCH) &&
    noJsText.batch02 === String(LANDING_BATCH_02) &&
    noJsText.total === String(LANDING_TOTAL) &&
    noJsText.specialties === String(LANDING_SPECIALTIES),
  `${JSON.stringify(noJsText)}, expected ${LANDING_BATCH}/${LANDING_BATCH_02}/${LANDING_TOTAL}/${LANDING_SPECIALTIES}`
);
// The demo panel ships solved so the page is honest with the script blocked.
// If landing.js ever became load-bearing here, this is what would catch it.
const noJsDemo = await noJsPage.$eval(".demo", (d) => ({
  painted: [...d.querySelectorAll(".demo-stem mark")]
    .filter((m) => getComputedStyle(m).backgroundColor !== "rgba(0, 0, 0, 0)").length,
  feedback: [...d.querySelectorAll(".demo-fb")]
    .filter((e) => getComputedStyle(e).display !== "none")
    .map((e) => e.dataset.role),
}));
check(
  "index.html demo panel still reads as solved with JavaScript disabled",
  noJsDemo.painted === 3 &&
    noJsDemo.feedback.length === 1 && noJsDemo.feedback[0] === "pivot",
  JSON.stringify(noJsDemo)
);

await ctxNoJs.close();

// --- contrast of the hero CTA in both schemes (WCAG AA >= 4.5) ---
// The one control the whole page is built to get tapped; it has to be
// readable in whichever scheme the phone is set to.
for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ colorScheme: scheme });
  const pg = await c.newPage();
  await pg.goto(LANDING_URL);
  const { fg, bg } = await pg.evaluate(() => {
    const s = getComputedStyle(document.getElementById("startBatch01"));
    return { fg: s.color, bg: s.backgroundColor };
  });
  const [l1, l2] = [lum(parse(fg)), lum(parse(bg))].sort((a, b) => b - a);
  const ratio = (l1 + 0.05) / (l2 + 0.05);
  check(`hero CTA contrast (${scheme})`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  await c.close();
}

// --- ar.html: the Arabic landing page ---
// ar.html is the RTL counterpart of index.html: same stylesheets, same script,
// same element ids. That shared machinery is exactly why it needs its own
// checks -- a rule written for the LTR page can look fine there and fall apart
// once the writing direction flips, and nothing in the English section above
// would notice.
const ARABIC_URL = URL.replace(/play\.html$/, "ar.html");

const arabicConsoleErrors = [];
const arabicBadResponses = [];
const ctx5 = await browser.newContext({ viewport: { width: 360, height: 740 } });
const arabicPage = await ctx5.newPage();
watch(arabicPage, arabicConsoleErrors, arabicBadResponses);

await arabicPage.goto(ARABIC_URL);
// Same as index.html: landing.js fetches cases.json, so the counted numbers
// land after load rather than at DOMContentLoaded.
await arabicPage.waitForLoadState("networkidle");

check("no console/page errors on ar.html", arabicConsoleErrors.length === 0, arabicConsoleErrors.join(" | "));
check("no failed requests on ar.html", arabicBadResponses.length === 0, arabicBadResponses.join(" | "));

// --- the document really is Arabic and really is RTL ---
// Both attributes carry weight and neither implies the other: `lang` is what
// picks Arabic shaping, hyphenation and the right voice in a screen reader,
// while `dir` is what mirrors the layout. A copy-paste of index.html that kept
// `lang="en"`, or an `ar` page that forgot `dir`, would still render Arabic
// glyphs and look plausible in a screenshot.
const arabicDoc = await arabicPage.evaluate(() => ({
  lang: document.documentElement.lang,
  dir: document.documentElement.dir,
}));
check(
  "ar.html declares Arabic and RTL on <html>",
  arabicDoc.lang === "ar" && arabicDoc.dir === "rtl",
  `lang=${arabicDoc.lang} dir=${arabicDoc.dir}`
);

// --- the primary CTAs actually go somewhere ---
// The Arabic page sends people to the same English deck page, so a renamed
// deck file breaks it in exactly the same silent way. Resolve the real href
// with a real request rather than trusting the attribute.
for (const target of ["angina.html", "diabetes.html"]) {
  const hrefs = await arabicPage.locator(`a[href="${target}"]`).evaluateAll((els) =>
    els.map((e) => e.href));
  check(`ar.html links to ${target}`, hrefs.length > 0, `${hrefs.length} links`);
  if (hrefs.length > 0) {
    const res = await ctx5.request.get(hrefs[0]);
    check(`${target} resolves with 200 from the Arabic landing page link`, res.status() === 200, `${res.status()} ${hrefs[0]}`);
  }
}

// --- the mixed deck is closed here too ---
// The two landing pages are maintained separately, so the policy has to be
// asserted on each of them: translating a page is exactly the moment an old
// CTA gets copied back in.
const arabicMixedDeckLinks = await arabicPage.locator("a[href]").evaluateAll((els) =>
  els.map((e) => e.href).filter((h) => h.split(/[?#]/)[0].endsWith("/play.html")));
check(
  "ar.html does not link to the mixed deck (in preparation)",
  arabicMixedDeckLinks.length === 0,
  arabicMixedDeckLinks.length ? arabicMixedDeckLinks.join(", ") : "0 links to play.html"
);

const arabicMixedDeckCard = await arabicPage.evaluate(() => {
  const card = document.querySelector("article.batch.upcoming");
  if (!card) return null;
  return {
    status: (card.querySelector(".batch-status")?.textContent ?? "").trim(),
    anchors: card.querySelectorAll("a").length,
  };
});
check(
  "ar.html shows the mixed deck as closed, with a status and no link",
  !!arabicMixedDeckCard && arabicMixedDeckCard.status.length > 0 &&
    arabicMixedDeckCard.anchors === 0,
  arabicMixedDeckCard
    ? `status "${arabicMixedDeckCard.status}", ${arabicMixedDeckCard.anchors} anchors`
    : "no article.batch.upcoming"
);

// --- no horizontal scroll at 360px ---
// The check that matters most on a mirrored layout: any margin, padding or
// offset written as left/right instead of a logical property lands on the
// wrong side under `dir="rtl"` and pushes the page sideways. On a phone that
// shows up as content sliding out from under the thumb.
const arabicOverflow = await arabicPage.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal scroll on ar.html at 360px", arabicOverflow <= 1, `overflow ${arabicOverflow}px`);

// --- the counted facts match the data ---
// Same three numbers, same source. Passing here proves landing.js runs on this
// page too -- the Arabic markup could easily have shipped with the ids renamed
// or the script tag dropped, leaving three frozen numbers that drift from the
// bank the moment a case is added.
const arabicFacts = await arabicPage.evaluate(() => ({
  batch: document.getElementById("factBatch")?.textContent.trim(),
  batch02: document.getElementById("factBatch02")?.textContent.trim(),
  total: document.getElementById("factTotal")?.textContent.trim(),
  specialties: document.getElementById("factSpecialties")?.textContent.trim(),
}));
check(
  "ar.html counts Batch 01 from cases.json",
  arabicFacts.batch === String(LANDING_BATCH),
  `${arabicFacts.batch}, expected ${LANDING_BATCH}`
);
check(
  "ar.html counts Batch 02 from cases.json",
  arabicFacts.batch02 === String(LANDING_BATCH_02),
  `${arabicFacts.batch02}, expected ${LANDING_BATCH_02}`
);
check(
  "ar.html counts the total deck from cases.json",
  arabicFacts.total === String(LANDING_TOTAL),
  `${arabicFacts.total}, expected ${LANDING_TOTAL}`
);
check(
  "ar.html counts distinct specialties from cases.json",
  arabicFacts.specialties === String(LANDING_SPECIALTIES),
  `${arabicFacts.specialties}, expected ${LANDING_SPECIALTIES}`
);

// --- the announcement bar points at the batch it announces ---
// The bar is hand-written copy on two separately maintained pages, so the one
// thing that can be asserted mechanically is that it exists, is a real link,
// and goes to the newest batch page rather than to the one it replaced. A bar
// still shouting about Batch 02 with a link to angina.html is the failure this
// catches; stale wording is not something a test can see.
for (const [label, pg] of [["index.html", landingPage], ["ar.html", arabicPage]]) {
  const announce = await pg.evaluate(() => {
    const a = document.querySelector("a.announce");
    if (!a) return null;
    return {
      href: a.getAttribute("href"),
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      height: a.getBoundingClientRect().height,
    };
  });
  check(
    `${label} carries an announcement linking to the newest batch`,
    !!announce && announce.href === "diabetes.html" && announce.text.length > 0,
    announce ? `href=${announce.href}, "${announce.text.slice(0, 48)}"` : "no a.announce"
  );
}

// --- the language switch is reciprocal ---
// A one-way switch is a trap: a reader who lands on the Arabic page from a
// shared link and wants the English one (or the reverse) has no route back,
// and search engines see a dangling pair. Both halves are asserted together so
// deleting either one fails here.
const arabicSwitch = await arabicPage.locator('a[href="index.html"]').count();
const landingSwitch = await landingPage.locator('a[href="ar.html"]').count();
check(
  "ar.html and index.html link to each other (reciprocal language switch)",
  arabicSwitch > 0 && landingSwitch > 0,
  `ar.html->index.html ${arabicSwitch}, index.html->ar.html ${landingSwitch}`
);

// --- the demo panel stays left-to-right ---
// The panel is a picture of the real deck, and the real deck is English. If
// `dir="rtl"` were allowed to cascade into it the punctuation and the clause
// order would flip, and the page would be advertising a screen that does not
// exist in the product.
const demoDir = await arabicPage.locator(".demo").getAttribute("dir");
check(
  "ar.html demo panel stays LTR (it depicts the English interface)",
  demoDir === "ltr",
  `dir=${demoDir}`
);

// --- the wordmark stays on one line ---
// The product name is Latin text sitting in an RTL bar next to three Arabic
// links; at 360px it wrapped onto a second line and pushed the bar to double
// height. Measuring the rendered box against the type is what keeps this
// honest at any type scale -- one line cannot be 1.6x its own font-size tall.
// The floor is the catch: the wordmark is also a tap target, so brand.css
// pins it to min-height 44px and a single line already measures exactly that,
// well past 1.6x a 17px font. So the bar is whichever of the two is taller,
// and it still has teeth: restoring the wrap measures 96px here, over twice
// the floor, because a second line stacks on top of it.
const wordmark = await arabicPage.locator(".wordmark").evaluate((e) => {
  const s = getComputedStyle(e);
  return {
    height: e.getBoundingClientRect().height,
    fontSize: parseFloat(s.fontSize),
    floor: parseFloat(s.minHeight) || 0,
  };
});
const wordmarkCeiling = Math.max(wordmark.fontSize * 1.6, wordmark.floor);
check(
  "ar.html wordmark stays on one line at 360px",
  wordmark.height <= wordmarkCeiling,
  `${Math.round(wordmark.height)}px tall, one-line ceiling ${Math.round(wordmarkCeiling)}px ` +
    `(font-size ${Math.round(wordmark.fontSize)}px, tap-target floor ${Math.round(wordmark.floor)}px)`
);

// --- contrast of the hero CTA in both schemes (WCAG AA >= 4.5) ---
// Same button, same stylesheet, but the Arabic face renders at a different
// weight and the button is checked here on its own so a font-driven colour
// tweak for Arabic cannot quietly drop below AA.
for (const scheme of ["light", "dark"]) {
  const c = await browser.newContext({ colorScheme: scheme });
  const pg = await c.newPage();
  await pg.goto(ARABIC_URL);
  const { fg, bg } = await pg.evaluate(() => {
    const s = getComputedStyle(document.getElementById("startBatch01"));
    return { fg: s.color, bg: s.backgroundColor };
  });
  const [l1, l2] = [lum(parse(fg)), lum(parse(bg))].sort((a, b) => b - a);
  const ratio = (l1 + 0.05) / (l2 + 0.05);
  check(`ar.html hero CTA contrast (${scheme})`, ratio >= 4.5, `${ratio.toFixed(2)}:1`);
  await c.close();
}

// --- what the deploy actually publishes ---
// The link checks above only prove nothing on the site points at play.html or
// at an unpublished case. Anything copied into _site is served to anyone who
// guesses its URL, whether or not a page links to it -- so the assembly step
// is the only place the policy is really enforced. It is no longer a cp line
// in the workflow YAML to grep for: the workflow runs tools/build-site.mjs, so
// the suite runs it too, into a temp directory, and reads what came out.
const SITE = mkdtempSync(join(tmpdir(), "find-the-pivot-site-"));
const built = buildSite(SITE);

// Every file under _site, as a path/bytes pair -- the site as a visitor could
// fetch it, which is what the leak checks below have to be asked about.
function siteFiles(dir = SITE) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...siteFiles(path));
    else out.push({ path: relative(SITE, path), text: readFileSync(path, "utf8") });
  }
  return out;
}
const SITE_FILES = siteFiles();
const sitePaths = SITE_FILES.map((f) => f.path);

check(
  "the build publishes the open pages and not play.html",
  ["index.html", "ar.html", "angina.html", "diabetes.html"].every((f) =>
    sitePaths.includes(f)) && !sitePaths.includes("play.html"),
  sitePaths.filter((p) => p.endsWith(".html")).join(", ") || "no pages built"
);

// The mixed deck being unpublished means nothing while the data behind it is
// served: src/cases.json carried all 48 cases, pivots and resolutions
// included, at a URL as guessable as play.html's.
check(
  "the full deck is not published",
  !sitePaths.includes(join("src", "cases.json")),
  sitePaths.filter((p) => p.startsWith("src") && p.endsWith(".json")).join(", ")
);

// The batches the build publishes are read off the deck pages it copies, so
// this is the same list the site itself is built from, not a second copy.
const PUBLISHED = built.batches;
const publishedCases = CASES.filter((c) => PUBLISHED.includes(c.batch));
const unpublishedCases = CASES.filter((c) => !PUBLISHED.includes(c.batch));

// The real check: not "is the file gone" but "is the content gone". An id is
// the cheapest unique string per case, and one appearing anywhere in the bytes
// of the site means that case shipped by some other route.
const leaked = unpublishedCases
  .map((c) => c.id)
  .filter((id) => SITE_FILES.some((f) => f.text.includes(id)));
check(
  `no unpublished case appears anywhere in the built site (${unpublishedCases.length} withheld)`,
  leaked.length === 0,
  leaked.length ? `leaked: ${leaked.slice(0, 5).join(", ")}` : `${publishedCases.length} published`
);

// Each deck page's own file, and nothing more: the narrowing has to happen at
// build time, because a file that carries the other batches has already served
// them however the page then filters.
for (const batch of PUBLISHED) {
  const expected = CASES.filter((c) => c.batch === batch).map((c) => c.id);
  const file = join("src", `cases.${batch}.json`);
  const found = SITE_FILES.find((f) => f.path === file);
  const deck = found ? JSON.parse(found.text) : { cases: [] };
  const ids = deck.cases.map((c) => c.id);
  check(
    `src/cases.${batch}.json carries exactly its own ${expected.length} cases`,
    found !== undefined &&
      ids.length === expected.length &&
      expected.every((id, i) => ids[i] === id) &&
      deck.prompt === DECK.prompt,
    found ? `${ids.length} cases` : `${file} was not built`
  );
}

// The landing pages claim a total and a specialty count. Those claims have to
// stay true without the cases that back them being downloadable, which is the
// whole reason counts.json exists -- so it has to agree with cases.json.
const counts = JSON.parse(
  SITE_FILES.find((f) => f.path === join("src", "counts.json"))?.text ?? "{}");
const expectedCounts = {
  total: CASES.length,
  topics: new Set(CASES.map((c) => c.topic)).size,
  batches: Object.fromEntries(
    PUBLISHED.map((b) => [b, CASES.filter((c) => c.batch === b).length])),
};
check(
  "src/counts.json matches src/cases.json",
  JSON.stringify(counts) === JSON.stringify(expectedCounts),
  `${JSON.stringify(counts)} vs ${JSON.stringify(expectedCounts)}`
);

// Aggregate numbers only. A count file that grew a topic list or a case title
// would be the same leak in a smaller package.
check(
  "src/counts.json carries no case text",
  !/"(id|clauses|resolution|feedback|topic)"/.test(
    SITE_FILES.find((f) => f.path === join("src", "counts.json"))?.text ?? ""),
  `${(SITE_FILES.find((f) => f.path === join("src", "counts.json"))?.text ?? "").length} bytes`
);


// --- the demo panel plays, without moving the page ---
// The panel ships solved and landing.js rewinds it, so the whole cycle is an
// enhancement over a correct page. Three things have to hold at once: the
// solved still survives with the script blocked, the cycle actually reaches
// all four beats, and the panel never changes height while it runs -- the
// feedback line carries three different sentences, and a box that resized
// three times a cycle would shove the page under the reader.
for (const [label, url] of [["index.html", LANDING_URL], ["ar.html", ARABIC_URL]]) {
  const demoCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const demoPage = await demoCtx.newPage();
  await demoPage.goto(url);
  await demoPage.locator(".demo").scrollIntoViewIfNeeded();

  const beats = new Set();
  const heights = new Set();
  // Long enough to cover the ~11s loop with margin, sampled fast enough that
  // no beat can slip between two reads.
  for (let i = 0; i < 32; i++) {
    const snap = await demoPage.$eval(".demo", (d) => {
      const shown = [...d.querySelectorAll(".demo-fb")]
        .find((e) => e.classList.contains("is-shown"));
      const marks = ["show-noise", "show-contributory", "show-pivot"]
        .filter((c) => d.classList.contains(c)).length;
      return {
        beat: `${marks}/${shown?.dataset.role ?? "-"}`,
        height: Math.round(d.getBoundingClientRect().height),
      };
    });
    beats.add(snap.beat);
    heights.add(snap.height);
    await demoPage.waitForTimeout(400);
  }

  check(
    `${label} demo panel reaches all four beats`,
    ["0/-", "1/noise", "2/contributory", "3/pivot"].every((b) => beats.has(b)),
    [...beats].join(" ")
  );
  check(
    `${label} demo panel height never changes while it plays`,
    heights.size === 1,
    `${[...heights].join(", ")}px`
  );

  // The panel is one image to assistive tech, with a fixed description. It
  // must never become a stream of changing text a screen reader narrates.
  const aria = await demoPage.$eval(".demo", (d) => ({
    role: d.getAttribute("role"),
    labelled: (d.getAttribute("aria-label") ?? "").length > 40,
    hidden: [...d.querySelectorAll(".demo-stem, .demo-feedback")]
      .every((e) => e.getAttribute("aria-hidden") === "true"),
    live: d.querySelector("[aria-live]") !== null,
  }));
  check(
    `${label} demo panel stays one labelled image to assistive tech`,
    aria.role === "img" && aria.labelled && aria.hidden && !aria.live,
    JSON.stringify(aria)
  );

  await demoCtx.close();
}

// Someone who asked for less motion gets the solved still, not a faster cycle.
const stillCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const stillPage = await stillCtx.newPage();
await stillPage.goto(LANDING_URL);
await stillPage.locator(".demo").scrollIntoViewIfNeeded();
await stillPage.waitForTimeout(1200);
const stillState = await stillPage.$eval(".demo", (d) => ({
  animated: d.classList.contains("is-animated"),
  painted: [...d.querySelectorAll(".demo-stem mark")]
    .filter((m) => getComputedStyle(m).backgroundColor !== "rgba(0, 0, 0, 0)").length,
}));
check(
  "prefers-reduced-motion leaves the demo panel solved and still",
  stillState.animated === false && stillState.painted === 3,
  JSON.stringify(stillState)
);
await stillCtx.close();

rmSync(SITE, { recursive: true, force: true });

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
