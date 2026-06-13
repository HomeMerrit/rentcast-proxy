require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../db/supabase');
const { loadConfig, saveConfig } = require('../config-loader');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── The Brain: reads 30 days of real outcomes, updates system config ───────────
async function runWeeklyBrain() {
  console.log('[Brain] Starting weekly optimization run...');

  try {
    const performanceData = await gatherPerformanceData();
    const currentConfig = loadConfig();
    const optimizedConfig = await optimizeConfig(currentConfig, performanceData);

    // Save to file
    saveConfig(optimizedConfig);

    // Archive to Supabase for audit trail
    await supabase.from('system_configs').insert({
      version: optimizedConfig.version,
      config: optimizedConfig,
      generated_at: optimizedConfig.generated_at,
      brain_notes: optimizedConfig.brain_notes,
      performance_summary: performanceData.summary
    });

    // Send weekly report to Telegram
    await sendBrainReport(performanceData, optimizedConfig);

    console.log(`[Brain] Complete — config updated to v${optimizedConfig.version}`);
  } catch (err) {
    console.error('[Brain] Error:', err.message);
    // Notify on Telegram
    try {
      const TelegramBot = require('node-telegram-bot-api');
      const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
      await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `⚠️ Brain run failed: ${err.message}`);
    } catch {}
  }
}

// ── Gather 30 days of performance data from Supabase ────────────────────────
async function gatherPerformanceData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All listings from last 30 days
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .gte('created_at', thirtyDaysAgo);

  // All operator decisions
  const { data: decisions } = await supabase
    .from('decisions')
    .select('*, listings(category, source_price, net_margin, margin_percent, target_platform, seller_signal_score, source, source_listing_id)')
    .gte('decided_at', thirtyDaysAgo);

  // All sold items
  const { data: soldItems } = await supabase
    .from('sold_items')
    .select('*, listings(category, source_price, ebay_median_sold, net_margin, target_platform, created_at)')
    .gte('sold_at', thirtyDaysAgo);

  // Sourcing run stats
  const { data: runs } = await supabase
    .from('sourcing_runs')
    .select('items_found, items_alerted, config_version')
    .gte('started_at', thirtyDaysAgo);

  // ── Compute analytics ────────────────────────────────────────────────────
  const approved = decisions?.filter(d => d.decision === 'approved') || [];
  const skipped = decisions?.filter(d => d.decision === 'skipped') || [];
  const totalDecisions = decisions?.length || 0;

  // Approval rate by category
  const categoryStats = {};
  for (const d of decisions || []) {
    const cat = d.listings?.category || 'unknown';
    if (!categoryStats[cat]) categoryStats[cat] = { approved: 0, skipped: 0, totalMargin: 0 };
    if (d.decision === 'approved') {
      categoryStats[cat].approved++;
      categoryStats[cat].totalMargin += d.listings?.net_margin || 0;
    }
    if (d.decision === 'skipped') categoryStats[cat].skipped++;
  }

  // Sales velocity by category
  const salesVelocity = {};
  for (const sale of soldItems || []) {
    const cat = sale.listings?.category || 'unknown';
    const listedAt = new Date(sale.listings?.created_at);
    const soldAt = new Date(sale.sold_at);
    const daysToSell = (soldAt - listedAt) / (1000 * 60 * 60 * 24);

    if (!salesVelocity[cat]) salesVelocity[cat] = { sales: 0, totalDays: 0, totalActualMargin: 0, totalPredictedMargin: 0 };
    salesVelocity[cat].sales++;
    salesVelocity[cat].totalDays += daysToSell;
    salesVelocity[cat].totalActualMargin += sale.actual_margin || sale.sold_price - (sale.listings?.source_price || 0);
    salesVelocity[cat].totalPredictedMargin += sale.listings?.net_margin || 0;
  }

  // Platform performance
  const platformStats = {};
  for (const sale of soldItems || []) {
    const platform = sale.sold_platform;
    if (!platformStats[platform]) platformStats[platform] = { sales: 0, totalMargin: 0, totalDays: 0 };
    platformStats[platform].sales++;
    platformStats[platform].totalMargin += sale.actual_margin || 0;
  }

  // Seller signal effectiveness
  const highSignalApprovalRate = approved.filter(d => (d.listings?.seller_signal_score || 0) > 50).length /
    Math.max(1, decisions?.filter(d => (d.listings?.seller_signal_score || 0) > 50).length || 1);

  // Source quality
  const fbApprovalRate = approved.filter(d => d.listings?.source === 'facebook_marketplace').length /
    Math.max(1, decisions?.filter(d => d.listings?.source === 'facebook_marketplace').length || 1);
  const misspellApprovalRate = approved.filter(d => d.listings?.source === 'ebay_misspell').length /
    Math.max(1, decisions?.filter(d => d.listings?.source === 'ebay_misspell').length || 1);

  const summary = {
    period: '30 days',
    totalListingsFound: listings?.length || 0,
    totalAlerted: listings?.filter(l => l.status === 'alerted').length || 0,
    totalDecisions,
    approvalRate: totalDecisions > 0 ? (approved.length / totalDecisions) : 0,
    totalSales: soldItems?.length || 0,
    fbApprovalRate,
    misspellApprovalRate,
    highSignalApprovalRate,
    categoryStats,
    salesVelocity,
    platformStats
  };

  return { listings, decisions, soldItems, runs, categoryStats, salesVelocity, platformStats, summary };
}

// ── Feed data to Claude and get optimized config back ───────────────────────
async function optimizeConfig(currentConfig, performanceData) {
  const { summary, categoryStats, salesVelocity, platformStats } = performanceData;

  // Build compact performance report for Claude
  const performanceReport = {
    overview: {
      approval_rate: `${(summary.approvalRate * 100).toFixed(1)}%`,
      total_decisions: summary.totalDecisions,
      total_sales: summary.totalSales,
      fb_marketplace_approval_rate: `${(summary.fbApprovalRate * 100).toFixed(1)}%`,
      ebay_misspell_approval_rate: `${(summary.misspellApprovalRate * 100).toFixed(1)}%`,
      high_seller_signal_approval_rate: `${(summary.highSignalApprovalRate * 100).toFixed(1)}%`
    },
    by_category: {},
    sales_velocity: {},
    platform_performance: {}
  };

  for (const [cat, stats] of Object.entries(categoryStats)) {
    const total = stats.approved + stats.skipped;
    performanceReport.by_category[cat] = {
      approval_rate: total > 0 ? `${((stats.approved / total) * 100).toFixed(0)}%` : 'no data',
      approvals: stats.approved,
      skipped: stats.skipped,
      avg_approved_margin: stats.approved > 0 ? `$${(stats.totalMargin / stats.approved).toFixed(0)}` : 'n/a'
    };
  }

  for (const [cat, stats] of Object.entries(salesVelocity)) {
    const accuracyPct = stats.totalPredictedMargin > 0
      ? ((stats.totalActualMargin / stats.totalPredictedMargin) * 100).toFixed(0)
      : 'n/a';
    performanceReport.sales_velocity[cat] = {
      sales: stats.sales,
      avg_days_to_sell: stats.sales > 0 ? (stats.totalDays / stats.sales).toFixed(1) : 'n/a',
      margin_accuracy: `${accuracyPct}%`
    };
  }

  for (const [platform, stats] of Object.entries(platformStats)) {
    performanceReport.platform_performance[platform] = {
      sales: stats.sales,
      avg_margin: stats.sales > 0 ? `$${(stats.totalMargin / stats.sales).toFixed(0)}` : 'n/a'
    };
  }

  const prompt = `You are the optimization brain for an arbitrage reselling business. 
Your job is to update the system configuration based on 30 days of real performance data.

CURRENT CONFIG (v${currentConfig.version}):
${JSON.stringify(currentConfig, null, 2)}

PERFORMANCE DATA (last 30 days):
${JSON.stringify(performanceReport, null, 2)}

OPTIMIZATION RULES:
1. If a category has < 20% approval rate → raise its min_margin_dollars threshold
2. If a category has > 60% approval rate → carefully lower its min_margin_dollars (more deals pass through)
3. If a category's margin accuracy is < 80% (actual < predicted) → lower comp_multiplier
4. If a category's margin accuracy is > 110% → raise comp_multiplier
5. If a category sells in < 5 days on average → it's hot, consider lowering threshold slightly
6. If a category hasn't sold in 30 days → flag it, raise threshold
7. If eBay misspell approval rate > FB approval rate → increase misspell_targets list weight
8. If seller signals correlate with approval → don't change signal weights (they're working)
9. Search query weights should reflect actual approval rates — reduce weight of queries with <10% approval
10. Never make changes larger than ±20% of current value in a single week (avoid overcorrection)
11. If fewer than 10 decisions total, be very conservative — not enough signal yet

OUTPUT: Return a complete updated config JSON. Include:
- Updated version number (increment by 1)
- brain_notes field explaining what changed and why (be specific)
- All updated thresholds, search_weights, comp_multipliers based on data
- Keep fields unchanged if there's insufficient data

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const responseText = msg.content[0].text.trim().replace(/```json|```/g, '').trim();

  try {
    const optimized = JSON.parse(responseText);
    optimized.generated_by = 'weekly_brain';
    return optimized;
  } catch (err) {
    console.error('[Brain] Failed to parse Claude response — keeping current config');
    console.error('[Brain] Response was:', responseText.substring(0, 200));
    return { ...currentConfig, brain_notes: 'Brain ran but output parsing failed — config unchanged' };
  }
}

// ── Send weekly Telegram summary ─────────────────────────────────────────────
async function sendBrainReport(performanceData, newConfig) {
  try {
    const TelegramBot = require('node-telegram-bot-api');
    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    const { summary } = performanceData;

    const topCategory = Object.entries(performanceData.categoryStats)
      .sort(([,a], [,b]) => b.approved - a.approved)[0];

    const report = `🧠 *Weekly Brain Report — Config v${newConfig.version}*

📊 *Last 30 Days:*
• Listings found: ${summary.totalListingsFound}
• Decisions made: ${summary.totalDecisions}
• Approval rate: ${(summary.approvalRate * 100).toFixed(0)}%
• Sales completed: ${summary.totalSales}

🔥 *Top Category:* ${topCategory ? `${topCategory[0]} (${topCategory[1].approved} approved)` : 'Insufficient data'}

🤖 *What Changed:*
${newConfig.brain_notes || 'No changes — insufficient data'}

_Config v${newConfig.version} now active_`;

    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, report, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[Brain] Telegram report failed:', err.message);
  }
}

module.exports = { runWeeklyBrain };
