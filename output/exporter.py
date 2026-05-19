"""CSV exporter for scored leads."""
from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

from pipeline.normalizer import CANONICAL_FIELDS

log = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "output"
MASTER_FILE = DEFAULT_OUTPUT_DIR / "all_leads_master.csv"


def _dataframe(leads: list[dict[str, Any]]) -> pd.DataFrame:
    rows = []
    for lead in leads:
        row = {field: lead.get(field) for field in CANONICAL_FIELDS}
        if isinstance(row.get("tech_stack"), list):
            row["tech_stack"] = ", ".join(str(t) for t in row["tech_stack"])
        rows.append(row)
    return pd.DataFrame(rows, columns=list(CANONICAL_FIELDS))


def export(
    leads: list[dict[str, Any]],
    output_dir: Path | None = None,
    run_date: date | None = None,
) -> dict[str, Any]:
    """Write HOT+WARM to daily file, dedupe-append everything to master, return summary."""
    output_dir = output_dir or DEFAULT_OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    run_date = run_date or date.today()

    by_stage: dict[str, list[dict[str, Any]]] = {"HOT": [], "WARM": [], "COLD": []}
    for lead in leads:
        stage = (lead.get("stage") or "COLD").upper()
        by_stage.setdefault(stage, []).append(lead)

    daily_path = output_dir / f"leads_{run_date.isoformat()}.csv"
    daily_leads = by_stage["HOT"] + by_stage["WARM"]
    if daily_leads:
        _dataframe(daily_leads).to_csv(daily_path, index=False)
        log.info("wrote %d HOT+WARM leads to %s", len(daily_leads), daily_path)
    else:
        log.info("no HOT/WARM leads; skipped %s", daily_path)

    master_path = output_dir / MASTER_FILE.name
    new_df = _dataframe(leads)
    if master_path.exists():
        try:
            existing = pd.read_csv(master_path)
            seen = set(existing.get("listing_url", pd.Series(dtype=str)).dropna().tolist())
            new_df = new_df[~new_df["listing_url"].isin(seen)]
            combined = pd.concat([existing, new_df], ignore_index=True)
        except Exception as exc:  # noqa: BLE001
            log.exception("failed to read master csv, overwriting: %s", exc)
            combined = new_df
    else:
        combined = new_df

    combined.to_csv(master_path, index=False)
    log.info("master file now has %d rows at %s", len(combined), master_path)

    return {
        "daily_file": str(daily_path) if daily_leads else None,
        "master_file": str(master_path),
        "hot": len(by_stage["HOT"]),
        "warm": len(by_stage["WARM"]),
        "cold": len(by_stage["COLD"]),
        "appended_to_master": len(new_df),
    }


def print_summary(stats: dict[str, Any]) -> None:
    print("=" * 60)
    print("SellFi Lead Pipeline — Run Summary")
    print("=" * 60)
    print(f"  Total scraped:       {stats.get('total_scraped', 0)}")
    print(f"  Passed filters:      {stats.get('passed_filters', 0)}")
    print(f"  Dropped (enrich):    {stats.get('dropped', 0)}")
    print(f"  HOT  (>= 0.70):      {stats.get('hot', 0)}")
    print(f"  WARM (0.40-0.69):    {stats.get('warm', 0)}")
    print(f"  COLD (< 0.40):       {stats.get('cold', 0)}")
    if stats.get("daily_file"):
        print(f"  Daily CSV:           {stats['daily_file']}")
    if stats.get("master_file"):
        print(f"  Master CSV:          {stats['master_file']}")
        print(f"  Appended to master:  {stats.get('appended_to_master', 0)}")
    if stats.get("sheet_url"):
        print(f"  Google Sheet:        {stats['sheet_url']}")
        print(f"  Sheet rows appended: {stats.get('sheet_rows_appended', 0)}")
    print("=" * 60)
