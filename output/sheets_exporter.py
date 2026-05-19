"""Google Sheets exporter using a service-account credential.

Env vars:
    GOOGLE_SHEETS_CREDS_PATH  Path to the service-account JSON file (required).
    GOOGLE_SHEET_ID           Spreadsheet ID to append to. If unset, a new
                              spreadsheet named "SellFi Leads" is created and
                              its URL is printed.
    GOOGLE_SHEET_TAB          Worksheet/tab name, defaults to "Leads".

If GOOGLE_SHEETS_CREDS_PATH is not set, `push_to_sheet` is a no-op so the rest
of the pipeline keeps working in mock mode.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from pipeline.normalizer import CANONICAL_FIELDS

log = logging.getLogger(__name__)

DEFAULT_TAB = "Leads"
DEFAULT_TITLE = "SellFi Leads"


def _cell_value(value: Any) -> Any:
    """Coerce a canonical-schema value to something a sheet cell can hold."""
    if value is None:
        return ""
    if isinstance(value, list):
        return ", ".join(str(v) for v in value)
    if isinstance(value, (dict, set, tuple)):
        return json.dumps(value, default=str)
    return value


def _rows_for(leads: list[dict[str, Any]]) -> list[list[Any]]:
    return [
        [_cell_value(lead.get(field)) for field in CANONICAL_FIELDS]
        for lead in leads
    ]


def push_to_sheet(leads: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Append leads to a Google Sheet. Returns metadata dict, or None if skipped."""
    creds_path = os.getenv("GOOGLE_SHEETS_CREDS_PATH")
    if not creds_path:
        log.warning("GOOGLE_SHEETS_CREDS_PATH not set; skipping Sheets export")
        return None

    creds_file = Path(creds_path)
    if not creds_file.exists():
        log.error("GOOGLE_SHEETS_CREDS_PATH points to missing file: %s", creds_path)
        return None

    try:
        import gspread  # type: ignore
    except ImportError:
        log.error("gspread not installed; run `pip install -r requirements.txt`")
        return None

    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    tab_name = os.getenv("GOOGLE_SHEET_TAB", DEFAULT_TAB)

    try:
        client = gspread.service_account(filename=str(creds_file))
    except Exception as exc:  # noqa: BLE001
        log.exception("failed to authenticate to Google Sheets: %s", exc)
        return None

    try:
        if sheet_id:
            spreadsheet = client.open_by_key(sheet_id)
            created = False
        else:
            spreadsheet = client.create(DEFAULT_TITLE)
            log.info(
                "created new spreadsheet '%s' (id=%s); share it with the "
                "service-account email to grant yourself edit access",
                DEFAULT_TITLE, spreadsheet.id,
            )
            created = True

        try:
            worksheet = spreadsheet.worksheet(tab_name)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.add_worksheet(title=tab_name, rows=1000, cols=len(CANONICAL_FIELDS))

        existing = worksheet.get_all_values()
        if not existing:
            worksheet.append_row(list(CANONICAL_FIELDS), value_input_option="RAW")

        rows = _rows_for(leads)
        if rows:
            worksheet.append_rows(rows, value_input_option="RAW")

        url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
        log.info("pushed %d rows to %s (tab=%s)", len(rows), url, tab_name)
        return {
            "spreadsheet_id": spreadsheet.id,
            "spreadsheet_url": url,
            "tab": tab_name,
            "rows_appended": len(rows),
            "created": created,
        }
    except Exception as exc:  # noqa: BLE001
        log.exception("Google Sheets export failed: %s", exc)
        return None
