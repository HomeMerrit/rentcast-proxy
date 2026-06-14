# FB Arbitrage Engine v2

Automated arbitrage pipeline with a self-improving feedback loop.

## The Moat
The code is open. The **data** is yours. Every approve/skip decision and every sale outcome
feeds a weekly Brain that rewrites the system's own configuration. After 6 months you have
a proprietary dataset of what works, at what margins, in what seasons — tuned specifically
to this operator, this market, this taste. Nobody can buy that.

## Two Sourcing Channels
1. **Facebook Marketplace** via SociaVault API (3 documented endpoints, clean JSON, maintained)
2. **eBay Misspelled Listings** — Claude generates common misspellings, hunts for underpriced
   items buried in search results. Buy, rephoto, relist with correct title.

## The Brain
Runs every Sunday at midnight. Reads 30 days of decisions and sales. Feeds the data to
Claude Sonnet. Gets back an updated `config/system-config.json` with:
- Adjusted margin thresholds per category (based on real approval rates)
- Updated comp multipliers (based on actual vs predicted margins)
- Search query weight adjustments (based on which queries generate quality leads)
- Platform routing updates (based on actual sales velocity)

Every config version is logged to Supabase with reasoning. Full audit trail.

## Quick Start
```bash
npm install
cp .env.example .env    # fill in all keys
# Run db/schema.sql in Supabase SQL Editor
node scripts/setup-check.js   # verify everything
npm test                      # test all components
npm start                     # go live
```

Full setup guide: `docs/SETUP.md`
Operations guide: `docs/OPERATIONS.md`

## Commands
```bash
npm start              # pipeline every 30min + brain weekly
npm run dev            # nodemon watch
npm test               # component tests + Telegram test
npm run mark-sold      # log a completed sale (feeds the Brain)
node src/index.js --brain  # run brain manually
node scripts/setup-check.js  # verify API keys + connections
```

## Telegram Bot Commands
- `/stats` — 7-day performance
- `/pending` — approved items waiting on pickup
- `/config` — current brain config version
- `/help` — all commands

## File Map
```
src/
  index.js              Main orchestrator + cron
  config-loader.js      Reads system-config.json (never hardcodes thresholds)
  sourcing/
    sociavault.js       FB Marketplace via SociaVault API
    ebay-misspell.js    eBay underpriced listing finder
    seller-signals.js   Listing language → deal score boost
  enrichment/
    ebay-comps.js       eBay Browse API resale comps (active-listing proxy)
    margin.js           Net margin calculator (all platform fees)
  brain/
    weekly-optimizer.js THE BRAIN — reads data, optimizes config
  alerts/
    telegram.js         Bot with approve/skip/stats/pending/config
  listing/
    description-gen.js  Claude API listing copy generator
  db/
    supabase.js         Client + helpers
config/
  system-config.json    Live system config (Brain rewrites this weekly)
db/
  schema.sql            Full Supabase schema
scripts/
  test-pipeline.js      Component tests
  mark-sold.js          CLI to log a sale
  setup-check.js        API key + connection verification
docs/
  SETUP.md
  OPERATIONS.md
```
