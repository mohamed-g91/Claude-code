# MRCP Cardio Revision

An offline-first mobile web app (PWA) combining MRCP Part 1 cardiology revision with
game mechanics: spaced repetition, streaks, XP, and five play modes — MCQ, Rapid Fire,
Swipe Sort, Pair Match and Bucket Match — plus per-group boss battles.

No backend, no auth, single user. All content is baked into the build at content-sync
time; the app never talks to Notion at runtime.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build       # type-check + production build to dist/
npm run preview      # serve the production build at http://localhost:4173
```

```bash
npm run test         # vitest — domain layer + content pipeline
npm run test:e2e      # playwright — mobile smoke tests (390x844)
```

Playwright uses the Chromium already installed at `/opt/pw-browsers/chromium` (see
`playwright.config.ts`) — don't run `playwright install`.

## How the content pipeline works

Content lives in a Notion database ("Cardio V3") and is turned into the JSON the app
ships with by a deterministic build-time pipeline under `scripts/`:

```
scripts/fixtures/notion-raw.json   committed fixture: 86 rows, verbatim from Notion
scripts/topic-groups.json          hand-authored map: 64 fine topics -> 8 topic groups
scripts/lib/normalise.mjs          Notion row -> Question (topic rule, id, answer strip)
scripts/lib/generate-play-items.mjs deterministic, seeded generator for all 5 modes
scripts/sync-notion.mjs            orchestrates the above, writes public/content/*.json
```

Run it in either mode:

```bash
node scripts/sync-notion.mjs --dry-run   # offline, reads the committed fixture
node scripts/sync-notion.mjs             # live, needs NOTION_TOKEN (see below)
```

`--dry-run` never touches the network — it's what CI and this repo's own verification
run against. The live path needs a Notion **internal integration** token:

1. Create an internal integration at <https://www.notion.so/my-integrations>.
2. Share the "Cardio V3" database with that integration (`···` menu → *Connections*).
3. `export NOTION_TOKEN=secret_...`
4. `npm run sync`

Either way, the script writes `public/content/manifest.json`,
`public/content/cardiology.v1.json` and `public/content/cardiology.play.v1.json`, and
those generated files are what's committed and what the app actually loads — the
running PWA never depends on Notion or on `NOTION_TOKEN` existing.

### The topic rule

Notion's `Topic` column is a comma-joined string, e.g.
`Cardiology,Prosthetic heart valves,Pericarditis`. Position 0 is the specialty,
position 1 is the *pearl's* topic (this is what the Notion page title mirrors),
and **position 2 is the question's actual topic** — the one the app uses. This
routinely looks wrong against the page title (a question titled "Prosthetic heart
valves" can genuinely be a pericarditis vignette) — that's Notion's authoring
convention, not a bug, and `normalise.mjs` does not "correct" it. See
`scripts/lib/normalise.test.mjs` for the D016 regression that pins this down.

### The play-item generator

`scripts/lib/generate-play-items.mjs` is deterministic and seeded — the same
questions and seed always produce byte-identical output — so the committed
`cardiology.play.v1.json` can be regenerated and diffed rather than trusted blindly.
Running it prints a summary of items produced per mode and every rejection with its
reason (a Bucket Match tile whose answer text is ambiguous across groups, a Pair
Match round that couldn't find 4 collision-free questions, an incomplete question
excluded from Swipe Sort, etc.) — nothing is dropped silently.

## Adding a new specialty

Nothing in the app is Cardiology-specific:

1. Add an entry to `scripts/sources.json` (data source URL, output filenames).
2. Extend `scripts/topic-groups.json` with that specialty's fine-topic → group
   mapping. The build **fails** if any fine topic in the bank has no group — a new
   specialty can't silently ship uncategorised questions.
3. Run the sync (`--dry-run` against a fixture you provide, or live with
   `NOTION_TOKEN`).

The new specialty then shows up in `manifest.json` and everywhere that reads from
it — topic tree, bucket categories, boss tree — with no other code changes.

## Architecture

- **`src/domain/`** — pure, unit-tested game rules: SM-2 spaced repetition
  (`srs.ts`), XP/combo scoring (`scoring.ts`), day-boundary streaks with a grace
  window (`streak.ts`), per-group mastery + boss pass/fail (`mastery.ts`), and
  mode-specific item selection (`selectors.ts`). No React, no storage — these are
  plain functions in, plain data out.
- **`src/storage/`** — Dexie (IndexedDB) behind a `StorageProvider` interface
  (`provider.ts`), so a future sync backend is an adapter swap, not a rewrite.
- **`src/app/useAnswerEngine.ts`** — the one place every mode calls into to grade
  an answer: it runs the domain functions above and persists the result, so a
  Swipe Sort answer advances the same SRS card an MCQ answer would.
- **`src/modes/`** — one component per play mode, all rendered inside
  `SessionShell` (progress bar, combo/XP, pause, summary screen).
- **`src/screens/`** — the four tab destinations (Today, Practice, Progress,
  Settings) plus the `/session/:mode` player route.

Bucket Match uses `@dnd-kit/core` (pointer + keyboard sensors) for drag-and-drop,
**and every tile has a tap-to-place fallback** (tap a tile, then tap a bucket) —
this isn't an accessibility afterthought, drag-and-drop on mobile browsers is
unreliable enough that tap is the mode most people will actually use one-handed.

All Notion-authored HTML (vignettes, explanations) is sanitised with DOMPurify
(`src/content/sanitize.ts`) before it's ever rendered.

## Notes on this build

- **Bootstrapping**: `public/content/*.json` in this repo was generated by querying
  Notion through this session's MCP access (SQL query mode was rate-limited on the
  workspace, so the extraction used the MCP tool's view-mode query instead, which
  markdown-escapes `< > ~ ^ [ ]` — `scripts/fixtures/notion-raw.json` has those
  un-escaped back to the real HTML/text before normalisation). All 86 rows are
  copied verbatim; nothing was authored or paraphrased.
- **Routing**: the app uses `HashRouter`, so it works from a plain static file
  server (or `file://`-adjacent hosting) with no server-side rewrite rules needed
  for deep links — useful for a no-backend PWA.
