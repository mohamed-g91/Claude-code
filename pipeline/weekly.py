"""
weekly.py — CLI entry point for the weekly MRCP pearls routine.

Subcommands:
    plan      fetch + rewrite + structural gate. No LLM, no render.
    render    render PNG. Idempotent on identical input.
    preview   post PNG to review chat. Runs on cron.
    publish   post PNG to @mrcp_gafar. NEVER on cron. You run this.

The first three subcommands can be wired to a routine. `publish` is a
separate command, run by a human, in a session that has the preview in
context. There is no `--to` flag and no `--send` flag — the destination
is read from state/series_start.json.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

# Make the pipeline package importable when this file is run as a script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import state  # noqa: E402


# ---------------------------------------------------------------------------
# Subcommand stubs — each is a separate function with the same signature
# (args, series_start) -> int. They return the exit code; main() exits with it.
# ---------------------------------------------------------------------------


def cmd_plan(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Fetch pearls from Notion, rewrite into cards, run structural gate.

    Writes work/plan.json and work/cards.json. Exits 0 on success, 2 on
    zero pearls, 3 on <3 pearls, 1 on unexpected error.
    """
    print("plan: not yet implemented", file=sys.stderr)
    print(
        "this subcommand will:\n"
        "  1. query Cardio V3 for pearls posted in the last 7 days\n"
        "  2. call the rewriter on each\n"
        "  3. run gate.validate on each card\n"
        "  4. write work/plan.json and work/cards.json",
        file=sys.stderr,
    )
    return 1


def cmd_render(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Render the PNG from work/cards.json.

    Idempotent: if work/infographic_{week}.png exists and the input cards
    are byte-identical to the last render, returns the existing path with
    no work. Exits 0 on success, 1 on render failure.
    """
    print("render: not yet implemented", file=sys.stderr)
    print(
        "this subcommand will:\n"
        "  1. load work/cards.json\n"
        "  2. render templates/infographic.html.j2 with Jinja2\n"
        "  3. screenshot the HTML with Playwright/Chromium\n"
        "  4. write work/infographic_{week}.png",
        file=sys.stderr,
    )
    return 1


def cmd_preview(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Post the rendered PNG to the review chat.

    This is the only subcommand the cron routine runs. It does NOT publish
    to @mrcp_gafar. The user (Mohamed) reviews in the private chat and
    then runs `publish` in a separate session.
    """
    print("preview: not yet implemented", file=sys.stderr)
    print(
        "this subcommand will:\n"
        f"  1. load work/infographic_*.png\n"
        f"  2. sendPhoto to chat_id={series.review_chat_id}\n"
        f"  3. caption: week number, card count, [REVIEW] tags from Pass B\n"
        f"  4. record message_id in state/preview_log.json",
        file=sys.stderr,
    )
    return 1


def cmd_publish(args: argparse.Namespace, series: state.SeriesStart) -> int:
    """Post the rendered PNG to @mrcp_gafar.

    NEVER run by the cron. Run by the human (Mohamed) in a session that
    has the preview in context, after they have approved the preview.
    """
    print("publish: not yet implemented", file=sys.stderr)
    print(
        "this subcommand will:\n"
        f"  1. load the most recent preview from state/preview_log.json\n"
        f"  2. require APPROVED status (set by the user in-session)\n"
        f"  3. sendPhoto to @{series.channel_username.lstrip('@')}\n"
        f"  4. record publish in state/sent_weeks.json",
        file=sys.stderr,
    )
    return 1


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="weekly.py",
        description="Weekly MRCP pearls infographic routine.",
    )
    sub = parser.add_subparsers(dest="subcommand", required=True)

    # `plan` — no extra args
    sub.add_parser(
        "plan",
        help="fetch + rewrite + structural gate. No LLM, no render.",
    )

    # `render` — no extra args
    sub.add_parser(
        "render",
        help="render the PNG from work/cards.json. Idempotent on identical input.",
    )

    # `preview` — no extra args
    sub.add_parser(
        "preview",
        help="post the PNG to the review chat. Runs on cron.",
    )

    # `publish` — explicit confirmation flag
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

    # Preflight runs first. On failure, it prints a message and exits with
    # the named code; it never returns. On success, it returns SeriesStart.
    series = state.preflight()

    week = series.current_week()
    started_at = date.today().isoformat()
    log: dict = {
        "started_at": started_at,
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
