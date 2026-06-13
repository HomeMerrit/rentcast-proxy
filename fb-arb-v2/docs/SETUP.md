# Setup Guide

## Step 1 — Get API Keys

### SociaVault (FB Marketplace data)
1. Go to sociavault.com
2. Sign up (free tier: 100 req/day, Starter: 1,000/day)
3. Copy API key → `SOCIAVAULT_API_KEY`

### eBay Finding API
1. Go to developer.ebay.com → Sign in
2. Create an application
3. Get **Production** keys (not Sandbox)
4. Copy App ID → `EBAY_APP_ID`

### Supabase
1. Go to supabase.com → New project
2. Project Settings → API
3. Copy Project URL → `SUPABASE_URL`
4. Copy `anon` public key → `SUPABASE_ANON_KEY`
5. Go to SQL Editor → New Query → paste entire `db/schema.sql` → Run

### Telegram Bot
1. Open Telegram → message @BotFather
2. `/newbot` → follow prompts → copy token → `TELEGRAM_BOT_TOKEN`
3. Open Telegram → message @userinfobot → copy your ID → `TELEGRAM_CHAT_ID`
4. Start your bot (search its name, hit Start) so it can message you

### Anthropic
1. console.anthropic.com → API Keys → Create key
2. Copy → `ANTHROPIC_API_KEY`

---

## Step 2 — Install & Configure

```bash
# Clone or unzip the project
cd fb-arb-v2

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with all your keys (use any text editor)
```

---

## Step 3 — Verify Setup

```bash
node scripts/setup-check.js
```

All ✅? Move on. If not, the script tells you exactly what's wrong.

---

## Step 4 — Run Tests

```bash
npm test
```

This tests every component and sends a test Telegram alert. Check your phone.
8 green checks = ready.

---

## Step 5 — Go Live

```bash
npm start
```

Pipeline runs every 30 minutes. Brain runs Sunday midnight.

---

## Step 6 — Daily Operations

When Telegram fires:
- Tap **✅ Go Get It** → it's logged as approved, go pick it up
- Tap **❌ Skip** → logged as skipped, signal feeds the Brain

When you sell something:
```bash
node scripts/mark-sold.js
```
Enter what it sold for and where. This is the most important step — it's what teaches
the Brain whether its margin predictions are accurate.

---

## Commands

| Command | What it does |
|---|---|
| `/stats` | 7-day performance summary |
| `/pending` | Approved items waiting on pickup |
| `/config` | Current brain config version + notes |
| `/help` | All commands |

---

## Running the Brain Manually

```bash
node src/index.js --brain
```

Useful to trigger a brain run before Sunday if you've accumulated enough data.
Needs at least ~10 decisions to produce meaningful output.

---

## Upgrading Search Categories

Edit `config/system-config.json` → `search_queries` array. Add or remove entries.
The Brain will automatically learn which ones perform well and adjust weights accordingly.
