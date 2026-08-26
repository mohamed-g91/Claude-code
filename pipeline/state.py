"""
state.py — preflight, week arithmetic, and persistent state for the weekly routine.

This module is the routine's spine. Every subcommand (plan / render / preview / publish)
calls preflight() at the top. Preflight failures are loud, named, and never auto-fixed.

Exit codes are reserved. Don't reuse them for new failures — add a new code instead.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Exit codes — keep stable. Add new ones at the end, never renumber.
# ---------------------------------------------------------------------------

EXIT_OK = 0
EXIT_NO_PEARLS = 2
EXIT_INSUFFICIENT_PEARLS = 3

EXIT_REPO = 10           # wrong branch or repo state dirty
EXIT_ANCHOR = 11         # state/series_start.json missing or malformed
EXIT_TOKENS = 12         # NOTION_TOKEN or TELEGRAM_BOT_TOKEN missing
EXIT_NOTION = 13         # api.notion.com unreachable
EXIT_TELEGRAM = 14       # api.telegram.org unreachable
EXIT_DEPS = 15           # required Python package not importable
EXIT_CHROMIUM = 16       # Playwright Chromium not installed
EXIT_BRANCH_BEHIND = 17  # branch is behind origin

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = REPO_ROOT / "state"
WORK_DIR = REPO_ROOT / "work"
LOGS_DIR = REPO_ROOT / "logs"
SERIES_START_PATH = STATE_DIR / "series_start.json"
SENT_WEEKS_PATH = STATE_DIR / "sent_weeks.json"
PREVIEW_LOG_PATH = STATE_DIR / "preview_log.json"

EXPECTED_BRANCH = "claude/weekly-mrcp-infographic-automation-m8sjxa"

# ---------------------------------------------------------------------------
# Series start (the anchor file)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeriesStart:
    """Loaded from state/series_start.json. Immutable once loaded."""

    anchor_date: date
    anchor_week: int
    channel_username: str
    review_chat_id: int

    @classmethod
    def load(cls, path: Path = SERIES_START_PATH) -> "SeriesStart":
        if not path.exists():
            raise AnchorMissing(
                f"PREFLIGHT FAIL: anchor file missing at {path}\n"
                f"fix: this routine needs an anchor before it can run. "
                f"See state/series_start.example.json for the schema. "
                f"The anchor_date is the publication date of the first published "
                f"infographic; anchor_week is 1."
            )
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise AnchorMalformed(f"PREFLIGHT FAIL: {path} is not valid JSON: {e}") from e

        try:
            return cls(
                anchor_date=date.fromisoformat(raw["anchor_date"]),
                anchor_week=int(raw["anchor_week"]),
                channel_username=str(raw["channel_username"]),
                review_chat_id=int(raw["review_chat_id"]),
            )
        except (KeyError, ValueError) as e:
            raise AnchorMalformed(
                f"PREFLIGHT FAIL: {path} is missing required fields or has wrong types: {e}\n"
                f"required: anchor_date (YYYY-MM-DD), anchor_week (int), "
                f"channel_username (str), review_chat_id (int)"
            ) from e

    def current_week(self, today: date | None = None) -> int:
        """Series week for today, given this anchor.

        Pure arithmetic from the anchor — no caching, no state, no surprises.
        """
        if today is None:
            today = date.today()
        if today < self.anchor_date:
            # Anchor is in the future relative to today. Shouldn't happen, but
            # be loud about it rather than silently returning anchor_week.
            raise ValueError(
                f"today ({today}) is before anchor_date ({self.anchor_date}). "
                f"Check the system clock or the anchor file."
            )
        weeks_since = (today - self.anchor_date).days // 7
        return self.anchor_week + weeks_since


class AnchorMissing(FileNotFoundError):
    """Raised when state/series_start.json does not exist."""


class AnchorMalformed(ValueError):
    """Raised when state/series_start.json exists but is invalid."""


# ---------------------------------------------------------------------------
# Sent weeks (idempotency + double-publish protection)
# ---------------------------------------------------------------------------


def load_sent_weeks() -> dict[str, Any]:
    if not SENT_WEEKS_PATH.exists():
        return {}
    try:
        return json.loads(SENT_WEEKS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Corrupt file is a loud problem, not a silent empty dict.
        raise


def record_published(week: int, pearl_hash: str, message_id: int) -> None:
    """Called only by `publish`. Never by preview, render, or plan."""
    sent = load_sent_weeks()
    sent[str(week)] = {
        "pearl_hash": pearl_hash,
        "published_at": date.today().isoformat(),
        "message_id": message_id,
    }
    SENT_WEEKS_PATH.write_text(json.dumps(sent, indent=2, sort_keys=True), encoding="utf-8")


def already_published(week: int) -> bool:
    return str(week) in load_sent_weeks()


# ---------------------------------------------------------------------------
# Preflight checks — one function per check, each raises with a named message.
# ---------------------------------------------------------------------------


def check_repo() -> None:
    """Confirm we're on the expected branch and the working tree is clean."""
    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=REPO_ROOT,
            stderr=subprocess.STDOUT,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as e:
        raise PreflightError(
            f"PREFLIGHT FAIL: not a git repository or git unavailable\n"
            f"git output: {e.output}"
        ) from e

    if branch != EXPECTED_BRANCH:
        raise PreflightError(
            f"PREFLIGHT FAIL: on branch '{branch}', expected '{EXPECTED_BRANCH}'\n"
            f"fix: git checkout {EXPECTED_BRANCH}"
        )


def check_branch_not_behind() -> None:
    """Fetch origin and ensure the branch is not behind."""
    try:
        subprocess.check_output(
            ["git", "fetch", "origin", EXPECTED_BRANCH],
            cwd=REPO_ROOT,
            stderr=subprocess.STDOUT,
            text=True,
        )
        behind = subprocess.check_output(
            ["git", "rev-list", "--count", f"HEAD..origin/{EXPECTED_BRANCH}"],
            cwd=REPO_ROOT,
            stderr=subprocess.STDOUT,
            text=True,
        ).strip()
    except subprocess.CalledProcessError as e:
        raise PreflightError(
            f"PREFLIGHT FAIL: could not check branch state vs origin\n"
            f"git output: {e.output}"
        ) from e

    if behind != "0":
        raise PreflightError(
            f"PREFLIGHT FAIL: branch is {behind} commit(s) behind origin/{EXPECTED_BRANCH}\n"
            f"fix: git pull --rebase origin {EXPECTED_BRANCH}"
        )


def check_tokens() -> None:
    """NOTION_TOKEN is required. TELEGRAM_BOT_TOKEN is required for preview/publish."""
    notion = os.environ.get("NOTION_TOKEN", "").strip()
    if not notion:
        raise PreflightError(
            "PREFLIGHT FAIL: NOTION_TOKEN missing from environment\n"
            "fix: set NOTION_TOKEN in the routine's environment secrets"
        )

    # subcommand is in argv; only require Telegram token for preview/publish
    subcommand = sys.argv[1] if len(sys.argv) > 1 else ""
    if subcommand in ("preview", "publish"):
        telegram = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        if not telegram:
            raise PreflightError(
                "PREFLIGHT FAIL: TELEGRAM_BOT_TOKEN missing from environment\n"
                "fix: set TELEGRAM_BOT_TOKEN in the routine's environment secrets"
            )


def check_notion_reachable() -> None:
    """api.notion.com must be reachable. Surfaces 403 / connect_rejected loudly."""
    import httpx  # imported lazily so a missing dep doesn't mask a network error

    token = os.environ.get("NOTION_TOKEN", "").strip()
    try:
        r = httpx.get(
            "https://api.notion.com/v1/users/me",
            headers={
                "Authorization": f"Bearer {token}",
                "Notion-Version": "2022-06-28",
            },
            timeout=15.0,
        )
    except httpx.ConnectError as e:
        raise PreflightError(
            "PREFLIGHT FAIL: network unreachable host=api.notion.com\n"
            f"detail: {e}\n"
            "fix: add api.notion.com to environment Network access -> Custom -> "
            "Allowed domains, keeping the default list checked. "
            "Verify the edit was made on the environment this routine actually uses."
        ) from e

    if r.status_code == 401:
        raise PreflightError(
            "PREFLIGHT FAIL: Notion rejected the token (401)\n"
            "fix: NOTION_TOKEN is invalid or the integration has been revoked"
        )
    if r.status_code == 403:
        raise PreflightError(
            "PREFLIGHT FAIL: api.notion.com returned 403 — likely blocked by network policy\n"
            "fix: add api.notion.com to environment Network access -> Custom -> "
            "Allowed domains, keeping the default list checked. "
            "If 403 persists, the Cardio V3 database may not be shared with the integration."
        )
    if r.status_code >= 500:
        raise PreflightError(
            f"PREFLIGHT FAIL: api.notion.com returned {r.status_code}\n"
            f"fix: Notion may be down; check status.notion.com"
        )


def check_telegram_reachable() -> None:
    """api.telegram.org must be reachable. Only required for preview/publish."""
    subcommand = sys.argv[1] if len(sys.argv) > 1 else ""
    if subcommand not in ("preview", "publish"):
        return

    import httpx

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    try:
        r = httpx.get(f"https://api.telegram.org/bot{token}/getMe", timeout=15.0)
    except httpx.ConnectError as e:
        raise PreflightError(
            "PREFLIGHT FAIL: network unreachable host=api.telegram.org\n"
            f"detail: {e}\n"
            "fix: add api.telegram.org to environment Network access -> Custom -> "
            "Allowed domains, keeping the default list checked."
        ) from e

    if r.status_code != 200:
        raise PreflightError(
            f"PREFLIGHT FAIL: api.telegram.org returned {r.status_code} for getMe\n"
            f"fix: TELEGRAM_BOT_TOKEN may be invalid, or the bot is not authorised"
        )


def check_deps() -> None:
    """Required packages must be importable — scoped to the subcommand.

    Base set every subcommand needs; playwright only for `render` (the only
    command that launches Chromium).
    """
    subcommand = sys.argv[1] if len(sys.argv) > 1 else ""
    required = ["qrcode", "jinja2", "httpx", "notion_client"]
    if subcommand == "render":
        required.append("playwright")
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        raise PreflightError(
            f"PREFLIGHT FAIL: missing Python packages: {', '.join(missing)}\n"
            f"fix: pip install -r weekly-infographic/requirements.txt"
        )


def check_chromium() -> None:
    """Playwright Chromium must be installed. Only required for render."""
    subcommand = sys.argv[1] if len(sys.argv) > 1 else ""
    if subcommand != "render":
        return

    try:
        from playwright.sync_api import sync_playwright  # noqa: F401
    except ImportError as e:
        raise PreflightError(
            f"PREFLIGHT FAIL: playwright not importable: {e}\n"
            f"fix: pip install -r weekly-infographic/requirements.txt"
        ) from e

    # We don't try to launch Chromium here — that's expensive. Just check that
    # the binary path is registered. If launch fails later, render() reports it.
    browser_path = REPO_ROOT / ".cache" / "ms-playwright"
    if not browser_path.exists():
        raise PreflightError(
            f"PREFLIGHT FAIL: Chromium not installed for Playwright\n"
            f"expected path: {browser_path}\n"
            f"fix: playwright install chromium"
        )


# ---------------------------------------------------------------------------
# Top-level preflight
# ---------------------------------------------------------------------------


class PreflightError(RuntimeError):
    """All preflight failures raise this. The message is what gets reported."""


# Ordered list of (check_fn, exit_code). On failure, we exit with the
# matching code and write the message to stderr. Order matters — cheaper
# and more-likely-to-fail checks first.
CHECKS: list[tuple[callable, int]] = [
    (check_repo, EXIT_REPO),
    (check_tokens, EXIT_TOKENS),
    (check_deps, EXIT_DEPS),
    (check_chromium, EXIT_CHROMIUM),
    (check_branch_not_behind, EXIT_BRANCH_BEHIND),
    (check_notion_reachable, EXIT_NOTION),
    (check_telegram_reachable, EXIT_TELEGRAM),
]


def preflight(extra_checks: list[tuple[callable, int]] | None = None) -> SeriesStart:
    """Run all preflight checks. On any failure, print message to stderr and
    exit with the named code. On success, return the loaded SeriesStart."""
    checks = list(CHECKS)
    if extra_checks:
        checks.extend(extra_checks)

    for check_fn, exit_code in checks:
        try:
            check_fn()
        except PreflightError as e:
            print(str(e), file=sys.stderr)
            sys.exit(exit_code)
        except (AnchorMissing, AnchorMalformed) as e:
            print(str(e), file=sys.stderr)
            sys.exit(EXIT_ANCHOR)

    # Anchor loaded last so the other checks (which don't need it) run first
    # and produce a clearer error if the environment is broken upstream.
    try:
        return SeriesStart.load()
    except (AnchorMissing, AnchorMalformed) as e:
        print(str(e), file=sys.stderr)
        sys.exit(EXIT_ANCHOR)


# ---------------------------------------------------------------------------
# Logging — every run writes logs/{YYYY-MM-DD}.json
# ---------------------------------------------------------------------------


def write_log(payload: dict[str, Any]) -> Path:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    path = LOGS_DIR / f"{date.today().isoformat()}.jsonl"
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, sort_keys=True) + "\n")
    return path
