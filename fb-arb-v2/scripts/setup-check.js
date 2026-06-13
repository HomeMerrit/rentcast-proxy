require('dotenv').config();
const axios = require('axios');

async function checkSetup() {
  console.log('\n=== Setup Check ===\n');
  let allGood = true;

  function check(name, value, hint) {
    if (value && value !== `your_${name.toLowerCase().replace(/ /g, '_')}_here`) {
      console.log(`  ✅ ${name}`);
    } else {
      console.log(`  ❌ ${name} — ${hint}`);
      allGood = false;
    }
  }

  check('SOCIAVAULT_API_KEY', process.env.SOCIAVAULT_API_KEY, 'Get from sociavault.com');
  check('EBAY_APP_ID', process.env.EBAY_APP_ID, 'Get from developer.ebay.com → Production keys → Finding API');
  check('SUPABASE_URL', process.env.SUPABASE_URL, 'Get from Supabase project settings → API');
  check('SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY, 'Get from Supabase project settings → API');
  check('TELEGRAM_BOT_TOKEN', process.env.TELEGRAM_BOT_TOKEN, 'Message @BotFather on Telegram → /newbot');
  check('TELEGRAM_CHAT_ID', process.env.TELEGRAM_CHAT_ID, 'Message @userinfobot on Telegram');
  check('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY, 'Get from console.anthropic.com');

  if (!allGood) {
    console.log('\n❌ Fill in all keys in .env before running.\n');
    process.exit(1);
  }

  console.log('\nAll keys present. Testing live connections...\n');

  // Test SociaVault
  try {
    await axios.get('https://api.sociavault.com/v1/scrape/facebook-marketplace/location-search',
      { params: { query: 'Salt Lake City, UT' }, headers: { 'x-api-key': process.env.SOCIAVAULT_API_KEY } }
    );
    console.log('  ✅ SociaVault API — connected');
  } catch (err) {
    console.log(`  ❌ SociaVault API — ${err.response?.status || err.message}`);
    allGood = false;
  }

  // Test Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { error } = await sb.from('sourcing_runs').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('  ❌ Supabase — tables not found. Run db/schema.sql in your Supabase SQL Editor.');
      allGood = false;
    } else if (error) {
      console.log(`  ❌ Supabase — ${error.message}`);
      allGood = false;
    } else {
      console.log('  ✅ Supabase — connected, tables exist');
    }
  } catch (err) {
    console.log(`  ❌ Supabase — ${err.message}`);
    allGood = false;
  }

  if (allGood) {
    console.log('\n✅ All systems go. Run: npm start\n');
  } else {
    console.log('\n❌ Fix the errors above, then re-run: node scripts/setup-check.js\n');
    process.exit(1);
  }
}

checkSetup().catch(console.error);
