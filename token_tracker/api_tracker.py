"""Capture usage from live Anthropic Messages API responses.

This module never imports the `anthropic` package at load time -- it only
inspects response/usage objects handed to it, so the rest of token_tracker
works with zero extra dependencies. Bring your own `anthropic.Anthropic()`
client; TrackedClient just wraps it and logs usage after each call.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from .models import UsageRecord
from .pricing import estimate_cost_usd
from .store import UsageStore


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _usage_to_dict(usage) -> dict:
    if usage is None:
        return {}
    if isinstance(usage, dict):
        return usage
    if hasattr(usage, "model_dump"):  # pydantic v2 model, as used by the SDK
        return usage.model_dump()
    if hasattr(usage, "dict"):
        return usage.dict()
    return dict(usage)


def record_from_response(
    response,
    *,
    session_id: str | None = None,
    project: str | None = None,
) -> UsageRecord:
    """Build a UsageRecord from a Messages API response (SDK object or dict).

    Works with `client.messages.create(...)` results and with
    `stream.get_final_message()` results.
    """
    if isinstance(response, dict):
        response_id = response.get("id")
        model = response.get("model", "unknown")
        usage = response.get("usage") or {}
    else:
        response_id = getattr(response, "id", None)
        model = getattr(response, "model", "unknown")
        usage = _usage_to_dict(getattr(response, "usage", None))

    request_id = response_id or f"api-{uuid.uuid4()}"
    cache_creation = usage.get("cache_creation") or {}
    cache_5m = cache_creation.get("ephemeral_5m_input_tokens", 0) or 0
    cache_1h = cache_creation.get("ephemeral_1h_input_tokens", 0) or 0
    server_tools = usage.get("server_tool_use") or {}
    output_details = usage.get("output_tokens_details") or {}

    input_tokens = usage.get("input_tokens", 0) or 0
    output_tokens = usage.get("output_tokens", 0) or 0
    cache_creation_input_tokens = usage.get("cache_creation_input_tokens", 0) or 0
    cache_read_input_tokens = usage.get("cache_read_input_tokens", 0) or 0

    cost = estimate_cost_usd(
        model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_5m_tokens=cache_5m,
        cache_creation_1h_tokens=cache_1h,
        cache_read_input_tokens=cache_read_input_tokens,
    )

    return UsageRecord(
        source="api",
        request_id=request_id,
        session_id=session_id or "default",
        timestamp=_utcnow_iso(),
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_input_tokens=cache_creation_input_tokens,
        cache_read_input_tokens=cache_read_input_tokens,
        thinking_tokens=output_details.get("thinking_tokens", 0) or 0,
        cache_creation_5m_tokens=cache_5m,
        cache_creation_1h_tokens=cache_1h,
        web_search_requests=server_tools.get("web_search_requests", 0) or 0,
        web_fetch_requests=server_tools.get("web_fetch_requests", 0) or 0,
        service_tier=usage.get("service_tier"),
        speed=usage.get("speed"),
        inference_geo=usage.get("inference_geo"),
        effort=None,
        project=project,
        cost_usd=cost,
        raw_usage_json=json.dumps(usage),
    )


class TrackedClient:
    """Wraps an anthropic.Anthropic client and logs usage after each call.

    Example:
        import anthropic
        from token_tracker.api_tracker import TrackedClient
        from token_tracker.store import UsageStore

        store = UsageStore()
        client = TrackedClient(anthropic.Anthropic(), store, session_id="my-app-run-1")

        response = client.messages_create(
            model="claude-sonnet-5", max_tokens=1024,
            messages=[{"role": "user", "content": "hi"}],
        )
    """

    def __init__(
        self,
        client,
        store: UsageStore,
        *,
        session_id: str | None = None,
        project: str | None = None,
    ):
        self._client = client
        self._store = store
        self.session_id = session_id or f"api-session-{uuid.uuid4().hex[:8]}"
        self.project = project

    def messages_create(self, **kwargs):
        response = self._client.messages.create(**kwargs)
        self._store.upsert(record_from_response(response, session_id=self.session_id, project=self.project))
        return response

    def track_stream(self, **kwargs):
        """Runs client.messages.stream(**kwargs) and logs usage from the final message."""
        with self._client.messages.stream(**kwargs) as stream:
            final_message = stream.get_final_message()
        self._store.upsert(record_from_response(final_message, session_id=self.session_id, project=self.project))
        return final_message
