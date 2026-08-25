# Weekly infographic pipeline

Turns last week's posted pearls in the `Cardio V3` Notion database into the
1080×1350 recap image for **@mrcp_gafar**, unattended.

```bash
python3 pipeline/weekly.py plan     # select the week, propose a card per pearl
#   ... write any card the proposal could not ...
python3 pipeline/weekly.py render   # verify every card, then build + screenshot
python3 pipeline/weekly.py send --to review   # dry run unless --send
```

The week number on the image counts the series — week 1 is the week of the first
post — not the ISO week of the year. `--today YYYY-MM-DD` pins the run date, `--fixture` reads a saved Notion
response instead of querying live, and `--work DIR` moves the scratch directory.

## Why it is three commands

`plan` and `send` are the only steps allowed to be interesting. `render`
re-verifies every card from scratch against the pearl it came from, so editing
`work/cards.json` — by hand, or by a model — cannot get an unverified claim into
a PNG. A failed verification deletes any image from a previous run before it
gives up, so `send` can never pick up a stale one.

## The gate

`gate.py` treats a card as an **extract, not a paraphrase**: every word of
substance in the card must already appear in its source pearl. Only a short list
of connectives (`and`, `or`, `if`, `switch`…) may be introduced. Thresholds are
checked as (operator, number) pairs, so `> 2` cannot quietly become `> 5`.

This exists because an image generator asked to typeset these pearls replaced
**atorvastatin with nabumetone** — a statin with an NSAID — while looking
entirely plausible. Tested against that exact substitution, plus a corrupted
threshold, a flipped operator and a fluent paraphrase; all four are rejected.

What the gate does **not** check is meaning. Dropping "contraindicated" from
"prasugrel contraindicated after stroke/TIA" leaves every word present and
inverts the advice. Whoever writes a card is still responsible for it — the gate
only guarantees that no number, drug or term was *invented*.

## Writing a card

A card is one `text` field carrying its own emphasis as `**spans**`. Emphasis
marks what is worth remembering — the threshold, the dose, the drug — and can
fall anywhere in the sentence, as many as five times.

The gate enforces that emphasis means something rather than measuring something:
a span may not exceed 34 characters, may not cross a clause break, may not begin
or end on a connective, and may not separate a number from its unit
(`**20** mg`). A card with no emphasis at all is rejected too.

This replaced a `lead` + `rest` pair where `lead` was always bold and always
first — in practice the first 48 characters, which made every card's bold run
the same width. Legacy `lead`/`rest` cards still verify and render.

The whole card is capped at 118 visible characters.

## Known gaps

- **No source references.** `Cardio V3` has no property holding the guideline a
  pearl came from, so `src` is empty and the card hides the line. The footer
  still reads "Guideline-checked", which is now a claim with nothing next to it.
  Adding a `Source` property to the database is the fix.
- **Topic is positional.** `Topic` is a comma list and the pearl's own topic is
  element 2. Verified against the `Topic:` line inside the pearl bodies, but a
  topic containing a comma would split wrongly.
- **No idempotency marker yet.** Nothing records that a week was published, so
  re-running publishes again.
- **Emphasis placement is only checked, not chosen well.** The proposer marks
  measures and the source's own bold runs; whether that is the *most examinable*
  fact on the card is a judgement the gate cannot make.

## Running it in a cloud routine

Two things the base image does not give you, both found by a routine run rather
than by reading:

- **`qrcode` is not installed.** `build.py` imports it, so the routine runs
  `pip install -r weekly-infographic/requirements.txt` first. Package registries
  are inside the Trusted network allowlist, so this works before anything else
  is opened up.
- **`api.notion.com` and `api.telegram.org` are not in the Trusted allowlist.**
  Both are refused with a 403 at the CONNECT tunnel, which shows up as
  `connect_rejected` in the agent proxy's `recentRelayFailures`. The
  environment's Network access has to be Custom with both hosts added. Nothing
  in the pipeline can work around this, and nothing should try.

## Layout

| file | does |
|---|---|
| `weekly.py` | the three commands |
| `notion.py` | week boundaries, REST query, row normalisation |
| `pearls.py` | pearl HTML → facts; topic extraction and shortening |
| `cards.py` | mechanical card proposal, and re-verification |
| `gate.py` | the check described above |
| `telegram.py` | `sendPhoto`, dry run by default |
| `fixtures/posted_rows.json` | nine real posted rows, for offline runs |
