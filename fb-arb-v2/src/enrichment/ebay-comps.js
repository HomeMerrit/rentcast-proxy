const axios = require('axios');

// ── eBay Browse API (replaces the deprecated Finding API) ──────────────────────
// NOTE: The legacy Finding API (findCompletedItems) that returned *sold* prices is
// deprecated and no longer available to new keys. We now use the Browse API, which
// returns *active* listings. Active asking prices are a PROXY for resale value, not
// true sold comps — they tend to run higher than actual sale prices. The per-category
// `comp_multiplier` in system-config.json is what discounts these down to a realistic
// target sale price; tune those multipliers down if margins come in optimistic.
//
// To get true sold data later, apply for eBay's Marketplace Insights API and swap the
// endpoint in browseSearch() — the rest of the pipeline stays the same.

const EBAY_CLIENT_ID = process.env.EBAY_APP_ID;      // App ID  = OAuth client_id
const EBAY_CLIENT_SECRET = process.env.EBAY_CERT_ID; // Cert ID = OAuth client_secret
const OAUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const MARKETPLACE = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';

// Used-condition IDs: Used, Very Good, Good, Acceptable, Seller/Manufacturer refurbished
const USED_CONDITION_IDS = '2000|2010|2020|2030|2500|3000|4000|5000|6000';

// ── OAuth token (client credentials grant), cached until expiry ────────────────
let _token = null;
let _tokenExp = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
    throw new Error('Missing EBAY_APP_ID / EBAY_CERT_ID — both are required for the Browse API OAuth flow');
  }

  const basic = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope'
  });

  const res = await axios.post(OAUTH_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    timeout: 10000
  });

  _token = res.data.access_token;
  // Refresh 60s before the real expiry to avoid edge-of-expiry 401s
  _tokenExp = Date.now() + ((res.data.expires_in || 7200) - 60) * 1000;
  return _token;
}

// ── Low-level Browse API search ────────────────────────────────────────────────
async function browseSearch(query, { limit = 50, minPrice, maxPrice, usedOnly = true } = {}) {
  const token = await getToken();

  const filters = ['buyingOptions:{FIXED_PRICE}'];
  if (usedOnly) filters.push(`conditionIds:{${USED_CONDITION_IDS}}`);
  if (minPrice != null || maxPrice != null) {
    filters.push(`price:[${minPrice != null ? minPrice : 0}..${maxPrice != null ? maxPrice : ''}]`);
    filters.push('priceCurrency:USD');
  }

  const res = await axios.get(BROWSE_URL, {
    params: { q: query, limit: String(Math.min(limit, 200)), filter: filters.join(',') },
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE },
    timeout: 10000
  });

  return res.data.itemSummaries || [];
}

function ebayErr(err) {
  return err.response?.data?.errors?.[0]?.message || err.response?.status || err.message;
}

// Cache comps to avoid redundant API calls within a pipeline run
const _compsCache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Returns a resale-value estimate from active eBay listings (proxy for sold comps).
// Shape kept identical to the old Finding API version so callers don't change.
async function getEbaySoldComps(searchQuery, options = {}) {
  const cacheKey = searchQuery.toLowerCase().trim();
  const cached = _compsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) return cached.data;

  const EMPTY = { median: 0, average: 0, count: 0, low: 0, high: 0, basis: 'active_listings' };

  try {
    const items = await browseSearch(searchQuery, { limit: 50, minPrice: options.minPrice, usedOnly: true });

    const prices = items
      .map(i => parseFloat(i.price?.value || 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    if (!prices.length) return EMPTY;

    // Remove outliers (top and bottom 10%)
    const trimCount = Math.floor(prices.length * 0.10);
    const trimmed = prices.slice(trimCount, prices.length - trimCount);
    const arr = trimmed.length ? trimmed : prices;

    const median = arr[Math.floor(arr.length / 2)];
    const average = arr.reduce((a, b) => a + b, 0) / arr.length;

    const data = {
      median: parseFloat(median.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      count: prices.length,
      low: parseFloat(prices[0].toFixed(2)),
      high: parseFloat(prices[prices.length - 1].toFixed(2)),
      basis: 'active_listings' // proxy for sold price, not actual completed sales
    };

    _compsCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error(`  [eBayComps] Error for "${searchQuery}":`, ebayErr(err));
    return EMPTY;
  }
}

// Returns current eBay listings, normalized to a flat shape for the misspell pipeline.
async function searchEbayCurrentListings(searchQuery, options = {}) {
  const { minPrice, maxPrice, maxResults = 15 } = options;

  try {
    const items = await browseSearch(searchQuery, { limit: maxResults, minPrice, maxPrice, usedOnly: true });
    return items.map(i => ({
      itemId: i.itemId,
      title: i.title || 'Unknown',
      price: parseFloat(i.price?.value || 0),
      url: i.itemWebUrl || '',
      image: i.image?.imageUrl || i.thumbnailImages?.[0]?.imageUrl || null
    }));
  } catch (err) {
    console.error(`  [eBaySearch] Error for "${searchQuery}":`, ebayErr(err));
    return [];
  }
}

module.exports = { getEbaySoldComps, searchEbayCurrentListings, getToken };
