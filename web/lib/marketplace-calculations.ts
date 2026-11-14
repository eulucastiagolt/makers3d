export type MarketplaceType = 'shopee' | 'tiktok' | 'mercadolivre';

export type PricingMode = 'margin' | 'price';


interface ShopeeCommissionBracket {
  minPrice: number;
  maxPrice: number | null;
  percentage: number;
  fixedFee: number;
}

const SHOPEE_COMMISSION_BRACKETS: ShopeeCommissionBracket[] = [
  { minPrice: 0, maxPrice: 79.99, percentage: 20, fixedFee: 4 },
  { minPrice: 80, maxPrice: 99.99, percentage: 14, fixedFee: 16 },
  { minPrice: 100, maxPrice: 199.99, percentage: 14, fixedFee: 20 },
  { minPrice: 200, maxPrice: 499.99, percentage: 14, fixedFee: 26 },
  { minPrice: 500, maxPrice: null, percentage: 14, fixedFee: 26 },
];

const SHOPEE_HIGHLIGHT_CAMPAIGNS_PERCENTAGE = 3.5;

function getShopeeBracket(sellingPrice: number): ShopeeCommissionBracket {
  for (const bracket of SHOPEE_COMMISSION_BRACKETS) {
    if (bracket.maxPrice === null && sellingPrice >= bracket.minPrice) {
      return bracket;
    }
    if (sellingPrice >= bracket.minPrice && sellingPrice <= (bracket.maxPrice ?? Infinity)) {
      return bracket;
    }
  }
  return SHOPEE_COMMISSION_BRACKETS[0];
}


const TIKTOK_COMMISSION_PERCENTAGE = 6;
const TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE = 6;
const TIKTOK_FIXED_FEE = 4;
const TIKTOK_TOTAL_PERCENTAGE = TIKTOK_COMMISSION_PERCENTAGE + TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE;


export function calculateShippingCost(weight: number, height: number, width: number, depth: number): number {
  if (weight <= 0) return 0;

  const volumetricWeight = height > 0 && width > 0 && depth > 0
    ? (height * width * depth) / 6000
    : 0;
  const finalWeight = Math.max(weight, volumetricWeight);


  if (finalWeight <= 0.5) {
    return 12;
  } else {
    return 12 + Math.ceil((finalWeight - 0.5) / 0.5) * 4;
  }
}


export interface ShopeeInputs {
  productCost: number;
  otherCosts: number;
  taxPercentage: number;
  highlightCampaigns: boolean;
  pricingMode: PricingMode;
  desiredMargin: number;
  shippingMode: 'auto' | 'manual';
  weight: number;
  height: number;
  width: number;
  depth: number;
  shippingCost: number;
  freeShipping: boolean;
}

export interface TiktokInputs {
  productCost: number;
  otherCosts: number;
  taxPercentage: number;
  pricingMode: PricingMode;
  desiredMargin: number;
  shippingMode: 'auto' | 'manual';
  weight: number;
  height: number;
  width: number;
  depth: number;
  shippingCost: number;
  freeShipping: boolean;
}

export interface MercadolivreInputs {
  productCost: number;
  otherCosts: number;
  taxPercentage: number;
  categoryPercentage: number;
  shippingMode: 'auto' | 'manual';
  weight: number;
  height: number;
  width: number;
  depth: number;
  shippingCost: number;
  pricingMode: PricingMode;
  desiredMargin: number;
}


export interface MarketplaceResult {
  sellingPrice: number;
  totalFees: number;
  netProfit: number;
  profitMargin: number;
  commissionPercentage: number;
  commissionFixed: number;
  commissionAdditional: number;
  shippingCost: number;
  breakdown: {
    productCost: number;
    otherCosts: number;
    commissionPercentAmount: number;
    commissionFixedAmount: number;
    additionalFeeAmount: number;
    taxAmount: number;
    shippingCostAmount: number;
  };
  error: string | null;
}

function round2(v: number): number {
  return Math.round((v ?? 0) * 100) / 100;
}


export function calculateShopee(inputs: ShopeeInputs): MarketplaceResult {
  const { productCost, otherCosts, taxPercentage, highlightCampaigns, pricingMode, desiredMargin, shippingMode, weight, height, width, depth, shippingCost, freeShipping } = inputs;
  const error: string | null = null;

  let effectiveShippingCost = 0;
  if (!freeShipping) {
    if (shippingMode === 'auto' && weight > 0) {
      effectiveShippingCost = calculateShippingCost(weight, height, width, depth);
    } else {
      effectiveShippingCost = shippingCost ?? 0;
    }
  }

  if (pricingMode === 'margin') {

    let sellingPrice = 0;

    for (let attempt = 0; attempt < 5; attempt++) {
      const bracket = getShopeeBracket(sellingPrice > 0 ? sellingPrice : productCost + otherCosts + effectiveShippingCost + 4);
      const commissionPercentage = bracket.percentage;
      const fixedFee = bracket.fixedFee;
      const highlightPct = highlightCampaigns ? SHOPEE_HIGHLIGHT_CAMPAIGNS_PERCENTAGE : 0;

      const denominator = 1 - taxPercentage / 100 - commissionPercentage / 100 - highlightPct / 100 - desiredMargin / 100;

      if (denominator <= 0) {
        return {
          sellingPrice: 0,
          totalFees: 0,
          netProfit: 0,
          profitMargin: 0,
          commissionPercentage,
          commissionFixed: fixedFee,
          commissionAdditional: highlightPct,
          shippingCost: effectiveShippingCost,
          breakdown: {
            productCost, otherCosts,
            commissionPercentAmount: 0,
            commissionFixedAmount: fixedFee,
            additionalFeeAmount: 0,
            taxAmount: 0,
            shippingCostAmount: effectiveShippingCost,
          },
          error: 'Não foi possível calcular um preço viável com essa margem e taxas.',
        };
      }

      sellingPrice = round2((productCost + otherCosts + effectiveShippingCost + fixedFee) / denominator);

      const newBracket = getShopeeBracket(sellingPrice);
      if (newBracket.percentage === bracket.percentage && newBracket.fixedFee === bracket.fixedFee) {
        break;
      }
    }

    const bracket = getShopeeBracket(sellingPrice);
    const commissionPercentage = bracket.percentage;
    const fixedFee = bracket.fixedFee;
    const highlightPct = highlightCampaigns ? SHOPEE_HIGHLIGHT_CAMPAIGNS_PERCENTAGE : 0;

    const commissionPercentAmount = round2(sellingPrice * commissionPercentage / 100);
    const additionalFeeAmount = round2(sellingPrice * highlightPct / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + fixedFee + additionalFeeAmount + taxAmount + effectiveShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage,
      commissionFixed: fixedFee,
      commissionAdditional: highlightPct,
      shippingCost: effectiveShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: fixedFee,
        additionalFeeAmount,
        taxAmount,
        shippingCostAmount: effectiveShippingCost,
      },
      error,
    };
  } else {

    const sellingPrice = desiredMargin; // In "price" mode, desiredMargin is the selling price
    const bracket = getShopeeBracket(sellingPrice);
    const commissionPercentage = bracket.percentage;
    const fixedFee = bracket.fixedFee;
    const highlightPct = highlightCampaigns ? SHOPEE_HIGHLIGHT_CAMPAIGNS_PERCENTAGE : 0;

    const commissionPercentAmount = round2(sellingPrice * commissionPercentage / 100);
    const additionalFeeAmount = round2(sellingPrice * highlightPct / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + fixedFee + additionalFeeAmount + taxAmount + effectiveShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    let calculationError: string | null = null;
    if (netProfit < 0) {
      calculationError = 'O preço de venda informado resulta em prejuízo.';
    }

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage,
      commissionFixed: fixedFee,
      commissionAdditional: highlightPct,
      shippingCost: effectiveShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: fixedFee,
        additionalFeeAmount,
        taxAmount,
        shippingCostAmount: effectiveShippingCost,
      },
      error: calculationError,
    };
  }
}


export function calculateTiktok(inputs: TiktokInputs): MarketplaceResult {
  const { productCost, otherCosts, taxPercentage, pricingMode, desiredMargin, shippingMode, weight, height, width, depth, shippingCost, freeShipping } = inputs;

  let effectiveShippingCost = 0;
  if (!freeShipping) {
    if (shippingMode === 'auto' && weight > 0) {
      effectiveShippingCost = calculateShippingCost(weight, height, width, depth);
    } else {
      effectiveShippingCost = shippingCost ?? 0;
    }
  }

  if (pricingMode === 'margin') {
    const denominator = 1 - taxPercentage / 100 - TIKTOK_TOTAL_PERCENTAGE / 100 - desiredMargin / 100;

    if (denominator <= 0) {
      return {
        sellingPrice: 0,
        totalFees: 0,
        netProfit: 0,
        profitMargin: 0,
        commissionPercentage: TIKTOK_COMMISSION_PERCENTAGE,
        commissionFixed: TIKTOK_FIXED_FEE,
        commissionAdditional: TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE,
        shippingCost: effectiveShippingCost,
        breakdown: {
          productCost, otherCosts,
          commissionPercentAmount: 0,
          commissionFixedAmount: TIKTOK_FIXED_FEE,
          additionalFeeAmount: 0,
          taxAmount: 0,
          shippingCostAmount: effectiveShippingCost,
        },
        error: 'Não foi possível calcular um preço viável com essa margem e taxas.',
      };
    }

    const sellingPrice = round2((productCost + otherCosts + effectiveShippingCost + TIKTOK_FIXED_FEE) / denominator);

    const commissionPercentAmount = round2(sellingPrice * TIKTOK_COMMISSION_PERCENTAGE / 100);
    const shippingFeeAmount = round2(sellingPrice * TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + shippingFeeAmount + TIKTOK_FIXED_FEE + taxAmount + effectiveShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage: TIKTOK_COMMISSION_PERCENTAGE,
      commissionFixed: TIKTOK_FIXED_FEE,
      commissionAdditional: TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE,
      shippingCost: effectiveShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: TIKTOK_FIXED_FEE,
        additionalFeeAmount: shippingFeeAmount,
        taxAmount,
        shippingCostAmount: effectiveShippingCost,
      },
      error: null,
    };
  } else {
    const sellingPrice = desiredMargin;
    const commissionPercentAmount = round2(sellingPrice * TIKTOK_COMMISSION_PERCENTAGE / 100);
    const shippingFeeAmount = round2(sellingPrice * TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + shippingFeeAmount + TIKTOK_FIXED_FEE + taxAmount + effectiveShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    let calculationError: string | null = null;
    if (netProfit < 0) {
      calculationError = 'O preço de venda informado resulta em prejuízo.';
    }

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage: TIKTOK_COMMISSION_PERCENTAGE,
      commissionFixed: TIKTOK_FIXED_FEE,
      commissionAdditional: TIKTOK_SUBSIDIZED_SHIPPING_PERCENTAGE,
      shippingCost: effectiveShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: TIKTOK_FIXED_FEE,
        additionalFeeAmount: shippingFeeAmount,
        taxAmount,
        shippingCostAmount: effectiveShippingCost,
      },
      error: calculationError,
    };
  }
}


export function calculateMercadolivre(inputs: MercadolivreInputs): MarketplaceResult {
  const {
    productCost, otherCosts, taxPercentage, categoryPercentage,
    shippingMode, shippingCost, pricingMode, desiredMargin,
    weight, height, width, depth,
  } = inputs;

  let calculatedShippingCost = shippingCost ?? 0;

  if (shippingMode === 'auto' && weight > 0) {
    calculatedShippingCost = calculateShippingCost(weight, height, width, depth);
  }

  if (pricingMode === 'margin') {
    const denominator = 1 - taxPercentage / 100 - categoryPercentage / 100 - desiredMargin / 100;

    if (denominator <= 0) {
      return {
        sellingPrice: 0,
        totalFees: 0,
        netProfit: 0,
        profitMargin: 0,
        commissionPercentage: categoryPercentage,
        commissionFixed: 0,
        commissionAdditional: 0,
        shippingCost: calculatedShippingCost,
        breakdown: {
          productCost, otherCosts,
          commissionPercentAmount: 0,
          commissionFixedAmount: 0,
          additionalFeeAmount: 0,
          taxAmount: 0,
          shippingCostAmount: calculatedShippingCost,
        },
        error: 'Não foi possível calcular um preço viável com essa margem e taxas.',
      };
    }

    const sellingPrice = round2((productCost + otherCosts + calculatedShippingCost) / denominator);
    const commissionPercentAmount = round2(sellingPrice * categoryPercentage / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + taxAmount + calculatedShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage: categoryPercentage,
      commissionFixed: 0,
      commissionAdditional: 0,
      shippingCost: calculatedShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: 0,
        additionalFeeAmount: 0,
        taxAmount,
        shippingCostAmount: calculatedShippingCost,
      },
      error: null,
    };
  } else {
    const sellingPrice = desiredMargin;
    const commissionPercentAmount = round2(sellingPrice * categoryPercentage / 100);
    const taxAmount = round2(sellingPrice * taxPercentage / 100);
    const totalFees = round2(commissionPercentAmount + taxAmount + calculatedShippingCost);
    const netProfit = round2(sellingPrice - productCost - otherCosts - totalFees);
    const profitMargin = sellingPrice > 0 ? round2((netProfit / sellingPrice) * 100) : 0;

    let calculationError: string | null = null;
    if (netProfit < 0) {
      calculationError = 'O preço de venda informado resulta em prejuízo.';
    }

    return {
      sellingPrice,
      totalFees,
      netProfit,
      profitMargin,
      commissionPercentage: categoryPercentage,
      commissionFixed: 0,
      commissionAdditional: 0,
      shippingCost: calculatedShippingCost,
      breakdown: {
        productCost,
        otherCosts,
        commissionPercentAmount,
        commissionFixedAmount: 0,
        additionalFeeAmount: 0,
        taxAmount,
        shippingCostAmount: calculatedShippingCost,
      },
      error: calculationError,
    };
  }
}


export const defaultShopeeInputs: ShopeeInputs = {
  productCost: 30,
  otherCosts: 5,
  taxPercentage: 0,
  highlightCampaigns: false,
  pricingMode: 'margin',
  desiredMargin: 20,
  shippingMode: 'auto',
  weight: 0,
  height: 0,
  width: 0,
  depth: 0,
  shippingCost: 0,
  freeShipping: false,
};

export const defaultTiktokInputs: TiktokInputs = {
  productCost: 30,
  otherCosts: 5,
  taxPercentage: 0,
  pricingMode: 'margin',
  desiredMargin: 20,
  shippingMode: 'auto',
  weight: 0,
  height: 0,
  width: 0,
  depth: 0,
  shippingCost: 0,
  freeShipping: false,
};

export const defaultMercadolivreInputs: MercadolivreInputs = {
  productCost: 30,
  otherCosts: 5,
  taxPercentage: 0,
  categoryPercentage: 11,
  shippingMode: 'manual',
  weight: 0,
  height: 0,
  width: 0,
  depth: 0,
  shippingCost: 0,
  pricingMode: 'margin',
  desiredMargin: 20,
};
