# Claude-code

## Token Tracker

A local, dependency-free token usage tracker for Claude sessions. It pulls
usage from two sources into one SQLite store, then reports on it from the
terminal or as an offline HTML dashboard:

- **Claude Code session transcripts** -- parses the JSONL logs Claude Code
  already writes to `~/.claude/projects/**/*.jsonl` (no extra instrumentation
  needed).
- **Live Anthropic API calls** -- a thin wrapper you drop around your own
  `anthropic.Anthropic()` client to log usage from `messages.create()` /
  `messages.stream()` responses in your own apps/scripts.

For every request it captures input tokens, output tokens, cache write
tokens (broken out by 5-minute vs. 1-hour TTL), cache read tokens, thinking
tokens, model, effort, service tier, speed, and an estimated USD cost --
stored alongside the full raw `usage` object for drill-down.

### Setup

No dependencies are required for the core tracker (stdlib only). Optionally:

```bash
pip install -e ".[api]"   # only needed if you use the live API wrapper
pip install -e ".[dev]"   # only needed to run the test suite
```

### Usage

```bash
# 1. Ingest your local Claude Code session logs into the store
python -m token_tracker sync

# 2. Print a terminal summary (overall, by model, by day)
python -m token_tracker report

# 3. Generate the offline HTML dashboard and open it
python -m token_tracker dashboard --open
```

All three subcommands accept `--db path/to/usage.db` (default:
`data/usage.db`). `report` and `dashboard` also accept `--since`, `--until`,
`--source {claude_code,api}`, and `--model` to filter what's aggregated;
the dashboard additionally lets you filter, sort, and drill into individual
requests interactively once it's open, no server required.

### Tracking your own API calls

```python
import anthropic
from token_tracker.api_tracker import TrackedClient
from token_tracker.store import UsageStore

store = UsageStore()  # defaults to data/usage.db
client = TrackedClient(anthropic.Anthropic(), store, session_id="my-app-run-1")

response = client.messages_create(
    model="claude-sonnet-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "hi"}],
)
```

Already have a response object from your own SDK call? Log it directly
instead of going through `TrackedClient`:

```python
from token_tracker.api_tracker import record_from_response

store.upsert(record_from_response(response, session_id="my-app-run-1"))
```

### Pricing

`token_tracker/pricing.py` holds a small $/MTok table for current Claude
models plus the standard cache-write/cache-read multipliers. Update it
directly as pricing changes or new models ship -- everything else in the
package reads from it. Requests for a model not in the table still get
tracked in full; only `cost_usd` comes back as `null`/`n/a`.

### Tests

```bash
pip install -e ".[dev]"
pytest
```
