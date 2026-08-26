"""
telegram_client.py — sendPhoto to the review chat (preview) or the channel (publish).

Two entry points, mirroring the two subcommands:

    send_preview(series, png_path, caption)  -> message_id
    send_publish(series, png_path, caption)  -> message_id

The destination is never a CLI flag. preview always goes to
series.review_chat_id; publish always goes to series.channel_username.
"""

from __future__ import annotations

import os
from pathlib import Path


class TelegramError(RuntimeError):
    """Raised when the Bot API rejects or cannot be reached."""


def _token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise TelegramError("TELEGRAM_BOT_TOKEN missing from environment")
    return token


def _send_photo(chat_id: str | int, png_path: Path, caption: str) -> int:
    """POST sendPhoto with the PNG attached. Returns the message_id."""
    try:
        import httpx
    except ImportError as e:
        raise TelegramError(f"httpx not installed: {e}") from e

    url = f"https://api.telegram.org/bot{_token()}/sendPhoto"
    data = {"chat_id": str(chat_id), "caption": caption[:1024], "parse_mode": "HTML"}
    with open(png_path, "rb") as f:
        resp = httpx.post(url, data=data, files={"photo": (png_path.name, f, "image/png")}, timeout=60.0)

    body = {}
    try:
        body = resp.json()
    except ValueError:
        pass
    if resp.status_code != 200 or not body.get("ok"):
        desc = body.get("description", resp.text[:200])
        raise TelegramError(f"Telegram sendPhoto failed ({resp.status_code}): {desc}")
    result = body.get("result", {})
    return int(result.get("message_id", 0))


def send_preview(review_chat_id: int, png_path: Path, caption: str) -> int:
    """Post to the private review chat. This is what `preview` calls."""
    return _send_photo(review_chat_id, png_path, caption)


def send_publish(channel_username: str, png_path: Path, caption: str) -> int:
    """Post to @channel. This is what `publish` calls — never cron code."""
    return _send_photo(channel_username, png_path, caption)


# ---------------------------------------------------------------------------
# Preview log — the approval ledger between preview and publish
# ---------------------------------------------------------------------------


def record_preview(week: int, message_id: int, cards_hash: str) -> None:
    """Write state/preview_log.json. Called only by `preview`."""
    import json

    from pipeline.state import PREVIEW_LOG_PATH

    PREVIEW_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "week": week,
        "message_id": message_id,
        "cards_hash": cards_hash,
        "status": "PENDING_REVIEW",
    }
    PREVIEW_LOG_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def load_preview_log() -> dict:
    from pipeline.state import PREVIEW_LOG_PATH

    if not PREVIEW_LOG_PATH.exists():
        return {}
    return json.loads(PREVIEW_LOG_PATH.read_text(encoding="utf-8"))
