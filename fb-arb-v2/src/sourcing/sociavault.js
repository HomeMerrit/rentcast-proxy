const axios = require('axios');
const { getEbaySoldComps } = require('../enrichment/ebay-comps');
const { calculateMargin } = require('../enrichment/margin');
const { scoreSellerSignals } = require('./seller-signals');
const { getCategoryThreshold, getSeasonalBoost, getPlatformRouting } = require('../config-loader');
const { sendDealAlert } = require('../alerts/telegram');
const { supabase } = require('../db/supabase');

const API_KEY = process.env.SOCIAVAULT_API_KEY;
const BASE_URL = 'https://api.sociavault.com';
const SEARCH_RADIUS_KM = parseInt(process.env.SEARCH_RADIUS_KM) || 40;

// Cache resolved location to avoid burning credits on every run
let _locationCache = null;

async function resolveLocation(query) {
  if (_locationCache) return _locationCache;

  const res = await axios.get(`${BASE_URL}/v1/scrape/facebook-marketplace/location-search`, {
    params: { query },
    headers: { 'x-api-key': API_KEY }
  });

  const loc = res.data.locations?.[0];
  if (!loc) throw new Error(`SociaVault: could not resolve location: ${query}`);

  _locationCache = loc;
  console.log(`[SociaVault] Location resolved: ${loc.name} (${loc.latitude}, ${loc.longitude})`);
  return loc;
}

async function searchListings(query, location, priceMin, priceMax, cursor = null) {
  const params = {
    query,
    latitude: location.latitude,
    longitude: location.longitude,
    radius_km: SEARCH_RADIUS_KM,
    price_min: priceMin,
    price_max: priceMax
  };
  if (cursor) params.cursor = cursor;

  const res = await axios.get(`${BASE_URL}/v1/scrape/facebook-marketplace/search`, {
    params,
    headers: { 'x-api-key': API_KEY }
  });

  return {
    listings: res.data.listings || [],
    cursor: res.data.cursor || null,
    totalCount: res.data.total_count || 0
  };
}

async function getItemDetail(listingId) {
  const res = await axios.get(`${BASE_URL}/v1/scrape/facebook-marketplace/item`, {
    params: { id: listingId },
    headers: { 'x-api-key': API_KEY }
  });
  return res.data;
}

async function runSociaVaultPipeline(pipelineRunId, cfg) {
  let totalFound = 0, totalAlerted = 0;

  const locationQuery = process.env.SEARCH_LOCATION_QUERY || 'Salt Lake City, UT';
  const location = await resolveLocation(locationQuery);

  // Sort queries by weight (descending) — higher weight queries run first
  const queries = [...(cfg.search_queries || [])].sort((a, b) => (b.weight || 1) - (a.weight || 1));

  for (const searchConfig of queries) {
    try {
      console.log(`  [SociaVault] Searching: "${searchConfig.query}" ($${searchConfig.min_price}–$${searchConfig.max_price})`);

      const { listings, cursor } = await searchListings(
        searchConfig.query,
        location,
        searchConfig.min_price,
        searchConfig.max_price
      );

      for (const listing of listings) {
        // Only process items that support shipping
        if (!listing.delivery_types?.includes('shipping')) continue;

        const result = await processListing(listing, searchConfig, cfg, pipelineRunId);
        if (result) {
          totalFound++;
          if (result.alerted) totalAlerted++;
        }
      }

      await sleep(800); // Respect rate limits between queries
    } catch (err) {
      console.error(`  [SociaVault] Error for "${searchConfig.query}":`, err.message);
    }
  }

  return { found: totalFound, alerted: totalAlerted };
}

async function processListing(listing, searchConfig, cfg, pipelineRunId) {
  try {
    const listingId = listing.id;
    const title = listing.title || 'Unknown';
    const sourcePrice = listing.price?.amount || 0;
    const category = searchConfig.category;

    if (!listingId || sourcePrice <= 0) return null;

    // Dedup by listing ID
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('source_listing_id', listingId)
      .single();
    if (existing) return null;

    // Get eBay sold comps for this product
    const comps = await getEbaySoldComps(title);
    if (!comps || comps.median <= 0 || comps.count < 3) return null;

    // Get category-specific thresholds and seasonal boost
    const thresholds = getCategoryThreshold(cfg, category);
    const seasonalBoost = getSeasonalBoost(cfg, category);
    const platformInfo = getPlatformRouting(cfg, category);

    // Fetch detail for description + seller signal scoring
    let detail = null;
    try {
      detail = await getItemDetail(listingId);
    } catch {}

    // Score seller signals from title + description
    const signalScore = scoreSellerSignals(
      title + ' ' + (detail?.description || ''),
      cfg.seller_signal_weights
    );

    // Calculate margin using category-specific comp multiplier
    const compMultiplier = (thresholds.comp_multiplier || 0.90) * seasonalBoost;
    const targetSalePrice = comps.median * Math.min(compMultiplier, 0.98);

    const margin = calculateMargin({
      sourcePrice,
      targetSalePrice,
      platformFee: platformInfo.fee,
      estimatedWeightLbs: estimateWeight(category, title)
    });

    // Log everything to Supabase
    const { data: dbListing } = await supabase
      .from('listings')
      .insert({
        pipeline_run_id: pipelineRunId,
        source: 'facebook_marketplace',
        source_listing_id: listingId,
        source_url: `https://www.facebook.com/marketplace/item/${listingId}`,
        title,
        source_price: sourcePrice,
        ebay_median_sold: comps.median,
        ebay_comp_count: comps.count,
        net_margin: margin.netMargin,
        margin_percent: margin.marginPercent,
        target_platform: platformInfo.platform,
        category,
        photos: detail?.photos?.map(p => p.url) || [listing.primary_photo?.url].filter(Boolean),
        seller_signal_score: signalScore.score,
        seller_signal_flags: signalScore.flags,
        seasonal_boost: seasonalBoost,
        status: 'found',
        created_at: new Date().toISOString()
      })
      .select().single();

    // Fire alert if margin meets (or is close to with signal boost) threshold
    const adjustedMinMargin = thresholds.min_margin_dollars / signalScore.multiplier;
    const adjustedMinPercent = thresholds.min_margin_percent / signalScore.multiplier;

    if (margin.netMargin >= adjustedMinMargin && margin.marginPercent >= adjustedMinPercent) {
      await sendDealAlert({
        listingId: dbListing.id,
        title,
        sourcePrice,
        sourceUrl: `https://www.facebook.com/marketplace/item/${listingId}`,
        photo: detail?.photos?.[0]?.url || listing.primary_photo?.url || null,
        ebayMedianSold: comps.median,
        netMargin: margin.netMargin,
        marginPercent: margin.marginPercent,
        targetPlatform: platformInfo.platform,
        estimatedFees: margin.fees,
        estimatedShipping: margin.shippingCost,
        source: 'FB Marketplace',
        signalFlags: signalScore.flags,
        seasonalBoost
      });

      await supabase.from('listings').update({ status: 'alerted' }).eq('id', dbListing.id);
      return { alerted: true };
    }

    return { alerted: false };
  } catch (err) {
    console.error('  [processListing] Error:', err.message);
    return null;
  }
}

function estimateWeight(category, title) {
  const text = (category + ' ' + title).toLowerCase();
  if (text.includes('golf bag')) return 10;
  if (text.includes('golf')) return 7;
  if (text.includes('ski') || text.includes('snowboard')) return 6;
  if (text.includes('bike')) return 22;
  if (text.includes('guitar') || text.includes('bass guitar')) return 8;
  if (text.includes('drum')) return 15;
  if (text.includes('instrument')) return 7;
  if (text.includes('camera') || text.includes('lens')) return 2;
  if (text.includes('stroller')) return 18;
  if (text.includes('tool') || text.includes('drill') || text.includes('saw')) return 5;
  if (text.includes('phone') || text.includes('iphone')) return 0.4;
  if (text.includes('laptop') || text.includes('macbook')) return 4;
  if (text.includes('cooler')) return 15;
  return 3;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { runSociaVaultPipeline };
