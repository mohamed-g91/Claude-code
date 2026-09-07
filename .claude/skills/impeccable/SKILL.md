---
name: impeccable
description: The shipping bar for any page, style or copy change in Find the Pivot — brand tokens, layout rules, accessibility gates, honest-copy rules and the test gate. Use when adding or restyling a page (landing, deck, batch), touching src/*.css, writing marketing or landing copy, or before committing anything a learner will see.
---

# Impeccable

The audience is doctors sitting MRCP Part 1, mostly on a phone, mostly tired.
A page that looks amateur is not read carefully, and a drill that is not read
carefully teaches nothing. Every user-facing change clears this bar.

## 1. One source of truth per thing

| thing | lives in | never |
|---|---|---|
| colour, radius, shadow, page width | `src/brand.css` | re-declared per page |
| deck UI styles | `src/game.css` | copied into a second deck page |
| landing styles | `src/landing.css` | inlined in `index.html` |
| cases | `src/cases.json` | duplicated into a per-batch file |

A deck page is a **shell**: `<head>` links, the markup ids `src/game.js`
expects, and `<script src="src/game.js" data-batch="…">`. If two deck pages
differ by more than their `<title>`, their `data-batch` and their brand-bar
label, something belongs in `game.css` instead.

Adding a page means adding it to the `cp` line in
`.github/workflows/pages.yml`. A page that is not copied does not exist in
production.

## 2. Brand

- **Tokens only.** Use `var(--accent)`, `var(--ink-soft)`, `var(--line)`. A
  raw hex outside `brand.css` is a bug.
- Both colour schemes are first class. Define light on bare `:root`, then
  redefine the same names under `@media (prefers-color-scheme: dark)`. Never
  give a colour its only definition inside the dark block.
- The three answer states — pivot green, contributory amber, noise red — are
  the product's signature. Reuse them for anything that means the same thing
  (a solved marker, a state chip on the landing page) and invent no fourth
  colour.
- Type: the system stack for UI, `--font-display` for the wordmark and page
  headings. No webfont, no CDN — the site must load fast on hospital wifi and
  work offline.

## 3. Layout and touch

- Content column caps at `var(--maxw)`; the page never scrolls horizontally at
  360px. Anything wide (a card row, a nav strip) scrolls inside its own
  `overflow-x: auto` container.
- Every interactive target is at least 44×44px, at every width.
- Every focusable element has a visible `:focus-visible` ring. Hover is not an
  affordance — most of this audience has no pointer.
- Text on a filled surface clears WCAG AA (4.5:1) in **both** schemes. Check
  it, do not eyeball it.

## 4. Copy

Written for a registrar, not a marketer.

- **Never fabricate.** No invented testimonials, user counts, pass rates,
  endorsements, institutions or authorship. If a number appears on a page it
  is either counted from `src/cases.json` or it does not ship.
- Say what the thing is and what it costs the reader. "Nine cases, free, no
  signup" beats "revolutionise your revision".
- The product is independent. Every page footer says so: not affiliated with
  MRCP(UK) or the Royal Colleges, cases written originally, educational use
  and not clinical advice.
- The drill prompt never names the answer — see README. Landing copy must not
  leak a pivot either: show a case's shape, never a real case's answer.

## 5. Gate before commit

```
npm run validate                      # cases still shippable
python3 -m http.server 8000 &         # fetch is blocked on file://
node tools/smoke-test.mjs             # deck + landing suite
```

A new page earns new checks in `tools/smoke-test.mjs`: that it loads with no
console error and no 4xx, that its links resolve, that it does not scroll
sideways at 360px, and that its primary button clears contrast in both
schemes. Counts asserted in tests are read from `src/cases.json`, never
hardcoded — retagging a case should fail on a real bug, not on a number.
