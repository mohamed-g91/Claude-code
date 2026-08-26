# Weekly MRCP Pearls Infographic Routine

Every week this pipeline pulls the last week's posted pearls from the Notion
**Cardio V3** database, rewrites each into a single-sentence card with
`**emphasis**` spans, renders them as one PNG infographic, posts a **preview**
to a private review Telegram chat, and waits for Mohamed's approval before
anything is published to `@mrcp_gafar`.

**Hard rule:** the routine never publishes. `preview` runs unattended on cron.
`publish` only runs when Mohamed runs it, in a session that has seen the preview.

---

## Quick start (Claude Code)

1. Attach this repository to the routine, branch
   `claude/weekly-mrcp-infographic-automation-m8sjxa`.
2. Paste `.claude/routine.md` as the routine's prompt (it is intentionally ~10 lines).
3. Schedule: Sunday 18:00 Africa/Cairo.
4. Environment secrets: `NOTION_TOKEN`, `TELEGRAM_BOT_TOKEN`.
   Optional rewrite-model overrides: `REWRITE_API_BASE`, `REWRITE_API_KEY`,
   `REWRITE_MODEL` (defaults to OpenRouter).
5. Network allowlist: `api.notion.com`, `api.telegram.org`, plus your
   rewrite-API host (default `openrouter.ai`). Keep the default list checked.

## The four subcommands

```
python3 pipeline/weekly.py plan      # fetch + rewrite + structural gate. No render.
python3 pipeline/weekly.py render    # render PNG from work/cards.json. Idempotent.
python3 pipeline/weekly.py preview   # post PNG to review chat. THIS RUNS ON CRON.
python3 pipeline/weekly.py publish --i-have-reviewed-the-preview   # NEVER on cron.
```

There is no `--to` flag and no `--send` flag. Destinations come from
`state/series_start.json`. Flags are too easy to flip; subcommands are not.

## First-publish bootstrap

The week counter starts from the **first published infographic**, so:

1. Push this branch, attach the routine, but **do not enable the cron yet**.
2. Run `plan` / `render` manually, review the PNG yourself, post week 1 to
   `@mrcp_gafar` by hand (or run `preview` then `publish`).
3. Create `state/series_start.json` from `state/series_start.example.json`,
   setting `anchor_date` to the date of that first publish and `anchor_week`
   to `1`. Commit and push.
4. Enable the cron. From then on every run computes
   `week = 1 + (today - anchor_date).days // 7`.

Before step 3 the preflight fails loud with exit code 11 — that is correct;
the routine is dormant until the anchor exists.

## Preflight exit codes

| Code | Check | Meaning |
|---|---|---|
| 0 | — | success |
| 2 | Notion query | zero posted pearls this week |
| 3 | Notion query | fewer than 3 pearls (before *or* after gating) |
| 10 | repo | wrong branch |
| 11 | anchor | `state/series_start.json` missing/malformed |
| 12 | tokens | `NOTION_TOKEN` / `TELEGRAM_BOT_TOKEN` missing |
| 13 | notion | api.notion.com unreachable / rejected |
| 14 | telegram | api.telegram.org unreachable / rejected |
| 15 | deps | required Python package not importable |
| 16 | chromium | Playwright Chromium not installed |
| 17 | branch | behind origin |

Preflight never auto-fixes anything. You fix the environment; the routine
reports and exits.

## The two-pass gate

- **Pass A — structural (hard fail).** Pure Python (`pipeline/gate.py`):
  one sentence, ≤118 chars, ≤5 spans, each span ≤34 chars, no connective
  boundaries, no crossing clause breaks, no separating numbers from units,
  every emphasized term must appear in the source pearl. A failing card gets
  exactly one LLM retry with the error appended; a second failure drops the
  card. Dropping below 3 cards exits 3.
- **Pass B — clinical (soft flag).** LLM-as-judge (`pipeline/gate.py::clinical`)
  flags dropped qualifiers ("contraindicated", "not", "avoid"), dose drift,
  inverted meaning, and ambiguous fact-picks. It **never blocks the render** —
  flagged cards are tagged `[REVIEW]` in the preview caption. You decide.

Never edit `gate.py` to make a card pass. The tests exist to stop you.

## State files

- `state/series_start.json` — the anchor. Written once after first publish.
- `state/sent_weeks.json` — written **only** by `publish`. Makes re-runs safe
  and blocks double-publishing a week.
- `state/preview_log.json` — written by `preview`; `publish` refuses to run
  without a preview newer than the last recorded approval.
- `logs/{date}.jsonl` — one JSON line per run: full audit trail.

## Idempotency

Re-running `render` on byte-identical input returns the cached PNG. Re-running
`preview` for an already-published week exits 0 as `no_change`. Re-running for
a week whose pearls changed refuses: "week N already sent, manual reset
required."

## Tests

```
pip install -r weekly-infographic/requirements.txt
playwright install chromium
python -m pytest tests/
```

`tests/test_gate_structural.py` is pure Python (no network). Fixtures live in
`tests/fixtures/`.
