"""End-to-end orchestrator.

Run all scrapers in parallel → normalize → enrich → score → export.

Usage:
    python pipeline/orchestrator.py              # full pipeline (live + mock fallback)
    python pipeline/orchestrator.py --mock       # all stages on mock data
    python pipeline/orchestrator.py --source bizbuysell   # single source
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any, Awaitable, Callable

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass

from scrapers import bizbuysell, empire_flippers, flippa, shopify_exchange  # noqa: E402
from pipeline.normalizer import normalize  # noqa: E402
from enrichment.enricher import enrich  # noqa: E402
from scoring.prescreen import score_and_stage  # noqa: E402
from output.exporter import export, print_summary  # noqa: E402

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("orchestrator")

SCRAPERS: dict[str, Callable[[bool], Awaitable[list[dict[str, Any]]]]] = {
    "bizbuysell": bizbuysell.scrape_async,
    "flippa": flippa.scrape_async,
    "shopify_exchange": shopify_exchange.scrape_async,
    "empire_flippers": empire_flippers.scrape_async,
}


async def run_scrapers(sources: list[str], force_mock: bool) -> list[dict[str, Any]]:
    print(f"[1/5] Scraping sources in parallel: {sources}")
    tasks = [SCRAPERS[name](force_mock) for name in sources]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: list[dict[str, Any]] = []
    for name, result in zip(sources, results):
        if isinstance(result, Exception):
            log.exception("scraper %s failed: %s", name, result)
            continue
        log.info("scraper %s returned %d rows", name, len(result))
        merged.extend(result)
    return merged


def main() -> int:
    parser = argparse.ArgumentParser(description="SellFi lead pipeline orchestrator")
    parser.add_argument("--mock", action="store_true", help="force mock mode for every scraper")
    parser.add_argument(
        "--source",
        choices=sorted(SCRAPERS.keys()),
        help="run a single source instead of all four",
    )
    args = parser.parse_args()

    sources = [args.source] if args.source else list(SCRAPERS.keys())

    raw = asyncio.run(run_scrapers(sources, args.mock))
    print(f"   → scraped {len(raw)} raw rows")

    print("[2/5] Normalizing + deduping + filtering")
    normalized = normalize(raw)
    print(f"   → {len(normalized)} rows after filters")

    print("[3/5] Enriching (Apollo → BuiltWith → SimilarWeb → OpenCorporates → WhoisXML → "
          "Experian* → UCC)")
    enriched = enrich(normalized)
    dropped = len(normalized) - len(enriched)
    print(f"   → {len(enriched)} rows after enrichment ({dropped} dropped)")

    print("[4/5] Scoring + stage assignment")
    scored = score_and_stage(enriched)

    print("[5/5] Exporting")
    export_stats = export(scored)

    summary = {
        "total_scraped": len(raw),
        "passed_filters": len(normalized),
        "dropped": dropped,
        **export_stats,
    }
    print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
