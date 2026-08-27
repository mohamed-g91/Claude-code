"""Week selection and card proposal, against the nine real posted rows."""
import datetime as dt
import json
import pathlib

import cards as cards_mod
import gate
import notion
import telegram
import weekly
import pytest

FIXTURE = pathlib.Path(__file__).resolve().parent.parent / "pipeline/fixtures/posted_rows.json"


@pytest.mark.parametrize("today,start,end", [
    ("2026-08-28", "2026-08-21", "2026-08-27"),   # the Friday the routine runs
    ("2026-08-25", "2026-08-14", "2026-08-20"),   # mid-week, previous week
    ("2026-08-27", "2026-08-14", "2026-08-20"),   # Thursday, still the old week
    ("2026-09-04", "2026-08-28", "2026-09-03"),   # next Friday rolls over
])
def test_last_complete_week(today, start, end):
    s, e = notion.last_complete_week(dt.date.fromisoformat(today))
    assert (s.isoformat(), e.isoformat()) == (start, end)


def test_selects_only_the_target_week():
    """Weeks run Friday..Thursday, so the window is 14th-20th, not 17th-23rd."""
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 21))   # a Friday
    assert (s.isoformat(), e.isoformat()) == ("2026-08-14", "2026-08-20")
    rows = notion.normalise_rows(raw, s, e)
    dates = [r["post_date"] for r in rows]
    assert dates == sorted(dates)
    assert dates == ["2026-08-15", "2026-08-17", "2026-08-18",
                     "2026-08-19", "2026-08-20"]
    assert "2026-08-21" not in dates, "the 21st opens the next week"


def test_topic_is_the_second_element_and_abbreviated_when_long():
    """Read the rows directly: which week they fall in is beside the point."""
    raw = json.loads(FIXTURE.read_text())
    everything = notion.normalise_rows(raw, dt.date(2026, 8, 1), dt.date(2026, 8, 31))
    topics = [cards_mod.propose(r)[0]["topic"] for r in everything]
    assert "Pulmonary embolism" in topics
    # "Adenosine diphosphate (ADP) receptor inhibitors" is too long for the row.
    assert "ADP receptor inhibitors" in topics


def test_multi_fact_pearls_are_reported_not_mangled():
    """The proposer must admit what it cannot do rather than emit a bad card."""
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 21))
    needs = [cards_mod.propose(r)[0]["topic"]
             for r in notion.normalise_rows(raw, s, e) if cards_mod.propose(r)[1]]
    # Ventricular tachycardia used to land here because the proposer picked its
    # colon-terminated lead-in; it now picks a fact with content and proposes
    # cleanly, which is the point of skipping lead-ins.
    assert set(needs) == {"Prosthetic heart valves", "Pulmonary embolism"}


def test_every_proposed_card_that_passes_is_actually_valid():
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 28))
    for row in notion.normalise_rows(raw, s, e):
        card, problems = cards_mod.propose(row)
        if not problems:
            assert cards_mod.verify(card, row) == [], card["topic"]


def test_truncated_fact_is_not_proposed_as_clean():
    """A cut sentence keeps only source words, so the gate passes it. Flag it.

    _trim strips trailing punctuation, so the cut reads as finished. If a
    trailing qualifier is what got cut, the card inverts the pearl silently.
    """
    long_fact = ("Amiodarone " + "three hundred milligrams is given early " * 4
                 + "but is contraindicated here.")
    row = {"id": "x", "post_date": "2026-08-17",
           "topic": "Cardiology,Amiodarone,Adrenaline",
           "pearl": f"<p><b>{long_fact}</b></p>"}
    card, problems = cards_mod.propose(row)
    assert problems, "a truncated card must not be proposed as clean"
    assert any("cut to fit" in p for p in problems)
    assert "contraindicated" not in card["text"]


def test_short_fact_is_untouched():
    row = {"id": "x", "post_date": "2026-08-17",
           "topic": "Cardiology,Adrenaline,Amiodarone",
           "pearl": "<p><b>Give adrenaline 1 mg IV as soon as possible.</b></p>"}
    card, problems = cards_mod.propose(row)
    assert not any("cut to fit" in p for p in problems)


def test_review_keyboard_carries_week_and_hash_within_telegram_limits():
    """callback_data is capped at 64 bytes, and must bind to these cards."""
    kb = telegram.review_keyboard(2, "69e69d5db7e9ea14")
    datas = [b["callback_data"] for b in kb["inline_keyboard"][0]]
    assert datas == ["wk:2:69e69d5db7e9ea14:ok", "wk:2:69e69d5db7e9ea14:no"]
    for d in datas:
        assert len(d.encode()) <= 64


def test_channel_post_carries_no_buttons():
    """Approval belongs to the private review chat, never to the channel."""
    src = pathlib.Path(__file__).resolve().parent.parent / "pipeline" / "weekly.py"
    body = src.read_text()
    publish = body[body.index("def cmd_publish"):body.index("def cmd_approval")]
    assert "buttons=False" in publish
    assert "review_keyboard" not in publish


def test_settle_message_makes_one_call(monkeypatch):
    """editMessageCaption drops the keyboard; a second edit is a no-op 400."""
    calls = []
    monkeypatch.setattr(telegram, "_call",
                        lambda m, p, *a, **k: (calls.append(m), {"ok": True})[1])
    telegram.settle_message("123", 5, "done")
    assert calls == ["editMessageCaption"]


def test_settle_message_tolerates_an_unchanged_message(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("editMessageCaption failed: 400 message is not modified")
    monkeypatch.setattr(telegram, "_call", boom)
    assert telegram.settle_message("123", 5, "done")["ok"] is True


def test_settle_message_still_raises_other_errors(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("editMessageCaption failed: 400 chat not found")
    monkeypatch.setattr(telegram, "_call", boom)
    with pytest.raises(RuntimeError):
        telegram.settle_message("123", 5, "done")


def test_summary_handles_a_copied_message():
    """copyMessage returns {"message_id": n} with no chat, unlike sendPhoto."""
    assert "138" in weekly._sent_summary({"ok": True, "result": {"message_id": 138}},
                                         "publish")


def test_channel_post_has_no_caption():
    """Mohamed wants the image alone on the channel. copyMessage keeps the
    source caption unless one is supplied, so publish must supply an empty one."""
    src = (pathlib.Path(__file__).resolve().parent.parent / "pipeline" / "weekly.py").read_text()
    publish = src[src.index("def cmd_publish"):src.index("def cmd_approval")]
    assert 'caption = ""' in publish
    assert "_preview_caption" not in publish


def test_preview_caption_still_tells_the_reviewer_what_is_flagged():
    plan = {"week": 2, "start": "2026-08-17", "end": "2026-08-23"}
    cap = weekly._preview_caption(plan, [{"topic": "PE", "flags": ["f"]}] * 2, "Cardiology")
    assert "[REVIEW]" in cap and "[PREVIEW]" in cap and "17 – 23 August 2026" in cap


def test_caption_span_matches_the_image_footer():
    """The preview caption and the infographic footer print dates the same way."""
    import importlib.util, datetime as dt
    build = pathlib.Path(__file__).resolve().parent.parent / "weekly-infographic" / "build.py"
    spec = importlib.util.spec_from_loader("b", loader=None)
    mod = importlib.util.module_from_spec(spec)
    exec(compile(build.read_text().split("def main")[0], "build.py", "exec"), mod.__dict__)
    for a, b in [("2026-08-17", "2026-08-23"), ("2026-12-28", "2027-01-03")]:
        assert weekly._span(a, b) == mod.fmt_range(dt.date.fromisoformat(a),
                                                   dt.date.fromisoformat(b))


def test_a_lead_in_is_not_proposed_as_a_card():
    """"Amiodarone toxicity - organ by organ:" passes every gate check and says
    nothing. Prefer a fact with content; flag it if there is nothing else."""
    row = {"id": "x", "post_date": "2026-08-21",
           "topic": "Cardiology,Amiodarone,Adrenaline",
           "pearl": ("<p><b>Amiodarone toxicity - organ by organ:</b></p>"
                     "<p>Lung: pneumonitis progressing to fibrosis in some patients</p>")}
    card, problems = cards_mod.propose(row)
    assert not card["text"].rstrip().endswith(":"), card["text"]
    assert "pneumonitis" in card["text"]


def test_a_pearl_that_is_only_a_lead_in_is_flagged():
    row = {"id": "x", "post_date": "2026-08-21",
           "topic": "Cardiology,Amiodarone,Adrenaline",
           "pearl": "<p><b>Amiodarone toxicity - organ by organ:</b></p>"}
    card, problems = cards_mod.propose(row)
    assert any("introduces a list" in p for p in problems), problems


def test_render_refreshes_soft_flags_on_hand_written_cards():
    """warnings() exists to catch meaning drift in cards a human rewrote.

    plan computes flags against the *proposed* card. If render did not
    recompute them, a rewritten card would carry the proposal's flags: stale
    warnings reported, and real ones on the new text never looked for.
    """
    src = (pathlib.Path(__file__).resolve().parent.parent / "pipeline" / "weekly.py").read_text()
    render = src[src.index("def cmd_render"):src.index("def _preview_caption")]
    assert "gate.warnings(" in render, "render must recompute soft flags"
    assert 'cards.json").write_text' in render, "refreshed flags must be persisted"


def test_warnings_catch_a_dropped_polarity_word():
    """The flag is advisory and deliberately over-eager: it fires whenever a
    clause carrying a polarity word is dropped, whether or not the meaning
    actually inverted. It must never stay silent on a real inversion."""
    source = ("Prasugrel is contraindicated after stroke or TIA, "
              "so it must not be given to those patients.")
    inverted = "Prasugrel is given to those patients after stroke or TIA."
    assert gate.warnings(inverted, source), "dropping 'not' must be flagged"

    # A card that keeps the polarity word in place is not flagged for it.
    plain = "Amiodarone 300 mg is given after the third shock."
    assert gate.warnings(plain, "Amiodarone 300 mg is given after the third shock.") == []
