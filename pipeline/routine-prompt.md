# The weekly routine

Registered as a Claude Code Routine that fires a fresh session on a cron. It
needs these set on the environment (once — they persist across every firing):

| variable | what |
|---|---|
| `NOTION_TOKEN` | Notion internal integration token with access to `Cardio V3` |
| `TELEGRAM_BOT_TOKEN` | the bot that posts to @mrcp_gafar |
| `TELEGRAM_REVIEW_CHAT_ID` | your private chat, where the preview lands |
| `TELEGRAM_CHANNEL_ID` | `-1004455886951`, only used after approval |

Cron: `0 6 * * 6` — Saturday 06:00 UTC, 09:00 Africa/Cairo, summarising the week
that ended the previous Sunday.

## Prompt

> Build and send this week's MRCP pearls infographic for review.
>
> 1. `python3 pipeline/weekly.py plan`
> 2. For every card listed under "need writing", and for any proposed card that
>    reads badly, write `lead` and `rest` into `work/cards.json` yourself. Build
>    them out of the source pearl's own words — the gate rejects any term that is
>    not in the source. Start `rest` with a connector (`—`, `;`, or a lower-case
>    continuation). Keep the clinical meaning intact: do not drop a qualifier
>    like "contraindicated", which the gate cannot catch.
> 3. `python3 pipeline/weekly.py render`. If it rejects a card, fix that card and
>    run it again. Never edit `gate.py` to make a card pass.
> 4. `python3 pipeline/weekly.py send --to review --send`
> 5. Reply with the week number, the pearl count, and any pearl you dropped.
>
> If `plan` exits 3 there were fewer than three pearls that week — say so and
> stop, do not send anything. Never send to the channel; the review chat is the
> only destination for this job.
