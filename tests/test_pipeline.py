"""Week selection and card proposal, against the nine real posted rows."""
import datetime as dt
import json
import pathlib

import cards as cards_mod
import notion
import pytest

FIXTURE = pathlib.Path(__file__).resolve().parent.parent / "pipeline/fixtures/posted_rows.json"


@pytest.mark.parametrize("today,start,end", [
    ("2026-08-25", "2026-08-17", "2026-08-23"),   # Tuesday
    ("2026-08-24", "2026-08-17", "2026-08-23"),   # the Monday itself
    ("2026-08-29", "2026-08-17", "2026-08-23"),   # the Saturday the routine runs
    ("2026-08-31", "2026-08-24", "2026-08-30"),   # next Monday rolls over
])
def test_last_complete_week(today, start, end):
    s, e = notion.last_complete_week(dt.date.fromisoformat(today))
    assert (s.isoformat(), e.isoformat()) == (start, end)


def test_selects_only_the_target_week():
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 26))
    rows = notion.normalise_rows(raw, s, e)
    assert len(rows) == 7, "the 15th and 24th belong to neighbouring weeks"
    assert [r["post_date"] for r in rows] == sorted(r["post_date"] for r in rows)


def test_topic_is_the_second_element_and_abbreviated_when_long():
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 26))
    topics = [cards_mod.propose(r)[0]["topic"] for r in notion.normalise_rows(raw, s, e)]
    assert "Pulmonary embolism" in topics
    # "Adenosine diphosphate (ADP) receptor inhibitors" is too long for the row.
    assert "ADP receptor inhibitors" in topics


def test_multi_fact_pearls_are_reported_not_mangled():
    """The proposer must admit what it cannot do rather than emit a bad card."""
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 26))
    needs = [cards_mod.propose(r)[0]["topic"]
             for r in notion.normalise_rows(raw, s, e) if cards_mod.propose(r)[1]]
    assert set(needs) == {"Pulmonary embolism", "Ventricular tachycardia",
                          "ADP receptor inhibitors",
                          # cut at 118 chars, losing "after the fifth shock"
                          "Adult advanced life support"}


def test_every_proposed_card_that_passes_is_actually_valid():
    raw = json.loads(FIXTURE.read_text())
    s, e = notion.last_complete_week(dt.date(2026, 8, 26))
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
