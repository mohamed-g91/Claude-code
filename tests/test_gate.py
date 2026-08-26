"""The gate's job is to stop invented clinical text reaching an image.

Every case here is one that has actually gone wrong, or one the rules were
written to make impossible. If a change to gate.py makes one of these pass,
the change is wrong - not the test.
"""
import gate
import pytest

STATIN = ("QRISK3 >= 10% - offer atorvastatin 20 mg for primary prevention of "
          "cardiovascular disease.")
DOAC = ("Apixaban or rivaroxaban are first-line for confirmed PE and DVT - no lead-in "
        "heparin needed, unlike dabigatran and edoxaban which require 5 days of LMWH first.")
P2Y12 = ("Three P2Y12 inhibitors: clopidogrel is a prodrug needing CYP2C19 activation; "
         "ticagrelor causes dyspnoea; prasugrel is contraindicated after stroke/TIA.")


def test_faithful_extract_passes():
    assert gate.check("**QRISK3 >= 10%** - **atorvastatin 20 mg** for primary prevention.",
                      STATIN) == []


@pytest.mark.parametrize("card,needle", [
    # The failure that started all of this: a statin swapped for an NSAID.
    ("**QRISK3 >= 10%** - **nabumetone 20 mg** for primary prevention.", "nabumetone"),
    # A threshold quietly moved.
    ("**QRISK3 >= 20%** - **atorvastatin 20 mg** for primary prevention.", "20%"),
    # A claim the source never made.
    ("**atorvastatin 20 mg** is recommended for all adults.", "recommended"),
])
def test_invented_terms_are_blocked(card, needle):
    problems = gate.check(card, STATIN)
    assert problems, f"expected {needle!r} to be blocked"
    assert any(needle in p for p in problems)


def test_flipped_operator_is_blocked():
    problems = gate.check("**QRISK3 <= 10%** - **atorvastatin 20 mg** for prevention.", STATIN)
    assert any("threshold" in p for p in problems)


@pytest.mark.parametrize("card,rule", [
    # Emphasis must mark a fact, not a fixed-size opening chunk. A length cap
    # alone did not catch this: the chunk below is under the 34-char limit.
    ("**QRISK3 >= 10% - atorvastatin 20** mg for prevention.", "clause break"),
    ("QRISK3 >= 10% - atorvastatin 20 mg for prevention.", "no emphasis"),
    ("**QRISK3 >= 10%** - atorvastatin **20** mg for prevention.", "number from its unit"),
    ("**QRISK3 >= 10%** - **atorvastatin for** prevention.", "ends on"),
])
def test_emphasis_rules(card, rule):
    problems = gate.check(card, STATIN)
    assert any(rule in p for p in problems), f"{rule!r} not reported in {problems}"


def test_unclosed_marker_is_reported():
    assert any("unclosed" in p for p in
               gate.check("**QRISK3 >= 10% - **atorvastatin 20 mg** here", STATIN))


def test_card_length_cap():
    long_card = "**QRISK3 >= 10%** " + "atorvastatin 20 mg for primary prevention " * 4
    assert any("chars" in p for p in gate.check(long_card, STATIN))


class TestSoftFlags:
    """Warnings, never blocks: the hard rules cannot see meaning."""

    def test_dropped_qualifier_is_flagged(self):
        card = "**Clopidogrel** needs **CYP2C19**; **prasugrel** is used after stroke/TIA."
        assert gate.check(card, P2Y12) == []          # every word is in the source
        flags = gate.warnings(card, P2Y12)
        assert flags and "contraindicated" in flags[0]

    def test_qualifier_kept_is_clean(self):
        card = ("**Clopidogrel** needs **CYP2C19**; **prasugrel** is contraindicated "
                "after stroke/TIA.")
        assert gate.warnings(card, P2Y12) == []

    def test_polarity_in_another_clause_does_not_flag(self):
        """The window must not leak across a clause into a neighbouring fact."""
        card = "**Clopidogrel** needs **CYP2C19**; **ticagrelor** causes dyspnoea."
        assert gate.warnings(card, P2Y12) == []

    def test_omitting_an_unrelated_fact_does_not_flag(self):
        """Picking one fact from a multi-fact pearl is the job, not a defect.

        This card drops "no lead-in heparin" entirely, but it does not govern
        anything the card claims - the card is true and complete for what it
        says. Flagging omission would fire on almost every card, because every
        card leaves most of its pearl behind.
        """
        card = "**Apixaban** and **rivaroxaban** are first-line for PE and DVT."
        assert gate.check(card, DOAC) == []
        assert gate.warnings(card, DOAC) == []

    def test_qualifier_governing_a_term_the_card_uses_is_flagged(self):
        """Contrast with the above: here the dropped word governs the card."""
        card = "**dabigatran** and **edoxaban** need lead-in heparin for PE."
        assert gate.warnings(card, DOAC)
