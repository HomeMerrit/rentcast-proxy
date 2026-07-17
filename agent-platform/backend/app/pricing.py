"""Simple per-model cost estimation.

Prices are USD per 1M tokens as (input, output) tuples. The estimate is a
blended average of input and output rates, applied to total tokens used.
"""

# USD per 1M tokens: model -> (input_per_million, output_per_million)
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "claude-sonnet-5": (3.0, 15.0),
    "claude-opus-4-8": (15.0, 75.0),
    "claude-haiku-4-5-20251001": (0.8, 4.0),
}

# Fallback for unknown models.
DEFAULT_PRICE: tuple[float, float] = (3.0, 15.0)


def cost_for(model: str, tokens: int) -> float:
    """Blended cost estimate for `tokens` total tokens on `model`.

    Uses the average of the input and output per-million rates for simplicity.
    Returns a rounded USD float.
    """
    if not tokens or tokens < 0:
        return 0.0
    in_rate, out_rate = MODEL_PRICES.get(model, DEFAULT_PRICE)
    blended = (in_rate + out_rate) / 2.0
    cost = (tokens / 1_000_000) * blended
    return round(cost, 6)
