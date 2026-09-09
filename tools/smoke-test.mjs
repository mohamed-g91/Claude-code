// End-to-end checks for the three-state interaction, accessibility and
// persistence. Needs the site served over HTTP (fetch is blocked on file://):
//
//   python3 -m http.server 8000 &
//   node tools/smoke-test.mjs
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8000/play.html";

// Deck size and the last case's pivot come from the data, never hardcoded --
// otherwise adding a case fails the suite on a count rather than on a bug.
// join(), not new URL() -- the page address below shadows the global URL.
const CASES = JSON.parse(readFileSync(
  join(import.meta.dirname, "..", "src", "cases.json"), "utf8")).cases;
const N = CASES.length;
// The last case's pivot may live on a stem clause, or (for a case whose plan
// is already right) on `none` instead -- there is never both, so exactly one
// of these resolves to a usable target for solving the last case below.
const LAST_PIVOT = CASES[N - 1].clauses.findIndex((c) => c.role === "pivot");
const LAST_PIVOT_IS_NONE = LAST_PIVOT === -1 && CASES[N - 1].none?.role === "pivot";
const results = [];
const check = (name, ok, detail = "") =>
  results.push({ name, ok, detail });

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
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });

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
  batchPage.on("pageerror", (e) => batchConsoleErrors.push(String(e)));
  batchPage.on("console", (m) => { if (m.type() === "error") batchConsoleErrors.push(m.text()); });
  batchPage.on("response", (r) => { if (r.status() >= 400) batchBadResponses.push(`${r.status()} ${r.url()}`); });

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
landingPage.on("pageerror", (e) => landingConsoleErrors.push(String(e)));
landingPage.on("console", (m) => { if (m.type() === "error") landingConsoleErrors.push(m.text()); });
landingPage.on("response", (r) => { if (r.status() >= 400) landingBadResponses.push(`${r.status()} ${r.url()}`); });

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
arabicPage.on("pageerror", (e) => arabicConsoleErrors.push(String(e)));
arabicPage.on("console", (m) => { if (m.type() === "error") arabicConsoleErrors.push(m.text()); });
arabicPage.on("response", (r) => { if (r.status() >= 400) arabicBadResponses.push(`${r.status()} ${r.url()}`); });

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

// --- the deploy workflow must not publish the mixed deck ---
// The two link checks above only prove nothing on the site points at
// play.html. A page copied into _site is still served, so anyone who guesses
// the URL reaches it -- which is precisely what "in preparation" is supposed
// to prevent. The assembly step is therefore the only place the policy is
// actually enforced, and it is read from disk (same as cases.json above)
// because no served page can reveal what the deploy job copies.
const PAGES_WORKFLOW = readFileSync(
  join(import.meta.dirname, "..", ".github", "workflows", "pages.yml"), "utf8");
const copyLine = (PAGES_WORKFLOW.split("\n").find((l) =>
  /^\s*cp\b[^\n]*\.html[^\n]*_site\//.test(l)) ?? "").trim();
check(
  "the deploy workflow copies the open pages into _site but not play.html",
  ["index.html", "ar.html", "angina.html", "diabetes.html"].every((f) => copyLine.includes(f)) &&
    !copyLine.includes("play.html"),
  copyLine || "no cp ... _site/ line for .html files"
);

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
