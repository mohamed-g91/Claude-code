# Weekly infographic pipeline

Turns last week's posted pearls in the `Cardio V3` Notion database into the
1080×1350 recap image for **@mrcp_gafar**, unattended.

```bash
python3 pipeline/weekly.py preflight  # check the environment; changes nothing
python3 pipeline/weekly.py plan       # select the week, propose a card per pearl
#   ... write any card the proposal could not ...
python3 pipeline/weekly.py render     # verify every card, then build + screenshot
python3 pipeline/weekly.py preview    # post to the review chat; dry run unless --send
python3 pipeline/weekly.py publish --i-have-reviewed-the-preview   # never on cron
```

`preview` and `publish` are separate subcommands rather than one command with a
destination flag. A flag is one keystroke away from posting a draft to the
channel; choosing the wrong subcommand is a deliberate act. Destinations come
from `state/series.json`, never from the command line.

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

## Preflight exit codes

`preflight` runs the same checks the other commands run, and reports the first
failure as an exit code so the routine names it the same way every time instead
of depending on how carefully a prompt was read.

| Code | Meaning |
|---|---|
| 0 | success |
| 3 | fewer than three pearls this week — nothing to post |
| 11 | `state/series.json` missing or malformed |
| 12 | `NOTION_TOKEN` / `TELEGRAM_BOT_TOKEN` missing |
| 13 | api.notion.com unreachable (usually the network allowlist) |
| 14 | api.telegram.org unreachable (same) |
| 15 | a required Python package is not importable |
| 16 | no Chromium found |
| 17 | week already published, or these cards were never previewed |
| 18 | these cards were previewed but never approved |

Preflight never fixes anything. It reports and exits.

## State

- `state/series.json` — the anchor. Week 1 is the week of the first published
  infographic, so the number counts the series rather than the ISO calendar,
  which resets to 1 each January.
- `state/sent_weeks.json` — written by `publish`. A week in this file cannot be
  published again.
- `state/preview_log.json` — written by `preview`. `publish` refuses unless the
  cards it is about to send are byte-identical to the ones previewed, so an edit
  after review cannot slip out.

**These files must be committed.** Each run happens in a fresh container that
clones the repo, so a ledger that is not pushed does not exist next week, and
the double-publish guard silently stops working.

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
- **Soft flags are heuristic.** `gate.warnings()` catches a dropped polarity
  word that governs a term the card uses. It cannot catch a meaning shift with
  no such word in it, and it never blocks a render.
- **The ledger is only as good as the last push.** Nothing in the pipeline
  commits `state/`; that is on whoever runs `publish`.
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

## Publishing to the channel

The channel post is the image alone, with no caption. Publishing republishes the
photo that was reviewed - by `copyMessage` from the Python side, by `file_id`
from n8n - so the channel gets the exact image that was approved rather than a
re-render that merely hashes the same.

Two things can pull the trigger, and only one should be live at a time.

### The repo (`publish`)

`approval` collects a tap through `getUpdates`, then `publish --send` copies the
previewed message to the channel. It refuses a week already in `sent_weeks.json`,
refuses cards that were never previewed (17), and refuses cards that were never
approved (18).

### n8n (`MRCP Weekly Infographic - Approve to Publish`, workflow `Yix5C9nejcbRW5wS`)

A Telegram Trigger on `callback_query`, restricted to the review chat, parses the
`wk:<week>:<hash>:<verdict>` payload that `review_keyboard()` writes, and on
approval sends the reviewed `file_id` to the channel with no caption. The
`weekly_infographic_published` data table (`SrUsmj5uyC02e6KZ`) is the
double-publish guard: an approved tap looks the week up first and answers
"already on the channel" instead of posting twice.

**Activating it sets a webhook on the bot, and a webhook disables `getUpdates`** -
so the repo's `approval` command stops collecting taps the moment n8n goes live.
That is the trade: instant, always-on publishing, at the cost of the repo no
longer being able to see a tap. Run one or the other, not both.

### The editor's test listener steals the webhook

**A Telegram bot has exactly one webhook slot.** n8n says so in the trigger
node: *"Due to Telegram API limitations, you can use just one Telegram trigger
for each bot at a time."* That limit is not only about two workflows - the
editor competes with production for the same slot.

Pressing **Execute step** / **Execute workflow** on the Telegram Trigger puts
the node into "Listening for test event" and registers the **test** URL
(`/webhook-test/...`). That evicts the production registration. When listening
stops - Stop Listening, a timeout, or closing the tab - n8n calls
`deleteWebhook` and does **not** restore production. The workflow still reports
`active: true`, so nothing looks wrong, and every tap is silently dropped.

This is what happened on 2026-08-28: publishes registered the webhook, and it
was gone within 15-45 seconds each time, because the editor was open and
listening.

**To run in production:** Stop Listening, close the workflow tab, and only then
activate. Never leave the trigger's test panel listening. After any test run,
deactivate and reactivate the workflow to force the production webhook back.

Check which one holds the slot with `preview`'s `listener:` line, or directly:
a URL containing `/webhook-test/` is the editor, `/webhook/` is production.

### One bot has one update consumer

Resolved 2026-08-28. The webhook kept disappearing within 20-45 seconds because
**another agent (Hermes) was polling the same bot.** Polling and webhooks are
mutually exclusive on a Telegram bot, so a polling client clears the webhook to
receive; every cycle wiped the registration. It also ate the taps - which is
why `approval` reported "no new taps" and n8n logged no executions. The update
was delivered, just not to us.

It was not n8n: the webhook died just the same with the workflow deactivated
and with the registration set by hand, straight to Telegram.

The fix is a separate bot per consumer. Hermes moved to its own; this bot keeps
the drip, the preview and the publish. Note that `file_id`s are bot-scoped - the
publish step resends the reviewed photo by `file_id`, so whichever bot sends the
preview must be the one that publishes.

**Do not call `setWebhook` by hand.** n8n registers a `secret_token` and rejects
any delivery that arrives without the matching header - a hand-registered
webhook holds the slot and every delivery fails `403 Forbidden`. If the
registration needs replacing: deactivate, `deleteWebhook`, reactivate, and let
n8n set it.

To diagnose this class of problem: `getWebhookInfo` reports `url`,
`pending_update_count`, and `last_error_message`. A URL containing
`/webhook-test/` is the n8n editor holding the slot; `/webhook/` is production.
A registration that vanishes on a cycle means another consumer is polling.

**Superseded (2026-08-28): the n8n listener does not stay registered.** After
`publish`, `getWebhookInfo` shows the webhook for roughly 15 seconds and it is
gone by 45 - reproducibly, every time - while n8n continues to report the
workflow as `active: true` with `triggerCount: 1` and records no executions.
The cause is the editor test listener described above, not a fault in the
workflow. While that is not ruled out, the repo's `approval` + `publish` path is the only route to
the channel. Do not run both: each keeps its own ledger, so a week published
through one is invisible to the other's double-publish guard.

`preview` now prints a `listener:` line after sending, naming the webhook host
or saying none is registered. That line is the only thing that makes this
failure visible - it is silent everywhere else.

The paragraph below describes the intended arrangement, once n8n holds its
registration.

The workflow was **active** as of 2026-08-27. The webhook is registered with
`allowed_updates: ["callback_query"]`, so only button taps are routed to it -
the daily drip, which only sends, is unaffected.

While it is active, `approval` fails with:

    getUpdates failed: 409 Conflict: can't use getUpdates method while webhook
    is active; use deleteWebhook to delete the webhook first

and because `publish` requires a recorded approval (18), the repo cannot post to
the channel at all. That is the intended state, not a fault: n8n owns the
channel while it is live. To hand it back, deactivate the workflow - n8n calls
`deleteWebhook`, and `approval` starts collecting again on the next run.


## What the buttons do

**Approve is a one-time action.** The buttons live on the preview message, and
the Telegram node cannot edit a photo's reply markup - `editMessageReplyMarkup`
is not one of its operations, and Telegram authenticates by URL path, so an HTTP
Request node cannot supply the token from a credential without putting it in
plaintext the way the drip's `Send Poll` node does. So after any decision the
preview is **deleted**, which takes the buttons with it. The delete is marked
`continueRegularOutput`: it is cosmetic, and must never fail a publish that has
already happened.

| Tap | What happens |
|---|---|
| Approve, first time | Publishes to the channel, records the week in `weekly_infographic_published`, answers the tap, deletes the preview, confirms in the review chat |
| Approve, week already in the ledger | Answers "already on the channel", publishes nothing |
| Needs changes | Answers the tap, deletes the preview, reposts the image without buttons for reference, then asks for a written comment with `force_reply` |

The comment prompt carries a `#wk<N>` tag. The reply comes back through the same
trigger (which is why it listens for `message` as well as `callback_query`), the
week is read back out of the tag, and the comment is filed in
`weekly_infographic_feedback` (`XhVdZJ9cdByVxipg`). Nothing is held between
executions - the tag is the whole mechanism. Only a reply to the bot's own
prompt counts; anything else typed in the chat is ignored.

Read the feedback before building the next week: it is keyed by week number, and
says what was wrong with the version that was rejected.

One consequence of deleting the preview: `state/preview_log.json` still holds
that message id, and the repo's `publish` copies from it. That path is already
unusable while n8n holds the webhook, but if the two are ever swapped back, a
week whose preview was deleted has to be previewed again.
