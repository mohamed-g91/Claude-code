import json
from pathlib import Path

from token_tracker.ingest_claude_code import parse_session_file
from token_tracker.store import UsageStore

SAMPLE_LINES = [
    {"type": "queue-operation", "operation": "x", "timestamp": "t", "sessionId": "s1"},
    {
        "type": "assistant",
        "requestId": "req_1",
        "sessionId": "s1",
        "timestamp": "2026-08-21T12:27:52.641Z",
        "cwd": "/home/user/project",
        "effort": "high",
        "message": {
            "model": "claude-sonnet-5",
            "usage": {
                "input_tokens": 2,
                "cache_creation_input_tokens": 44969,
                "cache_read_input_tokens": 0,
                "output_tokens": 245,
                "output_tokens_details": {"thinking_tokens": 122},
                "server_tool_use": {"web_search_requests": 1, "web_fetch_requests": 0},
                "service_tier": "standard",
                "cache_creation": {"ephemeral_1h_input_tokens": 44969, "ephemeral_5m_input_tokens": 0},
                "speed": "standard",
            },
        },
    },
    # Duplicate snapshot of the same request -- should collapse to one record on upsert.
    {
        "type": "assistant",
        "requestId": "req_1",
        "sessionId": "s1",
        "timestamp": "2026-08-21T12:27:52.649Z",
        "cwd": "/home/user/project",
        "effort": "high",
        "message": {
            "model": "claude-sonnet-5",
            "usage": {
                "input_tokens": 2,
                "cache_creation_input_tokens": 44969,
                "cache_read_input_tokens": 0,
                "output_tokens": 245,
                "output_tokens_details": {"thinking_tokens": 122},
                "server_tool_use": {"web_search_requests": 1, "web_fetch_requests": 0},
                "service_tier": "standard",
                "cache_creation": {"ephemeral_1h_input_tokens": 44969, "ephemeral_5m_input_tokens": 0},
                "speed": "standard",
            },
        },
    },
    {"type": "user", "message": {}, "sessionId": "s1"},
]


def write_sample(tmp_path: Path) -> Path:
    session_file = tmp_path / "abc123.jsonl"
    with session_file.open("w") as fh:
        for line in SAMPLE_LINES:
            fh.write(json.dumps(line) + "\n")
    return session_file


def test_parse_session_file_extracts_assistant_usage(tmp_path):
    session_file = write_sample(tmp_path)
    records = list(parse_session_file(session_file))
    assert len(records) == 2  # two assistant lines, not yet deduped
    r = records[0]
    assert r.source == "claude_code"
    assert r.request_id == "req_1"
    assert r.session_id == "s1"
    assert r.model == "claude-sonnet-5"
    assert r.input_tokens == 2
    assert r.output_tokens == 245
    assert r.thinking_tokens == 122
    assert r.cache_creation_1h_tokens == 44969
    assert r.project == "/home/user/project"
    assert r.effort == "high"
    assert r.web_search_requests == 1
    assert r.cost_usd is not None and r.cost_usd > 0


def test_upsert_dedupes_repeated_request_id(tmp_path):
    session_file = write_sample(tmp_path)
    records = list(parse_session_file(session_file))
    store = UsageStore(tmp_path / "usage.db")
    try:
        store.upsert_many(records)
        all_records = store.all_records()
        assert len(all_records) == 1
        assert all_records[0].request_id == "req_1"
    finally:
        store.close()
