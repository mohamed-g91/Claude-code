"""Data model for a single tracked Claude request."""

from __future__ import annotations

import json
from dataclasses import dataclass, fields


@dataclass
class UsageRecord:
    """One billed request against a Claude model.

    ``source`` distinguishes where the record came from:
      - "claude_code": parsed from a local Claude Code session transcript
      - "api": captured from a live Anthropic Messages API response

    ``request_id`` + ``source`` is the dedup key — Claude Code transcripts
    repeat the same request across several streamed snapshot lines, so the
    store upserts on this pair rather than appending duplicates.
    """

    source: str
    request_id: str
    session_id: str
    timestamp: str  # ISO 8601 UTC, e.g. "2026-08-21T12:27:52.641Z"
    model: str

    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    thinking_tokens: int = 0
    cache_creation_5m_tokens: int = 0
    cache_creation_1h_tokens: int = 0

    web_search_requests: int = 0
    web_fetch_requests: int = 0

    service_tier: str | None = None
    speed: str | None = None
    inference_geo: str | None = None
    effort: str | None = None

    project: str | None = None  # cwd for claude_code, app/service name for api

    cost_usd: float | None = None  # None when the model isn't in the pricing table
    raw_usage_json: str = "{}"  # full usage blob, for drill-down in the dashboard

    @property
    def total_tokens(self) -> int:
        return (
            self.input_tokens
            + self.output_tokens
            + self.cache_creation_input_tokens
            + self.cache_read_input_tokens
        )

    def to_row(self) -> dict:
        return {f.name: getattr(self, f.name) for f in fields(self)}

    @classmethod
    def from_row(cls, row: dict) -> "UsageRecord":
        known = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in row.items() if k in known})

    def raw_usage(self) -> dict:
        try:
            return json.loads(self.raw_usage_json)
        except (TypeError, ValueError):
            return {}
