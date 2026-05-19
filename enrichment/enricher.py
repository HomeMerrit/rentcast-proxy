"""Staged lead enrichment.

Every stage is env-gated. If the corresponding API key is missing the stage
returns typed mock data and logs a warning. Stage 6 (Experian) only runs when
the running prescreen score exceeds the configured gate.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SETTINGS = REPO_ROOT / "config" / "settings.yaml"
DEFAULT_SIC_RULES = REPO_ROOT / "config" / "sic_rules.yaml"


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except FileNotFoundError:
        return {}
    except yaml.YAMLError as exc:
        log.error("failed to parse %s: %s", path, exc)
        return {}


# ---------------------------------------------------------------------------
# Stage implementations
# ---------------------------------------------------------------------------
def stage1_apollo(lead: dict[str, Any]) -> dict[str, Any]:
    """Email/domain lookup via Apollo."""
    key = os.getenv("APOLLO_API_KEY")
    if not key:
        log.warning("APOLLO_API_KEY not set; stage1 returning mock data")
        return {"domain": "example.com", "owner_email": "owner@example.com"}
    try:
        import aiohttp  # noqa: F401  -- placeholder for real call
        # Live API not implemented; this is the integration point.
        return {"domain": lead.get("domain") or "example.com", "owner_email": None}
    except Exception as exc:  # noqa: BLE001
        log.exception("apollo enrichment failed: %s", exc)
        return {}


def stage2_builtwith(lead: dict[str, Any]) -> dict[str, Any]:
    """Tech stack via BuiltWith."""
    key = os.getenv("BUILTWITH_API_KEY")
    if not key:
        log.warning("BUILTWITH_API_KEY not set; stage2 returning mock data")
        return {"tech_stack": ["Shopify", "Stripe", "Klaviyo"]}
    try:
        return {"tech_stack": []}
    except Exception as exc:  # noqa: BLE001
        log.exception("builtwith enrichment failed: %s", exc)
        return {}


def stage3_similarweb(lead: dict[str, Any]) -> dict[str, Any]:
    """Traffic & trend via SimilarWeb."""
    key = os.getenv("SIMILARWEB_API_KEY")
    if not key:
        log.warning("SIMILARWEB_API_KEY not set; stage3 returning mock data")
        return {"monthly_traffic": 45_000, "traffic_trend": "declining"}
    try:
        return {"monthly_traffic": None, "traffic_trend": None}
    except Exception as exc:  # noqa: BLE001
        log.exception("similarweb enrichment failed: %s", exc)
        return {}


def stage4_opencorporates(lead: dict[str, Any]) -> dict[str, Any]:
    """Legal entity via OpenCorporates."""
    key = os.getenv("OPENCORPORATES_API_KEY")
    if not key:
        log.warning("OPENCORPORATES_API_KEY not set; stage4 returning mock data")
        return {"incorporated": True, "state": "UT", "years_active": 4}
    try:
        return {"incorporated": None, "state": lead.get("state"), "years_active": None}
    except Exception as exc:  # noqa: BLE001
        log.exception("opencorporates enrichment failed: %s", exc)
        return {}


def stage5_whoisxml(lead: dict[str, Any]) -> dict[str, Any]:
    """Domain age via WhoisXML."""
    key = os.getenv("WHOISXML_API_KEY")
    if not key:
        log.warning("WHOISXML_API_KEY not set; stage5 returning mock data")
        return {"domain_age_years": 5}
    try:
        return {"domain_age_years": None}
    except Exception as exc:  # noqa: BLE001
        log.exception("whoisxml enrichment failed: %s", exc)
        return {}


def stage6_experian(lead: dict[str, Any]) -> dict[str, Any]:
    """Business credit via Experian. Caller must enforce the prescreen gate."""
    key = os.getenv("EXPERIAN_API_KEY")
    if not key:
        log.warning("EXPERIAN_API_KEY not set; stage6 returning mock data")
        return {"business_credit_score": 72}
    try:
        return {"business_credit_score": None}
    except Exception as exc:  # noqa: BLE001
        log.exception("experian enrichment failed: %s", exc)
        return {}


def stage7_ucc_check(lead: dict[str, Any]) -> dict[str, Any]:
    """UCC / MCA stack check via state Secretary-of-State Firecrawl scrape."""
    key = os.getenv("FIRECRAWL_API_KEY")
    if not key:
        log.warning("FIRECRAWL_API_KEY not set; stage7 returning mock data")
        return {"ucc_filing_count": 1, "mca_stack_count": 0}
    try:
        return {"ucc_filing_count": 0, "mca_stack_count": 0}
    except Exception as exc:  # noqa: BLE001
        log.exception("ucc/mca check failed: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def _interim_prescreen(lead: dict[str, Any]) -> float:
    """Cheap prescreen using only currently-known fields to gate stage 6."""
    from scoring.prescreen import score_lead  # local import to avoid cycle

    return score_lead(lead).get("prescreen_score", 0.0)


def enrich_lead(
    lead: dict[str, Any],
    settings_path: Path | None = None,
) -> dict[str, Any] | None:
    """Run all enrichment stages on a single lead.

    Returns the enriched lead, or None if it should be dropped (MCA stack too deep).
    """
    settings = _load_yaml(settings_path or DEFAULT_SETTINGS)
    gate = float(settings.get("prescreen_gate_for_credit_pull", 0.6))
    mca_drop = int(settings.get("mca_stack_drop_threshold", 3))

    enriched = dict(lead)

    for fn in (stage1_apollo, stage2_builtwith, stage3_similarweb,
               stage4_opencorporates, stage5_whoisxml):
        result = fn(enriched)
        for k, v in result.items():
            if enriched.get(k) in (None, [], "") and v is not None:
                enriched[k] = v

    # Stage 6 gating
    interim = _interim_prescreen(enriched)
    enriched["prescreen_score"] = interim
    if interim > gate:
        for k, v in stage6_experian(enriched).items():
            if v is not None:
                enriched[k] = v
    else:
        log.debug(
            "skip experian for %s: prescreen %.2f <= gate %.2f",
            enriched.get("business_name"), interim, gate,
        )

    # Stage 7 + MCA drop check
    ucc = stage7_ucc_check(enriched)
    enriched["ucc_filing_count"] = ucc.get("ucc_filing_count", 0)
    mca_count = int(ucc.get("mca_stack_count", 0) or 0)
    if mca_count >= mca_drop:
        log.info(
            "dropping %s: %d MCA filings >= threshold %d",
            enriched.get("business_name"), mca_count, mca_drop,
        )
        return None

    return enriched


def enrich(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Enrich a list of leads, filtering out anything dropped during enrichment."""
    out: list[dict[str, Any]] = []
    for lead in leads:
        result = enrich_lead(lead)
        if result is not None:
            out.append(result)
    return out
