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

Paste this into the form's Instructions box verbatim.

```
Build and send this week's MRCP pearls infographic for review.

PREFLIGHT — check each of these before doing anything else. If one fails, stop
and report it with the named fix. Do not work around a failed preflight: a run
that improvises past one produces an infographic nobody can trust.

a. REPOSITORY. This job lives in mohamed-g91/Claude-code, on the branch
   `claude/weekly-mrcp-infographic-automation-m8sjxa` — NOT on the default
   branch, which holds only a README. Routines clone the repositories configured
   on the routine itself.
   - If no clone is present, stop and say: "this routine has no repository
     attached — add mohamed-g91/Claude-code to it at claude.ai/code/routines".
     Do not clone it by some other route.
   - If a clone is present, run:
       git fetch origin claude/weekly-mrcp-infographic-automation-m8sjxa
       git checkout claude/weekly-mrcp-infographic-automation-m8sjxa
     then confirm `pipeline/weekly.py` exists before continuing.

b. NETWORK. The Default environment's Trusted policy allows package registries
   and GitHub, and does NOT include api.notion.com or api.telegram.org. A
   blocked request fails with 403 and `x-deny-reason: host_not_allowed`. If you
   see that, stop and say which host was refused, and that the fix is to set the
   environment's Network access to Custom with that host in Allowed domains
   (keeping the default list checked).

c. TOKENS. NOTION_TOKEN and TELEGRAM_BOT_TOKEN come from the environment. If
   NOTION_TOKEN is missing, stop and say so. If only TELEGRAM_BOT_TOKEN is
   missing, still run steps 1-3, then stop and say the send was skipped.

Then:

1. Run `python3 pipeline/weekly.py plan`.
   If it exits 3 there were fewer than three posted pearls that week: say so and
   stop. Do not send anything.
   If the Notion query succeeds but returns zero rows, that usually means the
   integration has not been shared with the Cardio V3 database — say that
   explicitly rather than reporting a quiet week.

2. Open `work/plan.json` and `work/cards.json`. For every card listed under
   "need writing", and for any proposed card that reads badly, rewrite its
   `text` field yourself. A card is one sentence carrying its own emphasis as
   `**spans**`.
   - Build each card out of its source pearl's own words. The gate rejects any
     term that does not appear in the source, so a paraphrase will fail.
   - Emphasise what is worth remembering — the threshold, the dose, the drug —
     wherever it falls in the sentence. Do not emphasise a fixed opening run:
     a span may not exceed 34 characters, cross a clause break, begin or end on
     a connective, or separate a number from its unit. Up to five spans.
   - Keep the clinical meaning intact. Dropping a qualifier such as
     "contraindicated" leaves every word present and inverts the advice; the
     gate cannot catch that, so it is on you.
   - Pick the single most examinable fact from a multi-fact pearl rather than
     cramming. The whole card is capped at 118 visible characters.

3. Run `python3 pipeline/weekly.py render`. If it rejects a card, rewrite that
   card and run it again. Never edit `gate.py` to make a card pass, and never
   lower a limit or a minimum to get a week over the line.

4. Run `python3 pipeline/weekly.py send --to review --send`.
   Send only to the review chat. Never send to the channel — publishing to
   @mrcp_gafar is Mohamed's decision, made after seeing the preview.

5. Reply with the week number, how many pearls made it, and any pearl you
   dropped along with the reason. The week number counts the series (week 1 is
   the week of the first post), not the ISO week of the year.

Do not commit or push anything unless you changed code to fix a genuine bug, in
which case commit it to that branch with a short explanation of the bug.
```
