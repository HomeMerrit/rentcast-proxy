const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function markSold({ listingId, soldPrice, soldPlatform, notes }) {
  const { data: listing } = await supabase
    .from('listings')
    .select('source_price, net_margin')
    .eq('id', listingId)
    .single();

  const actualMargin = listing
    ? soldPrice - (listing.source_price || 0)
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
