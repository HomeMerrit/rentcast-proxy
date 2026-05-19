# SellFi Lead Scraper & Enrichment Pipeline

End-to-end pipeline that scrapes business-for-sale listings from four marketplaces,
normalizes them to a single schema, enriches each lead through a gated multi-stage API
chain, scores it, and writes HOT / WARM leads to CSV.

## Install

```bash
pip install -r requirements.txt
```

Python 3.11+ required.

## Configure (env vars)

All API keys are read from environment variables. Any unset key triggers a typed
mock response for that stage with a warning logged — the pipeline always runs end to end.

| Variable | Used by |
| --- | --- |
| `FIRECRAWL_API_KEY` | all scrapers + UCC stage |
| `APOLLO_API_KEY` | enrichment stage 1 |
| `BUILTWITH_API_KEY` | enrichment stage 2 |
| `SIMILARWEB_API_KEY` | enrichment stage 3 |
| `OPENCORPORATES_API_KEY` | enrichment stage 4 |
| `WHOISXML_API_KEY` | enrichment stage 5 |
| `EXPERIAN_API_KEY` | enrichment stage 6 (gated) |
| `LOG_LEVEL` | optional, defaults to `INFO` |

You can place these in a `.env` file at the repo root — `python-dotenv` loads it
automatically when the orchestrator starts.

## Run

### Mock mode (no keys needed)
```bash
python pipeline/orchestrator.py --mock
```

### Single source
```bash
python pipeline/orchestrator.py --source bizbuysell
python pipeline/orchestrator.py --source flippa
python pipeline/orchestrator.py --source shopify_exchange
python pipeline/orchestrator.py --source empire_flippers
```

### Full live pipeline
```bash
python pipeline/orchestrator.py
```

Any stage missing its API key still produces mock data, so a live run with only
`FIRECRAWL_API_KEY` set still produces enriched output.

## Output files

| File | Contents |
| --- | --- |
| `output/leads_<YYYY-MM-DD>.csv` | HOT + WARM leads from this run only |
| `output/all_leads_master.csv` | All leads ever scored; deduplicated on `listing_url` |

Both files share the canonical schema defined in `pipeline/normalizer.CANONICAL_FIELDS`.

## Pipeline stages

1. **Scrapers** — `scrapers/{bizbuysell,flippa,shopify_exchange,empire_flippers}.py`
   pull listings in parallel via `asyncio.gather`.
2. **Normalize** — `pipeline/normalizer.py` maps source-specific keys → canonical schema,
   drops restricted industries (`config/sic_rules.yaml`) and revenue below
   `min_revenue`, and dedupes on domain / listing URL.
3. **Enrich** — `enrichment/enricher.py` runs stages 1–7. Stage 6 (Experian business
   credit) only runs when the interim prescreen score exceeds
   `prescreen_gate_for_credit_pull` from `config/settings.yaml`. Stage 7 drops any
   lead with `mca_stack_count >= mca_stack_drop_threshold`.
4. **Score** — `scoring/prescreen.py` produces a 0.0–1.0 weighted score and assigns
   `HOT` (≥0.70), `WARM` (0.40–0.69), or `COLD` (<0.40).
5. **Export** — `output/exporter.py` writes daily + master CSVs and prints a run summary.

## Tuning

Edit `config/settings.yaml` to change revenue floor, days-listed floor, credit-pull gate,
MCA drop threshold, or HOT/WARM cutoffs. Edit `config/sic_rules.yaml` to tweak the
industry block-list, preferred-industries list, or the MCA-lender keyword set used in
UCC scanning.
