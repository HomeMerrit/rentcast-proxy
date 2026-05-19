"""Empire Flippers scraper: active marketplace listings."""
from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

SOURCE = "empire_flippers"
SEARCH_URL = "https://empireflippers.com/marketplace/"


def _mock_listings() -> list[dict[str, Any]]:
    return [
        {
            "listing_id": "EF-71244",
            "asking_price": 1_800_000,
            "monthly_net_profit": 42_000,
            "business_model": "Affiliate / Content",
            "niche": "Personal Finance",
            "listing_url": "https://empireflippers.com/listing/71244/",
        },
        {
            "listing_id": "EF-72101",
            "asking_price": 3_400_000,
            "monthly_net_profit": 78_000,
            "business_model": "Ecommerce",
            "niche": "Pet Supplies",
            "listing_url": "https://empireflippers.com/listing/72101/",
        },
        {
            "listing_id": "EF-71988",
            "asking_price": 690_000,
            "monthly_net_profit": 18_500,
            "business_model": "SaaS",
            "niche": "B2B Productivity",
            "listing_url": "https://empireflippers.com/listing/71988/",
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
                        "listing_id": {"type": "string"},
                        "asking_price": {"type": "number"},
                        "monthly_net_profit": {"type": "number"},
                        "business_model": {"type": "string"},
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
        log.warning("firecrawl-py not installed; empire_flippers returning empty result")
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
        log.exception("empire_flippers firecrawl scrape failed: %s", exc)
        return []


def scrape(force_mock: bool = False) -> list[dict[str, Any]]:
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if force_mock or not api_key:
        if not api_key and not force_mock:
            log.warning("FIRECRAWL_API_KEY not set; empire_flippers returning mock data")
        listings = _mock_listings()
    else:
        listings = _firecrawl_scrape(api_key)
        if not listings:
            log.warning("empire_flippers live scrape returned no rows; falling back to mock")
            listings = _mock_listings()

    for item in listings:
        item["source"] = SOURCE
    return listings


async def scrape_async(force_mock: bool = False) -> list[dict[str, Any]]:
    import asyncio

    return await asyncio.to_thread(scrape, force_mock)
