# The weekly routine

Configure this at claude.ai/code/routines.

A routine created with the `create_trigger` MCP tool has no `sources` field, so
its sessions start with nothing cloned and every run fails at the repository
preflight. The tool has no parameter for repositories, so they have to be added
afterwards in the web form — open the routine, add the repository, save. Either
create it in the form to begin with, or remember to attach the repository if you
mint it from a session.

## Form settings

| field | value |
|---|---|
| Name | Weekly MRCP pearls infographic |
| Repositories | `mohamed-g91/Claude-code` |
| Environment | Default |
| Schedule | Weekly, Saturday 09:00 Africa/Cairo (`0 6 * * 6` UTC) |
| Connectors | none needed — the pipeline uses REST, not the Notion connector |

Routines always clone the **default branch**, which here holds only a README.
The prompt below therefore checks out the working branch itself; there is no
branch selector on the form.

## Environment settings

Network access must be **Custom**, with the default package-manager list kept
and these added:

- `api.notion.com`
- `api.telegram.org`

Neither is in the Trusted allowlist. A blocked request is refused with a 403 at
the CONNECT tunnel, which appears as `connect_rejected` in the agent proxy's
`recentRelayFailures` log — not as a DNS or TLS error, so it is easy to
misread as the API being down. Make the edit on the environment the routine
actually uses.

Environment variables (`.env` format, one per line):

| variable | required | note |
|---|---|---|
| `NOTION_TOKEN` | yes | internal integration token, shared with `Cardio V3` |
| `TELEGRAM_BOT_TOKEN` | yes | the bot that posts to @mrcp_gafar |
| `TELEGRAM_REVIEW_CHAT_ID` | no | defaults to `7515421307` |
| `TELEGRAM_CHANNEL_ID` | no | defaults to `-1004455886951` |
| `NOTION_DATA_SOURCE` / `NOTION_DATABASE` | no | override if the database moves |

Cloud environments have no secrets store and the values are readable by anyone
who can use the environment, so keep the Notion integration read-only and share
only `Cardio V3` with it.

## Prompt

Paste this into the routine's Instructions box.

```
Build and send this week's MRCP pearls infographic for review.

Work in mohamed-g91/Claude-code on branch
`archive/pre-rewrite-origin-implementation`. Routines clone the default branch,
so fetch and check that branch out first, then confirm `pipeline/weekly.py`
exists.

Install dependencies every run: `pip install -r weekly-infographic/requirements.txt`.

Then:

1. `python3 pipeline/weekly.py preflight`
   If it exits non-zero, report the exit code and the message and STOP. The
   codes are documented in pipeline/README.md; each names its own fix. Do not
   fix the environment yourself, and never disable TLS verification.

2. `python3 pipeline/weekly.py plan`
   Exit 3 means fewer than three pearls that week: say so and stop.
   A successful query returning zero rows means the Notion integration was
   never shared with the Cardio V3 database - say that, do not report a quiet
   week.

3. Rewrite `work/cards.json` for every card listed under "need writing", and
   for any proposed card that reads badly. A card is one sentence carrying its
   own emphasis as `**spans**`.
   - Build it from the source pearl's own words; the gate rejects any term that
     is not in the source, so a paraphrase fails.
   - Emphasise the threshold, the dose, the drug - wherever it falls. A span may
     not exceed 34 characters, cross a clause break, begin or end on a
     connective, or separate a number from its unit. Up to five spans.
   - Keep the meaning. Dropping a qualifier like "contraindicated" leaves every
     word present and inverts the advice. `gate.warnings()` catches some of
     these and reports them as [REVIEW]; it will not catch all of them.
   - Pick one fact from a multi-fact pearl rather than cramming. 118 chars max.

4. `python3 pipeline/weekly.py render`
   If it rejects a card, rewrite that card and run again. Never edit gate.py to
   make a card pass, and never lower a limit to get a week over the line.

5. `python3 pipeline/weekly.py preview --send`
   This posts to the private review chat. It is the only thing you ever send.

NEVER run `publish`. Publishing to @mrcp_gafar is Mohamed's decision, made after
he has seen the preview, in a session he is present for.

Reply with the week number, how many pearls made it, every [REVIEW] flag, and
any pearl you dropped with the reason.

Do not commit or push unless you fixed a genuine bug, in which case commit it to
that branch with a short explanation.
```
