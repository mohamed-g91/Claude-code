"""Propose a card for a pearl, and refuse to emit one that fails the gate.

Most pearls in the bank are multi-fact teaching blocks - "three P2Y12
inhibitors, three features" - and no rule turns those into one line without
choosing which fact to keep. So this proposes mechanically where it can, and
reports what it could not do rather than inventing something. Whoever fills the
gap, model or human, goes through gate.check() exactly like this does.

Emphasis is placed by looking at what the sentence says, not by counting into
it: the thresholds and doses it contains, plus whatever the source pearl itself
bolded. An earlier version emphasised the first 48 characters, which made every
card's bold run the same width whatever the card said.
"""
import re

import gate
from pearls import parse_pearl, parse_topic

_NUMERIC = re.compile(r"[0-9]|>=|<=|[><≥≤]")
_CLAUSE = re.compile(r"\s+[-–—]\s+|:\s+|;\s+")

_UNIT = (r"(?:mg|mcg|g|kg|ml|l|mmhg|ms|%|mmol/l|ng/l|iu|units?|wood\s+units?"
         r"|minutes?|mins?|hours?|days?|weeks?|months?|years?|shocks?)")
# A threshold or dose: an optional comparison, a number, and any unit that
# belongs to it. The unit is part of the fact - emphasising "20" and leaving
# "mmHg" outside the bold is exactly the split the gate rejects.
# The lookbehind keeps digits that are part of a name out of it: P2Y12 and
# CYP2C19 are words, not doses, and marking the "2" in P2Y12 is nonsense.
_MEASURE = re.compile(rf"(?<![A-Za-z0-9])(?:[<>≥≤]=?\s*)?\d[\d.,:/–-]*\s*{_UNIT}?", re.I)
_LABEL = re.compile(r"([A-Z]{2,}|[A-Za-z]{5,})\s*$")


def _trim(s, limit):
    """Cut to `limit` on a word boundary, without leaving dangling punctuation.

    Returns (text, truncated). The flag matters: trimming strips the trailing
    punctuation, so a cut sentence reads as a finished one, and every word it
    still contains is genuinely in the source - so the gate passes it. Losing a
    trailing "is contraindicated" that way would ship a card that inverts the
    pearl. A truncated card is therefore never proposed as clean.
    """
    s = s.strip()
    if len(s) <= limit:
        return s, False
    cut = s[:limit + 1]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > limit * 0.6 else cut[:limit]).rstrip(" ,;:-—–"), True


def _is_lead_in(fact):
    """A colon-terminated line introduces a list; it states nothing itself.

    "Amiodarone toxicity - organ by organ:" passes every gate check - each word
    is in the source, it carries emphasis, it is under the length cap - and
    tells the reader nothing. The facts it introduces are the content.
    """
    return fact.rstrip().endswith(":")


def _best_fact(parsed):
    """The fact a card should be built from: prefer one carrying a threshold."""
    facts = [f for f in parsed["facts"] if len(f) > 25 and not _is_lead_in(f)]
    if not facts:
        facts = [f for f in parsed["facts"] if len(f) > 25]
    if not facts:
        facts = parsed["facts"]
    if not facts:
        return ""
    numeric = [f for f in facts if _NUMERIC.search(f)]
    return (numeric or facts)[0]


def _measure_spans(text):
    """Every threshold or dose, extended left over the term it qualifies."""
    out = []
    for m in _MEASURE.finditer(text):
        start, end = m.start(), m.end()
        while end > start and text[end - 1] in " ,;:":
            end -= 1
        label = _LABEL.search(text[:start])
        if label and (end - label.start(1)) <= gate.MAX_SPAN:
            start = label.start(1)
        if end - start <= gate.MAX_SPAN and not gate.CLAUSE_BREAK.search(text[start:end]):
            out.append((start, end))
    return out


def _bold_spans(text, bolds):
    """Whatever the pearl's own author chose to bold, where it survives into the card."""
    out = []
    for b in bolds:
        if not (2 <= len(b) <= gate.MAX_SPAN) or gate.CLAUSE_BREAK.search(b):
            continue
        i = text.lower().find(b.lower())
        if i >= 0:
            out.append((i, i + len(b)))
    return out


def _mark(text, spans):
    """Insert ** around the chosen spans, dropping any that overlap an earlier one."""
    chosen = []
    for start, end in sorted(spans, key=lambda s: (s[0], -(s[1] - s[0]))):
        if any(start < c_end and end > c_start for c_start, c_end in chosen):
            continue
        piece = text[start:end]
        if not gate._is_substantive(piece) or gate._edge_glue(piece):
            continue
        chosen.append((start, end))
        if len(chosen) == gate.MAX_SPANS:
            break
    for start, end in sorted(chosen, reverse=True):
        text = text[:start] + "**" + text[start:end] + "**" + text[end:]
    return text


def propose(row):
    """Return (card, problems). `card` is always shaped; problems empty = usable."""
    parsed = parse_pearl(row["pearl"])
    topic = parse_topic(row["topic"])
    fact, truncated = _trim(_best_fact(parsed), gate.MAX_TOTAL)
    text = _mark(fact, _measure_spans(fact) + _bold_spans(fact, parsed["bolds"]))

    card = {"topic": topic, "text": text, "src": row.get("src", ""),
            "id": row["id"], "post_date": row["post_date"]}
    problems = gate.check(text, parsed["text"], topic)
    if truncated:
        problems.append(
            "the source fact was cut to fit; rewrite it as a whole sentence")
    if _is_lead_in(fact):
        problems.append(
            "this only introduces a list; build the card from one of its items")
    return card, problems


def verify(card, row):
    """Re-check a card that was written or edited by hand, against its own pearl."""
    parsed = parse_pearl(row["pearl"])
    text = card.get("text")
    if text is None:                       # legacy lead/rest cards
        text = f"**{card.get('lead', '')}** {card.get('rest', '')}".strip()
    return gate.check(text, parsed["text"], parse_topic(row["topic"]))
