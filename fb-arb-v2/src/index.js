require('dotenv').config();
const cron = require('node-cron');
const { runSociaVaultPipeline } = require('./sourcing/sociavault');
const { runMisspellPipeline } = require('./sourcing/ebay-misspell');
const { runWeeklyBrain } = require('./brain/weekly-optimizer');
const { supabase } = require('./db/supabase');
const { loadConfig } = require('./config-loader');
const { initBot } = require('./alerts/telegram');

// Every 2 hours by default. Each run fans out across all search_queries, and each
// query/listing burns SociaVault + eBay credits — running every 30 min blows past
// the SociaVault free tier (100/day) in a single run. Override with PIPELINE_CRON.
const PIPELINE_CRON = process.env.PIPELINE_CRON || '0 */2 * * *';
const BRAIN_CRON = process.env.BRAIN_CRON || '0 0 * * 0'; // Sunday midnight
const IS_TEST = process.argv.includes('--test');
const RUN_BRAIN_NOW = process.argv.includes('--brain');

async function runPipeline() {
  const runId = `run_${Date.now()}`;
  const cfg = loadConfig();
  console.log(`\n[${new Date().toISOString()}] Pipeline start — ${runId} (config v${cfg.version})`);

  const { data: run } = await supabase
    .from('sourcing_runs')
    .insert({ run_id: runId, started_at: new Date().toISOString(), status: 'running', config_version: cfg.version })
    .select().single();

  let totalFound = 0, totalAlerted = 0;

  try {
    // ── Source 1: Facebook Marketplace via SociaVault ─────────────────────
    console.log('[Pipeline] SociaVault FB Marketplace...');
    const svResults = await runSociaVaultPipeline(runId, cfg);
    totalFound += svResults.found;
    totalAlerted += svResults.alerted;
    console.log(`[Pipeline] SociaVault: ${svResults.found} found, ${svResults.alerted} alerted`);

    // ── Source 2: eBay Misspelled Listings ────────────────────────────────
    console.log('[Pipeline] eBay misspell finder...');
    const misspellResults = await runMisspellPipeline(runId, cfg);
    totalFound += misspellResults.found;
    totalAlerted += misspellResults.alerted;
    console.log(`[Pipeline] Misspell: ${misspellResults.found} found, ${misspellResults.alerted} alerted`);

    await supabase.from('sourcing_runs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      items_found: totalFound,
      items_alerted: totalAlerted
    }).eq('run_id', runId);

    console.log(`[Pipeline] Done — ${totalFound} found, ${totalAlerted} alerted\n`);
  } catch (err) {
    console.error('[Pipeline] Fatal error:', err.message);
    await supabase.from('sourcing_runs').update({
      status: 'error', error_message: err.message, completed_at: new Date().toISOString()
    }).eq('run_id', runId);
  }
}

async function main() {
  console.log('FB Arbitrage Engine v2 starting...');

  if (RUN_BRAIN_NOW) {
    console.log('Running Brain manually...');
    await runWeeklyBrain();
    process.exit(0);
  }

  // Start the Telegram bot up front so commands + approve/skip buttons work
  // immediately, even before the first deal alert fires. (Skipped in --test:
  // the test run sends one alert and exits, and a polling bot would hang it.)
  if (!IS_TEST) initBot();

  await runPipeline();

  if (IS_TEST) {
    console.log('Test mode — exiting after single run');
    process.exit(0);
  }

  cron.schedule(PIPELINE_CRON, runPipeline);
  console.log(`Pipeline cron: ${PIPELINE_CRON}`);

  cron.schedule(BRAIN_CRON, async () => {
    console.log('[Brain] Weekly optimization run starting...');
    await runWeeklyBrain();
  });
  console.log(`Brain cron: ${BRAIN_CRON}`);
}

main().catch(console.error);
