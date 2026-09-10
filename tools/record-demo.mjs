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
//                     injected into the page and travelled to each target. It
//                     is kept small: at 540 CSS px wide, a dot big enough to
//                     see on a desktop reads as a beach ball on a phone and
//                     covers the words it is pointing at.
//   the flicker       Chromium's screencast can deliver a frame whose contents
//                     predate the paint it is timestamped after. On the pivot
//                     tap -- the biggest relayout in the clip, where the page
//                     grows 445px and becomes scrollable in one commit -- that
//                     shows up as the case appearing solved, unsolved, then
//                     solved again. The DOM never does this; it is the capture,
//                     it is intermittent, and the only defence is to check the
//                     file and record it again. See the verify section.
//   the instruction   The clip goes out into a status feed, where it is the
//                     whole pitch and the first thing anyone sees of this
//                     site. Unlabelled, it is a stranger watching sentences
//                     change colour for no stated reason: it has to open by
//                     saying what the exercise is and close by saying where
//                     to find it. Those cards are injected too.
//   the framing       recordVideo.size does not scale a small viewport up --
//                     it pads it into the corner. See sizing note below.
//
// Set PW_CHROMIUM to a Chromium binary if Playwright's bundled one is absent.

import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync, globSync, mkdirSync, openSync, readSync, closeSync,
  readdirSync, readFileSync, rmSync, statSync,
} from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

const ROOT = join(import.meta.dirname, "..");
const URL = process.env.DEMO_URL ?? "http://127.0.0.1:8000/play.html";

// Constrained, not preferred -- see the header note and README's demo panel rule.
const CASE_ID = "resp_asthma_bdr_200ml";

// --- what the clip says ------------------------------------------------
//
// Every word burned into the frame, in one place. The opening card is the
// instruction: someone who scrolls past this in a status feed has no idea what
// the colours mean or what they are watching, and the taps on their own do not
// tell them. The captions name each of the three states as it is answered, and
// the closing card is the only thing in the clip that says where the site is.
//
// The copy is the landing page's own, not a second pitch written for video:
// the hero argues "exam stems are mostly noise" and this has to arrive at the
// same site the viewer was promised. The end card's numbers are counted from
// the deck below rather than typed, for the same reason the taps are.
const COPY = {
  intro: {
    eyebrow: "mrcp_gafar \u00b7 Find the Pivot",
    headline: "Exam stems are mostly noise.",
    line: "One finding changes what you do next. Tap it.",
  },
  captions: {
    noise: "A wrong tap is answered, not punished",
    contributory: "Right line of reasoning \u2014 still not decisive",
    pivot: "The pivot \u2014 and why it decides",
  },
  // The answer to the question the clip has been asking. The prompt on screen
  // says "the finding that most changes immediate management", and until this
  // beat existed the clip never legibly said what the management becomes: the
  // resolution does carry it, in the smallest type in the frame, nine lines
  // into a grey paragraph that is on screen for two seconds. Nobody reads
  // that. This states it in the largest words in the clip, over the frame that
  // already shows the marks and the explanation.
  plan: {
    line: "Not confirmed \u2014 finish the algorithm before starting treatment",
    // A plan is the one caption that would still look right while describing
    // the wrong patient. Swapping CASE_ID without rewriting the line above is
    // exactly the silent failure the deck-driven taps exist to prevent, so
    // every one of these has to appear in the case's own resolution.
    evidence: ["confirmed", "algorithm", "treatment"],
  },
  end: {
    // The closing card carries the wordmark too. It is the frame a viewer is
    // looking at when they decide whether to type the address in, and a URL
    // with no name over it is a string of characters to mistype.
    eyebrow: "mrcp_gafar \u00b7 Find the Pivot",
    headline: (cases, topics) => `${cases} cases \u00b7 ${topics} specialties`,
    line: "Free, no signup. Runs in your browser, on your phone.",
    url: "mohamed-g91.github.io/find-the-pivot",
  },
};

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
// This is a clinical stem, not a UI demo. A viewer has to actually read it, so
// every hold errs slow; the whole clip lands in the 20-30s band, which is also
// the longest a WhatsApp status will carry without being cut in two.
//
// The reading holds are shorter than they were, because the clip now spends
// six seconds on the two cards and the band did not move. What was given up is
// the tail of each pause -- the seconds after a viewer has taken the screen in
// and is waiting for something to happen, which in a status feed is where they
// swipe. The stem is not there to be studied; the deck is for that.
const T = {
  intro: 2700,        // the opening card, before the page is uncovered
  introFade: 420,     // matches the overlay's CSS transition
  settle: 600,        // after the card lifts, before anything moves
  readStem: 4200,     // the unmarked stem, long enough to take the shape in
  travel: 900,        // cursor flight between targets
  land: 260,          // hover before the finger goes down
  press: 190,         // finger down, before the click lands
  release: 260,       // finger up
  readFeedback: 3000, // each of the two answered taps
  scroll: 800,        // easing the resolution into frame
  readEnd: 1800,      // three marks and the resolution together, uncovered
  plan: 2800,         // and what the pivot means you do about her
  endCard: 3400,      // where to find it
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

  // A resolution is a plain string in the mixed deck and an object in the
  // batches written since; both have to be readable here, because the plan
  // caption is checked against it.
  const resolution = typeof kase.resolution === "string"
    ? kase.resolution
    : [
        kase.resolution?.lead,
        ...(kase.resolution?.points ?? []).map((pt) => (typeof pt === "string" ? pt : pt?.text)),
        kase.resolution?.trap,
      ].filter(Boolean).join(" ");

  const unsupported = COPY.plan.evidence.filter(
    (term) => !resolution.toLowerCase().includes(term.toLowerCase())
  );
  if (unsupported.length) {
    throw new Error(
      `the plan caption is not supported by case "${CASE_ID}": ` +
      `its resolution never mentions ${unsupported.join(", ")}. ` +
      `Rewrite COPY.plan for this case rather than stating a plan for another one.`
    );
  }

  const noise = withRole("noise");
  const notThePlan = noise.filter((clause) => clause.i !== kase.clauses.length - 1);
  const lateNoise = (notThePlan.length ? notThePlan : noise).at(-1);
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
    // The closing card's claim, counted the same way the landing page counts
    // it, so the clip cannot go out promising a deck size the site does not
    // have. Every case in the file, not only the published batches: that is
    // what "cases written" means on the site too.
    deckSize: deck.cases.length,
    topicCount: new Set(deck.cases.map((c) => c.topic)).size,
    steps: [
      // A late noise clause, but never the last clause of the stem. The first
      // noise clause is usually the background line ("a 34-year-old woman"),
      // and tapping that reads as a throwaway. The last clause of a stem is
      // the inherited plan by house rule, and its feedback only says that it
      // is the plan -- true, and the least interesting thing in the case to
      // watch someone tap. What is wanted in between is a real distractor.
      { ...lateNoise, hold: T.readFeedback },
      // The last contributory clause for the same reason as the noise tap: the
      // first is usually the presenting complaint, which every reader already
      // knows is not decisive. The last one is the near miss worth watching --
      // here the normal FeNO, which is the trap the whole case turns on.
      { ...contributory.at(-1), hold: T.readFeedback },
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
//
// Size is the one number here worth arguing about. The frame is 540 CSS px
// wide, so the dot is a far larger share of it than the same dot on a desktop:
// at 34px it sat on the stem like a thumbprint and hid the words it had just
// tapped. 22px still reads clearly at 1080x1920 on a phone held at arm's
// length, and the ripple carries the tap rather than the dot's own bulk.
const CURSOR_PX = 22;

const CURSOR_SETUP = `
  const dot = document.createElement("div");
  dot.id = "__demo_cursor";
  const css = document.createElement("style");
  css.textContent = \`
    #__demo_cursor {
      position: fixed; left: 0; top: 0;
      width: ${CURSOR_PX}px; height: ${CURSOR_PX}px;
      margin: ${-CURSOR_PX / 2}px 0 0 ${-CURSOR_PX / 2}px; border-radius: 50%;
      background: rgba(13, 92, 112, 0.26);
      border: 2px solid rgba(13, 92, 112, 0.9);
      box-shadow: 0 2px 9px rgba(0, 0, 0, 0.26);
      z-index: 2147483000; pointer-events: none;
      transition: transform var(--dur, 900ms) cubic-bezier(0.32, 0.06, 0.2, 1);
      will-change: transform;
    }
    #__demo_cursor::after {
      content: ""; position: absolute; inset: -5px; border-radius: 50%;
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

/* ---------- the burned-in instruction ---------- */

// The cards and captions are DOM in the page rather than an ffmpeg text
// filter: drawtext needs a font file on the machine and knows nothing about
// line breaking, while the page already carries the site's typography and
// colours in brand.css. What is on screen is therefore the real wordmark
// typeface and the real accent, and it cannot drift from the site the clip is
// advertising.
//
// This one goes in through addInitScript, not evaluate: the screencast starts
// when the context is created, so anything added after load shows up a beat
// late, on top of a page the viewer has already started reading. Built at
// DOMContentLoaded with the opening card already up, the clip's first painted
// frame is the card.
//
// Text is written with textContent and the copy is authored here, so no case
// data reaches the frame except by way of the page itself.
const OVERLAY_SETUP = (copy) => `
  const COPY = ${JSON.stringify(copy)};

  function build() {
    const style = document.createElement("style");
    style.textContent = \`
      #__demo_overlay {
        position: fixed; inset: 0; z-index: 2147483646;
        display: flex; flex-direction: column; justify-content: center;
        padding: 0 46px; box-sizing: border-box;
        background: var(--bg, #f2f6f9);
        font-family: var(--font-ui, sans-serif);
        transition: opacity ${T.introFade}ms ease;
        /* A faded-out overlay is still a full-screen box in front of the page:
           without this the first tap of the clip lands on the card instead of
           the stem, and the recording times out waiting for an answer that was
           never given. Nothing here is ever meant to be clicked. */
        pointer-events: none;
      }
      #__demo_overlay.is-off { opacity: 0; }
      .__demo_eyebrow {
        margin: 0 0 14px; font-size: 20px; font-weight: 700;
        letter-spacing: 0.12em; text-transform: uppercase;
        color: var(--accent, #0d5c70);
      }
      .__demo_headline {
        margin: 0; font-family: var(--font-display, Georgia, serif);
        font-size: 46px; line-height: 1.15; letter-spacing: -0.01em;
        color: var(--brand, #10344f);
      }
      .__demo_line {
        margin: 14px 0 0; font-size: 25px; line-height: 1.45;
        color: var(--ink-soft, #475569);
      }
      .__demo_url {
        margin: 30px 0 0; padding-top: 22px;
        border-top: 1px solid var(--line, #dbe4ec);
        font-size: 24px; font-weight: 700; color: var(--accent, #0d5c70);
      }
      /* Top edge, not a lower third: the last beats scroll the resolution up
         to the bottom of the frame, and a caption down there would cover the
         explanation the whole clip is working towards. */
      #__demo_caption {
        position: fixed; left: 0; right: 0; top: 0; z-index: 2147483645;
        padding: 15px 24px; box-sizing: border-box; text-align: center;
        background: var(--brand, #10344f); color: var(--on-brand, #ffffff);
        font-family: var(--font-ui, sans-serif);
        font-size: 21px; font-weight: 600; line-height: 1.3;
        transform: translateY(-101%);
        transition: transform 340ms cubic-bezier(0.32, 0.06, 0.2, 1);
        pointer-events: none;
      }
      #__demo_caption.is-on { transform: translateY(0); }
      /* The plan is not another label, so it does not look like one. Dark
         green is the deck's own decisive colour, and white on it clears
         contrast at this size where the mid-green line colour would not. */
      #__demo_caption.is-plan {
        background: var(--pivot-ink, #1c4532);
        font-size: 24px;
        padding: 19px 24px;
      }
    \`;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "__demo_overlay";
    const parts = {};
    for (const name of ["eyebrow", "headline", "line", "url"]) {
      const node = document.createElement("p");
      node.className = "__demo_" + name;
      parts[name] = node;
      overlay.appendChild(node);
    }

    const caption = document.createElement("div");
    caption.id = "__demo_caption";

    document.body.append(overlay, caption);

    const card = (text) => {
      for (const name of Object.keys(parts)) {
        parts[name].textContent = text[name] ?? "";
        parts[name].hidden = !text[name];
      }
      overlay.classList.remove("is-off");
    };

    window.__demoOverlay = {
      intro: () => card(COPY.intro),
      end: () => card(COPY.end),
      hide: () => overlay.classList.add("is-off"),
      caption(role) {
        caption.textContent = COPY.captions[role] ?? "";
        caption.classList.remove("is-plan");
        caption.classList.add("is-on");
      },
      plan() {
        caption.textContent = COPY.plan;
        caption.classList.add("is-plan", "is-on");
      },
      clearCaption: () => caption.classList.remove("is-on", "is-plan"),
    };

    window.__demoOverlay.intro();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
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

  await ctx.addInitScript(OVERLAY_SETUP({
    intro: COPY.intro,
    captions: COPY.captions,
    plan: COPY.plan.line,
    end: {
      eyebrow: COPY.end.eyebrow,
      headline: COPY.end.headline(plan.deckSize, plan.topicCount),
      line: COPY.end.line,
      url: COPY.end.url,
    },
  }));

  const page = await ctx.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(String(e)));

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForSelector(".clause");

  const shown = await page.locator("#meta").innerText();
  if (!shown.startsWith(plan.topic)) {
    throw new Error(`opened on "${shown}", expected the ${plan.topic} case`);
  }

  // A clip that shipped without its cards would be exactly the silent,
  // unexplained one this script was changed to stop sending out, and nothing
  // downstream would notice: the file would still be a valid 1080x1920 MP4.
  if (!(await page.evaluate(() => Boolean(window.__demoOverlay)))) {
    throw new Error("the overlay init script did not run -- the clip would carry no instruction");
  }

  await page.evaluate(CURSOR_SETUP);
  // The pointer starts low and central, where a thumb rests, so its first
  // move is a journey rather than a materialisation.
  await page.evaluate(
    ([x, y]) => window.__demoCursor.place(x, y, 0),
    [CSS_W / 2, CSS_H - 90]
  );

  // The opening card is already up -- it was painted with the first frame --
  // so this is the hold on it, then the page underneath is uncovered.
  await sleep(T.intro);
  await page.evaluate(() => window.__demoOverlay.hide());
  await sleep(T.introFade);

  await sleep(T.settle);
  await sleep(T.readStem);

  for (const step of plan.steps) {
    // Each caption belongs to the answer that earned it, so the previous one
    // leaves as the pointer sets off rather than hanging over the next tap.
    await page.evaluate(() => window.__demoOverlay.clearCaption());
    const point = await clausePoint(page, step.i);
    await tap(page, point);
    await waitForAnswer(page, step);
    await page.evaluate((role) => window.__demoOverlay.caption(role), step.role);
    if (step.hold) await sleep(step.hold);
  }

  await frameEnding(page);
  await sleep(T.readEnd);

  // The answer, laid over the frame that already carries the marks and the
  // explanation. All three at once is the strongest shot in the clip, and it
  // is the only place a viewer is told what the pivot means they should do.
  await page.evaluate(() => window.__demoOverlay.plan());
  await sleep(T.plan);

  // Last: the only frame that says where any of this lives.
  await page.evaluate(() => {
    window.__demoOverlay.clearCaption();
    window.__demoOverlay.end();
  });
  await sleep(T.endCard);

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

/* ---------- verify ---------- */

// How many times to record before giving up on a clean take. Three, because a
// flicker showed up in roughly one take in three when this was measured, and a
// run of three bad takes means something has changed that a fourth will not fix.
const MAX_TAKES = 3;

// A flicker is one frame that differs from both its neighbours while those
// neighbours agree with each other: the page appearing to go back and then
// forward again. Motion -- a scroll, the caption sliding, the cards fading --
// also changes every frame, but there the frame before and the frame after do
// not match, and that is what separates the two.
//
// The frames are compared as small grayscale thumbnails. Full resolution buys
// nothing: a flicker is a whole panel changing colour, which survives being
// scaled to 160px wide, and the decode stays under a second.
//
// The threshold is set from measurement, not taste. A real flicker moved 7.6
// grey levels per pixel on average. x264 re-quantising a static screen moves
// under 1.3 -- spread thinly over a third of the frame at 8 levels at most,
// which is nothing a viewer can see. 3.0 sits in the gap.
const FLICKER_W = 160;
const FLICKER_H = 284;
const FLICKER_MOVE = 3.0;

function findFlicker(file) {
  const size = FLICKER_W * FLICKER_H;
  const raw = spawnSync(ffmpegPath, [
    "-hide_banner", "-nostdin", "-i", file,
    "-vf", `scale=${FLICKER_W}:${FLICKER_H},format=gray`,
    "-f", "rawvideo", "-",
  ], { maxBuffer: 1 << 30 }).stdout;

  const frames = Math.floor(raw.length / size);
  // Every third pixel: a panel-sized change is in all of them, and this is the
  // inner loop of a few hundred million comparisons.
  const distance = (a, b) => {
    let sum = 0;
    for (let i = 0; i < size; i += 3) sum += Math.abs(raw[a * size + i] - raw[b * size + i]);
    return sum / (size / 3);
  };

  const found = [];
  for (let n = 1; n < frames - 1; n++) {
    const back = distance(n - 1, n);
    const forward = distance(n, n + 1);
    if (back < FLICKER_MOVE || forward < FLICKER_MOVE) continue;
    const across = distance(n - 1, n + 1);
    if (across < Math.min(back, forward) * 0.25) {
      found.push({ at: n / 25, moved: Math.max(back, forward) });
    }
  }
  return found;
}

/* ---------- run ---------- */

const plan = planFromDeck();
const windowSize = await windowFitting(CSS_W, CSS_H);

// Record, convert, then look at what came out -- and if the capture flickered,
// take it again. The flicker is not something this script can prevent: it is
// Chromium handing back a frame from before the paint, it lands on a different
// beat each time, and a clean take is one re-run away.
let source;
let flicker;
for (let take = 1; take <= MAX_TAKES; take++) {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });

  const webm = await record(plan, windowSize);
  source = readMedia(webm);

  toMp4(webm, OUT_FILE);
  rmSync(WORK_DIR, { recursive: true, force: true });
  if (!existsSync(OUT_FILE)) throw new Error("ffmpeg produced no file");

  flicker = findFlicker(OUT_FILE);
  if (!flicker.length) break;

  const where = flicker
    .map((f) => `${f.at.toFixed(2)}s (moved ${f.moved.toFixed(1)})`)
    .join(", ");
  console.error(
    take < MAX_TAKES
      ? `  take ${take} flickered at ${where} -- recording again`
      : `  take ${take} flickered at ${where}`
  );
}

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
if (flicker.length) {
  problems.push(
    `${flicker.length} flickered frame(s) survived ${MAX_TAKES} takes: ` +
    flicker.map((f) => `${f.at.toFixed(2)}s`).join(", ")
  );
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
  capture     ${flicker.length ? `${flicker.length} flickered frame(s)` : "no flickered frames"}
`);

if (problems.length) {
  console.error("The clip is not what it should be:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
