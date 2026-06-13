require('dotenv').config();
const readline = require('readline');
const { supabase, markSold } = require('../src/db/supabase');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  console.log('\n=== Mark Item Sold ===\n');

  // Show approved items waiting to be marked sold
  const { data: pending } = await supabase
    .from('listings')
    .select('id, title, source_price, net_margin, target_platform, approved_at')
    .eq('status', 'approved')
    .is('sold_at', null)
    .order('approved_at', { ascending: false })
    .limit(20);

  if (!pending?.length) {
    console.log('No approved items waiting to be marked sold.');
    rl.close();
    return;
  }

  console.log('Approved items:\n');
  pending.forEach((item, i) => {
    console.log(`${i + 1}. ${item.title.substring(0, 60)}`);
    console.log(`   Bought: $${item.source_price} | Predicted net: $${item.net_margin?.toFixed(2)} | Platform: ${item.target_platform}`);
    console.log(`   ID: ${item.id}\n`);
  });

  const choice = await ask('Enter item number (or ID): ');
  let listingId;

  const num = parseInt(choice);
  if (num >= 1 && num <= pending.length) {
    listingId = pending[num - 1].id;
    console.log(`\nSelected: ${pending[num - 1].title}`);
  } else {
    listingId = choice.trim();
  }

  const soldPriceStr = await ask('Sold price (e.g. 115): $');
  const soldPrice = parseFloat(soldPriceStr);
  if (isNaN(soldPrice) || soldPrice <= 0) {
    console.log('Invalid price. Exiting.');
    rl.close();
    return;
  }

  const platform = await ask('Platform sold on (eBay/Mercari/Reverb/etc): ');
  const notes = await ask('Notes (optional, press enter to skip): ');

  const { actualMargin } = await markSold({
    listingId,
    soldPrice,
    soldPlatform: platform.trim(),
    notes: notes.trim() || null
  });

  console.log(`\n✅ Marked as sold!`);
  console.log(`   Sold for: $${soldPrice}`);
  console.log(`   Actual margin: $${actualMargin?.toFixed(2) || 'unknown'}`);
  console.log(`   This data feeds the Brain's next optimization run.\n`);

  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
