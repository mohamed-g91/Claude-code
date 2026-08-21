"""Per-model $/MTok pricing, used to estimate cost for each usage record.

Rates are first-party Anthropic API list prices (USD per million tokens),
current as of 2026-08-21. Update PRICING as new models ship or prices change
-- nothing else in this package needs to change when you do.

Cache tokens are not separately listed by Anthropic per-model; the standard
multipliers on the base input price are applied instead:
  - 5-minute cache write:  1.25x input price
  - 1-hour cache write:    2.00x input price
  - cache read:            0.10x input price
"""

from __future__ import annotations

CACHE_WRITE_5M_MULTIPLIER = 1.25
CACHE_WRITE_1H_MULTIPLIER = 2.00
CACHE_READ_MULTIPLIER = 0.10

# (input $/MTok, output $/MTok)
PRICING: dict[str, tuple[float, float]] = {
    "claude-fable-5": (10.00, 50.00),
    "claude-mythos-5": (10.00, 50.00),
    "claude-opus-5": (5.00, 25.00),
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-opus-4-6": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    # Older / retired models kept for historical transcripts.
    "claude-opus-4-5": (5.00, 25.00),
    "claude-sonnet-4-5": (3.00, 15.00),
    "claude-haiku-4-5-20251001": (1.00, 5.00),
}


def estimate_cost_usd(
    model: str,
    *,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_creation_5m_tokens: int = 0,
    cache_creation_1h_tokens: int = 0,
    cache_read_input_tokens: int = 0,
) -> float | None:
    """Return an estimated USD cost, or None if the model isn't priced.

    Cache-write tokens not attributable to a specific TTL (older transcripts
    that only report a flat cache_creation_input_tokens) are billed at the
    5-minute multiplier, since that's the API default when no TTL is set.
    """
    rates = PRICING.get(model)
    if rates is None:
        return None
    input_rate, output_rate = rates
    per_token_in = input_rate / 1_000_000
    per_token_out = output_rate / 1_000_000

    cost = input_tokens * per_token_in
    cost += output_tokens * per_token_out
    cost += cache_creation_5m_tokens * per_token_in * CACHE_WRITE_5M_MULTIPLIER
    cost += cache_creation_1h_tokens * per_token_in * CACHE_WRITE_1H_MULTIPLIER
    cost += cache_read_input_tokens * per_token_in * CACHE_READ_MULTIPLIER
    return cost
