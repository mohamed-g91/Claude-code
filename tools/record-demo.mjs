// Records the share clip: one case being solved, wrong tap and all.
//
//   python3 -m http.server 8000 &   (or: npm run serve)
//   node tools/record-demo.mjs      (or: npm run demo)
//
// The point of the clip is the three states, not right-and-wrong: a noise tap
// goes red and is *answered*, a contributory tap goes amber and is told it is
// the right line of reasoning, and only then does the pivot go green and open
// the resolution. Earlier marks stay on screen, because the trail of what you
// tried is the thing this drill is for -- nothing here clears them.
//
// Three things this script is careful about, each of which was a bug first:
//
//   the case          resp_asthma_normal_co2, and only ever from the mixed
//                     deck. Showing a case solved spoils it, and the landing
//                     page's demo panel has already spent this one, so the
//                     clip costs no case a reader is pointed at. See the demo
//                     panel rule in README.md before swapping it.
//   the cursor        Playwright records no pointer, so an un-augmented tap
//                     video looks like the page operating itself. A cursor is
//                     injected into the page and travelled to each target.
//   the framing       recordVideo.size does not scale a small viewport up --
//                     it pads it into the corner. See sizing note below.
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import {
  existsSync, globSync, mkdirSync, openSync, readSync, closeSync,
  readdirSync, readFileSync, rmSync, statSync,
} from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

const ROOT = join(import.meta.dirname, "..");
const URL = process.env.DEMO_URL ?? "http://127.0.0.1:8000/play.html";

// Constrained, not preferred -- see the header note and README's demo panel rule.
const CASE_ID = "resp_asthma_normal_co2";

const OUT_DIR = join(ROOT, "demo");
const OUT_FILE = join(OUT_DIR, "find-the-pivot-demo.mp4");
const WORK_DIR = join(OUT_DIR, ".record");

// --- sizing ------------------------------------------------------------
//
// Target 1080x1920 for Telegram/WhatsApp status. Playwright's
// recordVideo.size does NOT enlarge a smaller picture to fill the frame: an
// emulated 360x640 viewport recorded at 1080x1920 comes out as a phone-sized
// image in the top-left corner of a grey field (measured, not assumed). So
// the frame is produced at native resolution instead: no emulated viewport,
// a real browser window, and --force-device-scale-factor=2, which makes every
// CSS pixel two device pixels and the screencast 1080 wide for real.
//
// The cost is the CSS width. Chromium clamps a window to ~500 CSS px minimum,
// so 360 (the phone breakpoint this audience actually uses) is not reachable
// this way -- 540 is the width that divides into 1080 at 2x. 540x960 is still
// exactly 9:16 and still reads as a phone screen; it is a large phone rather
// than a small one. The alternative, capturing 360 wide and upscaling 3x,
// trades a real layout for mush on every glyph.
const DPR = 2;
const CSS_W = 1080 / DPR;
const CSS_H = 1920 / DPR;

// --- pacing ------------------------------------------------------------
//
// This is a clinical stem, not a UI demo. A viewer has to actually read it,
// so every hold errs slow; the whole clip lands in the 20-30s band.
const T = {
  settle: 700,        // after load, before anything moves
  readStem: 6000,     // the unmarked stem, long enough to take in
  travel: 900,        // cursor flight between targets
  land: 260,          // hover before the finger goes down
  press: 190,         // finger down, before the click lands
  release: 260,       // finger up
  readFeedback: 3800, // each of the two answered taps
  scroll: 800,        // easing the resolution into frame
  readEnd: 6200,      // final state: three marks and the resolution together
};

const executablePath =
  process.env.PW_CHROMIUM ??
  globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")[0];

const launchArgs = (w, h) => [
  `--window-size=${w},${h}`,
  `--force-device-scale-factor=${DPR}`,
  "--hide-scrollbars",
];

/* ---------- the deck, read from the data ---------- */

// Position in the deck and the clauses to tap both come out of cases.json.
// Nothing here is a case number or a clause index typed by hand: the deck gets
// reordered, and a hardcoded "case 2, clause 4" records the wrong case in
// silence rather than failing.
function planFromDeck() {
  const deck = JSON.parse(readFileSync(join(ROOT, "src", "cases.json"), "utf8"));
  const caseIndex = deck.cases.findIndex((c) => c.id === CASE_ID);
  if (caseIndex === -1) throw new Error(`case "${CASE_ID}" is not in src/cases.json`);
  const kase = deck.cases[caseIndex];

  const withRole = (role) =>
    kase.clauses
      .map((clause, i) => ({ ...clause, i }))
      .filter((clause) => clause.role === role);

  const noise = withRole("noise");
  const contributory = withRole("contributory");
  const pivot = withRole("pivot");
  if (!noise.length || !contributory.length || !pivot.length) {
    throw new Error(
      `case "${CASE_ID}" cannot show three states: ` +
      `${noise.length} noise, ${contributory.length} contributory, ${pivot.length} pivot`
    );
  }

  return {
    caseIndex,
    topic: kase.topic,
    steps: [
      // The *last* noise clause, not the first: a stem's opening sentence is
      // usually the background line ("a 24-year-old woman with known asthma"),
      // and tapping that reads as a throwaway. A later noise clause is a real
      // distractor -- here, the falsely reassuring oxygen saturation -- which
      // is the tap worth showing being answered rather than punished.
      { ...noise[noise.length - 1], hold: T.readFeedback },
      { ...contributory[0], hold: T.readFeedback },
      { ...pivot[0], hold: 0 },
    ],
  };
}

/* ---------- the injected cursor ---------- */

// Everything about the pointer lives in the page: a fixed-position dot that
// travels to a target on a CSS transition (compositor-driven, so it is smooth
// in a 25fps screencast), squashes on press, and throws a ripple. The real
// mouse is moved to the same coordinates when it lands, so hover styling
// happens at the moment the cursor arrives rather than before it sets off.
const CURSOR_SETUP = `
  const dot = document.createElement("div");
  dot.id = "__demo_cursor";
  const css = document.createElement("style");
  css.textContent = \`
    #__demo_cursor {
      position: fixed; left: 0; top: 0; width: 34px; height: 34px;
      margin: -17px 0 0 -17px; border-radius: 50%;
      background: rgba(13, 92, 112, 0.26);
      border: 2px solid rgba(13, 92, 112, 0.9);
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.28);
      z-index: 2147483647; pointer-events: none;
      transition: transform var(--dur, 900ms) cubic-bezier(0.32, 0.06, 0.2, 1);
      will-change: transform;
    }
    #__demo_cursor::after {
      content: ""; position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid rgba(13, 92, 112, 0.55); opacity: 0; transform: scale(0.6);
    }
    #__demo_cursor.press::after { animation: __demo_ripple 480ms ease-out; }
    @keyframes __demo_ripple {
      from { opacity: 0.85; transform: scale(0.55); }
      to   { opacity: 0;    transform: scale(2.1); }
    }
  \`;
  document.head.appendChild(css);
  document.body.appendChild(dot);

  window.__demoCursor = {
    at: { x: 0, y: 0 },
    place(x, y, ms) {
      this.at = { x, y };
      dot.style.setProperty("--dur", ms + "ms");
      dot.style.transform = "translate(" + x + "px, " + y + "px) scale(1)";
    },
    press() {
      dot.style.setProperty("--dur", "150ms");
      dot.style.transform =
        "translate(" + this.at.x + "px, " + this.at.y + "px) scale(0.68)";
      dot.classList.remove("press");
      void dot.offsetWidth; // restart the ripple animation
      dot.classList.add("press");
    },
    release() {
      dot.style.setProperty("--dur", "220ms");
      dot.style.transform =
        "translate(" + this.at.x + "px, " + this.at.y + "px) scale(1)";
    },
  };
`;

/* ---------- helpers ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ffmpeg = (args) =>
  execFileSync(ffmpegPath, ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

// `ffmpeg -i` with no output is how this build reports on a file; it exits
// non-zero after printing, which is the expected path, not a failure.
function probe(file) {
  try {
    return ffmpeg(["-i", file]);
  } catch (e) {
    return String(e.stderr ?? "");
  }
}

function readMedia(file) {
  const text = probe(file);
  const stream = text.match(/Stream #0:0.*: Video: (\w+).*?, (\d+)x(\d+)/);
  const duration = text.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  // ffmpeg names a demuxer, not a container: an MP4 arrives as the whole
  // "mov,mp4,m4a,3gp,3g2,mj2" family, and cutting that at the first comma
  // reports every MP4 this script writes as a QuickTime .mov.
  const container = text.match(/Input #0, (.+?), from/);
  return {
    container: container?.[1] ?? "?",
    codec: stream?.[1] ?? "?",
    width: Number(stream?.[2] ?? 0),
    height: Number(stream?.[3] ?? 0),
    seconds: duration
      ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
      : 0,
  };
}

// An MP4 is an ISO base media file: bytes 4-8 of the first box are "ftyp",
// followed by the brand. Checked straight off disk so the report rests on the
// file itself and not only on what a decoder was willing to say about it.
function ftypBrand(file) {
  const fd = openSync(file, "r");
  const head = Buffer.alloc(12);
  readSync(fd, head, 0, 12, 0);
  closeSync(fd);
  return head.subarray(4, 8).toString("latin1") === "ftyp"
    ? head.subarray(8, 12).toString("latin1")
    : null;
}

/* ---------- window sizing ---------- */

// A real window is not all page: some of the height requested comes back as
// browser furniture, and a wrong guess pads the recording with a grey band.
// Rather than hardcode a fudge, open a throwaway window, measure the shortfall
// and add it back, repeating until the page's own box is exactly what the
// screencast needs.
async function windowFitting(cssW, cssH) {
  let w = cssW;
  let h = cssH;
  for (let attempt = 0; attempt < 4; attempt++) {
    const browser = await chromium.launch({
      executablePath,
      args: launchArgs(w, h),
    });
    const page = await (await browser.newContext({ viewport: null })).newPage();
    const inner = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    await browser.close();
    if (inner.w === cssW && inner.h === cssH) return { w, h };
    w += cssW - inner.w;
    h += cssH - inner.h;
  }
  throw new Error(`could not size a window to ${cssW}x${cssH} CSS px`);
}

/* ---------- record ---------- */

async function record(plan, windowSize) {
  const browser = await chromium.launch({
    executablePath,
    args: launchArgs(windowSize.w, windowSize.h),
  });
  const ctx = await browser.newContext({
    viewport: null,
    colorScheme: "light", // the clip must not change with the host's theme
    recordVideo: { dir: WORK_DIR, size: { width: 1080, height: 1920 } },
  });

  // Opening straight on the case, rather than tapping through the navigator to
  // reach it: the deck page restores its own index from localStorage, so
  // seeding that before any page script runs is both invisible and exact.
  // Writing a clean progress object at the same time is what makes the clip
  // identical on a re-run -- no marks or score carried over.
  await ctx.addInitScript(`
    try {
      localStorage.setItem("findthepivot.v1", JSON.stringify({
        index: ${plan.caseIndex}, progress: {},
      }));
    } catch {}
  `);

  const page = await ctx.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(String(e)));

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForSelector(".clause");

  const shown = await page.locator("#meta").innerText();
  if (!shown.startsWith(plan.topic)) {
    throw new Error(`opened on "${shown}", expected the ${plan.topic} case`);
  }

  await page.evaluate(CURSOR_SETUP);
  // The pointer starts low and central, where a thumb rests, so its first
  // move is a journey rather than a materialisation.
  await page.evaluate(
    ([x, y]) => window.__demoCursor.place(x, y, 0),
    [CSS_W / 2, CSS_H - 90]
  );

  await sleep(T.settle);
  await sleep(T.readStem);

  for (const step of plan.steps) {
    const point = await clausePoint(page, step.i);
    await tap(page, point);
    await waitForAnswer(page, step);
    if (step.hold) await sleep(step.hold);
  }

  await frameEnding(page);
  await sleep(T.readEnd);

  if (failures.length) throw new Error(`page errors: ${failures.join("; ")}`);

  await ctx.close(); // flushes the video
  await browser.close();

  const file = readdirSync(WORK_DIR).find((f) => f.endsWith(".webm"));
  if (!file) throw new Error("Playwright wrote no video");
  return join(WORK_DIR, file);
}

// The centre of the clause's widest line box, not of its bounding box: a
// clause that wraps across lines has a bounding-box centre that can land in
// the gap between them, which is a tap on nothing.
function clausePoint(page, clauseIndex) {
  return page.evaluate((i) => {
    const span = document.querySelectorAll("#stem .clause")[i];
    const rects = [...span.getClientRects()];
    const line = rects.reduce((a, b) => (b.width > a.width ? b : a));
    return { x: Math.round(line.x + line.width / 2), y: Math.round(line.y + line.height / 2) };
  }, clauseIndex);
}

async function tap(page, point) {
  await page.evaluate(
    ([x, y, ms]) => window.__demoCursor.place(x, y, ms),
    [point.x, point.y, T.travel]
  );
  await sleep(T.travel);

  await page.mouse.move(point.x, point.y);
  await sleep(T.land);

  await page.evaluate(() => window.__demoCursor.press());
  await sleep(T.press);
  await page.mouse.click(point.x, point.y);

  await page.evaluate(() => window.__demoCursor.release());
  await sleep(T.release);
}

// Waits on the DOM actually being in the answered state -- feedback populated
// in the right colour, the clause marked, and for the pivot the resolution
// rendered -- so the reading pause that follows is a pause on a finished
// screen and never a race the recording happens to win.
async function waitForAnswer(page, step) {
  await page.waitForFunction(
    ({ i, role }) => {
      const span = document.querySelectorAll("#stem .clause")[i];
      const fb = document.querySelector("#feedback");
      const marked = span?.classList.contains(role);
      const answered = fb?.classList.contains(role) && fb.textContent.trim().length > 0;
      if (!marked || !answered) return false;
      if (role !== "pivot") return true;
      const res = document.querySelector("#resolution");
      return (
        res.querySelector("h2") !== null &&
        (res.textContent ?? "").trim().length > 80 &&
        span.getAttribute("aria-disabled") === "true"
      );
    },
    { i: step.i, role: step.role },
    { timeout: 5000 }
  );
}

// The last shot has to carry both halves of the point: every mark still on the
// stem, and the resolution they earned. Scroll only as far as the resolution
// needs, and never past the top of the stem, so the marks cannot be pushed off
// the top of the frame to make room for prose.
async function frameEnding(page) {
  await page.evaluate(() => {
    const stem = document.querySelector("#stem").getBoundingClientRect();
    const res = document.querySelector("#resolution").getBoundingClientRect();
    const needed = window.scrollY + res.bottom - window.innerHeight + 20;
    const limit = window.scrollY + stem.top - 12;
    window.scrollTo({ top: Math.max(0, Math.min(needed, limit)), behavior: "smooth" });
  });
  await sleep(T.scroll);
}

/* ---------- convert ---------- */

// WhatsApp is unreliable with WebM, which is all Playwright writes. H.264 in
// MP4 with yuv420p is the combination that plays everywhere, faststart puts
// the index first so it previews without downloading whole, and CRF 28 on a
// mostly-static screen recording lands in single-digit megabytes.
function toMp4(webm, mp4) {
  ffmpeg([
    "-y", "-i", webm,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "28",
    "-profile:v", "high",
    "-level", "4.0",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    mp4,
  ]);
}

/* ---------- run ---------- */

const plan = planFromDeck();

rmSync(WORK_DIR, { recursive: true, force: true });
mkdirSync(WORK_DIR, { recursive: true });

const windowSize = await windowFitting(CSS_W, CSS_H);
const webm = await record(plan, windowSize);
const source = readMedia(webm);

toMp4(webm, OUT_FILE);
rmSync(WORK_DIR, { recursive: true, force: true });

if (!existsSync(OUT_FILE)) throw new Error("ffmpeg produced no file");
const out = readMedia(OUT_FILE);
const brand = ftypBrand(OUT_FILE);
const bytes = statSync(OUT_FILE).size;

// Report on the file that exists, not on the settings it was asked for.
const problems = [];
if (out.codec !== "h264") problems.push(`video codec is ${out.codec}, not h264`);
if (!out.container.split(",").includes("mp4")) {
  problems.push(`demuxed as "${out.container}", which is not the MP4 family`);
}
if (!brand) problems.push("no ftyp box -- this is not an MP4");
if (out.width !== 1080 || out.height !== 1920) {
  problems.push(`frame is ${out.width}x${out.height}, not 1080x1920`);
}
if (Math.abs(out.seconds - source.seconds) > 0.5) {
  problems.push(`duration drifted: ${source.seconds}s in, ${out.seconds}s out`);
}
if (out.seconds < 20 || out.seconds > 30) {
  problems.push(`duration ${out.seconds.toFixed(2)}s is outside the 20-30s band`);
}

console.log(`
  ${OUT_FILE}
  case        ${CASE_ID} (${plan.topic}, deck position ${plan.caseIndex + 1})
  duration    ${out.seconds.toFixed(2)}s
  dimensions  ${out.width}x${out.height} (portrait 9:16)
  size        ${(bytes / 1024 / 1024).toFixed(2)} MB
  format      ${out.container} / ${out.codec}, ftyp brand "${brand}"
`);

if (problems.length) {
  console.error("The clip is not what it should be:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
