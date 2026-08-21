from token_tracker.models import UsageRecord
from token_tracker.store import UsageStore


def make_record(**overrides) -> UsageRecord:
    base = dict(
        source="api",
        request_id="req_a",
        session_id="sess_a",
        timestamp="2026-08-21T00:00:00.000Z",
        model="claude-sonnet-5",
        input_tokens=10,
        output_tokens=20,
    )
    base.update(overrides)
    return UsageRecord(**base)


def test_upsert_and_query_roundtrip(tmp_path):
    store = UsageStore(tmp_path / "usage.db")
    try:
        store.upsert(make_record())
        records = store.all_records()
        assert len(records) == 1
        assert records[0].input_tokens == 10
        assert records[0].output_tokens == 20
    finally:
        store.close()


def test_upsert_same_key_updates_in_place(tmp_path):
    store = UsageStore(tmp_path / "usage.db")
    try:
        store.upsert(make_record(output_tokens=20))
        store.upsert(make_record(output_tokens=99))
        records = store.all_records()
        assert len(records) == 1
        assert records[0].output_tokens == 99
    finally:
        store.close()


def test_filters(tmp_path):
    store = UsageStore(tmp_path / "usage.db")
    try:
        store.upsert(make_record(request_id="r1", model="claude-sonnet-5", source="api"))
        store.upsert(make_record(request_id="r2", model="claude-haiku-4-5", source="claude_code"))
        assert len(store.all_records(model="claude-sonnet-5")) == 1
        assert len(store.all_records(source="claude_code")) == 1
        assert len(store.all_records()) == 2
    finally:
        store.close()
