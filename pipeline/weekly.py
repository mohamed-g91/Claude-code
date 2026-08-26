"""
weekly.py — CLI entry point for the weekly MRCP pearls routine.

Subcommands:
    plan      fetch + rewrite + structural gate. No render.
    render    render PNG from work/cards.json. Idempotent.
    preview   post PNG to review chat. Runs on cron.
    publish   post PNG to @mrcp_gafar. NEVER on cron. You run this.

The first three can be wired to a routine. `publish` is a separate command,
run by a human, in a session that has seen the preview. There is no `--to`
flag and no `--send` flag — destinations come from state/series_start.json.

Exit codes: 0 ok · 2 no pearls · 3 insufficient pearls · 10-17 preflight
(see state.py) · 1 unexpected error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

# Make the pipeline package importable when this file is run as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import gate, rewriter, state  # noqa: E402
from pipeline.state import EXIT_INSUFFICIENT_PEARLS, EXIT_NO_PEARLS, WORK_DIR  # noqa: E402


def _pearl_hash(pearls) -> str:
    h = hashlib.sha256()
    for p in pearls:
        h.update(p.page_id.encode())
    return h.hexdigest()[:16]


def _cards_hash(cards_json: dict) -> str:
    return hashlib.sha256(
        json.dumps(cards_json, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]


# ---------------------------------------------------------------------------
# plan — fetch, rewrite, structural gate
# ---------------------------------------------------------------------------


def cmd_plan(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Fetch pearls from Notion, rewrite into cards, run both gates.

    Writes work/plan.json and work/cards.json. Exits 2 on zero pearls,
    3 on <3 pearls (before or after gating), 1 on transport failure.
    """
    import os

    from pipeline import notion_client

    token = os.environ.get("NOTION_TOKEN", "").strip()

    # -- fetch ------------------------------------------------------------
    try:
        pearls = notion_client.fetch_posted_pearls(token)
        pearls = notion_client.apply_week_rules(pearls)
    except notion_client.NoPearls as e:
        print(str(e), file=sys.stderr)
        state.write_log({"subcommand": "plan", "week": series.current_week(), "exit": EXIT_NO_PEARLS})
        return EXIT_NO_PEARLS
    except notion_client.InsufficientPearls as e:
        print(str(e), file=sys.stderr)
        state.write_log({"subcommand": "plan", "week": series.current_week(), "exit": EXIT_INSUFFICIENT_PEARLS})
        return EXIT_INSUFFICIENT_PEARLS

    dropped_oldest = getattr(notion_client.apply_week_rules, "last_dropped", [])
    week = series.current_week()
    print(f"plan: week {week}, {len(pearls)} pearls fetched", file=sys.stderr)

    # -- rewrite + Pass A --------------------------------------------------
    cards = []
    drops = []
    for pearl in pearls:
        card, err = rewriter.rewrite_card_with_retry(
            pearl_id=pearl.page_id,
            source_pearl=pearl.pearl_text,
            validate_fn=lambda text: gate.validate(text, pearl.pearl_text),
        )
        if card is None:
            reason = f"STRUCTURAL_FAIL: {err}" if err else "unknown"
            drops.append({"pearl_id": pearl.page_id, "reason": reason})
            print(f"plan: dropped {pearl.page_id}: {reason}", file=sys.stderr)
            continue
        cards.append((card, pearl))

    if len(cards) < 3:
        msg = (
            f"INSUFFICIENT_PEARLS_AFTER_REWRITE: {len(cards)} valid card(s) "
            f"remain after the structural gate; need ≥3"
        )
        print(msg, file=sys.stderr)
        state.write_log({"subcommand": "plan", "week": week, "drops": drops, "exit": EXIT_INSUFFICIENT_PEARLS})
        return EXIT_INSUFFICIENT_PEARLS

    # -- Pass B (soft flags, never blocks) ---------------------------------
    for card, pearl in cards:
        try:
            flags = rewriter.judge_clinical(card.visible, pearl.pearl_text)
            card.flags = [f.rule for f in flags]
        except rewriter.RewriterError as e:
            # Judge unreachable is not a content problem; log and move on.
            print(f"plan: clinical judge unavailable ({e}); proceeding unflagged", file=sys.stderr)

    # -- persist ------------------------------------------------------------
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    plan_doc = {
        "week": week,
        "anchor_date": series.anchor_date.isoformat(),
        "pearls": [
            {
                "page_id": p.page_id,
                "name": p.name,
                "post_date": p.post_date.isoformat(),
                "topic": p.topic,
                "subtopic": p.subtopic,
            }
            for _, p in cards
        ],
        "cards": [c.to_dict() for c, _ in cards],
        "drops": drops,
        "dropped_oldest_count": len(dropped_oldest),
    }
    cards_doc = {
        "week": week,
        "cards": [],
    }
    for i, (c, _) in enumerate(cards):
        _, spans = gate.extract_spans(c.visible)
        ranges = [[s.visible_start, s.visible_end] for s in spans]
        cards_doc["cards"].append(
            {
                "index": i + 1,
                "pearl_id": c.pearl_id,
                "visible": c.visible,
                "span_ranges": ranges,
                "flags": list(c.flags),
            }
        )

    (WORK_DIR / "plan.json").write_text(json.dumps(plan_doc, indent=2, sort_keys=True), encoding="utf-8")
    (WORK_DIR / "cards.json").write_text(json.dumps(cards_doc, indent=2, sort_keys=True), encoding="utf-8")
    (WORK_DIR / "pearls.json").write_text(
        json.dumps([p.__dict__ | {"post_date": p.post_date.isoformat()} for _, p in cards], default=str, indent=2),
        encoding="utf-8",
    )
    (WORK_DIR / "cards_hash.txt").write_text(_cards_hash(cards_doc), encoding="utf-8")

    flagged = sum(1 for c, _ in cards if c.flags)
    print(f"plan: wrote {len(cards)} cards ({flagged} flagged [REVIEW]), {len(drops)} dropped", file=sys.stderr)
    state.write_log(
        {
            "subcommand": "plan",
            "week": week,
            "notion_rows": len(pearls) + len(dropped_oldest),
            "dropped_oldest": len(dropped_oldest),
            "rewrites": [{"pearl_id": c.pearl_id, "structural": "pass", "clinical_flags": c.flags} for c, _ in cards]
            + drops,
            "exit": 0,
        }
    )
    return 0


# ---------------------------------------------------------------------------
# render — produce the PNG
# ---------------------------------------------------------------------------


def cmd_render(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Render work/infographic_{week}.png from work/cards.json."""
    from pipeline import renderer

    week = series.current_week()
    cards_path = WORK_DIR / "cards.json"
    if not cards_path.exists():
        print("RENDER FAIL: work/cards.json missing — run `weekly.py plan` first", file=sys.stderr)
        return 1

    cards = renderer.load_cards(cards_path)
    png, cached = renderer.render_png(week, cards)
    print(png, file=sys.stdout)
    print(f"render: week {week} -> {png} ({'cached' if cached else 'fresh'})", file=sys.stderr)
    state.write_log({"subcommand": "render", "week": week, "path": str(png), "exit": 0})
    return 0


# ---------------------------------------------------------------------------
# preview — post to the review chat (the only cron-facing send)
# ---------------------------------------------------------------------------


def cmd_preview(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Post the PNG to the review chat with a caption carrying [REVIEW] tags."""
    from pipeline.telegram_client import load_preview_log, record_preview, send_preview

    week = series.current_week()

    if state.already_published(week):
        print(f"NO_CHANGE: week {week} already published; nothing to preview", file=sys.stderr)
        state.write_log({"subcommand": "preview", "week": week, "result": "no_change", "exit": 0})
        return 0

    png_path = WORK_DIR / f"infographic_{week}.png"
    if not png_path.exists():
        print(
            f"PREVIEW FAIL: {png_path} missing — run `weekly.py plan` then `weekly.py render` first",
            file=sys.stderr,
        )
        return 1

    cards_doc = json.loads((WORK_DIR / "cards.json").read_text(encoding="utf-8"))
    chash = _cards_hash(cards_doc)

    lines = [f"Week {week} preview — {len(cards_doc['cards'])} pearls", ""]
    for c in cards_doc["cards"]:
        tag = " [REVIEW]" if c["flags"] else ""
        lines.append(f"{c['index']}. {c['visible']}{tag}")
    lines += [
        "",
        "Reply APPROVE to publish, EDIT <line> <new text> to fix a card, or DROP to cancel.",
    ]
    caption = "\n".join(lines)

    message_id = send_preview(series.review_chat_id, png_path, caption)
    record_preview(week, message_id, chash)
    print(f"preview: week {week} posted to review chat (message_id={message_id})", file=sys.stderr)
    state.write_log({"subcommand": "preview", "week": week, "message_id": message_id, "exit": 0})
    return 0


# ---------------------------------------------------------------------------
# publish — only on your say-so
# ---------------------------------------------------------------------------

APPROVAL_SENTINEL_NAME = ".publish_approved"


def cmd_publish(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Post the PNG to @mrcp_gafar after a human-approved preview."""
    from pipeline.telegram_client import load_preview_log, send_publish
    from pipeline import telegram_client

    week = series.current_week()

    if state.already_published(week):
        print(f"PUBLISH REFUSED: week {week} already published (double-publish guard)", file=sys.stderr)
        return 1

    log = load_preview_log()
    if not log or log.get("status") != "APPROVED" or int(log.get("week", -1)) != week:
        print(
            "PUBLISH REFUSED: no approved preview for this week.\n"
            "fix: review the preview in your private chat, mark it APPROVED, then re-run publish.",
            file=sys.stderr,
        )
        return 1

    png_path = WORK_DIR / f"infographic_{week}.png"
    if not png_path.exists():
        print(f"PUBLISH FAIL: {png_path} missing — nothing rendered for week {week}", file=sys.stderr)
        return 1

    cards_doc = json.loads((WORK_DIR / "cards.json").read_text(encoding="utf-8"))
    current_hash = _cards_hash(cards_doc)
    if log.get("cards_hash") != current_hash:
        print(
            "PUBLISH REFUSED: cards changed since the approved preview.\n"
            "fix: re-run preview and approve again.",
            file=sys.stderr,
        )
        return 1

    lines = [f"MRCP Pearls — Week {week}", ""]
    for c in cards_doc["cards"]:
        lines.append(f"{c['index']}. {c['visible']}")
    lines += ["", "#MRCP #Pearls @mrcp_gafar"]
    caption = "\n".join(lines)

    message_id = send_publish(series.channel_username, png_path, caption)

    state.record_published(week=week, pearl_hash=current_hash, message_id=message_id)
    log["status"] = "PUBLISHED"
    telegram_client.PREVIEW_LOG_PATH.write_text(json.dumps(log, indent=2), encoding="utf-8")

    print(f"publish: week {week} posted to {series.channel_username} (message_id={message_id})", file=sys.stderr)
    state.write_log({"subcommand": "publish", "week": week, "message_id": message_id, "exit": 0})
    return 0


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="weekly.py",
        description="Weekly MRCP pearls infographic routine.",
    )
    sub = parser.add_subparsers(dest="subcommand", required=True)

    sub.add_parser("plan", help="fetch + rewrite + structural gate.")
    sub.add_parser("render", help="render the PNG from work/cards.json. Idempotent.")
    sub.add_parser("preview", help="post the PNG to the review chat. Runs on cron.")

    pub = sub.add_parser(
        "publish",
        help="post the PNG to @mrcp_gafar. NEVER on cron. You run this.",
    )
    pub.add_argument(
        "--i-have-reviewed-the-preview",
        action="store_true",
        required=True,
        help="explicit confirmation that you have seen and approved the preview",
    )
    return parser


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # Preflight runs first. On failure it prints a message and exits with
    # the named code; it never returns. On success it returns SeriesStart.
    series = state.preflight()

    week = series.current_week()
    log: dict = {
        "started_at": date.today().isoformat(),
        "subcommand": args.subcommand,
        "week": week,
    }

    handlers = {
        "plan": cmd_plan,
        "render": cmd_render,
        "preview": cmd_preview,
        "publish": cmd_publish,
    }
    handler = handlers[args.subcommand]

    try:
        exit_code = handler(args, series)
    except Exception as e:  # noqa: BLE001 — top-level catch is intentional
        log["error"] = repr(e)
        log["exit"] = 1
        state.write_log(log)
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    log["exit"] = exit_code
    state.write_log(log)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
