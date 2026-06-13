// All fee structures verified June 2026

const PLATFORM_FEES = {
  'eBay':                { rate: 0.1325, maxFee: 750, payment: 0 },
  'Mercari':             { rate: 0.10,   maxFee: null, payment: 0.029 },
  'Poshmark':            { tiered: true, flatFee: 2.95, highRate: 0.20, threshold: 15 },
  'Reverb':              { rate: 0.05,   maxFee: null, payment: 0.027 },
  'Swappa':              { rate: 0.03,   maxFee: null, payment: 0 },
  'StockX':              { rate: 0.09,   maxFee: null, payment: 0.03 },
  'Whatnot':             { rate: 0.08,   maxFee: null, payment: 0.029 },
  'Facebook Marketplace':{ rate: 0.05,   maxFee: null, payment: 0, minFee: 0.40 }
};

function calcPlatformFee(platform, salePrice) {
  const f = PLATFORM_FEES[platform] || PLATFORM_FEES['eBay'];

  if (f.tiered) {
    return salePrice < f.threshold ? f.flatFee : salePrice * f.highRate;
  }

  let fee = salePrice * (f.rate || 0);
  if (f.maxFee) fee = Math.min(fee, f.maxFee);
  if (f.minFee) fee = Math.max(fee, f.minFee);
  return fee + (salePrice * (f.payment || 0));
}

function estimateShipping(weightLbs) {
  if (!weightLbs || weightLbs <= 0) return 8;
  if (weightLbs <= 0.5)  return 5;
  if (weightLbs <= 1)    return 7;
  if (weightLbs <= 3)    return 10;
  if (weightLbs <= 5)    return 14;
  if (weightLbs <= 10)   return 18;
  if (weightLbs <= 20)   return 28;
  if (weightLbs <= 30)   return 42;
  return 999; // Too heavy — skip
}

function calculateMargin({ sourcePrice, targetSalePrice, platformFee, estimatedWeightLbs, platform }) {
  const shippingCost = estimateShipping(estimatedWeightLbs);

  if (shippingCost >= 999) {
    return { netMargin: -999, marginPercent: -999, fees: 0, shippingCost: 999, viable: false };
  }

  let fees;
  if (platform) {
    fees = calcPlatformFee(platform, targetSalePrice);
  } else {
    fees = targetSalePrice * (platformFee || 0.1325);
  }

  const netMargin = targetSalePrice - sourcePrice - fees - shippingCost;
  const marginPercent = (netMargin / sourcePrice) * 100;

  return {
    netMargin: parseFloat(netMargin.toFixed(2)),
    marginPercent: parseFloat(marginPercent.toFixed(1)),
    fees: parseFloat(fees.toFixed(2)),
    shippingCost,
    targetSalePrice: parseFloat(targetSalePrice.toFixed(2)),
    viable: netMargin > 0
  };
}

module.exports = { calculateMargin, estimateShipping, calcPlatformFee, PLATFORM_FEES };
