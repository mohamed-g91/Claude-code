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
  *"Tap the finding that most changes immediate management."* A prompt like
  "tap the finding that contraindicates nitrates" hands over the answer and
  reduces the exercise to a multiple-choice question with extra clicks.
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
| `angina.html` | Batch 01, the nine stable-angina cases |
| `play.html` | the mixed deck, every case written so far |

A deck page is a shell: the markup `src/game.js` expects, plus
`data-batch` to narrow the deck. Everything visual lives in `src/brand.css`
(tokens, brand bar, buttons, footer) and `src/game.css` (the deck UI), so a
new batch page is a copy of `angina.html` with a different title and tag —
and a line in the deploy workflow's `cp`.

`src/landing.js` is enhancement only: it recounts the numbers on the landing
page from `cases.json` and offers a returning reader their place back. The
page is correct with it blocked.

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

The demo panel on both landing pages shows a **real case, solved**. That
spoils that one case, so the pick is constrained: it must come from the mixed
deck and never from Batch 01, which is the set a new reader is actually
pointed at. It is currently `resp_asthma_normal_co2` — a normal PaCO2 in
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
site. Only `index.html` and `src/` are published — the test harness is not.

One setting has to be changed by hand, once:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

The workflow then runs on every push to `main`, and can be triggered manually
from any branch (Actions → Deploy to GitHub Pages → Run workflow) to preview
before merging. The site lands at
`https://mohamed-g91.github.io/Claude-code/`.

Only the files named in the workflow's `cp` line are published. **A new page
that is not added there does not exist in production.**

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
src/cases.json             the cases
.claude/skills/impeccable  vendored Impeccable design skill
tools/validate-cases.mjs   schema gate
tools/smoke-test.mjs       browser suite
```

Content is rendered with `textContent`, never `innerHTML` — the cases are data
and stay data.
