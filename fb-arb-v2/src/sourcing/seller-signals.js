// Seller signals — listing language that predicts motivated sellers and better deals
// Weights loaded from system-config.json, updated by Brain based on real outcomes

const DEFAULT_WEIGHTS = {
  'moving':          1.5,
  'estate sale':     1.5,
  'divorce':         1.4,
  'must sell':       1.3,
  'downsizing':      1.3,
  'clearing out':    1.2,
  'need gone':       1.3,
  'open to offers':  1.1,
  'priced to sell':  1.1,
  'quick sale':      1.2,
  'leaving town':    1.3,
  'relocation':      1.3,
  'liquidating':     1.4,
  'storage unit':    1.2,
  'no longer use':   1.1,
  'upgrade':         1.1,
  'make offer':      1.1
};

function scoreSellerSignals(text, configWeights) {
  if (!text) return { score: 0, multiplier: 1.0, flags: [] };

  const weights = configWeights || DEFAULT_WEIGHTS;
  const lower = text.toLowerCase();
  const flags = [];
  let highestMultiplier = 1.0;

  for (const [signal, multiplier] of Object.entries(weights)) {
    if (lower.includes(signal.toLowerCase())) {
      flags.push(signal);
      if (multiplier > highestMultiplier) highestMultiplier = multiplier;
    }
  }

  // Score is 0-100 based on strongest signal
  const score = Math.min(100, Math.round((highestMultiplier - 1.0) * 200));

  return {
    score,
    multiplier: highestMultiplier,
    flags
  };
}

module.exports = { scoreSellerSignals };
