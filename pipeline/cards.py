"""Propose a card for a pearl, and refuse to emit one that fails the gate.

Most pearls in the bank are multi-fact teaching blocks - "three P2Y12
inhibitors, three features" - and no rule turns those into one line without
choosing which fact to keep. So this proposes mechanically where it can, and
reports what it could not do rather than inventing something. Whoever fills the
gap, model or human, goes through gate.check() exactly like this does.
"""
import re

import gate
from pearls import parse_pearl, parse_topic

_NUMERIC = re.compile(r"[0-9]|>=|<=|[><≥≤]")
# Sentence-level split point: an em-dash clause break, a colon, or a semicolon.
_CLAUSE = re.compile(r"\s+[-–—]\s+|:\s+|;\s+")


def _trim(s, limit):
    """Cut to `limit` on a word boundary, without leaving dangling punctuation."""
    s = s.strip()
    if len(s) <= limit:
        return s
    cut = s[:limit + 1]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > limit * 0.6 else cut[:limit]).rstrip(" ,;:-—–")


def _best_fact(parsed):
    """The fact a card should be built from: prefer one carrying a threshold."""
    facts = [f for f in parsed["facts"] if len(f) > 25]
    if not facts:
        facts = parsed["facts"]
    if not facts:
        return ""
    numeric = [f for f in facts if _NUMERIC.search(f)]
    return (numeric or facts)[0]


def propose(row):
    """Return (card, problems). `card` is always shaped; problems empty = usable."""
    parsed = parse_pearl(row["pearl"])
    topic = parse_topic(row["topic"])
    fact = _best_fact(parsed)

    # The lead is the pearl's first bolded claim when that claim is in this fact,
    # otherwise the fact's opening clause.
    lead = ""
    for b in parsed["bolds"]:
        if b.lower() in fact.lower() and len(b) <= gate.MAX_LEAD:
            lead = b
            break
    if not lead:
        lead = _trim(_CLAUSE.split(fact)[0], gate.MAX_LEAD)

    rest = fact
    idx = rest.lower().find(lead.lower())
    if idx >= 0:
        rest = rest[idx + len(lead):]
    rest = _trim(rest.lstrip(" -–—:;,"), gate.MAX_REST)

    card = {"topic": topic, "lead": lead.rstrip(" .,;:"), "rest": rest,
            "src": row.get("src", ""), "id": row["id"], "post_date": row["post_date"]}
    problems = gate.check(card["lead"], card["rest"], parsed["text"], topic)
    return card, problems


def verify(card, row):
    """Re-check a card that was written or edited by hand, against its own pearl."""
    parsed = parse_pearl(row["pearl"])
    return gate.check(card["lead"], card["rest"], parsed["text"], parse_topic(row["topic"]))
