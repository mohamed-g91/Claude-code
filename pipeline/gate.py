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

Card text carries its own emphasis as **spans**. Emphasis has to mark the thing
worth remembering - the threshold, the dose, the drug - which is why a span is
capped in length and has to contain something examinable. Bolding a fixed-size
opening chunk is the failure mode this replaced, and it is what the length cap
and the substance test between them rule out.
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
    "may", "can", "does", "do", "has", "have", "up", "out", "off", "yes",
}

# Long words that are still not "substance" - a span made only of these is
# marking sentence furniture, not a fact.
FURNITURE = {
    "after", "before", "within", "still", "which", "needed", "using", "every",
    "other", "these", "those", "first", "second", "third", "because", "while",
    "under", "about", "their", "there", "where", "should", "would", "could",
}

MAX_TOTAL = 118          # characters of visible card text
MAX_SPAN = 34            # one emphasis span
MAX_SPANS = 5

EMPH = re.compile(r"\*\*(.+?)\*\*", re.S)


def strip_emphasis(text):
    return EMPH.sub(r"\1", text or "")


def spans(text):
    return EMPH.findall(text or "")


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


CLAUSE_BREAK = re.compile(r"[—–;:]|\s-\s")


def _edge_glue(span):
    """A span that starts or ends on a connective is a chunk, not a mark."""
    words = re.findall(r"[A-Za-z]+", span)
    if not words:
        return None
    for w, end in ((words[0], "starts"), (words[-1], "ends")):
        if w.lower() in GLUE:
            return f"{end} on {w!r}"
    return None


def _is_substantive(span):
    """Does this emphasis span actually mark something a reader should remember?"""
    if any(c.isdigit() for c in span):
        return True
    if re.search(r"[<>≥≤]", span):
        return True
    if re.search(r"[A-Z]{2,}", span):                 # ARB, QRS, LMWH, CYP2C19
        return True
    return any(len(w) >= 6 and w.lower() not in FURNITURE
               for w in re.findall(r"[A-Za-z]+", span))


def check(text, source, topic=""):
    """Return a list of problems. Empty list means the card is safe to render."""
    problems = []
    visible = strip_emphasis(text)
    src = normalise(source) + " " + normalise(topic)

    for tok in _tokens(visible):
        if tok not in src:
            kind = "number/unit" if any(c.isdigit() for c in tok) else "term"
            problems.append(f"{kind} not in source pearl: {tok!r}")

    for op, num in _comparisons(visible) - _comparisons(source):
        problems.append(f"threshold not in source pearl: {op} {num}")

    if not visible.strip():
        problems.append("empty card")
    if len(visible) > MAX_TOTAL:
        problems.append(f"card {len(visible)} chars, max {MAX_TOTAL}")

    marks = spans(text)
    if not marks:
        problems.append("no emphasis: mark the threshold, dose or drug with **…**")
    if len(marks) > MAX_SPANS:
        problems.append(f"{len(marks)} emphasis spans, max {MAX_SPANS}")
    for m in EMPH.finditer(text or ""):
        span = m.group(1)
        if len(span) > MAX_SPAN:
            problems.append(f"emphasis span {len(span)} chars, max {MAX_SPAN}: {span!r}")
        elif CLAUSE_BREAK.search(span):
            # Emphasis marks one fact. A span crossing a clause break is a chunk
            # of text that happened to be that long - the failure this replaced.
            problems.append(f"emphasis spans a clause break: {span!r}")
        elif not _is_substantive(span):
            problems.append(f"emphasis marks nothing examinable: {span!r}")
        else:
            edge = _edge_glue(span)
            if edge:
                problems.append(f"emphasis {edge}: {span!r}")
        # "20** mg" - the number is emphasised and its unit is not.
        tail = (text or "")[m.end():]
        if span.rstrip().endswith(tuple("0123456789")) and re.match(r"\s+[a-z]", tail):
            problems.append(f"emphasis splits a number from its unit: {span!r}")
    if "**" in EMPH.sub("", text or ""):
        problems.append("unclosed ** in card text")
    return problems
