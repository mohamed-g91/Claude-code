from token_tracker.pricing import estimate_cost_usd


def test_known_model_input_output_only():
    cost = estimate_cost_usd("claude-sonnet-5", input_tokens=1_000_000, output_tokens=1_000_000)
    assert cost == 3.00 + 15.00


def test_cache_multipliers_applied():
    cost = estimate_cost_usd(
        "claude-sonnet-5",
        cache_creation_5m_tokens=1_000_000,
        cache_creation_1h_tokens=1_000_000,
        cache_read_input_tokens=1_000_000,
    )
    # 3.00 * 1.25 (5m write) + 3.00 * 2.00 (1h write) + 3.00 * 0.10 (read)
    assert cost == 3.75 + 6.00 + 0.30


def test_unknown_model_returns_none():
    assert estimate_cost_usd("some-future-model", input_tokens=100) is None


def test_zero_usage_is_zero_cost():
    assert estimate_cost_usd("claude-haiku-4-5") == 0.0
