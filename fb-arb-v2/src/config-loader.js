const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'system-config.json');

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // re-read config every 5 min

function loadConfig() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    _cache = JSON.parse(raw);
    _cacheTime = now;
    return _cache;
  } catch (err) {
    console.error('[Config] Failed to load system-config.json:', err.message);
    throw err;
  }
}

function saveConfig(newConfig) {
  newConfig.version = (loadConfig().version || 0) + 1;
  newConfig.generated_at = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
  _cache = newConfig;
  _cacheTime = Date.now();
  console.log(`[Config] Saved v${newConfig.version}`);
}

function getCategoryThreshold(cfg, category) {
  const global = cfg.thresholds.global;
  const byCategory = cfg.thresholds.by_category || {};

  // Exact match first, then keyword scan
  if (byCategory[category]) return { ...global, ...byCategory[category] };

  for (const [key, val] of Object.entries(byCategory)) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) {
      return { ...global, ...val };
    }
  }

  return { ...global, comp_multiplier: 0.90 };
}

function getSeasonalBoost(cfg, category) {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const boosts = cfg.seasonal_boosts || {};

  for (const [key, monthMap] of Object.entries(boosts)) {
    if (category && category.toLowerCase().includes(key.toLowerCase())) {
      return parseFloat(monthMap[month] || 1.0);
    }
  }
  return 1.0;
}

function getPlatformRouting(cfg, category) {
  const routing = cfg.platform_routing || {};
  if (routing[category]) return routing[category];

  for (const [key, val] of Object.entries(routing)) {
    if (key !== 'default' && category && category.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  return routing.default || { platform: 'eBay', fee: 0.1325 };
}

module.exports = { loadConfig, saveConfig, getCategoryThreshold, getSeasonalBoost, getPlatformRouting };
