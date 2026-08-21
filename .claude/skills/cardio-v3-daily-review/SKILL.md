---
name: cardio-v3-daily-review
description: "Daily review-and-reformat pass over Mohamed's Cardio V3 Notion database (MRCP cardiology Telegram drip). Finds tomorrow's entries (Africa/Cairo time), reformats their Answer and MRCP Pearl properties into escaped Telegram-HTML using the fixed templates below, then posts one Notion notification to Mohamed. Use when asked to run the Cardio V3 daily review, when invoked on the daily schedule, or when the user says things like 'run the cardio review', 'reformat tomorrow's cardio items', or names the Cardio V3 Daily Review Reminder agent."
---

# Cardio V3 Daily Review

Mirrors the Notion custom agent "Cardio V3 Daily Review Reminder" (🫀), rebuilt as a Claude Code skill so it can run on Claude Code's own scheduler instead of Notion's.

## Overview

Send Mohamed a daily in-app Notion reminder to review tomorrow's Cardio V3 study items, after reviewing and reformatting them yourself.

## Fixed references (this workspace)

- Cardio V3 database: `https://app.notion.com/p/3bda7a110cf680fdb2c4d2db8094aefb`
- Cardio V3 data source (use as SQL table name): `collection://3bda7a11-0cf6-80f2-947a-000b2ba43559`
- Telegram Queue hub page (post the notification comment here): `3ada7a11-0cf6-8018-9a4b-cff256c4a894`
- Mohamed's Notion user id (for the @mention): `3add872b-594c-81ed-b300-00027c94ddb3`

If any of these no longer resolve (page moved/renamed), re-fetch by searching Notion for "Cardio V3" and "Telegram Queue" before giving up.

## Daily review and reformat behaviour

1. Compute "tomorrow" as a calendar date in the `Africa/Cairo` time zone (regardless of what time zone this run executes in).
2. Query the Cardio V3 data source for every row whose `Post date` equals that date:
   ```sql
   SELECT url, "Name", "date:Post date:start", "Topic", "Answer", "MRCP Pearl", "Correct Answer",
          "Question", "Option 1", "Option 2", "Option 3", "Option 4", "Option 5", "Status"
   FROM "collection://3bda7a11-0cf6-80f2-947a-000b2ba43559"
   WHERE date("date:Post date:start") = date(?)
   ```
   (bind tomorrow's date as `YYYY-MM-DD`).
3. If there are no matching rows, skip straight to **No items** below.
4. For each matching row, reformat its `Answer` and `MRCP Pearl` properties per the **Output format rule** and the two fixed templates below, and write them back with `notion-update-page` (`update_properties` on that page's `url`/id). Use the row's own `Correct Answer`, `Question`/options, and `Topic` to fill in the templates — don't invent clinical content beyond what's already in the row; if the row lacks enough material to fill a field (e.g. no `Option 5`), drop that line rather than fabricating an option.
5. After editing every matching page, post **one** concise Notion notification (see **Notification** below).

## Output format rule (applies to all formatting)

Whenever you reformat `Answer` or `MRCP Pearl`, always output it as Telegram-transferable literal HTML:

- Use escaped literal tags so the text can be copied to Telegram: `\<p>...\</p>`, `\<b>...\</b>`, and `\<i>...\</i>` only if needed.
- Use paragraph tags only for spacing. Do not use `<br />`.
- Do not leave unescaped HTML like `<p>...</p>` in the final property value — every angle bracket must be backslash-escaped in the stored text.

## Fixed Pearl layout (use this every time)

One idea per paragraph, written as literal escaped HTML. `[chapter/subtopic]` is the subtopic the Pearl's own content is actually about — not the row's full `Topic` field. A row's `Topic` field can legitimately list more than one subtopic when the Pearl and Question are intentionally cross-paired on different topics (a known pattern in this database); in that case use only the subtopic matching the Pearl's own content, never append the Question's unrelated topic as a third item. No memory hook line.

```
\<p>💡\</p> \<p>\<b>Topic: Cardiology, [chapter/subtopic]\</b>\</p> \<p />\</p> \<p>\<b>💎 The Pearl\</b>\</p> \<p>\<b>Core rule\</b> — [1 sentence takeaway.]\</p> \<p>\<b>Do\</b> — [Best next step / first-line.]\</p> \<p>\<b>Avoid / trap\</b> — [Common pitfall.]\</p> \<p>#MRCP #Pearl\</p>
```

## Answer text formatting

For Cardio V3 items from D019 onward, format `Answer` as Telegram-transferable literal HTML:

- Use escaped literal tags: `\<p>...\</p>`, `\<b>...\</b>`, `\<i>...\</i>` only if needed.
- Use paragraph tags only for spacing. Do not use `<br />`.
- Do not include any "Guidance update" section.
- Keep wording concise, exam-focused, and easy to skim.
- Bold the answer line, section headings, and each option label/option text.
- End every answer with `\<p>#MRCP #Answer\</p>`.

Fixed structure:

```
\<p>✅ \<b>Answer: [Letter]. [Correct option]\</b>\</p> \<p>\<b>Why this is correct\</b>\</p> \<p>[Short explanation focused on the stem.]\</p> \<p>💡 \<b>Key exam point\</b>\</p> \<p>[One high-yield exam rule or guideline.]\</p> \<p>\<b>Option review\</b>\</p> \<p>- \<b>A. [Option A]\</b> — [Why correct/incorrect.]\</p> \<p>- \<b>B. [Option B]\</b> — [Why correct/incorrect.]\</p> \<p>- \<b>C. [Option C]\</b> — [Why correct/incorrect.]\</p> \<p>- \<b>D. [Option D]\</b> — [Why correct/incorrect.]\</p> \<p>- \<b>E. [Option E]\</b> — [Why correct/incorrect.]\</p> \<p>#MRCP #Answer\</p>
```

## Notification

Notion's own "in-app reminder" is normally an @-mention that fires Notion's native notification. Reproduce it with `notion-create-comment` on the Telegram Queue hub page (`3ada7a11-0cf6-8018-9a4b-cff256c4a894`), mentioning Mohamed via `<mention-user url="https://www.notion.so/3add872b594c81edb30000027c94ddb3"/>` at the start of the comment markdown. The comment must:

- Say tomorrow's Cardio V3 items were reviewed and reformatted (or that none were scheduled — see below).
- List the matching page names (first few, plus a total count if there are many).
- Include the item dates if useful.
- Remind Mohamed to review the final content and manually change each item's `Status` when done.

Keep the notification brief and actionable — this is a one-shot summary, not a report.

## If there are no items

If no Cardio V3 entries are scheduled for tomorrow, skip the edit step and post a short notification (same @mention mechanism) saying there are no Cardio V3 items scheduled for tomorrow.

## Important boundaries

- Do not change `Status` automatically — that stays a manual, human step.
- Keep the notification brief and actionable.
- If there are many matching items, include the first few and mention the total count rather than listing all of them.
- This skill only touches Cardio V3 rows and posts the one notification comment — it does not post to Telegram, change other databases, or take any other action.
