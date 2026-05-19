"""Normalize, dedupe, and filter raw scraper output to canonical schema."""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)

CANONICAL_FIELDS: tuple[str, ...] = (
    "source",
    "listing_url",
    "business_name",
    "asking_price",
    "annual_revenue",
    "monthly_revenue",
    "monthly_profit",
    "sde",
    "business_type",
    "industry",
    "state",
    "domain",
    "broker_name",
    "days_listed",
    "business_age_years",
    "tech_stack",
    "monthly_traffic",
    "traffic_trend",
    "business_credit_score",
    "ucc_filing_count",
    "owner_name",
    "owner_email",
    "owner_phone",
    "owner_linkedin",
    "ai_fit_score",
    "prescreen_score",
    "stage",
)

# Per-source field aliases (raw key -> canonical key).
SOURCE_ALIASES: dict[str, dict[str, str]] = {
    "bizbuysell": {
        "industry": "industry",
    },
    "flippa": {
        "age": "business_age_years",
        "business_type": "business_type",
    },
    "shopify_exchange": {
        "store_name": "business_name",
        "business_age": "business_age_years",
        "niche": "industry",
        "monthly_sessions": "monthly_traffic",
    },
    "empire_flippers": {
        "listing_id": "business_name",
        "monthly_net_profit": "monthly_profit",
        "business_model": "business_type",
        "niche": "industry",
    },
}

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SIC_RULES = REPO_ROOT / "config" / "sic_rules.yaml"
DEFAULT_SETTINGS = REPO_ROOT / "config" / "settings.yaml"


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except FileNotFoundError:
        log.warning("config file missing: %s", path)
        return {}
    except yaml.YAMLError as exc:
        log.error("failed to parse %s: %s", path, exc)
        return {}


def _industry_is_restricted(industry: str | None, restricted: list[str]) -> bool:
    if not industry:
        return False
    text = industry.lower()
    return any(re.search(rf"\b{re.escape(term)}\b", text) for term in restricted)


def _to_canonical(raw: dict[str, Any]) -> dict[str, Any]:
    source = str(raw.get("source", "")).lower()
    alias_map = SOURCE_ALIASES.get(source, {})

    canonical: dict[str, Any] = {field: None for field in CANONICAL_FIELDS}
    canonical["tech_stack"] = []

    for key, value in raw.items():
        canonical_key = alias_map.get(key, key)
        if canonical_key in CANONICAL_FIELDS:
            canonical[canonical_key] = value

    canonical["source"] = source
    # NOTE: `domain` is the *business's* domain (filled by enrichment Stage 1),
    # not the marketplace host. Leaving it None at normalize-time so dedupe can
    # fall through to listing_url instead of collapsing every row on one source.

    monthly_rev = canonical.get("monthly_revenue")
    if canonical.get("annual_revenue") is None and isinstance(monthly_rev, (int, float)):
        canonical["annual_revenue"] = int(monthly_rev * 12)

    return canonical


def normalize(
    raw_listings: list[dict[str, Any]],
    sic_rules_path: Path | None = None,
    settings_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Map raw rows → canonical schema, drop restricted industries / low revenue, dedupe."""
    sic = _load_yaml(sic_rules_path or DEFAULT_SIC_RULES)
    settings = _load_yaml(settings_path or DEFAULT_SETTINGS)

    restricted: list[str] = [str(x).lower() for x in sic.get("restricted_industries", [])]
    min_revenue: int = int(settings.get("min_revenue", 250_000))

    seen_keys: set[str] = set()
    cleaned: list[dict[str, Any]] = []

    for raw in raw_listings:
        if not isinstance(raw, dict):
            continue

        row = _to_canonical(raw)

        if _industry_is_restricted(row.get("industry"), restricted):
            log.debug("dropping restricted industry: %s", row.get("industry"))
            continue

        annual_rev = row.get("annual_revenue") or 0
        if isinstance(annual_rev, (int, float)) and annual_rev < min_revenue:
            log.debug(
                "dropping low revenue: %s ($%s < $%s)",
                row.get("business_name"),
                annual_rev,
                min_revenue,
            )
            continue

        dedupe_key = row.get("domain") or row.get("listing_url")
        if not dedupe_key:
            cleaned.append(row)
            continue
        if dedupe_key in seen_keys:
            log.debug("dropping duplicate: %s", dedupe_key)
            continue
        seen_keys.add(dedupe_key)
        cleaned.append(row)

    return cleaned
