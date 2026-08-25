# The weekly routine

Registered as a Claude Code Routine that fires a fresh session on a cron. It
needs these set on the environment (once — they persist across every firing):

| variable | what |
|---|---|
| `NOTION_TOKEN` | Notion internal integration token with access to `Cardio V3` |
| `TELEGRAM_BOT_TOKEN` | the bot that posts to @mrcp_gafar |
| `TELEGRAM_REVIEW_CHAT_ID` | optional — defaults to `7515421307`, the private chat |
| `TELEGRAM_CHANNEL_ID` | optional — defaults to `-1004455886951`, @mrcp_gafar |

Only the two tokens have to be supplied; the chat ids have defaults in
`weekly.py`. `NOTION_DATABASE` / `NOTION_DATA_SOURCE` can override the Notion
ids if the database moves workspaces.

Cron: `0 6 * * 6` — Saturday 06:00 UTC, 09:00 Africa/Cairo, summarising the week
that ended the previous Sunday.

The live prompt is stored on the trigger itself; this file is the readable copy.
Change both together, or the file drifts from what actually runs.

## Prompt

> Build and send this week's MRCP pearls infographic for review.
>
> The repository is checked out for you. Work on the branch
> `claude/weekly-mrcp-infographic-automation-m8sjxa` and read `pipeline/README.md`
> before starting. The job needs NOTION_TOKEN, TELEGRAM_BOT_TOKEN and
> TELEGRAM_REVIEW_CHAT_ID from the environment; if any is missing, stop and say
> which one rather than improvising a workaround.
>
> 1. Run `python3 pipeline/weekly.py plan`.
>    If it exits 3 there were fewer than three posted pearls that week: say so and
>    stop. Do not send anything.
>
> 2. Open `work/plan.json` and `work/cards.json`. For every card listed under
>    "need writing", and for any proposed card that reads badly, rewrite its
>    `text` field yourself. A card is one sentence carrying its own emphasis as
>    `**spans**`.
>    - Build each card out of its source pearl's own words. The gate rejects any
>      term that does not appear in the source, so a paraphrase will fail.
>    - Emphasise what is worth remembering — the threshold, the dose, the drug —
>      wherever it falls in the sentence. Do not emphasise a fixed opening run:
>      a span may not exceed 34 characters, cross a clause break, begin or end on
>      a connective, or separate a number from its unit. Up to five spans.
>    - Keep the clinical meaning intact. Dropping a qualifier such as
>      "contraindicated" leaves every word present and inverts the advice; the
>      gate cannot catch that, so it is on you.
>    - Pick the single most examinable fact from a multi-fact pearl rather than
>      cramming. The whole card is capped at 118 visible characters.
>
> 3. Run `python3 pipeline/weekly.py render`. If it rejects a card, rewrite that
>    card and run it again. Never edit `gate.py` to make a card pass, and never
>    lower a limit or a minimum to get a week over the line.
>
> 4. Run `python3 pipeline/weekly.py send --to review --send`.
>    Send only to the review chat. Never send to the channel — publishing to
>    @mrcp_gafar is Mohamed's decision, made after seeing the preview.
>
> 5. Reply with the week number, how many pearls made it, and any pearl you
>    dropped along with the reason. The week number counts the series (week 1 is
>    the week of the first post), not the ISO week of the year.
>
> Do not commit or push anything unless you changed code to fix a genuine bug, in
> which case commit it to that branch with a short explanation of the bug.
