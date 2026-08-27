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
        "anchor_date": "2026-08-21", "anchor_week": 1,
        "review_chat_id": "111", "channel_chat_id": "-222"}))
    return state.load_series()


@pytest.mark.parametrize("friday,week", [
    ("2026-08-21", 1),
    ("2026-08-28", 2),
    # The reason the anchor exists: an ISO week number resets to 1 in January,
    # which would restart the series mid-run. This must keep counting.
    ("2027-01-01", 20),
    ("2027-01-08", 21),
])
def test_week_counts_the_series_not_the_calendar(series, friday, week):
    assert series.week_for(dt.date.fromisoformat(friday)) == week


def test_week_before_the_anchor_is_refused(series):
    with pytest.raises(state.PreflightError) as e:
        series.week_for(dt.date(2026, 8, 3))
    assert e.value.code == state.ANCHOR_MISSING


def test_anchor_must_be_a_friday(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "SERIES_FILE", tmp_path / "series.json")
    (tmp_path / "series.json").write_text(json.dumps({
        "anchor_date": "2026-08-11", "anchor_week": 1,
        "review_chat_id": "1", "channel_chat_id": "-2"}))
    with pytest.raises(state.PreflightError) as e:
        state.load_series()
    assert "not a Friday" in str(e.value)


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


def test_chromium_found_here():
    assert state.check_chromium()


def test_missing_chromium_reports_what_it_searched(monkeypatch, tmp_path):
    """The failure path, which no environment variable can provoke: the search
    roots include a literal, so they have to be patched to test it."""
    monkeypatch.setattr(state, "CHROMIUM_ROOTS", [str(tmp_path / "nowhere")])
    monkeypatch.setattr(state, "CHROMIUM_NAMES", ["definitely-not-a-browser"])
    monkeypatch.delenv("CHROME_PATH", raising=False)
    monkeypatch.delenv("PLAYWRIGHT_BROWSERS_PATH", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))
    with pytest.raises(state.PreflightError) as e:
        state.check_chromium()
    assert e.value.code == state.CHROMIUM_MISSING
    assert "searched:" in str(e.value)


# --------------------------------------------------------------------------
# Reachability probes
#
# The first version of check_telegram_reachable() probed https://api.telegram.org,
# which 302s to core.telegram.org. urllib followed the redirect, the second
# CONNECT was refused because nobody allowlists that host, and preflight told the
# operator to allowlist api.telegram.org - the host it had just reached. These
# tests pin both halves: a redirect counts as reached, a refusal still fails.
# --------------------------------------------------------------------------

class _FakeOpener:
    def __init__(self, exc):
        self.exc = exc
        self.opened = []
        self.handlers = []

    def open(self, req, *args, **kwargs):
        self.opened.append(getattr(req, "full_url", req))
        raise self.exc


def _with_opener(monkeypatch, exc):
    fake = _FakeOpener(exc)

    def build_opener(*handlers):
        fake.handlers.extend(handlers)
        return fake

    monkeypatch.setattr(state.urllib.request, "build_opener", build_opener)
    return fake


def test_probe_refuses_to_follow_redirects(monkeypatch):
    """The opener must carry _NoRedirect, or a 302 walks off the allowlist."""
    fake = _with_opener(monkeypatch, state.urllib.error.HTTPError(
        "x", 401, "Unauthorized", {}, None))
    state.check_telegram_reachable()
    assert any(h is state._NoRedirect or isinstance(h, state._NoRedirect)
               for h in fake.handlers), "reachability probe follows redirects"


def test_redirect_counts_as_reachable(monkeypatch):
    """A 3xx proves the host answered; it is a pass, not a failure."""
    _with_opener(monkeypatch, state.urllib.error.HTTPError(
        "https://api.telegram.org/", 302, "Found",
        {"Location": "https://core.telegram.org/bots"}, None))
    state.check_telegram_reachable()          # must not raise


def test_refused_tunnel_still_fails(monkeypatch):
    """A genuine policy denial must keep failing, with its own exit code."""
    _with_opener(monkeypatch, state.urllib.error.URLError(
        "Tunnel connection failed: 403 Forbidden"))
    with pytest.raises(state.PreflightError) as e:
        state.check_telegram_reachable()
    assert e.value.code == state.TELEGRAM_UNREACHABLE
    assert "api.telegram.org" in str(e.value)


def test_no_redirect_handler_declines(monkeypatch):
    """redirect_request returning None is what makes urllib surface the 3xx."""
    assert state._NoRedirect().redirect_request(
        None, None, 302, "Found", {}, "https://core.telegram.org/bots") is None


def test_telegram_probe_is_not_the_redirecting_root(monkeypatch):
    """Probe a path the API answers itself, not the root that redirects away."""
    fake = _with_opener(monkeypatch, state.urllib.error.HTTPError(
        "x", 401, "Unauthorized", {}, None))
    state.check_telegram_reachable()
    url = fake.opened[0]
    assert url.startswith("https://api.telegram.org/")
    assert url.rstrip("/") != "https://api.telegram.org"


def test_probe_carries_no_real_token(monkeypatch):
    """The probe must never put the live bot token in a URL."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "8964793566:AAELsecretsecretsecret")
    fake = _with_opener(monkeypatch, state.urllib.error.HTTPError(
        "x", 401, "Unauthorized", {}, None))
    state.check_telegram_reachable()
    assert "AAELsecret" not in fake.opened[0]


# --------------------------------------------------------------------------
# Approval ledger
# --------------------------------------------------------------------------

def test_approval_is_bound_to_the_cards_that_were_shown(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "APPROVAL_FILE", tmp_path / "approvals.json")
    state.record_approval(2, "aaaaaaaaaaaaaaaa", "ok", by="Mohamed")
    assert state.approved(2, "aaaaaaaaaaaaaaaa")
    # a card rewritten after the tap must invalidate it
    assert not state.approved(2, "bbbbbbbbbbbbbbbb")


def test_needs_changes_is_not_an_approval(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "APPROVAL_FILE", tmp_path / "approvals.json")
    state.record_approval(2, "aaaaaaaaaaaaaaaa", "no")
    assert not state.approved(2, "aaaaaaaaaaaaaaaa")


def test_unapproved_week_is_not_approved(tmp_path, monkeypatch):
    monkeypatch.setattr(state, "APPROVAL_FILE", tmp_path / "approvals.json")
    assert not state.approved(2, "aaaaaaaaaaaaaaaa")


def test_offset_survives_alongside_approvals(tmp_path, monkeypatch):
    """The update offset shares the file; it must not read as a week."""
    monkeypatch.setattr(state, "APPROVAL_FILE", tmp_path / "approvals.json")
    state.record_approval(2, "aaaaaaaaaaaaaaaa", "ok")
    state.record_update_offset(12345)
    assert state.load_update_offset() == 12345
    assert state.approved(2, "aaaaaaaaaaaaaaaa")
