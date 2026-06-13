# Operations Guide

## The Daily Loop

1. Telegram fires an alert → check the deal card
2. Tap ✅ Go Get It or ❌ Skip
3. If approved: message seller, go pick it up, cash in hand
4. Photograph at home (white wall, 8-10 shots)
5. List on the recommended platform
6. Ship when sold
7. Run `node scripts/mark-sold.js` — this is critical for the Brain

---

## Reading the Alert Card

```
🔥 DEAL — FB Marketplace
DeWalt 20V MAX Drill Kit

💰 Buy: $45.00
📊 eBay Median: $120.00
🏪 Sell on: eBay

💵 Net: $47.50 (105%)
💳 Fees: $14.85  📦 Ship: $14.00
🚨 Signals: moving, must sell
```

- **Net** = your take-home after fees + shipping
- **Signals** = listing language suggesting a motivated seller (better deals)
- **Sell on** = which platform the system recommends for this item type

---

## When to Approve

Go get it if:
- Net margin is $40+ and item looks clean in photos
- You recognize the brand (DeWalt, Gibson, Canon, UppaBaby...)
- You can pick it up today or tomorrow
- The seller responded to your message

Skip if:
- You can't pick it up within 24 hours (it'll be gone)
- Photos show damage not reflected in price
- Seller isn't responding
- Something feels off about the listing

---

## Picking Up

Message seller immediately when you approve:
> "Hi! Is this still available? I can pick up today/tomorrow, cash in hand."

Bring exact cash. Inspect before paying. Check it works (power on electronics,
check for damage not in photos, verify all accessories are there).

Don't lowball aggressively — losing a deal over $10 isn't worth it.

---

## Photography (10 Minutes = More Money)

All you need: light grey or white wall, window light, your phone camera.

**Standard shots:**
1. Front — straight on, clean
2. Back
3. Left side / Right side
4. Top / Bottom (for tools, cameras, etc.)
5. Brand label and model number
6. Any flaws or wear — be honest, prevents returns
7. What's in the box — all cables, accessories, case
8. Powered on (electronics — proves it works)

Good photos = faster sales + fewer buyer complaints.

---

## Platform Quick Reference

| Platform | Best for | Typical days to sell |
|---|---|---|
| eBay | Tools, outdoor gear, golf, cameras, electronics | 3-10 days |
| Mercari | General items | 3-7 days |
| Reverb | Musical instruments | 3-14 days |
| Swappa | Phones, laptops, tablets | 1-5 days |
| Poshmark | Clothing, fashion brands | 7-21 days |
| StockX | Sneakers, streetwear | 1-3 days |
| Whatnot | Collectibles, cards | Live auction |

---

## Shipping

**Keep stocked:**
- Poly mailers: 9x12, 12x15, 19x24 (Uline or Amazon)
- Small/Medium/Large boxes (Uline or Home Depot)
- Packing tape + dispenser
- Bubble wrap roll
- Postal scale (~$15 on Amazon — saves you from overpaying)

**Print labels in the app** — eBay, Mercari, and Poshmark all have discounted shipping.
Don't go to the counter and pay retail rates.

**Drop off:** USPS or UPS Store. Or schedule free USPS home pickup at usps.com.

---

## eBay Seller Health — Keep These Green

- Transaction defect rate: **under 2%** — don't cancel orders
- Late shipment rate: **under 5%** — ship within your stated handling time
- Cases closed without resolution: **0** — always resolve buyer issues

If a buyer opens a case: offer a partial refund or accept a return. Don't fight it.
Your seller rating is worth more than any individual dispute.

---

## Mark Sales — Most Important Step

After every sale, run:
```bash
node scripts/mark-sold.js
```

Enter the sale price and platform. This logs actual margins vs predicted margins,
which is the primary signal the Brain uses to improve accuracy over time.

**Without this data, the Brain can't improve. Do this every time.**

---

## Weekly Brain Summary

Every Sunday night, the Brain sends a Telegram report:
- Approval rate for the week
- Top performing categories
- What it changed in the system config and why

You don't need to do anything — just read it. If the Brain suggests something that
doesn't match your real experience, note it. There's a feedback mechanism coming.
