const { createClient } = require('@supabase/supabase-js');
const { calcPlatformFee } = require('../enrichment/margin');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function markSold({ listingId, soldPrice, soldPlatform, notes }) {
  const { data: listing } = await supabase
    .from('listings')
    .select('source_price, net_margin, est_shipping')
    .eq('id', listingId)
    .single();

  // Actual NET margin = sale price − cost − real platform fee on the sale − shipping.
  // Use the platform actually sold on (may differ from the predicted one) and the
  // shipping estimate captured when the deal was found, so this is comparable to the
  // predicted net_margin the Brain optimizes against.
  const actualMargin = listing
    ? parseFloat((
        soldPrice
        - (listing.source_price || 0)
        - calcPlatformFee(soldPlatform, soldPrice)
        - (listing.est_shipping || 0)
      ).toFixed(2))
    : null;

  await supabase.from('listings').update({
    status: 'sold',
    sold_at: new Date().toISOString()
  }).eq('id', listingId);

  await supabase.from('sold_items').insert({
    listing_id: listingId,
    sold_price: soldPrice,
    sold_platform: soldPlatform,
    actual_margin: actualMargin,
    predicted_margin: listing?.net_margin,
    sold_at: new Date().toISOString(),
    notes
  });

  return { actualMargin };
}

async function getApprovedPending() {
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'approved')
    .is('sold_at', null)
    .order('approved_at', { ascending: false });
  return data || [];
}

module.exports = { supabase, markSold, getApprovedPending };
