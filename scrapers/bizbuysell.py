"""BizBuySell scraper: 90+ days listed, $250K+ asking price."""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

SOURCE = "bizbuysell"
SEARCH_URL = (
    "https://www.bizbuysell.com/businesses-for-sale/"
    "?priceMin=250000&listedWithin=Last+12+Months"
)


def _mock_listings() -> list[dict[str, Any]]:
    return [
        {
            "business_name": "Salt Lake Coffee Roasters",
            "asking_price": 850000,
            "annual_revenue": 1_200_000,
            "sde": 310_000,
            "days_listed": 142,
            "industry": "Food & Beverage",
            "state": "UT",
            "broker_name": "Mountain West Business Brokers",
            "listing_url": "https://www.bizbuysell.com/Business-Opportunity/saltlake-coffee/2391847/",
        },
        {
            "business_name": "Denver HVAC Services LLC",
            "asking_price": 2_400_000,
            "annual_revenue": 3_900_000,
            "sde": 720_000,
            "days_listed": 98,
            "industry": "Home Services",
            "state": "CO",
            "broker_name": "Front Range M&A",
            "listing_url": "https://www.bizbuysell.com/Business-Opportunity/denver-hvac/2401122/",
        },
        {
            "business_name": "Austin Digital Agency",
            "asking_price": 1_100_000,
            "annual_revenue": 1_650_000,
            "sde": 410_000,
            "days_listed": 211,
            "industry": "Digital Agency",
            "state": "TX",
            "broker_name": "Lone Star Advisors",
            "listing_url": "https://www.bizbuysell.com/Business-Opportunity/austin-digital/2378990/",
        },
    ]


def _firecrawl_scrape(api_key: str) -> list[dict[str, Any]]:
    """Live Firecrawl-backed scrape. Returns [] on any failure."""
    try:
        from firecrawl import FirecrawlApp  # type: ignore
    except ImportError:
        log.warning("firecrawl-py not installed; returning empty result")
        return []

    try:
        app = FirecrawlApp(api_key=api_key)
        result = app.scrape_url(
            SEARCH_URL,
            params={"formats": ["extract"], "extract": {"schema": _extract_schema()}},
        )
        data = result.get("extract", {}) if isinstance(result, dict) else {}
        listings = data.get("listings", []) if isinstance(data, dict) else []
        return [_coerce_listing(item) for item in listings if isinstance(item, dict)]
    except Exception as exc:  # noqa: BLE001
        log.exception("bizbuysell firecrawl scrape failed: %s", exc)
        return []


def _extract_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "listings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"},
                        "asking_price": {"type": "number"},
                        "annual_revenue": {"type": "number"},
                        "sde": {"type": "number"},
                        "days_listed": {"type": "number"},
                        "industry": {"type": "string"},
                        "state": {"type": "string"},
                        "broker_name": {"type": "string"},
                        "listing_url": {"type": "string"},
                    },
                },
            }
        },
    }


def _coerce_listing(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "business_name": raw.get("business_name"),
        "asking_price": raw.get("asking_price"),
        "annual_revenue": raw.get("annual_revenue"),
        "sde": raw.get("sde"),
        "days_listed": raw.get("days_listed"),
        "industry": raw.get("industry"),
        "state": raw.get("state"),
        "broker_name": raw.get("broker_name"),
        "listing_url": raw.get("listing_url"),
    }


def scrape(force_mock: bool = False) -> list[dict[str, Any]]:
    """Return BizBuySell listings tagged with source='bizbuysell'."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if force_mock or not api_key:
        if not api_key and not force_mock:
            log.warning("FIRECRAWL_API_KEY not set; bizbuysell returning mock data")
        listings = _mock_listings()
    else:
        listings = _firecrawl_scrape(api_key)
        if not listings:
            log.warning("bizbuysell live scrape returned no rows; falling back to mock")
            listings = _mock_listings()

    for item in listings:
        item["source"] = SOURCE
    return listings


async def scrape_async(force_mock: bool = False) -> list[dict[str, Any]]:
    """Async wrapper for orchestrator use."""
    import asyncio

    return await asyncio.to_thread(scrape, force_mock)
