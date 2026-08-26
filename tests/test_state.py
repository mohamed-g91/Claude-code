"""The anchor and the ledgers - the state that has to survive between runs."""
import datetime as dt
import json

import pytest
import state


@pytest.fixture
def series(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "STATE_DIR", tmp_path)
    monkeypatch.setattr(state, "SERIES_FILE", tmp_path / "series.json")
    monkeypatch.setattr(state, "SENT_FILE", tmp_path / "sent_weeks.json")
    monkeypatch.setattr(state, "PREVIEW_FILE", tmp_path / "preview_log.json")
    (tmp_path / "series.json").write_text(json.dumps({
        "anchor_date": "2026-08-10", "anchor_week": 1,
        "review_chat_id": "111", "channel_chat_id": "-222"}))
    return state.load_series()


@pytest.mark.parametrize("monday,week", [
    ("2026-08-10", 1),
    ("2026-08-17", 2),
    # The reason the anchor exists: an ISO week number resets to 1 in January,
    # which would restart the series mid-run. This must keep counting.
    ("2026-12-28", 21),
    ("2027-01-04", 22),
])
def test_week_counts_the_series_not_the_calendar(series, monday, week):
    assert series.week_for(dt.date.fromisoformat(monday)) == week


def test_week_before_the_anchor_is_refused(series):
    with pytest.raises(state.PreflightError) as e:
        series.week_for(dt.date(2026, 8, 3))
    assert e.value.code == state.ANCHOR_MISSING


def test_anchor_must_be_a_monday(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "SERIES_FILE", tmp_path / "series.json")
    (tmp_path / "series.json").write_text(json.dumps({
        "anchor_date": "2026-08-11", "anchor_week": 1,
        "review_chat_id": "1", "channel_chat_id": "-2"}))
    with pytest.raises(state.PreflightError) as e:
        state.load_series()
    assert "not a Monday" in str(e.value)


def test_missing_anchor_reports_its_own_exit_code(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "SERIES_FILE", tmp_path / "nope.json")
    with pytest.raises(state.PreflightError) as e:
        state.load_series()
    assert e.value.code == state.ANCHOR_MISSING


def test_publish_ledger_blocks_a_second_publish(series):
    assert not state.already_published(2)
    state.record_published(2, "abc123", 55)
    assert state.already_published(2)


def test_publish_requires_a_preview_of_these_exact_cards(series):
    assert not state.preview_matches(2, "abc123")
    state.record_preview(2, "abc123", 9)
    assert state.preview_matches(2, "abc123")
    # Edit the cards after previewing and the digest no longer matches.
    assert not state.preview_matches(2, "def456")


def test_missing_token_names_the_variable(monkeypatch):
    monkeypatch.delenv("NOTION_TOKEN", raising=False)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "x")
    with pytest.raises(state.PreflightError) as e:
        state.check_tokens()
    assert e.value.code == state.TOKENS_MISSING and "NOTION_TOKEN" in str(e.value)
