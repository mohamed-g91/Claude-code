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
import json
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cards as cards_mod
import notion
import telegram
from pearls import parse_pearl

ROOT = pathlib.Path(__file__).resolve().parent.parent
RENDERER = ROOT / "weekly-infographic"
MIN_CARDS = 3

# Chat ids are addresses, not secrets - a bot token is what grants the ability
# to post. Keeping them here means deployment only has to supply the two tokens.
REVIEW_CHAT = "7515421307"          # Mohamed's private chat, where previews land
CHANNEL_CHAT = "-1004455886951"     # @mrcp_gafar, only after approval

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
    start, end, rows = _load_rows(args)
    work = pathlib.Path(args.work); work.mkdir(parents=True, exist_ok=True)
    plan = {"week": renderer.series_week(start), "iso_week": start.isocalendar()[1],
            "start": start.isoformat(), "end": end.isoformat(),
            "rows": rows, "cards": [], "needs_writing": []}
    for row in rows:
        card, problems = cards_mod.propose(row)
        plan["cards"].append(card)
        if problems:
            plan["needs_writing"].append({"id": row["id"], "topic": card["topic"],
                                          "problems": problems,
                                          "source": parse_pearl(row["pearl"])["text"]})
    (work / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
    if not (work / "cards.json").exists() or args.reset_cards:
        (work / "cards.json").write_text(json.dumps(plan["cards"], ensure_ascii=False, indent=1))
    print(f"Week {plan['week']} (ISO {plan['iso_week']}) · {start} to {end} · "
          f"{len(rows)} posted rows")
    print(f"{len(rows) - len(plan['needs_writing'])} cards proposed cleanly, "
          f"{len(plan['needs_writing'])} need writing")
    for n in plan["needs_writing"]:
        print(f"  · {n['topic']}: {'; '.join(n['problems'])}")
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
    if failed:
        for topic, problems in failed:
            print(f"REJECT {topic}: {'; '.join(problems)}", file=sys.stderr)
        print(f"{len(failed)} card(s) failed verification — not rendering", file=sys.stderr)
        return 1
    if len(cards) < MIN_CARDS:
        print(f"only {len(cards)} verified cards (minimum {MIN_CARDS}) — not rendering",
              file=sys.stderr)
        return 3

    content = {"week_start": plan["start"], "specialty": args.specialty,
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


def cmd_send(args):
    work = pathlib.Path(args.work)
    plan = json.loads((work / "plan.json").read_text())
    png = work / f"week{plan['week']}-{args.theme}.png"
    if not png.exists():
        print(f"{png} does not exist — run render first", file=sys.stderr)
        return 1
    review = args.to == "review"
    chat = (os.environ.get("TELEGRAM_REVIEW_CHAT_ID") or REVIEW_CHAT) if review else \
           (os.environ.get("TELEGRAM_CHANNEL_ID") or CHANNEL_CHAT)
    caption = (f"<b>Week {plan['week']}</b> · {plan['start']} to {plan['end']} · "
               f"{len(json.loads((work / 'cards.json').read_text()))} pearls")
    if review:
        caption += "\nReview before publishing."
    out = telegram.send_photo(str(png), chat, caption, dry_run=not args.send, buttons=review)
    print(json.dumps(out, ensure_ascii=False, indent=1)[:900])
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", default=str(ROOT / "work"))
    ap.add_argument("--today", type=dt.date.fromisoformat, default=dt.date.today())
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("plan"); p.set_defaults(fn=cmd_plan)
    p.add_argument("--fixture", help="a saved Notion response, instead of a live query")
    p.add_argument("--reset-cards", action="store_true", help="discard edits to cards.json")

    p = sub.add_parser("render"); p.set_defaults(fn=cmd_render)
    p.add_argument("--specialty", default="Cardiology")

    p = sub.add_parser("send"); p.set_defaults(fn=cmd_send)
    p.add_argument("--to", choices=["review", "channel"], default="review")
    p.add_argument("--theme", choices=["dark", "light"], default="dark")
    p.add_argument("--send", action="store_true", help="actually call Telegram")

    args = ap.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    main()
