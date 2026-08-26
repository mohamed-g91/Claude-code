"""
rewriter.py — LLM calls: source pearl -> card, and Pass B clinical judging.

Two responsibilities:

1. rewrite_card(source_pearl) -> Card
   One LLM call. The system prompt encodes the six structural rules; the
   structural gate (gate.py) re-validates whatever comes back — we never
   trust the model.

2. judge_clinical(card_visible, source_pearl) -> list[ClinicalFlag]
   Pass B. A separate LLM call looking for dropped qualifiers, dose drift,
   inverted meaning, and ambiguous fact-picks. Soft flags only: they tag the
   preview with [REVIEW] and never block a render.

Both calls go through one OpenAI-compatible chat-completions endpoint,
configurable via env (REWRITE_API_BASE / REWRITE_API_KEY / REWRITE_MODEL),
defaulting to OpenRouter.

Content policy: cards must use the source pearl's own words where possible.
The rewriter reformats; it never regenerates clinical content.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_API_BASE = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "google/gemini-2.0-flash-001"


def _api_base() -> str:
    return os.environ.get("REWRITE_API_BASE", DEFAULT_API_BASE).rstrip("/")


def _api_key() -> str:
    return os.environ.get("REWRITE_API_KEY", "") or os.environ.get("NOTION_TOKEN", "") or ""


def _model() -> str:
    return os.environ.get("REWRITE_MODEL", DEFAULT_MODEL)


class RewriterError(RuntimeError):
    """Raised when the LLM call fails or returns unparseable output."""


# ---------------------------------------------------------------------------
# Card model
# ---------------------------------------------------------------------------


@dataclass
class Card:
    """One infographic card. `text` carries **emphasis** spans inline."""

    pearl_id: str
    text: str            # card with ** markers
    visible: str = ""    # filled by gate.validate
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"pearl_id": self.pearl_id, "text": self.text, "visible": self.visible, "flags": list(self.flags)}


@dataclass(frozen=True)
class ClinicalFlag:
    rule: str      # QUALIFIER_DROPPED | DOSE_DRIFT | INVERTED_MEANING | FACT_PICK_UNCLEAR
    reason: str


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

REWRITE_SYSTEM_PROMPT = """\
You convert MRCP study pearls into single-sentence infographic cards.

Rules (violating any makes the card invalid):
1. Exactly one sentence, ending in a single period.
2. At most 118 characters of visible text (excluding ** markers).
3. Wrap up to 5 key terms in **double asterisks** for emphasis.
4. Each emphasized span at most 34 characters.
5. A span must not:
   - begin or end on a connective word (the, a, an, and, or, but, of, in, to,
     for, with, on, at, by, is, are, was, were, be, been, being)
   - cross any punctuation clause break ( , ; : — – ( ) )
   - separate a number from its unit ("10 mg" cannot be split across a span)
6. Every emphasized term must appear verbatim (case-insensitive) in the
   source pearl. Never emphasize a word that is not in the source.
7. Use the source pearl's own words wherever possible. You are reformatting,
   not rewriting medicine. Do not drop qualifiers like "not", "avoid",
   "contraindicated", "rarely", "most". Do not change any number or unit.

Respond with ONLY a JSON object, no markdown fence, in this shape:
{"card": "one sentence with **emphasis** spans inside."}
"""

JUDGE_SYSTEM_PROMPT = """\
You are a clinical safety judge for medical infographic cards.

Compare CARD against its SOURCE pearl. Flag problems; do not fix them.

Flags:
- QUALIFIER_DROPPED: source contains "not"/"avoid"/"contraindicated"/"never"
  /"rarely" (or similar negations/qualifiers) whose meaning is absent or
  weakened in the card.
- DOSE_DRIFT: any number or unit in the card differs from the source
  (10x off, changed unit, changed threshold).
- INVERTED_MEANING: the card's clinical claim is the opposite of the source's.
- FACT_PICK_UNCLEAR: the source states multiple distinct facts and the card's
  emphasis does not make clear which fact it is presenting.

If the card is faithful, return no flags.

Respond with ONLY a JSON object, no markdown fence:
{"flags": [{"rule": "...", "reason": "..."}]}
"""


# ---------------------------------------------------------------------------
# HTTP plumbing
# ---------------------------------------------------------------------------


def _chat(system: str, user: str, timeout: float = 60.0) -> str:
    """One chat completion. Returns assistant content as plain text."""
    try:
        import httpx
    except ImportError as e:
        raise RewriterError(f"httpx not installed: {e}") from e

    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0,
    }
    resp = httpx.post(f"{_api_base()}/chat/completions", headers=headers, json=payload, timeout=timeout)
    if resp.status_code != 200:
        raise RewriterError(f"rewrite API returned {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as e:
        raise RewriterError(f"unexpected rewrite API response shape: {e}\n{resp.text[:300]}") from e


def _parse_json_loose(text: str) -> dict:
    """Extract the first JSON object from a response that may carry prose."""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise RewriterError(f"no JSON object found in response: {text[:300]}")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise RewriterError(f"invalid JSON in response: {e}\n{text[:300]}") from e


# ---------------------------------------------------------------------------
# Rewrite + retry-once-with-error contract
# ---------------------------------------------------------------------------


def rewrite_card(pearl_id: str, source_pearl: str) -> Card:
    """Call the LLM once. Returns the raw Card (unvalidated).

    Validation and the one retry belong to the caller (`plan` pipeline), so the
    gate stays the sole authority on what counts as valid.
    """
    content = _chat(REWRITE_SYSTEM_PROMPT, f"SOURCE PEARL:\n{source_pearl}")
    data = _parse_json_loose(content)
    card_text = data.get("card")
    if not isinstance(card_text, str) or not card_text.strip():
        raise RewriterError("response JSON missing non-empty 'card' string")
    return Card(pearl_id=pearl_id, text=card_text.strip())


def rewrite_card_with_retry(
    pearl_id: str, source_pearl: str, validate_fn, max_attempts: int = 2
) -> tuple[Card | None, Exception | None]:
    """Rewrite, validate, and retry exactly once with the error appended.

    validate_fn(card_text) should raise StructuralError on failure and return
    (visible, spans) on success. Returns (card, None) on success or
    (None, last_error) after exhausting attempts.
    """
    error_note = ""
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        prompt = f"SOURCE PEARL:\n{source_pearl}"
        if error_note:
            prompt += (
                f"\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED:\n{error_note}"
                "\nFix this specific violation and return the corrected JSON."
            )
        try:
            content = _chat(REWRITE_SYSTEM_PROMPT, prompt)
            data = _parse_json_loose(content)
            card_text = data["card"].strip()
            visible, spans = validate_fn(card_text)
        except Exception as e:  # noqa: BLE001 — retry contract needs broad catch
            last_error = e
            error_note = getattr(e, "reason", None) or str(e)
            continue
        return Card(pearl_id=pearl_id, text=card_text, visible=visible), None
    return None, last_error


# ---------------------------------------------------------------------------
# Pass B — clinical judge (soft flags only)
# ---------------------------------------------------------------------------


def judge_clinical(card_visible: str, source_pearl: str) -> list[ClinicalFlag]:
    """LLM-as-judge. Never raises on flagged content — only on transport errors."""
    content = _chat(JUDGE_SYSTEM_PROMPT, f"SOURCE PEARL:\n{source_pearl}\n\nCARD:\n{card_visible}")
    data = _parse_json_loose(content)
    known = {"QUALIFIER_DROPPED", "DOSE_DRIFT", "INVERTED_MEANING", "FACT_PICK_UNCLEAR"}
    flags: list[ClinicalFlag] = []
    for item in data.get("flags", []):
        rule = item.get("rule", "")
        if rule in known:
            flags.append(ClinicalFlag(rule=rule, reason=str(item.get("reason", ""))[:200]))
    return flags
