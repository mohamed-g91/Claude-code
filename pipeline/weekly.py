#!/usr/bin/env python3
"""The weekly infographic job.

Three commands, so the step that needs judgement is separable from the steps
that must not have any:

  plan    select last week's posted pearls, propose a card for each, and write
          work/plan.json + work/cards.json. Cards that could not be proposed
          mechanically are listed with the reason.
  render  verify EVERY card against its own pearl, then build and screenshot.
          Refuses to render if any card fails, so a bad card cannot reach a PNG.
  send    deliver the PNG. Dry run unless --send is passed.

Only `plan` produces something a human or model may edit; `render` re-verifies
from scratch, so editing cards.json cannot bypass the gate.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards as cards_mod
import gate
import notion
import telegram
from pearls import parse_pearl
import state

ROOT = pathlib.Path(__file__).resolve().parent.parent
RENDERER = ROOT / "weekly-infographic"
MIN_CARDS = 3

# Destinations come from state/series.json, never from a flag. A flag is one
# keystroke away from posting a draft to the channel; a subcommand is not.

# The week number on the image counts the series, not the calendar. The epoch
# lives in the renderer's CONFIG so there is one definition of week 1.
sys.path.insert(0, str(RENDERER))
import build as renderer


def _load_rows(args):
    start, end = notion.last_complete_week(args.today)
    if args.fixture:
        raw = json.loads(pathlib.Path(args.fixture).read_text())
    else:
        raw = notion.fetch_raw(start, end)
    return start, end, notion.normalise_rows(raw, start, end)


def cmd_plan(args):
    series = state.load_series()
    start, end, rows = _load_rows(args)
    work = pathlib.Path(args.work); work.mkdir(parents=True, exist_ok=True)
    plan = {"week": series.week_for(start), "iso_week": start.isocalendar()[1],
            "start": start.isoformat(), "end": end.isoformat(),
            "rows": rows, "cards": [], "needs_writing": []}
    for row in rows:
        card, problems = cards_mod.propose(row)
        card["flags"] = gate.warnings(card.get("text", ""), parse_pearl(row["pearl"])["text"])
        plan["cards"].append(card)
        if problems:
            plan["needs_writing"].append({"id": row["id"], "topic": card["topic"],
                                          "problems": problems,
                                          "source": parse_pearl(row["pearl"])["text"]})
    (work / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    kept = (work / "cards.json").exists() and not args.reset_cards
    if not kept:
        (work / "cards.json").write_text(json.dumps(plan["cards"], ensure_ascii=False, indent=1))
    print(f"Week {plan['week']} (ISO {plan['iso_week']}) · {start} to {end} · "
          f"{len(rows)} posted rows")
    print(f"{len(rows) - len(plan['needs_writing'])} cards proposed cleanly, "
          f"{len(plan['needs_writing'])} need writing")
    for n in plan["needs_writing"]:
        print(f"  · {n['topic']}: {'; '.join(n['problems'])}")
    if kept:
        # Hand-written cards are worth protecting, but silence here means the
        # summary above describes freshly proposed cards while the file on disk
        # still holds the previous run's text.
        print(f"NOTE: kept the existing {work / 'cards.json'} - the list above "
              f"describes freshly proposed cards, not what is in that file. "
              f"Pass --reset-cards to regenerate it.", file=sys.stderr)
    if len(rows) < MIN_CARDS:
        print(f"only {len(rows)} pearls this week (minimum {MIN_CARDS}) — nothing to post")
        return 3
    return 0


def cmd_render(args):
    work = pathlib.Path(args.work)
    plan = json.loads((work / "plan.json").read_text())
    cards = json.loads((work / "cards.json").read_text())
    by_id = {r["id"]: r for r in plan["rows"]}

    # Drop any image from a previous run before verifying. Otherwise a render
    # that fails verification leaves last run's PNG sitting in the work
    # directory, and `send` cannot tell it apart from one that just passed.
    for stale in work.glob("week*-*.png"):
        stale.unlink()

    failed = []
    for card in cards:
        row = by_id.get(card["id"])
        if row is None:
            failed.append((card.get("topic", "?"), ["card id is not in this week's rows"]))
            continue
        problems = cards_mod.verify(card, row)
        if problems:
            failed.append((card["topic"], problems))
            continue
        # Recompute the soft flags against the card as it stands now. They were
        # written by `plan` against the *proposed* card, so a card rewritten by
        # hand kept the proposal's flags - both reporting warnings that no
        # longer apply and, worse, never running the inversion check on the
        # hand-written cards it exists to check.
        card["flags"] = gate.warnings(card.get("text", ""),
                                      parse_pearl(row["pearl"])["text"])
    if failed:
        for topic, problems in failed:
            print(f"REJECT {topic}: {'; '.join(problems)}", file=sys.stderr)
        print(f"{len(failed)} card(s) failed verification — not rendering", file=sys.stderr)
        return 1
    (work / "cards.json").write_text(json.dumps(cards, ensure_ascii=False, indent=1))
    if len(cards) < MIN_CARDS:
        print(f"only {len(cards)} verified cards (minimum {MIN_CARDS}) — not rendering",
              file=sys.stderr)
        return 3

    content = {"week_start": plan["start"], "week": plan["week"],
               "specialty": args.specialty,
               "pearls": [{"topic": c["topic"], "src": c.get("src", ""),
                           "text": c.get("text") or
                                   f"**{c.get('lead', '')}** {c.get('rest', '')}".strip()}
                          for c in cards]}
    content_path = work / "week.json"
    content_path.write_text(json.dumps(content, ensure_ascii=False, indent=1))

    subprocess.run([sys.executable, "build.py", "--content", str(content_path.resolve())],
                   cwd=RENDERER, check=True)
    subprocess.run(["node", "shoot.mjs", "weekly_dark", "weekly_light"],
                   cwd=RENDERER, check=True)
    for theme in ("dark", "light"):
        src = RENDERER / f"weekly_{theme}.png"
        dst = work / f"week{plan['week']}-{theme}.png"
        dst.write_bytes(src.read_bytes())
        print(f"rendered {dst}")
    return 0


def _cards_hash(work):
    """Identity of exactly these cards, so a ledger entry means something."""
    raw = (work / "cards.json").read_bytes()
    return hashlib.sha256(raw).hexdigest()[:16]


def _span(start, end):
    """Human date range. Mirrors the footer format in weekly-infographic/build.py,
    which a test pins, so the caption and the image never disagree."""
    a = dt.date.fromisoformat(start)
    b = dt.date.fromisoformat(end)
    if a.month == b.month:
        return f"{a.day} – {b.day} {b:%B %Y}"
    return f"{a.day} {a:%b} – {b.day} {b:%b} {b:%Y}"


REVIEW_PREFIX = "[REVIEW]"
PREVIEW_PREFIX = "[PREVIEW]"


def _preview_caption(plan, cards, specialty="Cardiology"):
    """Context for the reviewer. The channel post carries no caption at all,
    so nothing here has to be safe to publish - it never travels."""
    lines = [f"Week {plan['week']} · {_span(plan['start'], plan['end'])}",
             f"{len(cards)} {specialty.lower()} pearls · "
             f"{plan['start']} to {plan['end']}"]
    flagged = [c for c in cards if c.get("flags")]
    if flagged:
        lines.append(f"{REVIEW_PREFIX} {len(flagged)} card(s) flagged: "
                     + "; ".join(c["topic"] for c in flagged))
    lines.append(f"{PREVIEW_PREFIX} Nothing has been published. "
                 f"Approve to post it to the channel.")
    return "\n".join(lines)


def _sent_summary(out, kind):
    """One line saying what actually happened.

    This used to dump the raw API response truncated to 900 characters. The
    photo-size array is long enough to push reply_markup past the cut, so the
    one field worth checking - whether the review buttons were attached - was
    the field you could not see.
    """
    if out.get("dry_run"):
        what = (f"copy of message {out['message_id']}" if out.get("method") == "copyMessage"
                else f"{out.get('photo_bytes')} bytes")
        return (f"DRY RUN {kind}: would post to {out['chat_id']}, "
                f"{what}, "
                f"buttons={'yes' if out.get('reply_markup') else 'no'}, "
                f"token={'present' if out['token_present'] else 'MISSING'}")
    if not out.get("ok"):
        return f"{kind} FAILED: {json.dumps(out)[:400]}"
    r = out["result"]
    # copyMessage returns a bare MessageId - just {"message_id": n} - where
    # sendPhoto returns a full Message. Do not assume the richer shape.
    if "chat" not in r:
        return f"{kind} sent · message {r['message_id']} (copied)"
    kb = r.get("reply_markup", {}).get("inline_keyboard") or []
    labels = [b["text"] for row in kb for b in row]
    return (f"{kind} sent · chat {r['chat']['id']} · message {r['message_id']} · "
            f"buttons: {', '.join(labels) if labels else 'none'}")


def _load_for_send(args):
    work = pathlib.Path(args.work)
    plan = json.loads((work / "plan.json").read_text())
    cards = json.loads((work / "cards.json").read_text())
    png = work / f"week{plan['week']}-{args.theme}.png"
    if not png.exists():
        raise state.PreflightError(1, f"{png} does not exist - run render first")
    return work, plan, cards, png


def cmd_preview(args):
    """Post to the private review chat. This is the only thing cron ever runs."""
    series = state.load_series()
    work, plan, cards, png = _load_for_send(args)
    digest = _cards_hash(work)
    out = telegram.send_photo(str(png), series.review_chat_id,
                              _preview_caption(plan, cards, series.specialty),
                              dry_run=not args.send,
                              buttons=telegram.review_keyboard(plan["week"], digest))
    if args.send:
        state.record_preview(plan["week"], digest, out.get("result", {}).get("message_id", 0))
    for c in cards:
        for f in c.get("flags", []):
            print(f"[REVIEW] {c['topic']}: {f}", file=sys.stderr)
    print(_sent_summary(out, "preview"))
    if args.send:
        print(f"listener: {telegram.listener()}")
    return 0


def cmd_publish(args):
    """Post to the channel. Never runs unattended, and never twice for a week."""
    series = state.load_series()
    work, plan, cards, png = _load_for_send(args)
    week, digest = plan["week"], _cards_hash(work)

    if state.already_published(week):
        print(f"week {week} is already in {state.SENT_FILE.name} - refusing to publish "
              f"it twice. Remove the entry by hand if this is deliberate.", file=sys.stderr)
        return state.ALREADY_PUBLISHED
    if not state.preview_matches(week, digest):
        print(f"these exact cards have not been previewed. Run `preview --send` and "
              f"look at it before publishing.", file=sys.stderr)
        return state.ALREADY_PUBLISHED
    if not state.approved(week, digest):
        print(f"week {week} has not been approved. Tap Approve on the preview, then "
              f"run `approval` to collect the tap.", file=sys.stderr)
        return state.NOT_APPROVED

    # The channel post is the image alone - Mohamed wants no caption on it.
    # copyMessage keeps the source caption unless one is supplied, and an
    # empty string is a supplied caption, so this clears it rather than
    # inheriting the preview text.
    caption = ""
    previewed = state.load_preview_log().get(str(week), {}).get("message_id")
    if previewed:
        # Publish the message that was approved, not a file that merely hashes
        # the same. Nothing can have been re-rendered in between.
        out = telegram.copy_message(series.review_chat_id, previewed,
                                    series.channel_chat_id, caption,
                                    dry_run=not args.send)
    else:
        out = telegram.send_photo(str(png), series.channel_chat_id, caption,
                                  dry_run=not args.send, buttons=False)
    if args.send:
        state.record_published(week, digest, out.get("result", {}).get("message_id", 0))
    print(_sent_summary(out, "publish"))
    return 0


def cmd_approval(args):
    """Collect a button tap from the review chat and record what it said.

    The tap is not seen as it happens: there is no webhook, so it waits in
    Telegram's update queue (24 hours) until this runs. --wait long-polls, so
    running it straight after preview catches a prompt tap; otherwise the next
    run picks it up.
    """
    series = state.load_series()
    offset = state.load_update_offset()
    res = telegram.get_updates(offset=offset, wait=args.wait).get("result", [])

    seen = 0
    for u in res:
        state.record_update_offset(u["update_id"] + 1)
        cb = u.get("callback_query")
        if not cb:
            continue
        parts = (cb.get("data") or "").split(":")
        if len(parts) != 4 or parts[0] != "wk":
            continue
        _, week, digest, verdict = parts
        if str(cb["message"]["chat"]["id"]) != series.review_chat_id:
            continue                       # only this chat decides
        who = cb.get("from", {}).get("first_name")
        state.record_approval(week, digest, "ok" if verdict == "ok" else "no",
                              by=who, update_id=u["update_id"])
        settled = ("✅ Approved - ready to publish." if verdict == "ok"
                   else "✍️ Marked as needing changes. Nothing was published.")
        # The decision is already recorded. Telling Telegram about it is
        # cosmetic and can legitimately fail - a callback id expires, so a tap
        # collected hours later cannot be acknowledged. Never lose the decision
        # over the acknowledgement.
        for label, fn in (("answerCallbackQuery",
                           lambda: telegram.answer_callback(cb["id"], settled)),
                          ("editMessageCaption",
                           lambda: telegram.settle_message(
                               series.review_chat_id, cb["message"]["message_id"],
                               _settled_caption(cb["message"].get("caption", ""), settled)))):
            try:
                fn()
            except Exception as e:
                print(f"note: {label} failed ({e}); the decision still stands",
                      file=sys.stderr)
        print(f"week {week}: {verdict} (by {who})")
        seen += 1

    if not seen:
        print("no new taps" + (f" after waiting {args.wait}s" if args.wait else ""))
    return 0


def _settled_caption(old, verdict):
    """Keep the original caption, replace the trailing preview disclaimer."""
    body = old.split("\nPreview. Nothing has been published.")[0]
    return f"{body}\n{verdict}"


def cmd_preflight(args):
    """Run every environment check and report the first failure by exit code."""
    series = state.preflight(need_telegram=True, need_render=True, network=not args.offline)
    monday, _ = notion.last_complete_week(args.today)
    print(f"preflight OK · series week {series.week_for(monday)} · "
          f"review {series.review_chat_id} · channel {series.channel_chat_id}")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", default=str(ROOT / "work"))
    ap.add_argument("--today", type=dt.date.fromisoformat, default=dt.date.today())
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("preflight", help="check the environment; changes nothing")
    p.set_defaults(fn=cmd_preflight)
    p.add_argument("--offline", action="store_true", help="skip the reachability probes")

    p = sub.add_parser("plan"); p.set_defaults(fn=cmd_plan)
    p.add_argument("--fixture", help="a saved Notion response, instead of a live query")
    p.add_argument("--reset-cards", action="store_true", help="discard edits to cards.json")

    p = sub.add_parser("render"); p.set_defaults(fn=cmd_render)
    p.add_argument("--specialty", default="Cardiology")

    # preview and publish are separate subcommands, not one command with a
    # destination flag. A flag is one keystroke from posting a draft to the
    # channel; picking the wrong subcommand is a deliberate act.
    p = sub.add_parser("preview", help="post to the private review chat")
    p.set_defaults(fn=cmd_preview)
    p.add_argument("--theme", choices=["dark", "light"], default="dark")
    p.add_argument("--send", action="store_true", help="actually call Telegram")

    p = sub.add_parser("approval", help="collect an Approve / Needs-changes tap")
    p.set_defaults(fn=cmd_approval)
    p.add_argument("--wait", type=int, default=0, metavar="SECONDS",
                   help="long-poll this long for a tap (0 = take what is queued)")

    p = sub.add_parser("publish", help="post to the channel; requires a matching preview")
    p.set_defaults(fn=cmd_publish)
    p.add_argument("--theme", choices=["dark", "light"], default="dark")
    p.add_argument("--send", action="store_true", help="actually call Telegram")
    p.add_argument("--i-have-reviewed-the-preview", dest="reviewed",
                   action="store_true", required=True,
                   help="required: confirms a human looked at the preview")

    args = ap.parse_args()
    try:
        sys.exit(args.fn(args))
    except state.PreflightError as e:
        print(f"PREFLIGHT FAIL ({e.code}): {e}", file=sys.stderr)
        sys.exit(e.code)


if __name__ == "__main__":
    main()
