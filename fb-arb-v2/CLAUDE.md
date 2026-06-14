# FB Arbitrage Engine v2 — CLAUDE.md

## Mission
Automated arbitrage pipeline with a self-improving feedback loop. Sources underpriced items
from Facebook Marketplace (via SociaVault API) and misspelled eBay listings. Calculates net
margin, routes each item to optimal selling platform, fires Telegram alerts. A weekly Brain
reads all performance data and updates the system's own configuration — thresholds, comp
multipliers, search weights, platform preferences — so it gets smarter every week.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SOURCING LAYER                          │
│  SociaVault FB Marketplace API ──┐                          │
│  eBay Misspell Finder ───────────┼──► Seller Signal Score   │
└──────────────────────────────────┼─────────────────────────-┘
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENRICHMENT LAYER                         │
│  eBay Resale Comps (Browse API — active-listing proxy)      │
│  Dynamic Margin Calc (reads system-config.json)             │
│  Category Router (reads system-config.json)                 │
└──────────────────────────────────┬──────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     ALERT LAYER                             │
│  Telegram Bot → Operator                                    │
│  ✅ Approve / ❌ Skip / 💰 Mark Sold                        │
└──────────────────────────────────┬──────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (Data Layer)                    │
│  listings, decisions, sold_items, sourcing_runs,            │
│  system_configs (versioned config audit trail)              │
└──────────────────────────────────┬──────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│               THE BRAIN (Weekly Feedback Loop)              │
│  Reads 30 days of decisions + outcomes                      │
│  Claude API analyzes performance                            │
│  Writes updated system-config.json                          │
│  Sends weekly summary to Telegram                           │
│  → Thresholds, comp multipliers, search weights             │
│    all adjust automatically over time                       │
└─────────────────────────────────────────────────────────────┘
```

## Key Concept: The Self-Improving Moat
Every approve/skip decision and every sale outcome is a training signal. The Brain reads
this data weekly and updates `config/system-config.json` so the system learns:
- Which categories she actually approves (revealed preference)
- Which comp multipliers are accurate vs optimistic
- Which search queries generate quality deals vs noise
- Which platforms move each category fastest
- Seasonal patterns that emerge over time

Anyone can copy the code. Nobody can copy 6 months of your performance data.

## Tech Stack
- Node.js (CommonJS)
- SociaVault API (FB Marketplace — 3 documented endpoints)
- eBay Browse API (resale-value comps via active listings + misspell search; OAuth client-credentials)
- Anthropic Claude API (Brain optimization + description generation)
- Telegram Bot API (operator alerts + commands)
- Supabase (all data + config versioning)
- node-cron (pipeline: every 2h by default, brain: weekly Sunday midnight)

## SociaVault API (Primary FB Source)
Base URL: https://api.sociavault.com
Key: x-api-key header

Endpoints:
  GET /v1/scrape/facebook-marketplace/location-search?query=Salt+Lake+City,+UT
  GET /v1/scrape/facebook-marketplace/search?query=...&latitude=...&longitude=...&radius_km=40&price_min=...&price_max=...&cursor=...
  GET /v1/scrape/facebook-marketplace/item?id=LISTING_ID

Response: clean JSON, see src/sourcing/sociavault.js for full field mapping

## eBay Browse API
Auth: OAuth client-credentials — needs EBAY_APP_ID (client_id) + EBAY_CERT_ID (client_secret)
Token: POST https://api.ebay.com/identity/v1/oauth2/token
Search: GET https://api.ebay.com/buy/browse/v1/item_summary/search
IMPORTANT: The legacy Finding API findCompletedItems (true *sold* prices) is deprecated and
unavailable to new keys. We use the Browse API's ACTIVE listings as a resale-value proxy —
asking prices run higher than sold prices, so the per-category comp_multiplier discounts them.
For real sold data, apply for eBay's Marketplace Insights API and swap the endpoint in
src/enrichment/ebay-comps.js (browseSearch); the rest of the pipeline is unchanged.

## Environment Variables
All in .env — see .env.example. Must be set before running.

## Commands
```bash
npm install                    # install deps
cp .env.example .env           # then fill in all keys
node scripts/setup-check.js    # verify all API keys work
npm test                       # test all components + send Telegram alert
npm start                      # run pipeline (cron every 2h) + brain (weekly)
npm run dev                    # nodemon watch mode
node scripts/mark-sold.js      # interactive CLI to log a sale
```

## Build Order for Buddy (Phase 1 First)
1. Set up Supabase: run db/schema.sql in SQL editor
2. Test SociaVault connection: node scripts/test-sociavault.js
3. Wire up full pipeline: src/index.js → sourcing → enrichment → telegram
4. Run npm test — get all components green
5. Run npm start — confirm alerts fire on phone
6. Phase 2: add Brain (src/brain/weekly-optimizer.js)
7. Phase 3: add description gen + cross-listing webhooks

## Config System
`config/system-config.json` is the system's brain state. It starts with sensible defaults
and gets rewritten weekly by the Brain. Never hardcode thresholds — always read from config.
The Brain also logs every config version to Supabase `system_configs` table for audit trail.

## Critical Rules
- Only alert items with delivery_types including "shipping" (shippable items only)
- Deduplicate by listing ID (not URL) to prevent re-alerting same item
- eBay sold comps use MEDIAN of last 30 completed sales
- Comp multiplier (default 0.90) is per-category from system-config.json
- Weight seller signals (moving/estate/must sell) to boost deal score
- Brain runs Sunday at midnight — never during active sourcing
- All config changes are logged to Supabase with timestamp and reasoning
