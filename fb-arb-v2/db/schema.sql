-- FB Arbitrage Engine v2 — Supabase Schema
-- Paste and run this entire file in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

-- ── Sourcing Runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sourcing_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id TEXT UNIQUE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',       -- running, completed, error
  items_found INT DEFAULT 0,
  items_alerted INT DEFAULT 0,
  config_version INT DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Listings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_run_id TEXT,
  source TEXT NOT NULL,                -- facebook_marketplace, ebay_misspell
  source_url TEXT,
  source_listing_id TEXT UNIQUE,       -- FB listing ID or eBay item ID (dedup key)
  title TEXT NOT NULL,
  source_price DECIMAL(10,2),
  ebay_median_sold DECIMAL(10,2),
  ebay_comp_count INT DEFAULT 0,
  net_margin DECIMAL(10,2),
  margin_percent DECIMAL(5,1),
  est_fees DECIMAL(10,2),              -- estimated platform fees at time of sourcing
  est_shipping DECIMAL(10,2),          -- estimated shipping cost (used to compute actual net margin on sale)
  target_platform TEXT,
  category TEXT,
  photos JSONB DEFAULT '[]',
  notes TEXT,
  seller_signal_score INT DEFAULT 0,
  seller_signal_flags JSONB DEFAULT '[]',
  seasonal_boost DECIMAL(4,2) DEFAULT 1.0,
  status TEXT DEFAULT 'found',         -- found, alerted, approved, skipped, sold
  approved_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_source_id ON listings(source_listing_id);

-- ── Operator Decisions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  decision TEXT NOT NULL,              -- approved, skipped
  decided_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_decisions_decided ON decisions(decided_at DESC);

-- ── Sold Items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sold_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id),
  sold_price DECIMAL(10,2) NOT NULL,
  sold_platform TEXT NOT NULL,
  actual_margin DECIMAL(10,2),
  predicted_margin DECIMAL(10,2),
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ── System Config Versions (Brain audit trail) ───────────────────────────────
-- Every config the Brain writes is stored here permanently.
-- This is your proof of how the system evolved over time.
CREATE TABLE IF NOT EXISTS system_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version INT UNIQUE NOT NULL,
  config JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  generated_by TEXT DEFAULT 'weekly_brain',
  brain_notes TEXT,
  performance_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Performance View ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_performance AS
SELECT
  DATE_TRUNC('day', created_at)::DATE AS day,
  category,
  COUNT(*) AS found,
  COUNT(*) FILTER (WHERE status = 'alerted') AS alerted,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
  COUNT(*) FILTER (WHERE status = 'sold') AS sold,
  ROUND(AVG(net_margin) FILTER (WHERE status = 'alerted'), 2) AS avg_alerted_margin,
  ROUND(AVG(net_margin) FILTER (WHERE status = 'approved'), 2) AS avg_approved_margin
FROM listings
GROUP BY DATE_TRUNC('day', created_at)::DATE, category
ORDER BY day DESC, approved DESC;

-- ── Category Performance View (Brain reads this) ──────────────────────────────
CREATE OR REPLACE VIEW category_performance_30d AS
SELECT
  l.category,
  COUNT(d.id) AS total_decisions,
  COUNT(d.id) FILTER (WHERE d.decision = 'approved') AS approved,
  COUNT(d.id) FILTER (WHERE d.decision = 'skipped') AS skipped,
  ROUND(
    COUNT(d.id) FILTER (WHERE d.decision = 'approved')::NUMERIC /
    NULLIF(COUNT(d.id), 0) * 100, 1
  ) AS approval_rate_pct,
  ROUND(AVG(l.net_margin) FILTER (WHERE d.decision = 'approved'), 2) AS avg_approved_margin,
  ROUND(AVG(l.margin_percent) FILTER (WHERE d.decision = 'approved'), 1) AS avg_approved_margin_pct,
  COUNT(s.id) AS sales,
  ROUND(AVG(s.actual_margin), 2) AS avg_actual_margin,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (s.sold_at - l.created_at)) / 86400
  ), 1) AS avg_days_to_sell
FROM listings l
LEFT JOIN decisions d ON d.listing_id = l.id AND d.decided_at >= NOW() - INTERVAL '30 days'
LEFT JOIN sold_items s ON s.listing_id = l.id AND s.sold_at >= NOW() - INTERVAL '30 days'
WHERE l.created_at >= NOW() - INTERVAL '30 days'
GROUP BY l.category
ORDER BY approved DESC;

-- ── RLS: Allow all ops for now (lock down per user if needed later) ───────────
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sold_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_access" ON listings FOR ALL USING (true);
CREATE POLICY "all_access" ON sourcing_runs FOR ALL USING (true);
CREATE POLICY "all_access" ON decisions FOR ALL USING (true);
CREATE POLICY "all_access" ON sold_items FOR ALL USING (true);
CREATE POLICY "all_access" ON system_configs FOR ALL USING (true);
