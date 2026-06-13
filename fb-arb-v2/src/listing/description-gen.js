const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLATFORM_TIPS = {
  eBay: 'Keyword-rich title (80 chars). Bullet points. Include: brand, model, condition, what is included.',
  Mercari: 'Friendly, conversational. Concise. Honest about flaws. Mention what is included.',
  Poshmark: 'Fashion-forward language. Size, measurements, brand, condition, style.',
  Reverb: 'Musician-focused. Include: year (if known), specs, modifications, case/cables included.',
  Swappa: 'Device focus: storage, carrier lock status, cosmetic condition, accessories included.',
  StockX: 'Minimal: size, condition (new/used), what is in box.',
  Whatnot: 'Punchy 1-2 sentence live auction hook.',
  Mercari: 'Friendly and concise. List condition honestly. Include accessories.'
};

async function generateListingDescription({ title, category, condition, platform, sourceDescription }) {
  const platformGuide = PLATFORM_TIPS[platform] || PLATFORM_TIPS.eBay;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `You are a reseller copywriter. Generate an optimized ${platform} listing.

Item: ${title}
Category: ${category}
Condition: ${condition || 'Used - Good'}
Platform guide: ${platformGuide}
Original description: ${sourceDescription || 'None provided'}

Return ONLY valid JSON:
{
  "title": "platform-optimized title (max 80 chars)",
  "description": "full listing description",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`
    }]
  });

  try {
    const text = msg.content[0].text.trim().replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch {
    return { title, description: sourceDescription || title, keywords: [title.split(' ')[0]] };
  }
}

module.exports = { generateListingDescription };
