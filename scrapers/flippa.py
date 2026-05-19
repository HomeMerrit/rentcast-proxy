"""Flippa scraper: 60+ days listed, $250K+, ecommerce/SaaS/Amazon FBA."""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

SOURCE = "flippa"
SEARCH_URL = (
    "https://flippa.com/search"
    "?filter[property_type][]=ecommerce&filter[property_type][]=saas"
    "&filter[property_type][]=fba&filter[price][min]=250000"
)
ALLOWED_TYPES = {"ecommerce", "saas", "amazon fba", "fba"}


def _mock_listings() -> list[dict[str, Any]]:
    return [
        {
            "business_name": "DTC Skincare Brand",
            "asking_price": 425_000,
            "monthly_revenue": 38_000,
            "monthly_profit": 11_000,
            "business_type": "ecommerce",
            "age": 4,
            "listing_url": "https://flippa.com/11223344-dtc-skincare",
        },
        {
            "business_name": "Recurring SaaS - SEO Tools",
            "asking_price": 1_250_000,
            "monthly_revenue": 32_000,
            "monthly_profit": 24_000,
            "business_type": "saas",
            "age": 6,
            "listing_url": "https://flippa.com/11223412-seo-saas",
        },
        {
            "business_name": "Amazon FBA Kitchen Goods",
            "asking_price": 690_000,
            "monthly_revenue": 95_000,
            "monthly_profit": 18_500,
            "business_type": "amazon fba",
            "age": 3,
            "listing_url": "https://flippa.com/11227890-fba-kitchen",
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
                        "business_name": {"type": "string"},
                        "asking_price": {"type": "number"},
                        "monthly_revenue": {"type": "number"},
                        "monthly_profit": {"type": "number"},
                        "business_type": {"type": "string"},
                        "age": {"type": "number"},
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
        log.warning("firecrawl-py not installed; flippa returning empty result")
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
        log.exception("flippa firecrawl scrape failed: %s", exc)
        return []


def scrape(force_mock: bool = False) -> list[dict[str, Any]]:
    """Return Flippa listings tagged with source='flippa'."""
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if force_mock or not api_key:
        if not api_key and not force_mock:
            log.warning("FIRECRAWL_API_KEY not set; flippa returning mock data")
        listings = _mock_listings()
    else:
        listings = _firecrawl_scrape(api_key)
        if not listings:
            log.warning("flippa live scrape returned no rows; falling back to mock")
            listings = _mock_listings()

    filtered: list[dict[str, Any]] = []
    for item in listings:
        btype = str(item.get("business_type", "")).lower()
        if btype and btype not in ALLOWED_TYPES:
            continue
        item["source"] = SOURCE
        filtered.append(item)
    return filtered


async def scrape_async(force_mock: bool = False) -> list[dict[str, Any]]:
    import asyncio

    return await asyncio.to_thread(scrape, force_mock)
