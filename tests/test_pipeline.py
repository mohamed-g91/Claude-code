"""
test_pipeline.py — unit tests for notion_client parsing, renderer HTML
conversion, and the plan-week rules. No network. No LLM.
"""

import json
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import notion_client as nc
from pipeline import renderer


FIXTURES = Path(__file__).parent / "fixtures"


def _page(props: dict) -> dict:
    return {"id": "page-1", "properties": props}


def _title_prop(text: str) -> dict:
    return {"type": "title", "title": [{"plain_text": text}]}


def _date_prop(iso: str) -> dict:
    return {"type": "date", "date": {"start": iso}}


def _rt_prop(text: str) -> dict:
    return {"type": "rich_text", "rich_text": [{"plain_text": text}]}


def _select_prop(name: str) -> dict:
    return {"type": "select", "select": {"name": name}}


# ---------------------------------------------------------------------------
# parse_pearl_page
# ---------------------------------------------------------------------------


def test_parse_full_page():
    page = _page(
        {
            "Name": _title_prop("AF rate control"),
            "Post": _date_prop("2026-08-25"),
            "Pearl": _rt_prop("Lenient rate control below 110 bpm is acceptable."),
            "Topic": _select_prop("Cardiology"),
            "Subtopic": _select_prop("Arrhythmias"),
        }
    )
    p = nc.parse_pearl_page(page)
    assert p is not None
    assert p.name == "AF rate control"
    assert p.post_date == date(2026, 8, 25)
    assert "110 bpm" in p.pearl_text
    assert p.topic == "Cardiology"
    assert p.subtopic == "Arrhythmias"


def test_parse_missing_post_returns_none():
    page = _page({"Name": _title_prop("x"), "Pearl": _rt_prop("body")})
    assert nc.parse_pearl_page(page) is None


def test_parse_empty_body_returns_none():
    page = _page({"Name": _title_prop("x"), "Post": _date_prop("2026-08-25")})
    assert nc.parse_pearl_page(page) is None


def test_parse_falls_back_to_longest_rich_text():
    # body property named differently — longest rich text should win
    page = _page(
        {
            "Name": _title_prop("x"),
            "Post": _date_prop("2026-08-25"),
            "Note": _rt_prop("short"),
            "Message": _rt_prop("the actual long pearl content lives here"),
        }
    )
    p = nc.parse_pearl_page(page)
    assert p is not None
    assert "long pearl" in p.pearl_text


# ---------------------------------------------------------------------------
# apply_week_rules
# ---------------------------------------------------------------------------


def _mk_pearls(n: int) -> list:
    return [
        nc.Pearl(page_id=f"p{i}", name="n", post_date=date(2026, 8, 20 + i % 5), pearl_text="body")
        for i in range(n)
    ]


def test_week_rules_zero_raises_nopearls():
    with pytest.raises(nc.NoPearls):
        nc.apply_week_rules([])


def test_week_rules_two_raises_insufficient():
    with pytest.raises(nc.InsufficientPearls):
        nc.apply_week_rules(_mk_pearls(2))


def test_week_rules_three_passes():
    out = nc.apply_week_rules(_mk_pearls(3))
    assert len(out) == 3


def test_week_rules_caps_at_seven_dropping_oldest():
    out = nc.apply_week_rules(_mk_pearls(9))
    assert len(out) == 7
    assert all(p.page_id >= "p2" for p in out)  # oldest two dropped


# ---------------------------------------------------------------------------
# renderer.spans_to_html
# ---------------------------------------------------------------------------


def test_spans_to_html_basic():
    visible = "Aspirin is avoided in children."
    html = renderer.spans_to_html(visible, [(0, 7), (22, 30)])
    assert html == "<strong>Aspirin</strong> is avoided in <strong>children</strong>."


def test_spans_to_html_no_spans():
    assert renderer.spans_to_html("plain text", []) == "plain text"


def test_card_render_roundtrip(tmp_path):
    doc = {
        "week": 1,
        "cards": [
            {
                "index": 1,
                "pearl_id": "x",
                "visible": "Beta blockers cause bronchospasm.",
                "span_ranges": [[0, 12]],
                "flags": ["QUALIFIER_DROPPED"],
            }
        ],
    }
    path = tmp_path / "cards.json"
    path.write_text(json.dumps(doc))
    cards = renderer.load_cards(path)
    assert cards[0].html == "<strong>Beta blocker</strong>s cause bronchospasm."
    assert cards[0].flags == ["QUALIFIER_DROPPED"]


# ---------------------------------------------------------------------------
# Fixtures sanity (used by LLM-dependent tests when network is available)
# ---------------------------------------------------------------------------


def test_fixtures_load_and_shape():
    good = json.loads((FIXTURES / "good_pearls.json").read_text())
    adv = json.loads((FIXTURES / "adversarial_pearls.json").read_text())
    assert len(good) == 4
    for g in good:
        assert {"page_id", "post_date", "pearl_text"} <= set(g)
    for a in adv:
        assert {"source_pearl", "bad_card", "expected_flag"} <= set(a)
