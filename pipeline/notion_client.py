"""
notion_client.py — query Cardio V3 for last week's posted pearls.

Thin wrapper over the Notion REST API (httpx, no SDK — one fewer dependency
to preflight). Knows exactly three things:

1. how to page a data-source query,
2. which properties to pull (Name / Post / Pearl / Topic / Subtopic),
3. the week rules from the plan:
     0 rows        -> NoPearls (exit 2)
     1-2 rows      -> InsufficientPearls (exit 3)
     >=3 rows      -> keep, cap at 7, drop oldest first

The Cardio V3 data source id is fixed in state (NOTION_DATA_SOURCE_ID env
override allowed) so rotating databases is config, not code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

DEFAULT_DATA_SOURCE_ID = "3bda7a11-0cf6-80f2-947a-000b2ba43559"  # Cardio V3

MAX_CARDS = 7


class NotionError(RuntimeError):
    """Transport/API failure with a loud, greppable message."""


@dataclass(frozen=True)
class Pearl:
    page_id: str
    name: str
    post_date: date
    pearl_text: str
    topic: str = ""
    subtopic: str = ""


# ---------------------------------------------------------------------------
# Property extraction — tolerant of property type drift
# ---------------------------------------------------------------------------


def _title(prop: dict) -> str:
    return "".join(t.get("plain_text", "") for t in prop.get("title", []))


def _rich_text(prop: dict) -> str:
    parts = prop.get("rich_text") or []
    return "".join(t.get("plain_text", "") for t in parts)


def _date_value(prop: dict) -> date | None:
    d = (prop.get("date") or {}).get("start")
    if not d:
        return None
    try:
        return date.fromisoformat(d[:10])
    except ValueError:
        return None


def _select(prop: dict) -> str:
    return (prop.get("select") or {}).get("name", "")


def parse_pearl_page(page: dict) -> Pearl | None:
    """Extract a Pearl from a query result row; None if unusable.

    Property-name based first (Name / Post / Pearl / Topic / Subtopic), with
    type-based fallbacks so minor renames in Notion don't silently break us.
    """
    props = page.get("properties", {})
    if not props:
        return None

    def by_name(*names: str) -> dict | None:
        low = {k.lower().strip(): v for k, v in props.items()}
        for n in names:
            if n in low:
                return low[n]
        return None

    name_prop = by_name("name")
    post_prop = by_name("post")
    body_prop = by_name("pearl", "pearl text", "message", "answer")
    topic_prop = by_name("topic")
    subtopic_prop = by_name("subtopic", "sub-topic")

    # Type-based fallbacks when names drift
    if name_prop is None:
        name_prop = next((p for p in props.values() if p.get("type") == "title"), None)
    date_props = [p for p in props.values() if p.get("type") == "date"]
    if post_prop is None and len(date_props) == 1:
        post_prop = date_props[0]

    name = _title(name_prop) if name_prop else ""

    post: date | None = None
    if post_prop is not None:
        post = _date_value(post_prop)
    elif len(date_props) == 1:
        post = _date_value(date_props[0])

    # Body: named prop wins; otherwise the longest rich_text property.
    body = ""
    if body_prop is not None:
        body = _rich_text(body_prop) or ""
    if not body.strip():
        rich_props = [(_rich_text(p), p) for p in props.values() if p.get("type") == "rich_text"]
        rich_props.sort(key=lambda t: -len(t[0]))
        if rich_props:
            body = rich_props[0][0]
    # Some databases keep the pearl in the page content rather than a property
    if not body.strip():
        body = _page_body_text(page["id"])

    topic = _select(topic_prop) if topic_prop else ""
    subtopic = _select(subtopic_prop) if subtopic_prop else ""

    if not body.strip() or post is None:
        return None

    return Pearl(
        page_id=page["id"],
        name=name,
        post_date=post,
        pearl_text=body.strip(),
        topic=topic,
        subtopic=subtopic,
    )


def _page_body_text(page_id: str, token: str | None = None) -> str:
    """Best-effort: concatenate plain text from page block children."""
    token = token or os.environ.get("NOTION_TOKEN", "")
    try:
        import httpx

        headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
        }
        resp = httpx.get(f"{API_BASE}/blocks/{page_id}/children", headers=headers, timeout=30.0)
        if resp.status_code != 200:
            return ""
        texts: list[str] = []
        for block in resp.json().get("results", []):
            for key, value in block.items():
                if isinstance(value, list) and key not in ("type",):
                    for item in value:
                        if isinstance(item, dict) and "plain_text" in item:
                            texts.append(item["plain_text"])
        return "\n".join(texts)
    except Exception:  # noqa: BLE001 — best-effort only
        return ""


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------


def fetch_posted_pearls(
    token: str,
    today: date | None = None,
    days_back: int = 7,
    data_source_id: str | None = None,
) -> list[Pearl]:
    """Query Cardio V3 for pearls posted within the last `days_back` days.

    Returns pearls oldest-first. Raises NotionError on transport/API failure.
    """
    import httpx  # lazy so deps-preflight catches missing httpx first

    if today is None:
        today = date.today()
    start_iso = (today - timedelta(days=days_back)).isoformat()
    end_iso = today.isoformat()

    ds_id = data_source_id or os.environ.get("NOTION_DATA_SOURCE_ID", DEFAULT_DATA_SOURCE_ID)

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    body = {
        "filter": {
            "and": [
                {"property": "Post", "date": {"on_or_after": start_iso}},
                {"property": "Post", "date": {"on_or_before": end_iso}},
            ]
        },
        "sorts": [{"property": "Post", "direction": "ascending"}],
        "page_size": 100,
    }

    pearls: list[Pearl] = []
    has_more = True
    cursor: str | None = None
    while has_more:
        payload = dict(body)
        if cursor:
            payload["start_cursor"] = cursor
        resp = httpx.post(
            f"{API_BASE}/data_sources/{ds_id}/query",
            headers=headers,
            json=payload,
            timeout=30.0,
        )
        if resp.status_code == 404:
            raise NotionError(
                f"Notion returned 404 for data source {ds_id} — check that the "
                "Cardio V3 database is shared with this integration and the id "
                "is current (Notion API changelog moved /databases to "
                "/data_sources)."
            )
        if resp.status_code == 401:
            raise NotionError("Notion rejected NOTION_TOKEN (401)")
        if resp.status_code == 400:
            raise NotionError(f"Notion rejected the query (400): {resp.text[:300]}")
        if resp.status_code >= 500:
            raise NotionError(f"Notion server error {resp.status_code}")
        data = resp.json()
        for row in data.get("results", []):
            pearl = parse_pearl_page(row)
            if pearl is not None:
                pearls.append(pearl)
        has_more = bool(data.get("has_more"))
        cursor = data.get("next_cursor")

    return pearls


# ---------------------------------------------------------------------------
# Week rules
# ---------------------------------------------------------------------------


class NoPearls(Exception):
    """0 posted pearls this week. Exit 2."""


class InsufficientPearls(Exception):
    """Fewer than MIN_PEARLS posted. Exit 3."""

    def __init__(self, count: int, needed: int = 3):
        self.count = count
        self.needed = needed
        super().__init__(f"INSUFFICIENT_PEARLS: only {count} posted this week, need ≥{needed}")


MIN_PEARLS = 3


def apply_week_rules(pearls: list[Pearl]) -> list[Pearl]:
    """Enforce the plan's count rules. Input must be oldest-first."""
    n = len(pearls)
    if n == 0:
        raise NoPearls("NO_PEARLS: Notion returned 0 posted pearls in the last 7 days")
    if n < MIN_PEARLS:
        raise InsufficientPearls(n)
    if n > MAX_CARDS:
        dropped = pearls[: n - MAX_CARDS]
        kept = pearls[n - MAX_CARDS :]
        # caller logs the drop; we surface it via attribute for simplicity
        apply_week_rules.last_dropped = dropped
        return kept
    apply_week_rules.last_dropped = []
    return pearls


apply_week_rules.last_dropped: list[Pearl] = []
