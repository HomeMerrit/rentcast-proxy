const Anthropic = require('@anthropic-ai/sdk');
const { getEbaySoldComps, searchEbayCurrentListings } = require('../enrichment/ebay-comps');
const { calculateMargin } = require('../enrichment/margin');
const { getCategoryThreshold, getPlatformRouting } = require('../config-loader');
const { sendDealAlert } = require('../alerts/telegram');
const { supabase } = require('../db/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateMisspellings(product) {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Generate 10 realistic misspellings/typos for eBay search: "${product}"
Include: transposed letters, missing letters, phonetic variations, common abbreviations.
Return ONLY a JSON array of strings. No explanation, no markdown.
Example: ["dewalt dril", "dewallt drill", "dewalt drll"]`
      }]
    });

    const text = msg.content[0].text.trim().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch {
    return [];
  }
}

async function runMisspellPipeline(pipelineRunId, cfg) {
  let totalFound = 0, totalAlerted = 0;
  const targets = cfg.ebay_misspell_targets || [];

  for (const target of targets) {
    try {
      const comps = await getEbaySoldComps(target.product);
      if (!comps || comps.median <= 0 || comps.count < 5) continue;

      console.log(`  [Misspell] "${target.product}" — median: $${comps.median} (${comps.count} sales)`);

      const misspellings = await generateMisspellings(target.product);
      if (!misspellings.length) continue;

      const threshold = target.threshold || 0.60;
      const maxPrice = comps.median * threshold;

      for (const misspelling of misspellings) {
        const listings = await searchEbayCurrentListings(misspelling, { maxPrice });

        for (const listing of listings) {
          const result = await processMisspellListing(listing, target, comps, cfg, pipelineRunId);
          if (result) {
            totalFound++;
            if (result.alerted) totalAlerted++;
          }
        }
        await sleep(400);
      }

      await sleep(2000);
    } catch (err) {
      console.error(`  [Misspell] Error for "${target.product}":`, err.message);
    }
  }

  return { found: totalFound, alerted: totalAlerted };
}

async function processMisspellListing(listing, target, comps, cfg, pipelineRunId) {
  try {
    const sourcePrice = parseFloat(listing.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0);
    const sourceUrl = listing.viewItemURL?.[0] || '';
    const listingId = listing.itemId?.[0] || sourceUrl;
    const title = listing.title?.[0] || 'Unknown';
    const photos = listing.galleryURL ? [listing.galleryURL[0]] : [];

    if (!sourceUrl || sourcePrice <= 0) return null;
    if (sourcePrice >= comps.median * (target.threshold || 0.60)) return null;

    // Dedup
    const { data: existing } = await supabase
      .from('listings').select('id').eq('source_url', sourceUrl).single();
    if (existing) return null;

    const thresholds = getCategoryThreshold(cfg, target.category);
    const platformInfo = getPlatformRouting(cfg, target.category);
    const margin = calculateMargin({
      sourcePrice,
      targetSalePrice: comps.median * 0.90,
      platformFee: platformInfo.fee,
      estimatedWeightLbs: 3
    });

    const { data: dbListing } = await supabase
      .from('listings')
      .insert({
        pipeline_run_id: pipelineRunId,
        source: 'ebay_misspell',
        source_url: sourceUrl,
        source_listing_id: listingId,
        title,
        source_price: sourcePrice,
        ebay_median_sold: comps.median,
        ebay_comp_count: comps.count,
        net_margin: margin.netMargin,
        margin_percent: margin.marginPercent,
        target_platform: platformInfo.platform,
        category: target.category,
        photos,
        notes: 'eBay misspell — buy, rephoto, relist with correct title',
        status: 'found',
        created_at: new Date().toISOString()
      })
      .select().single();

    const minD = thresholds.min_margin_dollars || 35;
    const minP = thresholds.min_margin_percent || 35;

    if (margin.netMargin >= minD && margin.marginPercent >= minP) {
      await sendDealAlert({
        listingId: dbListing.id,
        title,
        sourcePrice,
        sourceUrl,
        photo: photos[0] || null,
        ebayMedianSold: comps.median,
        netMargin: margin.netMargin,
        marginPercent: margin.marginPercent,
        targetPlatform: platformInfo.platform,
        estimatedFees: margin.fees,
        estimatedShipping: margin.shippingCost,
        source: 'eBay Misspell',
        note: '⚡ Buy on eBay → rephoto → relist correct title'
      });

      await supabase.from('listings').update({ status: 'alerted' }).eq('id', dbListing.id);
      return { alerted: true };
    }

    return { alerted: false };
  } catch (err) {
    console.error('  [processMisspellListing] Error:', err.message);
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { runMisspellPipeline };
