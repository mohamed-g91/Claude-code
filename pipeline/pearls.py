"""Turn a Cardio V3 row into something a card can be built from.

The pearl HTML is not consistent between rows: some carry "Topic:" and
"The Pearl" scaffolding, some do not; bullets appear as <ul><li> in some rows
and as "- " inside <p> in others; several rows contain malformed markup such as
"<p /></p>" or a <p> nested inside a <p>. Anything here that looks defensive is
defending against a row that actually exists in the database.
"""
import html
import re
import unicodedata

# Scaffolding the drip's authoring step adds. It is navigation, not content.
_SCAFFOLD = [
    re.compile(r"^\s*Topic\s*:.*$", re.I | re.M),      # "Topic: Cardiology, Adrenaline"
    re.compile(r"^\s*[\U0001F400-\U0001FAFF☀-➿]*\s*The Pearl\s*$", re.I | re.M),
    re.compile(r"#MRCP\b.*$", re.I | re.M),            # trailing hashtags
]
_BULLET = re.compile(r"^\s*[-–•⁃]\s+")


def _normalise(s):
    """Fold the typographic variation that makes two identical facts compare unequal."""
    s = unicodedata.normalize("NFKC", s)
    for dash in "‐‑‒–—―":   # non-breaking and en/em dashes
        s = s.replace(dash, "-")
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace(" ", " ")
    return s


def parse_topic(topic_field):
    """Topic is a comma list: specialty first, then this pearl's topic, then the next.

    Element 2 is the pearl's own topic - verified against the "Topic:" line inside
    the pearl body across the posted rows. Falls back to element 1 for older rows
    that only carry the specialty.
    """
    parts = [p.strip() for p in (topic_field or "").split(",") if p.strip()]
    if not parts:
        return ""
    # "Adenosine diphosphate (ADP) receptor inhibitors" contains no comma, but a
    # topic containing one would split wrongly; nothing in the bank does today.
    topic = parts[1] if len(parts) > 1 else parts[0]
    return shorten_topic(topic)


def shorten_topic(topic, limit=34):
    """Card topics are set in wide letter-spaced caps, so long ones crowd the row.

    A topic that spells out an abbreviation carries its own short form:
    "Adenosine diphosphate (ADP) receptor inhibitors" -> "ADP receptor inhibitors".
    """
    if len(topic) <= limit:
        return topic
    m = re.search(r"\(([A-Za-z0-9]{2,6})\)", topic)
    if m:
        short = m.group(1) + topic[m.end():]
        if len(short.strip()) <= limit:
            return short.strip()
    return topic


def parse_pearl(pearl_html):
    """Return {"text": plain text, "facts": [str]} for one pearl.

    A "fact" is one bullet or one sentence-level block - the unit a card can be
    built from. Bold runs are kept separately because the lead of a card is
    almost always the first bolded claim.
    """
    s = _normalise(pearl_html or "")
    bolds = [html.unescape(re.sub(r"<[^>]+>", "", m)).strip()
             for m in re.findall(r"<b\b[^>]*>(.*?)</b>", s, re.S | re.I)]
    # Block-level tags become newlines so bullets and paragraphs stay separate.
    s = re.sub(r"<\s*(br|/p|/li|/ul|/ol|/div|/h[1-6])\s*/?\s*>", "\n", s, flags=re.I)
    s = re.sub(r"<\s*(p|li|div|h[1-6])\b[^>]*>", "\n", s, flags=re.I)
    # Only strip things that look like real tags. The unbounded "<[^>]+>" swallows
    # a literal threshold like "<55%" inside a <b> run as if it were a tag start,
    # deleting the number up to the next ">" (the bold's own closing tag).
    s = re.sub(r"</?[a-zA-Z][^<>]*>", "", s)
    s = html.unescape(s)

    for pat in _SCAFFOLD:
        s = pat.sub("", s)
    # The bare lightbulb marker, and any line that is only an emoji.
    lines = []
    for raw in s.split("\n"):
        line = _BULLET.sub("", raw.strip())
        if not line:
            continue
        if not re.search(r"[A-Za-z0-9]", line):     # emoji-only separator lines
            continue
        lines.append(re.sub(r"\s+", " ", line))

    bolds = [b for b in (re.sub(r"\s+", " ", b) for b in bolds)
             if b and re.search(r"[A-Za-z0-9]", b)
             and not re.match(r"^\s*Topic\s*:", b, re.I)
             and "The Pearl" not in b]
    return {"text": " ".join(lines), "facts": lines, "bolds": bolds}
