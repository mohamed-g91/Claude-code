# Find the Pivot

A clinical reasoning drill for MRCP Part 1. Each case is a stem broken into
findings; the learner taps the one finding that changes immediate management.

Exam stems are mostly noise wrapped around a single decisive datum, and
candidates fail by pattern-matching the noise. This trains the step before the
answer: which finding actually commits you.

## Three states, not right and wrong

Every clause is one of:

| state | meaning |
|---|---|
| `pivot` | the finding that commits you to a different action |
| `contributory` | right line of reasoning, not decisive alone |
| `noise` | does not change what you do next |

This matters. In the right-ventricular-infarct case, a raised JVP is genuinely
part of the reasoning — a candidate who taps it is thinking correctly and is
told so, rather than being marked wrong. Binary scoring teaches a distorted
model of how clinical reasoning works.

Two further rules the content follows:

- **The prompt never names the answer.** It is the same line on every case:
  *"Tap the finding that most changes immediate management, or None if it is
  already right."* A prompt like "tap the finding that contraindicates
  nitrates" hands over the answer and reduces the exercise to a
  multiple-choice question with extra clicks.
- **None is an answer, not a trick.** One Batch 01 case has its pivot on None,
  so the prompt has to admit that possibility and both landing pages have to
  teach it — otherwise a reader meets a case whose answer is "the plan is
  already right" having been told, implicitly, that something always changes.
- **Marks persist.** Once you tap something it stays coloured, so the trail of
  what you tried is still on screen when you find the pivot. That trail is the
  useful part.
- **The stem is prose.** Findings are clickable runs inside a flowing
  paragraph, not a stacked list — a list of sentences reads as multiple choice,
  which is the habit this is meant to break. Highlights use
  `box-decoration-break: clone` so a sentence spanning two lines keeps one
  unbroken highlight.

## The name

The site is published by **mrcp_gafar** — lowercase, with the underscore;
**Find the Pivot** is the product.
Both sit in the brand bar as one lockup — company in the display face, product
after it in a quieter weight — and the footer credits the company. Below
360px the product half drops so the mark and the nav link still share one
line; the thresholds in `brand.css` were measured against a deck page's bar,
which is the widest in the site.

Because the company name contains "MRCP", the independence notice in every
footer is not boilerplate: it is the thing that keeps the name from reading
as an endorsement. Do not remove it.

## Pages

| page | what it is |
|---|---|
| `index.html` | the landing page — what a friend sent the link opens first |
| `ar.html` | the same page in Arabic, and the fuller explanation of how to solve a case |
| `angina.html` | Batch 01, the nine stable-angina cases — the only deck a reader can open |
| `play.html` | the mixed deck, every case written so far — **in preparation, not published** |

`play.html` is deliberately absent from the published site. The mixed deck is
presented on both landing pages as in preparation, with no link to it, and a
page left in `_site` is reachable by anyone who guesses the URL whether or not
anything links to it — so the two have to agree. The file stays in the repo
because the browser suite drives the full deck through it, and because it
becomes the live mixed deck again the day that opens: add `play.html` to
`PAGES` in `tools/build-site.mjs` and swap the card back to a linked one.

The same argument applies to the cases themselves, and for a while it was not
applied: the build copied `src/` wholesale, so `src/cases.json` served all 48
cases — pivots, feedback and resolutions for the 28 unpublished ones included —
at a URL as guessable as `play.html`'s. It is now split at build time. `_site`
carries one `src/cases.<batch>.json` per **published** batch and no
`src/cases.json` at all, so an unpublished case has no URL to guess. Which
batches are published is read off the `data-batch` attributes of the deck pages
the build copies, never from a second list: adding a batch page publishes its
cases, and forgetting to add the page keeps them private.

A deck page is a shell: the markup `src/game.js` expects, plus
`data-batch` to narrow the deck. Everything visual lives in `src/brand.css`
(tokens, brand bar, buttons, footer) and `src/game.css` (the deck UI), so a
new batch page is a copy of `angina.html` with a different title and tag —
and its filename in `PAGES` in `tools/build-site.mjs`, which is what both
publishes the page and publishes that batch's cases.

`src/landing.js` is enhancement only: it recounts the numbers on the landing
page and offers a returning reader their place back. The page is correct with
it blocked.

Both scripts run against two layouts and must work in both, because there is no
build step locally: served from the repo there is only `src/cases.json`, and
served from `_site` there are only the split files. So each asks for the narrow
file it wants — `src/cases.<batch>.json` for a deck page, `src/counts.json` for
a landing page — and falls back to `src/cases.json` when that is not there. The
404 on the first attempt is expected in the repo layout and is the only 404 the
browser suite tolerates.

`src/counts.json` is aggregate numbers only — total cases, distinct topics, and
a count per published batch. The landing pages claim "48 Cases written" and
"11 Specialties covered"; those claims have to stay true without the 48 cases
being downloadable to check them.

### Arabic

`ar.html` is not a translation of `index.html` — it carries a section the
English page does not, explaining what a case is asking and how to work
through one, because that is what a reader arriving in Arabic most needs.

It shares every stylesheet and script with the English page. Nothing in
`src/` is direction-specific: spacing and borders use logical properties
(`border-inline-start`, `margin-inline-end`, `text-align: start`), so `dir`
does the mirroring on its own. Arabic swaps the type stack and loosens the
line height through `:root:lang(ar)` in `brand.css`, and that is the whole
difference.

The demo panel on both landing pages plays a **real case being solved** —
noise, then contributory, then pivot, then a hold on all three at once. It
ships solved in the markup, which is what a reader with the script blocked
gets, and `landing.js` rewinds it. A pointer travels to each finding and taps
it: a mark that appears with nothing causing it reads as a screenshot being
swapped, and the panel's whole job on a marketing page is to be recognised as
the interaction. It idles with a pulse from the first frame and marks its
first finding inside a second and a half, because a reader who arrives during
a long rewound pause sees a still panel and scrolls past an animation they
never saw start. The caption is swapped at the same time — the shipped one
says the case is *shown solved*, which stops being true the moment it plays.

Showing a case solved spoils it, so the pick is constrained: it must come
from the mixed deck and never from Batch 01, which is the set a new reader
is actually pointed at. It is currently `resp_asthma_normal_co2` — a normal PaCO2 in
acute asthma, which argues the site's whole premise better than an invented
stem could: the reassuring number is the decisive one. Keep the
not-in-Batch-01 rule on any future swap.

Two things deliberately stay left-to-right on that page: the demo panel,
which depicts the real English interface and would misrepresent it mirrored,
and the cases themselves. **The cases are in English and stay in English** —
the exam is in English, and translating the stems would drill vocabulary the
candidate will never meet in the hall. `ar.html` says so plainly rather than
letting a reader discover it by clicking through.

## Running it

`fetch` is blocked on `file://`, so serve the folder rather than opening the
file directly:

```
npm run serve       # python3 -m http.server 8000
```

then open http://127.0.0.1:8000.

## Deploying

`.github/workflows/pages.yml` builds and publishes to GitHub Pages. It runs the
validator and the browser suite first, so a broken case cannot reach the live
site. Only the open pages and the assets under `src/` are published — not the
test harness, not `play.html`, the mixed deck that is still in preparation, and
not `src/cases.json`, which carries that deck's cases.

One setting has to be changed by hand, once:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

The workflow then runs on every push to `main`, and can be triggered manually
from any branch (Actions → Deploy to GitHub Pages → Run workflow) to preview
before merging. The site lands at
`https://mohamed-g91.github.io/find-the-pivot/`.

The assembly itself is `tools/build-site.mjs`, not shell in the workflow — the
step is one `node` line. It was moved out after a `sed` escaping bug in that
shell, which would have shipped a site whose scripts 404ed, was caught only by
dry-running it by hand. The script copies the open pages and `src/`, writes the
per-batch deck files and `counts.json`, stamps the commit onto every asset URL
so a returning reader cannot be served a cached script from an earlier deploy,
and fails the job if any of that did not apply. Run it by hand — `node
tools/build-site.mjs` — to inspect what a deploy would publish.

Only the files named in `PAGES` are published. **A new page that is not added
there does not exist in production**, and neither do its cases.

All asset paths are relative, so the site works unchanged under that subpath.

## Content

Cases live in `src/cases.json`. Add one by appending an object with `id`,
`topic`, `clauses` and `resolution`, then run the validator:

```
npm run validate
```

It rejects anything unshippable — a case with no pivot (unwinnable), two pivots
(the second is unreachable once the case locks), a missing `feedback` string, an
unknown role, a duplicate id — and warns if the pivot sits in the same position
too often, which teaches position rather than reasoning.

Two style guides govern the writing, and the validator enforces what it can of
them: [`docs/stem-style.md`](docs/stem-style.md) for the half of a case read
before answering, [`docs/explanation-style.md`](docs/explanation-style.md) for
the feedback and resolution read after. The second exists because batch 02
shipped without it and reached 243-word resolutions, which candidates from both
batches told us were too long and too clever. A `resolution` is now either a
plain string or a rule sentence, two to four bullets and a closing paragraph;
its word budgets are warnings, not gates, so a genuinely tangled case can still
ship.

> **Write cases originally.** Do not lift stems from PassMedicine, Pastest or
> any other commercial bank. Using their content in anything distributed or
> sold is copyright infringement. Published exam blueprints and topic
> weightings are fine; their questions are not.

## Tests

```
npm test            # validator, then the browser suite
```

Design work on these pages goes through the vendored
[Impeccable](https://github.com/pbakaus/impeccable) skill in
`.claude/skills/impeccable` — run `/impeccable audit index.html` or
`/impeccable polish ar.html`. See `.claude/skills/impeccable/VENDORED.md` for
where the copy came from and how to update it.

House rules that skill does not know about: no number appears on a page that
was not counted from `cases.json`, no page claims a user count, an
endorsement or a pass rate, and every footer says the site is independent of
MRCP(UK) and the Royal Colleges.

The browser suite needs the server running in another shell. It drives real
Chromium and covers the three-state interaction, that earlier marks survive,
locking after the pivot, keyboard-only play, focus visibility, persistence
across reload, behaviour with `localStorage` blocked, no horizontal scroll and
44px tap targets at 360px, and button contrast in both colour schemes.

It also runs `tools/build-site.mjs` into a temp directory and reads the result,
because no served page can reveal what the deploy publishes: that
`src/cases.json` is absent, that no unpublished case id appears anywhere in the
bytes of `_site`, that each batch file carries exactly its own cases, and that
`counts.json` agrees with `cases.json`.

It also covers both landing pages: that they load clean, that their links to
the decks resolve, that the counts they show match `cases.json`, that those
counts are still there with JavaScript off, and that the primary call to
action clears contrast in both schemes. The Arabic page additionally has to
prove it is really RTL, that the mirrored layout does not scroll sideways at
360px, and that the language switch between the two pages goes both ways.

Set `PW_CHROMIUM` if Playwright's bundled browser is missing.

## Layout

```
index.html                 landing page
ar.html                    landing page, Arabic
angina.html                Batch 01 deck shell
play.html                  mixed deck shell
src/brand.css              design tokens, brand bar, buttons, footer
src/game.css               the deck UI
src/landing.css            the landing page
src/game.js                rendering, three-state scoring, progress
src/landing.js             landing counts and resume (enhancement only)
src/cases.json             the cases (repo only -- never published whole)
.claude/skills/impeccable  vendored Impeccable design skill
tools/build-site.mjs       assembles _site (what the deploy publishes)
tools/validate-cases.mjs   schema gate
tools/smoke-test.mjs       browser suite
```

Content is rendered with `textContent`, never `innerHTML` — the cases are data
and stay data.

## The share clip

`tools/record-demo.mjs` records the clip that goes out on Telegram and
WhatsApp: one case solved in about 26 seconds, wrong tap and all. Serve the
site first, because it drives the real page rather than a mock-up:

```
npm run serve &
npm run demo
```

It writes `demo/find-the-pivot-demo.mp4` — 1080×1920, H.264, a couple of
megabytes — and prints the duration, dimensions, size and the container it
actually verified. The `demo/` directory is ignored: the clip is an output,
rebuildable in under a minute, and does not belong in the history.

What it shows is the argument the site is making, so the shape is fixed: a
pause on the unmarked stem long enough to read it, a **noise** tap that goes
red and is answered, a **contributory** tap that goes amber and is told it is
the right line of reasoning but not decisive, then the **pivot** going green
and opening the resolution — and a final hold with all three marks and the
explanation on screen together. The earlier marks are never cleared. A clip
that showed only a right answer would be selling a quiz.

The clip also has to **say what it is**, because it travels without the site
around it. A viewer meets it in a status feed with no page, no heading and no
sound, and taps alone do not tell a stranger what the colours mean or where
any of this lives. So three things are burned into the frame, all of them
injected into the page rather than drawn by ffmpeg — the page already has the
typefaces and the state colours, and a card built from them cannot drift from
the site it is advertising:

- an **opening card** carrying the landing page's own argument and the
  instruction (*tap the one finding that changes what you do next*), painted
  with the very first frame because it goes in through `addInitScript`;
- a **caption** at the top edge as each tap is answered, naming that state in
  words — a lower third would cover the resolution the last beats scroll into
  view;
- a **closing card** with the wordmark, the deck's size counted from
  `cases.json` rather than typed, and the URL. It is the only frame that says
  where to find any of this.

The copy all sits in one `COPY` object at the top of the script. The holds are
shorter than they were to pay for the six seconds those cards cost, because
20–30s is not negotiable: it is the longest a WhatsApp status carries without
being cut in two. What was given up is the tail of each pause, after a viewer
has taken the screen in — the stem is not there to be studied, the deck is for
that.

The case is `resp_asthma_normal_co2`, and that is a constraint rather than a
taste: a clip of a case being solved spoils it, so the pick has to come from
the unpublished mixed deck and never from a published batch — and this one is
already spent by the landing page's demo panel, so the clip costs nothing new.
The same rule as the demo panel applies to any swap. It is reached through
`play.html`, which serves the full deck; the script finds the case by `id` in
`cases.json` and picks its taps by clause `role`, so reordering the deck
cannot quietly point it at the wrong stem.

Two details are load-bearing and easy to undo by accident. Playwright records
no pointer, so the script injects a cursor into the page and flies it to each
target with a press on landing — without it the taps look like the page
operating itself. It is deliberately small (22px): the frame is only 540 CSS
pixels wide, so a dot sized for a desktop sits on the stem like a thumbprint
and hides the words it has just tapped. And `recordVideo.size` does not scale a small viewport up to
fill the frame, it pads it into the corner, so the recording is taken at
native resolution from a real 540×960 window at a device scale factor of 2
rather than from an emulated phone viewport. 540 CSS pixels, not the 360 the
deck's phone breakpoint targets, is the narrowest window Chromium will give:
the trade is a slightly roomier layout in exchange for text that is sharp at
1080 wide.
