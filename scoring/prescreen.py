"""Weighted prescreen scoring for enriched leads."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SETTINGS = REPO_ROOT / "config" / "settings.yaml"

SAAS_TOKENS = {"saas", "stripe", "intercom", "hubspot", "salesforce", "segment"}


def _load_settings(path: Path | None = None) -> dict[str, Any]:
    try:
        with (path or DEFAULT_SETTINGS).open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except FileNotFoundError:
        return {}
    except yaml.YAMLError as exc:
        log.error("failed to parse settings.yaml: %s", exc)
        return {}


def _revenue_score(annual_revenue: float | int | None) -> float:
    if not annual_revenue or not isinstance(annual_revenue, (int, float)):
        return 0.0
    if annual_revenue >= 1_000_000:
        return 0.3
    if annual_revenue >= 500_000:
        return 0.2
    if annual_revenue >= 250_000:
        return 0.1
    return 0.0


def _tech_score(tech_stack: Any) -> float:
    if not tech_stack or not isinstance(tech_stack, list):
        return 0.0
    lowered = {str(t).lower() for t in tech_stack}
    if "shopify" in lowered and "stripe" in lowered:
        return 0.15
    if lowered & SAAS_TOKENS:
        return 0.15
    return 0.0


def _traffic_trend_score(trend: str | None) -> float:
    if not trend:
        return 0.0
    return 0.1 if trend.lower() in {"declining", "flat"} else 0.0


def _business_age_score(years: float | int | None) -> float:
    if not years or not isinstance(years, (int, float)):
        return 0.0
    return 0.1 if years >= 3 else 0.0


def _ucc_score(count: int | float | None) -> float:
    if count is None or not isinstance(count, (int, float)):
        return 0.0
    return 0.05 if 1 <= count <= 2 else 0.0


def _credit_score(score: int | float | None) -> float:
    if score is None or not isinstance(score, (int, float)):
        return 0.0
    return 0.15 if score >= 70 else 0.0


def _days_listed_score(days: int | float | None) -> float:
    if days is None or not isinstance(days, (int, float)):
        return 0.0
    return 0.1 if days >= 90 else 0.0


def score_lead(lead: dict[str, Any]) -> dict[str, Any]:
    """Compute prescreen_score in [0.0, 1.0]; do not assign stage here."""
    components = (
        _revenue_score(lead.get("annual_revenue")),
        _tech_score(lead.get("tech_stack")),
        _traffic_trend_score(lead.get("traffic_trend")),
        _business_age_score(lead.get("business_age_years")),
        _ucc_score(lead.get("ucc_filing_count")),
        _credit_score(lead.get("business_credit_score")),
        _days_listed_score(lead.get("days_listed")),
    )
    raw_score = round(min(1.0, sum(components)), 4)
    return {"prescreen_score": raw_score}


def assign_stage(score: float, settings: dict[str, Any] | None = None) -> str:
    settings = settings or _load_settings()
    scoring_cfg = settings.get("scoring", {})
    hot = float(scoring_cfg.get("hot_threshold", 0.7))
    warm = float(scoring_cfg.get("warm_threshold", 0.4))
    if score >= hot:
        return "HOT"
    if score >= warm:
        return "WARM"
    return "COLD"


def score_and_stage(leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    settings = _load_settings()
    out: list[dict[str, Any]] = []
    for lead in leads:
        scored = dict(lead)
        result = score_lead(scored)
        scored["prescreen_score"] = result["prescreen_score"]
        scored["stage"] = assign_stage(result["prescreen_score"], settings)
        out.append(scored)
    return out
