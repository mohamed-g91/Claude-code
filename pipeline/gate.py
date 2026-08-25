"""Verify a card against the pearl it came from.

The failure this exists to prevent is real: an image generator asked to typeset
these pearls silently replaced atorvastatin with nabumetone - a statin with an
NSAID - and corrupted a guideline code, while looking entirely plausible. Any
step that rewrites clinical text has to be checked by something that does not
rewrite.

The rule is deliberately strict: a card is an EXTRACT, not a paraphrase. Every
word of substance in the card must already appear in the source pearl. Only a
small set of connectives may be introduced to join fragments. A card that fails
is not repaired automatically - it is dropped, or rewritten using the source's
own words and checked again.
"""
import re
import unicodedata

# Words that may be introduced to join extracted fragments. Function words and
# common clinical verbs only - nothing that could name a drug, dose or disease.
GLUE = {
    "a", "an", "and", "or", "the", "of", "in", "on", "at", "to", "for", "with",
    "if", "is", "are", "was", "were", "be", "not", "no", "but", "than", "then",
    "when", "while", "unless", "after", "before", "from", "into", "over",
    "under", "within", "per", "by", "as", "its", "it", "this", "that", "these",
    "those", "any", "all", "both", "each", "give", "given", "use", "used",
    "start", "stop", "add", "offer", "check", "needs", "need", "means", "must",
    "may", "can", "does", "do", "has", "have", "up", "out", "off", "no", "yes",
}

MAX_LEAD, MAX_REST, MAX_TOTAL = 48, 96, 118


def normalise(s):
    s = unicodedata.normalize("NFKC", s or "")
    for dash in "‐‑‒–—―":
        s = s.replace(dash, "-")
    s = s.replace("’", "'").replace("≥", ">=").replace("≤", "<=")
    return re.sub(r"\s+", " ", s).strip().lower()


def _tokens(s):
    """Words of substance: anything with a digit, or an alphabetic word >= 4 chars."""
    out = []
    for tok in re.findall(r"[a-z0-9][a-z0-9''\-/.,%:]*", normalise(s)):
        tok = tok.strip(".,;:")
        if not tok:
            continue
        if any(c.isdigit() for c in tok):
            out.append(tok)
        elif len(tok) >= 4 and tok not in GLUE:
            out.append(tok)
    return out


def _comparisons(s):
    """(operator, number) pairs - the part of a threshold that inverts its meaning."""
    return set(re.findall(r"(>=|<=|>|<)\s*([0-9][0-9.,:/]*)", normalise(s)))


def check(lead, rest, source, topic=""):
    """Return a list of problems. Empty list means the card is safe to render."""
    problems = []
    card = f"{lead} {rest}"
    src = normalise(source) + " " + normalise(topic)

    for tok in _tokens(card):
        if tok not in src:
            kind = "number/unit" if any(c.isdigit() for c in tok) else "term"
            problems.append(f"{kind} not in source pearl: {tok!r}")

    for op, num in _comparisons(card) - _comparisons(source):
        problems.append(f"threshold not in source pearl: {op} {num}")

    if len(lead) > MAX_LEAD:
        problems.append(f"lead {len(lead)} chars, max {MAX_LEAD}")
    if len(rest) > MAX_REST:
        problems.append(f"rest {len(rest)} chars, max {MAX_REST}")
    if len(card) > MAX_TOTAL:
        problems.append(f"card {len(card)} chars, max {MAX_TOTAL}")
    if not lead.strip():
        problems.append("empty lead")
    return problems
