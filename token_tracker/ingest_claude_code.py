"""Parse local Claude Code session transcripts into UsageRecord rows.

Claude Code stores one JSONL file per session under
``~/.claude/projects/<escaped-cwd>/<session-id>.jsonl``. Each line is a JSON
object with a "type" field; the ones that carry token usage are:

    {"type": "assistant", "requestId": "...", "sessionId": "...",
     "timestamp": "...", "cwd": "...", "effort": "high",
     "message": {"model": "...", "usage": {...}}}

A single API request is often written more than once (streamed snapshot
updates share the same requestId within a session) -- callers should dedupe
on (source, request_id), which is exactly what UsageStore.upsert_many does.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Iterator

from .models import UsageRecord
from .pricing import estimate_cost_usd

DEFAULT_PROJECTS_ROOT = Path.home() / ".claude" / "projects"


def find_session_files(root: Path = DEFAULT_PROJECTS_ROOT) -> list[Path]:
    if not root.exists():
        return []
    return sorted(root.glob("**/*.jsonl"))


def _record_from_line(line: dict, session_file: Path) -> UsageRecord | None:
    if line.get("type") != "assistant":
        return None

    message = line.get("message") or {}
    usage = message.get("usage") or {}
    if not usage:
        return None

    request_id = line.get("requestId") or message.get("id")
    if not request_id:
        return None

    session_id = line.get("sessionId") or session_file.stem
    model = message.get("model") or "unknown"

    cache_creation = usage.get("cache_creation") or {}
    cache_5m = cache_creation.get("ephemeral_5m_input_tokens", 0)
    cache_1h = cache_creation.get("ephemeral_1h_input_tokens", 0)
    server_tools = usage.get("server_tool_use") or {}
    output_details = usage.get("output_tokens_details") or {}

    input_tokens = usage.get("input_tokens", 0)
    output_tokens = usage.get("output_tokens", 0)
    cache_creation_input_tokens = usage.get("cache_creation_input_tokens", 0)
    cache_read_input_tokens = usage.get("cache_read_input_tokens", 0)

    cost = estimate_cost_usd(
        model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_5m_tokens=cache_5m,
        cache_creation_1h_tokens=cache_1h,
        cache_read_input_tokens=cache_read_input_tokens,
    )

    return UsageRecord(
        source="claude_code",
        request_id=request_id,
        session_id=session_id,
        timestamp=line.get("timestamp") or "",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_input_tokens=cache_creation_input_tokens,
        cache_read_input_tokens=cache_read_input_tokens,
        thinking_tokens=output_details.get("thinking_tokens", 0),
        cache_creation_5m_tokens=cache_5m,
        cache_creation_1h_tokens=cache_1h,
        web_search_requests=server_tools.get("web_search_requests", 0),
        web_fetch_requests=server_tools.get("web_fetch_requests", 0),
        service_tier=usage.get("service_tier"),
        speed=usage.get("speed"),
        inference_geo=usage.get("inference_geo"),
        effort=line.get("effort"),
        project=line.get("cwd"),
        cost_usd=cost,
        raw_usage_json=json.dumps(usage),
    )


def parse_session_file(path: Path) -> Iterator[UsageRecord]:
    with path.open("r", encoding="utf-8") as fh:
        for raw_line in fh:
            raw_line = raw_line.strip()
            if not raw_line:
                continue
            try:
                line = json.loads(raw_line)
            except json.JSONDecodeError:
                continue
            record = _record_from_line(line, path)
            if record is not None:
                yield record


def parse_all(root: Path = DEFAULT_PROJECTS_ROOT) -> Iterator[UsageRecord]:
    for session_file in find_session_files(root):
        yield from parse_session_file(session_file)


def sync_to_store(store, root: Path = DEFAULT_PROJECTS_ROOT, files: Iterable[Path] | None = None) -> int:
    """Ingest Claude Code transcripts into ``store``. Returns records written."""
    records: list[UsageRecord] = []
    target_files = list(files) if files is not None else find_session_files(root)
    for session_file in target_files:
        records.extend(parse_session_file(session_file))
    return store.upsert_many(records)
