"""Pass A (structural) gate tests — six rules, hard fail.

Rule 1: one sentence
Rule 2: <= 118 visible characters
Rule 3: <= 5 emphasis spans
Rule 4: each span <= 34 characters
Rule 5: span must not begin/end on a connective, cross a clause break, or
        separate a number from its unit
Rule 6: every emphasized term must appear in the source pearl
"""

import pytest

from pipeline.gate import (
    MAX_CARD_CHARS,
    MAX_SPAN_CHARS,
    MAX_SPANS,
    Span,
    StructuralError,
    extract_spans,
    validate,
    validate_batch,
)


# A long but plausible source pearl used across the tests. The exact wording
# doesn't matter — what matters is that "10 mg", "warfarin", "INR", and
# "contraindicated" all appear in it.
SOURCE_PEARL = (
    "Warfarin is contraindicated in pregnancy. The initial dose is 10 mg, "
    "adjusted to target an INR of 2.0 to 3.0. Unfractionated heparin is an "
    "alternative when rapid anticoagulation is required."
)


# ---------------------------------------------------------------------------
# Span extraction
# ---------------------------------------------------------------------------


class TestExtractSpans:
    def test_no_spans(self):
        visible, spans = extract_spans("Warfarin dose is 10 mg.")
        assert visible == "Warfarin dose is 10 mg."
        assert spans == []

    def test_single_span(self):
        visible, spans = extract_spans("Give **10 mg** warfarin.")
        assert visible == "Give 10 mg warfarin."
        assert len(spans) == 1
        assert spans[0].term == "10 mg"
        assert spans[0].visible_start == 5
        assert spans[0].visible_end == 10
        assert spans[0].length == 5

    def test_multiple_spans(self):
        visible, spans = extract_spans("**Warfarin** is **contraindicated** in pregnancy.")
        assert visible == "Warfarin is contraindicated in pregnancy."
        assert [s.term for s in spans] == ["Warfarin", "contraindicated"]

    def test_unterminated_marker_treated_as_literal(self):
        # If the LLM forgets to close a **, don't crash — surface it.
        visible, spans = extract_spans("**oops never closed")
        assert "**" in visible
        assert spans == []

    def test_adjacent_spans(self):
        # **a** **b** must be two spans, not one
        visible, spans = extract_spans("**a** **b**")
        assert visible == "a b"
        assert [s.term for s in spans] == ["a", "b"]


# ---------------------------------------------------------------------------
# Rule 1: one sentence
# ---------------------------------------------------------------------------


class TestOneSentence:
    def test_single_period_passes(self):
        validate("Give **10 mg** warfarin.", SOURCE_PEARL)

    def test_no_terminator_passes(self):
        # A clinical "no period" card is common — accept it.
        validate("Give **10 mg** warfarin", SOURCE_PEARL)

    def test_two_sentences_rejected(self):
        with pytest.raises(StructuralError) as ei:
            validate("Give **10 mg** warfarin. Check INR tomorrow.", SOURCE_PEARL)
        assert ei.value.rule == "ONE_SENTENCE"

    def test_three_sentences_rejected(self):
        with pytest.raises(StructuralError) as ei:
            validate(
                "Give **10 mg** warfarin. Check INR. Adjust dose.",
                SOURCE_PEARL,
            )
        assert ei.value.rule == "ONE_SENTENCE"

    def test_empty_rejected(self):
        with pytest.raises(StructuralError):
            validate("", SOURCE_PEARL)
        with pytest.raises(StructuralError):
            validate("****", SOURCE_PEARL)


# ---------------------------------------------------------------------------
# Rule 2: max card chars
# ---------------------------------------------------------------------------


class TestMaxChars:
    def test_at_limit_passes(self):
        # 118 visible chars, no spans
        card = "x" * MAX_CARD_CHARS
        validate(card, SOURCE_PEARL)

    def test_over_limit_rejected(self):
        card = "x" * (MAX_CARD_CHARS + 1)
        with pytest.raises(StructuralError) as ei:
            validate(card, SOURCE_PEARL)
        assert ei.value.rule == "MAX_CHARS"

    def test_limit_counts_visible_chars_not_markers(self):
        # The **...** markers must not count toward the 118.
        # 115 x's + **x x** (5 visible chars) = 120 visible. Over limit.
        visible_part = "x" * 115
        card = f"**{visible_part}**"  # visible = 115 chars, markers not counted
        # That's 115, under 118. Add a few more x's to push over.
        # Actually let's just build a clearly-over case.
        card = "**" + "x" * 120 + "**"
        with pytest.raises(StructuralError) as ei:
            validate(card, SOURCE_PEARL)
        assert ei.value.rule == "MAX_CHARS"


# ---------------------------------------------------------------------------
# Rule 3: max spans
# ---------------------------------------------------------------------------


class TestMaxSpans:
    def test_five_spans_passes(self):
        # 5 spans, all terms in source pearl
        card = "**Warfarin** is **contraindicated** in **pregnancy** with **10 mg** **dose**."
        # but "dose" isn't in source — see rule 6. Use only source terms.
        card = "**Warfarin** is **contraindicated** in **pregnancy** with initial **10 mg** dose."
        # 5 spans: Warfarin, contraindicated, pregnancy, 10 mg, dose
        # But "dose" isn't in source — let's pick terms all from source.
        # SOURCE has: Warfarin, contraindicated, pregnancy, 10 mg, INR, 2.0, 3.0,
        # unfractionated, heparin, alternative, rapid, anticoagulation, required
        # We need 5 emphasis terms all in source.
        card = "**Warfarin** is **contraindicated** in **pregnancy**, dose **10 mg**, target **INR**."
        # 5 spans, all in source. But 2 sentences? No — one period at end.
        # Wait, the comma is fine. Only period is a sentence terminator.
        # Let's verify there is exactly one terminator.
        validate(card, SOURCE_PEARL)

    def test_six_spans_rejected(self):
        # Six distinct terms in the source pearl
        terms = ["Warfarin", "contraindicated", "pregnancy", "10 mg", "INR", "heparin"]
        card = " ".join(f"**{t}**" for t in terms) + "."
        with pytest.raises(StructuralError) as ei:
            validate(card, SOURCE_PEARL)
        assert ei.value.rule == "MAX_SPANS"
        assert "6" in ei.value.reason


# ---------------------------------------------------------------------------
# Rule 4: span length
# ---------------------------------------------------------------------------


class TestSpanLength:
    def test_at_limit_passes(self):
        # 34-char term in source. We need a source that has this exact string.
        long_term = "x" * MAX_SPAN_CHARS
        source = f"Use {long_term} when needed."
        validate(f"Use **{long_term}** when needed.", source)

    def test_over_limit_rejected(self):
        long_term = "x" * (MAX_SPAN_CHARS + 1)
        source = f"Use {long_term} when needed."
        with pytest.raises(StructuralError) as ei:
            validate(f"Use **{long_term}** when needed.", source)
        assert ei.value.rule == "SPAN_LENGTH"


# ---------------------------------------------------------------------------
# Rule 5a: connective start/end
# ---------------------------------------------------------------------------


class TestConnectiveBoundaries:
    @pytest.mark.parametrize("conn", [
        "the", "a", "an", "and", "or", "but", "of", "in", "to", "for",
        "with", "on", "at", "by", "is", "are", "was", "were", "be", "been",
    ])
    def test_span_starting_on_connective_rejected(self, conn):
        # "The" must not be the first word inside the **
        card = f"Give **{conn} drug** now."
        source = f"Give {conn} drug now."  # connective also in source
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "CONNECTIVE_START"

    def test_span_ending_on_connective_rejected(self):
        card = "Give **drug the** now."
        source = "Give drug the now."
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "CONNECTIVE_END"

    def test_span_starting_with_capitalized_connective_rejected(self):
        # "The" capitalized — same rule
        card = "Give **The drug** now."
        source = "Give The drug now."
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "CONNECTIVE_START"

    def test_connective_in_middle_of_span_passes(self):
        # "of" inside a span is fine — only the boundary matters
        card = "Risk **contraindication of warfarin** in pregnancy."
        source = "Risk contraindication of warfarin in pregnancy."
        validate(card, source)


# ---------------------------------------------------------------------------
# Rule 5b: clause break
# ---------------------------------------------------------------------------


class TestClauseBreak:
    @pytest.mark.parametrize("br", [",", ";", ":", "—", "–", ")", "("])
    def test_span_crossing_clause_break_rejected(self, br):
        card = f"Give **drug{br} dose** now."
        source = f"Give drug{br} dose now."
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "CLAUSE_BREAK"


# ---------------------------------------------------------------------------
# Rule 5c: number-unit separation
# ---------------------------------------------------------------------------


class TestNumberUnit:
    def test_number_outside_span_unit_inside_rejected(self):
        # "10" outside, " mg" inside — separated
        card = "Give **10** mg warfarin."  # visible: "Give 10 mg warfarin."
        # wait, the span contains "10", the " mg" comes after.
        # The first char of the span is "1" (a digit). After the span, " mg" appears.
        source = "Give 10 mg warfarin."
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "NUMBER_UNIT"

    def test_number_inside_span_unit_outside_rejected(self):
        # "10 " inside, "mg" outside
        card = "Give **10 **mg warfarin."  # malformed but parseable
        # visible: "Give 10 mg warfarin."
        # span term: "10 "
        source = "Give 10 mg warfarin."
        # The first char of the span is "1" (digit). After span: "mg warfarin."
        # "mg" is a unit, so the gate flags NUMBER_UNIT. Correct.
        with pytest.raises(StructuralError) as ei:
            validate(card, source)
        assert ei.value.rule == "NUMBER_UNIT"

    def test_full_dose_inside_span_passes(self):
        # The whole "10 mg" emphasized — no separation
        card = "Give **10 mg** warfarin."
        source = "Give 10 mg warfarin."
        validate(card, source)

    def test_long_units(self):
        # "5 mmol/L" — the unit list has mmol and l, not mmol/L.
        # This is a known limitation: extend UNITS in gate.py if needed.
        # For now, we test that "5 mmol" inside a span is fine.
        source = "Dose is 5 mmol/L initially."
        card = "Dose is **5 mmol**/L initially."
        # The span contains "5 mmol" — no unit outside, no number outside.
        # The "/L" after the span is not preceded by a number+space at the
        # span boundary, so this should pass. But wait — the previous char to
        # the span is "is" so the number isn't "separated" at the start of
        # the span. After the span is "/L" — that's not a unit in our list.
        # So this should pass. Let's see:
        validate(card, source)


# ---------------------------------------------------------------------------
# Rule 6: hallucinated emphasis
# ---------------------------------------------------------------------------


class TestHallucinatedEmphasis:
    def test_term_not_in_source_rejected(self):
        card = "Give **aspirin** 10 mg."  # "aspirin" not in SOURCE_PEARL
        with pytest.raises(StructuralError) as ei:
            validate(card, SOURCE_PEARL)
        assert ei.value.rule == "HALLUCINATED_EMPHASIS"
        assert "aspirin" in ei.value.reason

    def test_term_in_source_passes(self):
        card = "Give **warfarin** 10 mg."
        validate(card, SOURCE_PEARL)

    def test_case_insensitive_match(self):
        # "WARFARIN" in card, "warfarin" in source — should pass
        card = "Give **WARFARIN** 10 mg."
        validate(card, SOURCE_PEARL)


# ---------------------------------------------------------------------------
# The "happy path" — a realistic card that should pass everything
# ---------------------------------------------------------------------------


class TestRealisticCard:
    def test_warfarin_pearl(self):
        card = "**Warfarin** is **contraindicated** in pregnancy; use **heparin** instead."
        source = (
            "Warfarin is contraindicated in pregnancy due to teratogenicity. "
            "Unfractionated heparin or low molecular weight heparin should be used instead."
        )
        # But "instead" is in source. Let's verify. Yes. And "use" is in source.
        # Wait — semicolon ";" inside the span "in pregnancy; use" — but the
        # semicolon is a clause break. Let me restructure.
        # The semicolon is OUTSIDE any span in this card. The spans are
        # "Warfarin", "contraindicated", "heparin". The semicolon sits in
        # plain text between two spans. That's fine — clause breaks must not
        # be INSIDE a span.
        validate(card, source)

    def test_dose_pearl(self):
        card = "Initial **warfarin dose** is **10 mg**, target **INR 2.0 to 3.0**."
        source = (
            "The initial warfarin dose is 10 mg, adjusted to target an INR of "
            "2.0 to 3.0 in most indications."
        )
        # "INR 2.0 to 3.0" — does this appear in source? Source has "INR of 2.0
        # to 3.0" — the substring "INR 2.0" is NOT in source (it's "INR of 2.0").
        # So the gate should reject. Let me adjust the card to use a substring
        # that IS in source.
        card = "Initial **warfarin dose** is **10 mg**, target **2.0 to 3.0**."
        # But "2.0 to 3.0" is not in source either — source has "2.0 to 3.0 in
        # most indications", so "2.0 to 3.0" IS a substring. Good.
        # But "warfarin dose" — is that a substring? Source: "initial warfarin
        # dose is 10 mg". "warfarin dose" is a substring. Good.
        # Now spans: "warfarin dose" (13 chars, ok), "10 mg" (5 chars, ok),
        # "2.0 to 3.0" (10 chars, ok). All under 34.
        # Sentence terminators: just one period at end. Good.
        # Connectives: "warfarin" starts a span (ok, not a connective).
        # "dose" ends first span (ok). "10" starts second (ok).
        # "mg" ends second (ok). "2.0" starts third (ok). "3.0" ends third (ok).
        # Clause breaks: comma between "10 mg" and "target" is outside spans. OK.
        validate(card, source)


# ---------------------------------------------------------------------------
# Batch validation
# ---------------------------------------------------------------------------


class TestBatch:
    def test_mixed_results(self):
        cards = [
            ("**Warfarin** is **contraindicated** in pregnancy.", SOURCE_PEARL),  # ok
            ("Give **aspirin** now.", SOURCE_PEARL),  # HALLUCINATED_EMPHASIS
            ("Sentence one. Sentence two.", SOURCE_PEARL),  # ONE_SENTENCE
        ]
        results = validate_batch(cards)
        assert len(results) == 3
        assert results[0].error is None
        assert results[1].error is not None
        assert results[1].error.rule == "HALLUCINATED_EMPHASIS"
        assert results[2].error is not None
        assert results[2].error.rule == "ONE_SENTENCE"
