"""Shopify Exchange scraper: $250K+ revenue listings."""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

SOURCE = "shopify_exchange"
SEARCH_URL = "https://exchange.shopify.com/businesses-for-sale?revenue_min=250000"


def _mock_listings() -> list[dict[str, Any]]:
    return [
        {
            "store_name": "Outdoor Gear Collective",
            "asking_price": 580_000,
            "monthly_revenue": 42_000,
            "monthly_sessions": 88_000,
            "business_age": 5,
            "niche": "Outdoor & Sports",
            "listing_url": "https://exchange.shopify.com/listings/outdoor-gear-collective",
        },
        {
            "store_name": "Eco Home Essentials",
            "asking_price": 1_100_000,
            "monthly_revenue": 71_000,
            "monthly_sessions": 134_000,
            "business_age": 4,
            "niche": "Home & Garden",
            "listing_url": "https://exchange.shopify.com/listings/eco-home-essentials",
        },
    ]


def _extract_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "listings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "store_name": {"type": "string"},
                        "asking_price": {"type": "number"},
                        "monthly_revenue": {"type": "number"},
                        "monthly_sessions": {"type": "number"},
                        "business_age": {"type": "number"},
                        "niche": {"type": "string"},
                        "listing_url": {"type": "string"},
                    },
                },
            }
        },
    }


def _firecrawl_scrape(api_key: str) -> list[dict[str, Any]]:
    try:
        from firecrawl import FirecrawlApp  # type: ignore
    except ImportError:
        log.warning("firecrawl-py not installed; shopify_exchange returning empty result")
        return []

    try:
        app = FirecrawlApp(api_key=api_key)
        result = app.scrape_url(
            SEARCH_URL,
            params={"formats": ["extract"], "extract": {"schema": _extract_schema()}},
        )
        data = result.get("extract", {}) if isinstance(result, dict) else {}
        listings = data.get("listings", []) if isinstance(data, dict) else []
        return [item for item in listings if isinstance(item, dict)]
    except Exception as exc:  # noqa: BLE001
        log.exception("shopify_exchange firecrawl scrape failed: %s", exc)
        return []


def scrape(force_mock: bool = False) -> list[dict[str, Any]]:
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if force_mock or not api_key:
        if not api_key and not force_mock:
            log.warning("FIRECRAWL_API_KEY not set; shopify_exchange returning mock data")
        listings = _mock_listings()
    else:
        listings = _firecrawl_scrape(api_key)
        if not listings:
            log.warning("shopify_exchange live scrape returned no rows; falling back to mock")
            listings = _mock_listings()

    for item in listings:
        item["source"] = SOURCE
    return listings


async def scrape_async(force_mock: bool = False) -> list[dict[str, Any]]:
    import asyncio

    return await asyncio.to_thread(scrape, force_mock)
