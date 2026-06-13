const axios = require('axios');
const xml2js = require('xml2js');

const EBAY_APP_ID = process.env.EBAY_APP_ID;
const BASE = 'https://svcs.ebay.com/services/search/FindingService/v1';

// Cache comps to avoid redundant API calls within a pipeline run
const _compsCache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

async function getEbaySoldComps(searchQuery, options = {}) {
  const cacheKey = searchQuery.toLowerCase().trim();
  const cached = _compsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) return cached.data;

  const params = {
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'XML',
    'REST-PAYLOAD': '',
    'keywords': searchQuery,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'Condition',
    'itemFilter(1).value': 'Used',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '50',
    'paginationInput.pageNumber': '1',
  };

  if (options.minPrice) {
    params['itemFilter(2).name'] = 'MinPrice';
    params['itemFilter(2).value'] = options.minPrice;
  }

  try {
    const res = await axios.get(BASE, { params, timeout: 10000 });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
    const items = parsed?.findCompletedItemsResponse?.searchResult?.[0]?.item || [];

    if (!items.length) return { median: 0, average: 0, count: 0, low: 0, high: 0 };

    const prices = items
      .map(i => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    // Remove outliers (top and bottom 10%)
    const trimCount = Math.floor(prices.length * 0.10);
    const trimmed = prices.slice(trimCount, prices.length - trimCount);
    if (!trimmed.length) return { median: 0, average: 0, count: 0, low: 0, high: 0 };

    const median = trimmed[Math.floor(trimmed.length / 2)];
    const average = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;

    const data = {
      median: parseFloat(median.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      count: prices.length,
      low: parseFloat(prices[0].toFixed(2)),
      high: parseFloat(prices[prices.length - 1].toFixed(2))
    };

    _compsCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error(`  [eBayComps] Error for "${searchQuery}":`, err.message);
    return { median: 0, average: 0, count: 0, low: 0, high: 0 };
  }
}

async function searchEbayCurrentListings(searchQuery, options = {}) {
  const { minPrice, maxPrice, maxResults = 15 } = options;

  const params = {
    'OPERATION-NAME': 'findItemsAdvanced',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'XML',
    'REST-PAYLOAD': '',
    'keywords': searchQuery,
    'itemFilter(0).name': 'ListingType',
    'itemFilter(0).value': 'FixedPrice',
    'itemFilter(1).name': 'Condition',
    'itemFilter(1).value': 'Used',
    'sortOrder': 'PricePlusShippingLowest',
    'paginationInput.entriesPerPage': String(maxResults),
  };

  if (minPrice) { params['itemFilter(2).name'] = 'MinPrice'; params['itemFilter(2).value'] = minPrice; }
  if (maxPrice) { params['itemFilter(3).name'] = 'MaxPrice'; params['itemFilter(3).value'] = maxPrice; }

  try {
    const res = await axios.get(BASE, { params, timeout: 10000 });
    const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: true });
    return parsed?.findItemsAdvancedResponse?.searchResult?.[0]?.item || [];
  } catch (err) {
    console.error(`  [eBaySearch] Error for "${searchQuery}":`, err.message);
    return [];
  }
}

module.exports = { getEbaySoldComps, searchEbayCurrentListings };
