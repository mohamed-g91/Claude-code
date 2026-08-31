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

## Running it

`fetch` is blocked on `file://`, so serve the folder rather than opening the
file directly:

```
npm run serve       # python3 -m http.server 8000
```

then open http://127.0.0.1:8000.

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

The browser suite needs the server running in another shell. It drives real
Chromium and covers the three-state interaction, that earlier marks survive,
locking after the pivot, keyboard-only play, focus visibility, persistence
across reload, behaviour with `localStorage` blocked, no horizontal scroll and
44px tap targets at 360px, and button contrast in both colour schemes.

Set `PW_CHROMIUM` if Playwright's bundled browser is missing.

## Layout

```
index.html              shell, styles, no embedded content
src/game.js             rendering, three-state scoring, progress
src/cases.json          the cases
tools/validate-cases.mjs   schema gate
tools/smoke-test.mjs       browser suite
```

Content is rendered with `textContent`, never `innerHTML` — the cases are data
and stay data.
