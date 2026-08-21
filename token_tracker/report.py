"""Aggregate UsageRecord rows into summaries for the CLI and the dashboard."""

from __future__ import annotations

from collections import defaultdict

from .models import UsageRecord


def _new_bucket() -> dict:
    return {
        "requests": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "thinking_tokens": 0,
        "cost_usd": 0.0,
        "cost_known": True,
        "sessions": set(),
        "models": set(),
    }


def _fold(bucket: dict, record: UsageRecord) -> None:
    bucket["requests"] += 1
    bucket["input_tokens"] += record.input_tokens
    bucket["output_tokens"] += record.output_tokens
    bucket["cache_creation_input_tokens"] += record.cache_creation_input_tokens
    bucket["cache_read_input_tokens"] += record.cache_read_input_tokens
    bucket["thinking_tokens"] += record.thinking_tokens
    bucket["sessions"].add(record.session_id)
    bucket["models"].add(record.model)
    if record.cost_usd is None:
        bucket["cost_known"] = False
    else:
        bucket["cost_usd"] += record.cost_usd


def _finalize(bucket: dict) -> dict:
    out = dict(bucket)
    out["sessions"] = len(bucket["sessions"])
    out["models"] = sorted(bucket["models"])
    out["total_tokens"] = (
        bucket["input_tokens"]
        + bucket["output_tokens"]
        + bucket["cache_creation_input_tokens"]
        + bucket["cache_read_input_tokens"]
    )
    if not bucket["cost_known"]:
        out["cost_usd"] = None
    return out


def summarize(records: list[UsageRecord]) -> dict:
    return _finalize(_fold_all(records))


def _fold_all(records: list[UsageRecord]) -> dict:
    bucket = _new_bucket()
    for r in records:
        _fold(bucket, r)
    return bucket


def by_model(records: list[UsageRecord]) -> dict[str, dict]:
    buckets: dict[str, dict] = defaultdict(_new_bucket)
    for r in records:
        _fold(buckets[r.model], r)
    return {k: _finalize(v) for k, v in sorted(buckets.items())}


def by_session(records: list[UsageRecord]) -> dict[str, dict]:
    buckets: dict[str, dict] = defaultdict(_new_bucket)
    first_ts: dict[str, str] = {}
    last_ts: dict[str, str] = {}
    sources: dict[str, set] = defaultdict(set)
    projects: dict[str, set] = defaultdict(set)
    for r in records:
        _fold(buckets[r.session_id], r)
        sources[r.session_id].add(r.source)
        if r.project:
            projects[r.session_id].add(r.project)
        if r.session_id not in first_ts or r.timestamp < first_ts[r.session_id]:
            first_ts[r.session_id] = r.timestamp
        if r.session_id not in last_ts or r.timestamp > last_ts[r.session_id]:
            last_ts[r.session_id] = r.timestamp
    out = {}
    for session_id, bucket in buckets.items():
        finalized = _finalize(bucket)
        finalized["source"] = "+".join(sorted(sources[session_id]))
        finalized["project"] = "+".join(sorted(projects[session_id])) if projects[session_id] else None
        finalized["first_seen"] = first_ts.get(session_id)
        finalized["last_seen"] = last_ts.get(session_id)
        out[session_id] = finalized
    return dict(sorted(out.items(), key=lambda kv: kv[1]["last_seen"] or "", reverse=True))


def by_day(records: list[UsageRecord]) -> dict[str, dict]:
    buckets: dict[str, dict] = defaultdict(_new_bucket)
    for r in records:
        day = (r.timestamp or "")[:10] or "unknown"
        _fold(buckets[day], r)
    return {k: _finalize(v) for k, v in sorted(buckets.items())}


def _fmt_usd(v) -> str:
    return f"${v:,.4f}" if v is not None else "n/a"


def _fmt_int(v) -> str:
    return f"{v:,}"


def print_summary_table(title: str, rows: dict[str, dict], key_label: str = "Key") -> str:
    headers = [key_label, "Requests", "Sessions", "Input", "Output", "Cache Wr", "Cache Rd", "Thinking", "Cost"]
    table_rows = []
    for key, r in rows.items():
        table_rows.append(
            [
                str(key),
                _fmt_int(r["requests"]),
                _fmt_int(r["sessions"]),
                _fmt_int(r["input_tokens"]),
                _fmt_int(r["output_tokens"]),
                _fmt_int(r["cache_creation_input_tokens"]),
                _fmt_int(r["cache_read_input_tokens"]),
                _fmt_int(r["thinking_tokens"]),
                _fmt_usd(r["cost_usd"]),
            ]
        )
    widths = [max(len(h), *(len(row[i]) for row in table_rows)) if table_rows else len(h) for i, h in enumerate(headers)]
    lines = [title, "=" * len(title)]
    lines.append("  ".join(h.ljust(w) for h, w in zip(headers, widths)))
    lines.append("  ".join("-" * w for w in widths))
    for row in table_rows:
        lines.append("  ".join(cell.ljust(w) for cell, w in zip(row, widths)))
    text = "\n".join(lines)
    print(text)
    return text
