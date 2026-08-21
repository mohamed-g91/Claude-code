"""Command-line interface for the token tracker.

    python -m token_tracker sync        # ingest local Claude Code transcripts
    python -m token_tracker report      # print a terminal summary
    python -m token_tracker dashboard   # generate the offline HTML dashboard
"""

from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from . import report
from .dashboard import render_dashboard
from .ingest_claude_code import DEFAULT_PROJECTS_ROOT, sync_to_store
from .store import DEFAULT_DB_PATH, UsageStore


def _add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to the SQLite store")


def cmd_sync(args: argparse.Namespace) -> None:
    store = UsageStore(args.db)
    try:
        root = Path(args.root)
        n = sync_to_store(store, root=root)
        total = store.count()
        print(f"Ingested {n} usage record(s) from {root}. Store now has {total} record(s) at {store.db_path}.")
    finally:
        store.close()


def cmd_report(args: argparse.Namespace) -> None:
    store = UsageStore(args.db)
    try:
        records = store.all_records(
            since=args.since, until=args.until, source=args.source, model=args.model
        )
        if not records:
            print("No usage records found. Run `token_tracker sync` first, or check your filters.")
            return
        summary = report.summarize(records)
        print(f"Overall ({len(records)} requests, {summary['sessions']} sessions)")
        print("-" * 60)
        print(f"  Input tokens:        {summary['input_tokens']:,}")
        print(f"  Output tokens:       {summary['output_tokens']:,}")
        print(f"  Cache write tokens:  {summary['cache_creation_input_tokens']:,}")
        print(f"  Cache read tokens:   {summary['cache_read_input_tokens']:,}")
        print(f"  Thinking tokens:     {summary['thinking_tokens']:,}")
        print(f"  Total tokens:        {summary['total_tokens']:,}")
        cost = summary["cost_usd"]
        print(f"  Estimated cost:      {'$' + format(cost, ',.4f') if cost is not None else 'n/a'}")
        print()
        report.print_summary_table("By model", report.by_model(records), key_label="Model")
        print()
        report.print_summary_table("By day", report.by_day(records), key_label="Day")
    finally:
        store.close()


def cmd_dashboard(args: argparse.Namespace) -> None:
    store = UsageStore(args.db)
    try:
        records = store.all_records(
            since=args.since, until=args.until, source=args.source, model=args.model
        )
        if not records:
            print("No usage records found. Run `token_tracker sync` first, or check your filters.")
            return
        out_path = render_dashboard(records, args.output)
        print(f"Dashboard written to {out_path} ({len(records)} requests).")
        if args.open:
            webbrowser.open(out_path.resolve().as_uri())
    finally:
        store.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="token_tracker", description="Track Claude token usage in deep detail.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_sync = sub.add_parser("sync", help="Ingest local Claude Code session transcripts into the store")
    _add_common_args(p_sync)
    p_sync.add_argument("--root", default=str(DEFAULT_PROJECTS_ROOT), help="Claude Code projects root to scan")
    p_sync.set_defaults(func=cmd_sync)

    p_report = sub.add_parser("report", help="Print a terminal summary")
    _add_common_args(p_report)
    p_report.add_argument("--since", default=None, help="ISO timestamp lower bound, e.g. 2026-08-01")
    p_report.add_argument("--until", default=None, help="ISO timestamp upper bound")
    p_report.add_argument("--source", default=None, choices=["claude_code", "api"])
    p_report.add_argument("--model", default=None)
    p_report.set_defaults(func=cmd_report)

    p_dash = sub.add_parser("dashboard", help="Generate the offline HTML dashboard")
    _add_common_args(p_dash)
    p_dash.add_argument("--since", default=None)
    p_dash.add_argument("--until", default=None)
    p_dash.add_argument("--source", default=None, choices=["claude_code", "api"])
    p_dash.add_argument("--model", default=None)
    p_dash.add_argument("--output", default="reports/dashboard.html", help="Output HTML path")
    p_dash.add_argument("--open", action="store_true", help="Open the dashboard in a browser after generating it")
    p_dash.set_defaults(func=cmd_dashboard)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
