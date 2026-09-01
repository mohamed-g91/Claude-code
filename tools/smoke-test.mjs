// End-to-end checks for the three-state interaction, accessibility and
// persistence. Needs the site served over HTTP (fetch is blocked on file://):
//
//   python3 -m http.server 8000 &
//   node tools/smoke-test.mjs
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { globSync } from "node:fs";

const URL = process.env.SMOKE_URL ?? "http://127.0.0.1:8000/index.html";
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
  promptText === "Tap the finding that most changes immediate management.",
  promptText
);

// --- no horizontal scroll at 360px ---
// The navigator has its own contained overflow-x, so this also confirms
// that scroll strip isn't leaking into the page's own scrollWidth.
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("no horizontal scroll at 360px", overflow <= 0, `overflow ${overflow}px`);

// --- navigator ---
const navCount = await page.locator(".nav-item").count();
check("nav renders one button per case", navCount === 29, `${navCount} nav buttons`);

const firstCurrent = await page.locator('.nav-item[aria-current="true"]').innerText();
check("case 1 marked current on load", firstCurrent === "1", firstCurrent);

const navSizes = await page.locator(".nav-item").evaluateAll((els) =>
  els.map((e) => e.getBoundingClientRect()));
check(
  "nav buttons are >= 44px tap targets",
  navSizes.every((r) => r.width >= 44 && r.height >= 44),
  `min ${Math.round(Math.min(...navSizes.map((r) => Math.min(r.width, r.height))))}px`
);

// Tab from a fresh page should reach the navigator before anything else --
// it comes first in document order, ahead of the stem's clauses.
await page.keyboard.press("Tab");
const firstFocused = await page.evaluate(() => document.activeElement?.className);
check(
  "Tab reaches the navigator first",
  String(firstFocused).includes("nav-item"),
  String(firstFocused)
);

// --- comments export with nothing recorded yet ---
await page.locator("#export-notes").click();
const emptyExportLabel = await page.locator("#export-notes").innerText();
check("export shows empty state with no notes", emptyExportLabel === "No notes yet", emptyExportLabel);

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
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("2 of 29"));
const meta2 = await page.locator("#meta").innerText();
check("next advances", meta2.includes("2 of 29"), meta2);

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

// --- navigator jump ---
// Jump to case 5 directly, skipping cases 3-4 entirely -- something only
// the navigator makes possible.
await page.locator(".nav-item").nth(4).click();
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("5 of 29"));
const meta5 = await page.locator("#meta").innerText();
check("nav jump moves to the clicked case", meta5.includes("5 of 29"), meta5);

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
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("2 of 29"));

// --- keyboard only ---
// The navigator's 29 buttons come before the clauses in tab order, so the
// guard needs enough headroom to walk past all of them first.
await page.keyboard.press("Tab");
let focused = await page.evaluate(() => document.activeElement?.className);
let guard = 0;
while (!String(focused).includes("clause") && guard++ < 40) {
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

// --- comments (review tool, not part of the published game) ---
// Still on case 2. Write a note, jump away, and confirm it neither leaks
// into another case nor gets lost.
await page.locator("#notes").fill("feels vague — check this wording");
const notedNav = await page.locator(".nav-item").nth(1).getAttribute("class");
check("nav marks a case that has a comment", notedNav.includes("has-note"), notedNav);

await page.locator(".nav-item").nth(4).click();
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("5 of 29"));
const leaked = await page.locator("#notes").inputValue();
check("comments don't leak into another case", leaked === "", JSON.stringify(leaked));

await page.locator(".nav-item").nth(1).click();
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("2 of 29"));
const restoredNote = await page.locator("#notes").inputValue();
check(
  "comment is restored when navigating back",
  restoredNote.includes("feels vague"),
  restoredNote
);

await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.locator("#export-notes").click();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check(
  "export copies the comment with its case context",
  clip.includes("Case 2") && clip.includes("feels vague"),
  clip.slice(0, 80)
);
const copiedLabel = await page.locator("#export-notes").innerText();
check("export button confirms the copy", copiedLabel === "Copied!", copiedLabel);

// --- persistence across reload ---
await page.reload();
await page.waitForSelector(".clause");
const metaAfter = await page.locator("#meta").innerText();
const scoreAfter = await page.locator("#score").innerText();
check("case index persists across reload", metaAfter.includes("2 of 29"), metaAfter);
check("score persists across reload", /of \d/.test(scoreAfter), scoreAfter);

const navAfterReload = await page.locator('.nav-item[aria-current="true"]').innerText();
check("nav current-case marker restores after reload", navAfterReload === "2", navAfterReload);

const noteAfterReload = await page.locator("#notes").inputValue();
check(
  "comment persists across reload",
  noteAfterReload.includes("feels vague"),
  noteAfterReload
);

// --- end of deck wraps rather than dead-ends ---
await page.evaluate(() => {
  localStorage.setItem("findthepivot.v1",
    JSON.stringify({ index: 28, progress: {} }));
});
await page.reload();
await page.waitForSelector(".clause");
const lastCase = await page.locator("#meta").innerText();
check("can resume at last case", lastCase.includes("29 of 29"), lastCase);

// Case 29 (cardio_surgery_thrombolysis): the pivot is the recent-surgery
// finding -- "operation" is unique to that clause.
const pivotIdx = await page.locator(".clause").evaluateAll((els) =>
  els.findIndex((e) => e.textContent.includes("operation")));
await page.locator(".clause").nth(pivotIdx).click();
const nextLabel = await page.locator("#next").innerText();
check("last case offers restart, not a dead button", /again/i.test(nextLabel), nextLabel);

const lastNavSolved = await page.locator(".nav-item").nth(28).getAttribute("class");
check("last case marked solved in nav after completion", lastNavSolved.includes("solved"), lastNavSolved);

await page.locator("#next").click();
await page.waitForFunction(() =>
  document.getElementById("meta").textContent.includes("1 of 29"));
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

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
