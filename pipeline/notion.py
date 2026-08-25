"""Select the pearls that a week's infographic is built from.

Talks to the Notion REST API with a long-lived integration token rather than an
OAuth connector, because this runs unattended: a token that silently expires
turns a Saturday morning job into a failure nobody is awake to fix.
"""
import datetime as dt
import json
import os
import urllib.request

API = "https://api.notion.com/v1"
VERSION = "2022-06-28"
DATA_SOURCE = os.environ.get("NOTION_DATA_SOURCE", "f414ac8e-de76-825a-a2cb-07e5e023e6bc")


def last_complete_week(today):
    """Monday..Sunday of the most recently *finished* ISO week.

    Run on any day, it names the week before the one containing `today`, so a
    Saturday run summarises a week that is over rather than one still in progress.
    """
    monday_this_week = today - dt.timedelta(days=today.weekday())
    start = monday_this_week - dt.timedelta(days=7)
    return start, start + dt.timedelta(days=6)


def _post(path, body, token):
    req = urllib.request.Request(
        f"{API}{path}", data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Notion-Version": VERSION,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_raw(start, end, token=None):
    """Every Posted row whose Post date falls in [start, end]. Paginated."""
    token = token or os.environ["NOTION_TOKEN"]
    body = {"filter": {"and": [
        {"property": "Status", "select": {"equals": "Posted"}},
        {"property": "Post date", "date": {"on_or_after": start.isoformat()}},
        {"property": "Post date", "date": {"on_or_before": end.isoformat()}},
    ]}, "sorts": [{"property": "Post date", "direction": "ascending"}]}
    results, cursor = [], None
    while True:
        if cursor:
            body["start_cursor"] = cursor
        page = _post(f"/databases/{DATA_SOURCE}/query", body, token)
        results.extend(page["results"])
        if not page.get("has_more"):
            return {"results": results}
        cursor = page["next_cursor"]


def _plain(prop):
    """Notion rich text arrives as runs; the drip writes HTML into a text property."""
    if not prop:
        return ""
    if prop.get("type") == "date":
        return (prop.get("date") or {}).get("start", "") or ""
    if prop.get("type") == "select":
        return ((prop.get("select") or {}).get("name") or "")
    runs = prop.get("rich_text") or prop.get("title") or []
    return "".join(r.get("plain_text", "") for r in runs)


def normalise_rows(raw, start, end):
    """API response -> the flat rows the rest of the pipeline works on."""
    rows = []
    for page in raw["results"]:
        props = page.get("properties", {})
        date = _plain(props.get("Post date"))[:10]
        if not (start.isoformat() <= date <= end.isoformat()):
            continue          # the fixture holds neighbouring weeks too
        pearl = _plain(props.get("MRCP Pearl"))
        if not pearl.strip():
            continue          # rows exist with an empty pearl
        rows.append({"id": page["id"], "post_date": date,
                     "topic": _plain(props.get("Topic")), "pearl": pearl})
    return sorted(rows, key=lambda r: r["post_date"])
