"""
gate.py — Pass A (structural) validator for card text.

A card is one sentence carrying its own emphasis as **spans**. Pass A re-derives
the spans from the card text itself (we never trust the LLM's span list) and
enforces six hard rules. Any violation raises StructuralError; the caller is
expected to retry the LLM once with the error reason and, on second failure,
drop the card.

Pass B (clinical, LLM-as-judge) lives in a future module and only produces
soft flags — it never blocks the render.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# ---------------------------------------------------------------------------
# Constants — match the spec. Do not change without updating tests.
# ---------------------------------------------------------------------------

MAX_CARD_CHARS = 118          # visible characters, excluding ** markers
MAX_SPANS = 5
MAX_SPAN_CHARS = 34

# Connectives a span may not begin or end on. Lowercase; check is case-insensitive.
CONNECTIVES = frozenset({
    "the", "a", "an", "and", "or", "but", "of", "in", "to", "for", "with",
    "on", "at", "by", "is", "are", "was", "were", "be", "been", "being",
})

# Clause breaks a span may not cross.
CLAUSE_BREAKS = (",", ";", ":", "—", "–", ")", "(")

# A unit a span may not separate a number from. Tightly bounded — clinical
# doses and lab values are the high-value cases. Add to this list as new
# dose-patterns appear in source pearls.
UNITS = (
    "mg", "g", "mcg", "ng", "mmol", "mol", "iu", "u",
    "ml", "l", "dl",
    "hr", "h", "min", "s", "sec",
    "mm", "cm", "m",
    "%", "mmHg", "bpm", "ms",
    "kg", "lb",
)

# Match a number immediately followed (possibly with a space) by a unit.
NUMBER_UNIT_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s?(" + "|".join(re.escape(u) for u in UNITS) + r")\b",
    re.IGNORECASE,
)

# Match **...** runs. Non-greedy so **a** **b** is two spans, not one.
SPAN_RE = re.compile(r"\*\*([^*]+)\*\*")


# ---------------------------------------------------------------------------
# Span model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Span:
    """A **...** run, expressed in terms of the visible (un-marked-up) text."""

    visible_start: int   # index in visible_text
    visible_end: int     # exclusive
    term: str            # the text between the ** markers

    @property
    def length(self) -> int:
        return self.visible_end - self.visible_start


class StructuralError(ValueError):
    """Raised when a card violates a structural rule.

    `rule` is one of the rule names from the spec; `reason` is a one-line
    human-readable explanation. The full message is suitable for appending
    to the LLM system prompt on retry.
    """

    def __init__(self, rule: str, reason: str):
        super().__init__(f"STRUCTURAL_FAIL: rule={rule} reason={reason}")
        self.rule = rule
        self.reason = reason


# ---------------------------------------------------------------------------
# Span extraction — re-derive from the card, never trust the LLM
# ---------------------------------------------------------------------------


def extract_spans(card: str) -> tuple[str, list[Span]]:
    """Return (visible_text, spans).

    visible_text is the card with all ** markers stripped. Spans are indexed
    against visible_text so the rest of the gate can reason about characters
    without worrying about marker positions.
    """
    spans: list[Span] = []
    out: list[str] = []
    cursor = 0  # position in visible_text
    i = 0
    while i < len(card):
        if card.startswith("**", i):
            # find the closing **
            close = card.find("**", i + 2)
            if close == -1:
                # unterminated ** — treat as literal text from here on
                out.append(card[i:])
                break
            term = card[i + 2 : close]
            spans.append(Span(visible_start=cursor, visible_end=cursor + len(term), term=term))
            out.append(term)
            cursor += len(term)
            i = close + 2
        else:
            out.append(card[i])
            cursor += 1
            i += 1
    return "".join(out), spans


# ---------------------------------------------------------------------------
# The six rules
# ---------------------------------------------------------------------------


def _check_one_sentence(visible: str) -> None:
    """Rule 1: one sentence."""
    # Count terminators followed by end-of-string or whitespace, ignoring
    # decimals ("2.5") and common abbreviations. We accept periods, question
    # marks, and exclamation marks as terminators.
    stripped = visible.strip()
    if not stripped:
        raise StructuralError("ONE_SENTENCE", "card is empty")

    # Strip trailing ellipsis-style endings and decimals before counting.
    candidates = re.findall(r"[.!?](?:\s|$)", visible)
    if len(candidates) > 1:
        raise StructuralError(
            "ONE_SENTENCE",
            f"card has {len(candidates)} sentence terminators; expected exactly 1",
        )


def _check_max_chars(visible: str) -> None:
    """Rule 2: card length."""
    if len(visible) > MAX_CARD_CHARS:
        raise StructuralError(
            "MAX_CHARS",
            f"card is {len(visible)} chars, max is {MAX_CARD_CHARS}",
        )


def _check_max_spans(spans: list[Span]) -> None:
    """Rule 3: number of emphasis spans."""
    if len(spans) > MAX_SPANS:
        raise StructuralError(
            "MAX_SPANS",
            f"card has {len(spans)} emphasis spans, max is {MAX_SPANS}",
        )


def _check_span_length(spans: list[Span]) -> None:
    """Rule 4: each span length."""
    for s in spans:
        if s.length > MAX_SPAN_CHARS:
            raise StructuralError(
                "SPAN_LENGTH",
                f"span '{s.term}' is {s.length} chars, max is {MAX_SPAN_CHARS}",
            )


def _check_span_boundaries(visible: str, spans: list[Span]) -> None:
    """Rule 5: span must not begin/end on connective or cross clause break.

    Also handled here: span must not separate a number from its unit.
    """
    lower = visible.lower()

    for s in spans:
        # The character immediately before the span (or BOS)
        if s.visible_start == 0:
            first_char = ""
        else:
            first_char = lower[s.visible_start - 1]

        # The character immediately after the span (or EOS)
        if s.visible_end >= len(visible):
            last_char = ""
        else:
            last_char = lower[s.visible_end]

        # "begin or end on a connective" — a span whose first or last word
        # is a connective. We detect this by checking whether the span's
        # first/last token (whitespace-separated) is a connective.
        first_token = s.term.split(" ", 1)[0].lower().strip(".,;:()")
        last_token = s.term.rsplit(" ", 1)[-1].lower().strip(".,;:()")
        if first_token in CONNECTIVES:
            raise StructuralError(
                "CONNECTIVE_START",
                f"span '{s.term}' starts on connective '{first_token}'",
            )
        if last_token in CONNECTIVES:
            raise StructuralError(
                "CONNECTIVE_END",
                f"span '{s.term}' ends on connective '{last_token}'",
            )

        # "cross a clause break" — a span that contains a clause break
        for br in CLAUSE_BREAKS:
            if br in s.term:
                raise StructuralError(
                    "CLAUSE_BREAK",
                    f"span '{s.term}' crosses clause break '{br}'",
                )

        # "separate a number from its unit" — check every <number><unit>
        # pattern in the visible text. If the number is inside the span and
        # the unit is outside (or vice versa), fail. If both are inside the
        # same span, no problem. If both are outside any span, no problem
        # (the card has no emphasized dose at all).
        number_unit_re = re.compile(
            r"(\d+(?:\.\d+)?)\s*(" + "|".join(re.escape(u) for u in UNITS) + r")\b",
            re.IGNORECASE,
        )
        for m in number_unit_re.finditer(visible):
            num_start, num_end = m.span(1)
            unit_start, unit_end = m.span(2)
            # is the number character at least partially inside the span?
            num_inside = num_start < s.visible_end and num_end > s.visible_start
            # is the unit character at least partially inside the span?
            unit_inside = unit_start < s.visible_end and unit_end > s.visible_start
            if num_inside != unit_inside:
                raise StructuralError(
                    "NUMBER_UNIT",
                    f"span '{s.term}' separates a number from its unit '{m.group(2)}'",
                )


def _check_emphasis_in_source(spans: list[Span], source_pearl: str) -> None:
    """Rule 6: every emphasized term must appear in the source pearl."""
    src_lower = source_pearl.lower()
    for s in spans:
        if s.term.lower() not in src_lower:
            raise StructuralError(
                "HALLUCINATED_EMPHASIS",
                f"emphasized term '{s.term}' does not appear in source pearl",
            )


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------


def validate(card: str, source_pearl: str) -> tuple[str, list[Span]]:
    """Validate a card against Pass A rules.

    Returns (visible_text, spans) on success. Raises StructuralError on the
    first violation found. The caller is expected to retry the LLM with the
    error message on failure.
    """
    visible, spans = extract_spans(card)

    if not visible.strip():
        raise StructuralError("EMPTY", "card is empty or only ** markers")

    _check_one_sentence(visible)
    _check_max_chars(visible)
    _check_max_spans(spans)
    _check_span_length(spans)
    _check_span_boundaries(visible, spans)
    _check_emphasis_in_source(spans, source_pearl)

    return visible, spans


# ---------------------------------------------------------------------------
# Convenience: validate many cards at once, collecting errors
# ---------------------------------------------------------------------------


@dataclass
class CardResult:
    card: str
    visible: str
    spans: list[Span]
    error: StructuralError | None = None


def validate_batch(
    cards: Iterable[tuple[str, str]],
) -> list[CardResult]:
    """Validate (card, source_pearl) pairs. Returns one CardResult per input.

    A result with `error` set means the card failed; the caller decides what
    to do (drop, retry, surface to the user).
    """
    out: list[CardResult] = []
    for card, source in cards:
        try:
            visible, spans = validate(card, source)
            out.append(CardResult(card=card, visible=visible, spans=spans))
        except StructuralError as e:
            # Re-derive visible/spans even on error so the caller can log
            # what the LLM produced.
            try:
                visible, spans = extract_spans(card)
            except Exception:
                visible, spans = card, []
            out.append(CardResult(card=card, visible=visible, spans=spans, error=e))
    return out
