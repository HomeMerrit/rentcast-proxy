const TelegramBot = require('node-telegram-bot-api');
const { supabase } = require('../db/supabase');
const { loadConfig } = require('../config-loader');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let _bot = null;

function getBot() {
  if (!_bot) {
    _bot = new TelegramBot(BOT_TOKEN, { polling: true });
    setupHandlers(_bot);
  }
  return _bot;
}

function esc(text) {
  return (text || '').toString().replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// ── Format deal alert message ─────────────────────────────────────────────────
function buildMessage(deal) {
  const { title, sourcePrice, ebayMedianSold, netMargin, marginPercent,
    targetPlatform, estimatedFees, estimatedShipping, source,
    signalFlags, seasonalBoost, note } = deal;

  const emoji = netMargin >= 100 ? '🔥🔥' : netMargin >= 70 ? '🔥' : netMargin >= 45 ? '✅' : '📦';
  const signalLine = signalFlags?.length ? `\n🚨 *Signals:* ${signalFlags.join(', ')}` : '';
  const seasonLine = (seasonalBoost && seasonalBoost > 1.1) ? `\n🌡️ *Seasonal boost:* ${seasonalBoost.toFixed(1)}x` : '';
  const noteLine = note ? `\n📝 ${esc(note)}` : '';

  return `${emoji} *DEAL — ${esc(source)}*
*${esc(title)}*

💰 Buy: *$${sourcePrice.toFixed(2)}*
📊 eBay Median: *$${ebayMedianSold.toFixed(2)}*
🏪 Sell on: *${esc(targetPlatform)}*

💵 Net: *$${netMargin.toFixed(2)} (${marginPercent.toFixed(0)}%)*
💳 Fees: $${estimatedFees.toFixed(2)}  📦 Ship: $${estimatedShipping.toFixed(2)}${signalLine}${seasonLine}${noteLine}`;
}

// ── Send deal alert ───────────────────────────────────────────────────────────
async function sendDealAlert(deal) {
  const b = getBot();
  const message = buildMessage(deal);

  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Go Get It', callback_data: `approve_${deal.listingId}` },
      { text: '❌ Skip',      callback_data: `skip_${deal.listingId}` },
      { text: '🔗 View',     url: deal.sourceUrl }
    ]]
  };

  try {
    if (deal.photo) {
      await b.sendPhoto(CHAT_ID, deal.photo, {
        caption: message, parse_mode: 'Markdown', reply_markup: keyboard
      });
    } else {
      await b.sendMessage(CHAT_ID, message, {
        parse_mode: 'Markdown', reply_markup: keyboard, disable_web_page_preview: false
      });
    }
    console.log(`  [Telegram] Alert sent: "${deal.title}" → $${deal.netMargin.toFixed(2)} net`);
  } catch (err) {
    // Fallback: no photo
    console.error('  [Telegram] Alert error:', err.message);
    try {
      await b.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {}
  }
}

// ── Button handlers ───────────────────────────────────────────────────────────
function setupHandlers(b) {
  b.on('callback_query', async (query) => {
    const { data, message, id } = query;

    if (data.startsWith('approve_')) {
      const listingId = data.replace('approve_', '');
      await handleApprove(listingId);
      await b.answerCallbackQuery(id, { text: '✅ Go get it!' });
      await b.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: '✅ APPROVED', callback_data: 'done' }]] },
        { chat_id: message.chat.id, message_id: message.message_id }
      ).catch(() => {});
    }

    if (data.startsWith('skip_')) {
      const listingId = data.replace('skip_', '');
      await handleSkip(listingId);
      await b.answerCallbackQuery(id, { text: '❌ Skipped' });
      await b.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: '❌ Skipped', callback_data: 'done' }]] },
        { chat_id: message.chat.id, message_id: message.message_id }
      ).catch(() => {});
    }

    if (data.startsWith('sold_')) {
      const listingId = data.replace('sold_', '');
      await b.answerCallbackQuery(id, { text: '💰 Mark sold — reply with: SOLD $[price] [platform]' });
    }
  });

  // /stats — pipeline performance
  b.onText(/\/stats/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const stats = await getStats();
    await b.sendMessage(CHAT_ID, stats, { parse_mode: 'Markdown' });
  });

  // /pending — show approved items awaiting pickup
  b.onText(/\/pending/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const pending = await getPending();
    await b.sendMessage(CHAT_ID, pending, { parse_mode: 'Markdown' });
  });

  // /config — show current brain config version + notes
  b.onText(/\/config/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    const cfg = loadConfig();
    const text = `🤖 *System Config v${cfg.version}*\n_${cfg.generated_at}_\n\n${cfg.brain_notes || 'Initial defaults'}`;
    await b.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
  });

  // /help
  b.onText(/\/help/, async (msg) => {
    if (String(msg.chat.id) !== String(CHAT_ID)) return;
    await b.sendMessage(CHAT_ID,
      `*Arb Bot Commands*\n\n/stats — Last 7 days performance\n/pending — Approved items waiting on pickup\n/config — Current brain config version\n/help — This message`,
      { parse_mode: 'Markdown' }
    );
  });
}

async function handleApprove(listingId) {
  await supabase.from('listings').update({
    status: 'approved', approved_at: new Date().toISOString()
  }).eq('id', listingId);

  await supabase.from('decisions').insert({
    listing_id: listingId, decision: 'approved', decided_at: new Date().toISOString()
  });
}

async function handleSkip(listingId) {
  await supabase.from('listings').update({
    status: 'skipped', skipped_at: new Date().toISOString()
  }).eq('id', listingId);

  await supabase.from('decisions').insert({
    listing_id: listingId, decision: 'skipped', decided_at: new Date().toISOString()
  });
}

async function getStats() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: runs } = await supabase.from('sourcing_runs').select('items_found, items_alerted').gte('started_at', since);
  const { data: decisions } = await supabase.from('decisions').select('decision').gte('decided_at', since);
  const { data: sold } = await supabase.from('sold_items').select('actual_margin').gte('sold_at', since);
  const cfg = loadConfig();

  const found = runs?.reduce((a, r) => a + (r.items_found || 0), 0) || 0;
  const alerted = runs?.reduce((a, r) => a + (r.items_alerted || 0), 0) || 0;
  const approved = decisions?.filter(d => d.decision === 'approved').length || 0;
  const skipped = decisions?.filter(d => d.decision === 'skipped').length || 0;
  const totalProfit = sold?.reduce((a, s) => a + (s.actual_margin || 0), 0) || 0;

  return `📊 *Stats — Last 7 Days*

🔍 Scanned: ${found}
🔔 Alerted: ${alerted}
✅ Approved: ${approved}
❌ Skipped: ${skipped}
📈 Approval: ${alerted > 0 ? ((approved / alerted) * 100).toFixed(0) : 0}%
💰 Sales profit: $${totalProfit.toFixed(2)}
🤖 Config: v${cfg.version}`;
}

async function getPending() {
  const { data } = await supabase
    .from('listings')
    .select('title, source_price, net_margin, target_platform, approved_at, source_url')
    .eq('status', 'approved')
    .is('sold_at', null)
    .order('approved_at', { ascending: false })
    .limit(10);

  if (!data?.length) return '✅ No pending items — all clear!';

  const lines = data.map(l =>
    `• *${esc(l.title.substring(0, 40))}*\n  $${l.source_price} → $${l.net_margin?.toFixed(0)} net on ${l.target_platform}`
  );

  return `📋 *Pending Pickups (${data.length}):*\n\n${lines.join('\n\n')}`;
}

module.exports = { sendDealAlert };
