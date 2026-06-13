require('dotenv').config();
const axios = require('axios');

async function testAll() {
  console.log('\n=== FB Arb v2 — Component Tests ===\n');
  let passed = 0, failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Config loader
  await test('Config loader', () => {
    const { loadConfig } = require('../src/config-loader');
    const cfg = loadConfig();
    if (!cfg.version) throw new Error('No version in config');
    console.log(`     → v${cfg.version}, ${cfg.search_queries?.length} queries`);
  });

  // 2. SociaVault location resolve
  await test('SociaVault location resolve', async () => {
    const res = await axios.get(
      'https://api.sociavault.com/v1/scrape/facebook-marketplace/location-search',
      { params: { query: process.env.SEARCH_LOCATION_QUERY || 'Salt Lake City, UT' },
        headers: { 'x-api-key': process.env.SOCIAVAULT_API_KEY } }
    );
    const loc = res.data.locations?.[0];
    if (!loc) throw new Error('No location returned');
    console.log(`     → ${loc.name} (${loc.latitude}, ${loc.longitude})`);
  });

  // 3. eBay sold comps
  await test('eBay sold comps (DeWalt drill)', async () => {
    const { getEbaySoldComps } = require('../src/enrichment/ebay-comps');
    const comps = await getEbaySoldComps('DeWalt drill 20v');
    if (!comps.median) throw new Error('No median returned');
    console.log(`     → median $${comps.median}, ${comps.count} sales`);
  });

  // 4. Margin calculator
  await test('Margin calculator', () => {
    const { calculateMargin } = require('../src/enrichment/margin');
    const m = calculateMargin({ sourcePrice: 45, targetSalePrice: 108, platformFee: 0.1325, estimatedWeightLbs: 5 });
    if (m.netMargin <= 0) throw new Error('Negative margin on test case');
    console.log(`     → $${m.netMargin} net (${m.marginPercent}%)`);
  });

  // 5. Seller signals
  await test('Seller signal scoring', () => {
    const { scoreSellerSignals } = require('../src/sourcing/seller-signals');
    const s = scoreSellerSignals('Must sell, moving to Seattle next week', {});
    if (s.multiplier <= 1.0) throw new Error('Should detect signals');
    console.log(`     → score ${s.score}, flags: ${s.flags.join(', ')}`);
  });

  // 6. Supabase connection
  await test('Supabase connection', async () => {
    const { supabase } = require('../src/db/supabase');
    const { error } = await supabase.from('sourcing_runs').select('id').limit(1);
    if (error) throw new Error(error.message + ' — did you run db/schema.sql?');
  });

  // 7. Telegram alert (sends real test message)
  await test('Telegram alert (check your phone)', async () => {
    const { sendDealAlert } = require('../src/alerts/telegram');
    await sendDealAlert({
      listingId: 'test_' + Date.now(),
      title: '✅ TEST — DeWalt 20V Drill Kit (ignore this)',
      sourcePrice: 45,
      sourceUrl: 'https://facebook.com/marketplace',
      photo: null,
      ebayMedianSold: 120,
      netMargin: 47.50,
      marginPercent: 105.6,
      targetPlatform: 'eBay',
      estimatedFees: 14.85,
      estimatedShipping: 14,
      source: 'TEST',
      signalFlags: ['moving'],
      seasonalBoost: 1.0
    });
  });

  // 8. Claude API
  await test('Claude API (description gen)', async () => {
    const { generateListingDescription } = require('../src/listing/description-gen');
    const d = await generateListingDescription({
      title: 'DeWalt 20V MAX Drill Driver Kit', category: 'tools',
      condition: 'Used - Good', platform: 'eBay'
    });
    if (!d.title) throw new Error('No title returned');
    console.log(`     → "${d.title.substring(0, 50)}..."`);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) console.log('Fix failures before running the pipeline.');
  process.exit(failed > 0 ? 1 : 0);
}

testAll().catch(console.error);
