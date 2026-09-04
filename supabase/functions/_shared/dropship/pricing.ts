// Configurable landed-cost and recommended-retail-price engine (ZAR marketplace).

export interface PricingRule {
  payment_fee_pct?: number;
  platform_fee_pct?: number;
  merchant_margin_pct?: number;
  risk_allowance_pct?: number;
  operational_fee_flat?: number;
  fx_buffer_pct?: number;
  rounding?: "none" | "nearest_10" | "nearest_5" | "charm_99";
}

export interface ShippingRule {
  strategy?: "passthrough" | "flat" | "markup" | "free";
  flat_zar?: number;
  markup_pct?: number;
  free_over_zar?: number | null;
}

export interface PriceBreakdown {
  supplierCost: number;
  supplierShipping: number;
  fxRate: number;
  landedCostZar: number;
  platformCostsZar: number;
  merchantProfitZar: number;
  recommendedPriceZar: number;
}

const DEFAULTS: Required<PricingRule> = {
  payment_fee_pct: 3.5,
  platform_fee_pct: 7,
  merchant_margin_pct: 30,
  risk_allowance_pct: 3,
  operational_fee_flat: 15,
  fx_buffer_pct: 4,
  rounding: "nearest_10",
};

function round(value: number, mode: Required<PricingRule>["rounding"]): number {
  switch (mode) {
    case "nearest_10":
      return Math.ceil(value / 10) * 10;
    case "nearest_5":
      return Math.ceil(value / 5) * 5;
    case "charm_99":
      return Math.max(0, Math.ceil(value) - 0.01);
    default:
      return Math.round(value * 100) / 100;
  }
}

export function calculatePrice(
  supplierCost: number,
  supplierShipping: number,
  fxRate: number,
  rule: PricingRule = {},
): PriceBreakdown {
  const r = { ...DEFAULTS, ...rule };
  const landedForeign = (Number(supplierCost) || 0) + (Number(supplierShipping) || 0);
  const landedCostZar = landedForeign * fxRate * (1 + r.fx_buffer_pct / 100);
  const platformCostsZar =
    (landedCostZar * (r.payment_fee_pct + r.platform_fee_pct + r.risk_allowance_pct)) / 100 +
    r.operational_fee_flat;
  const base = landedCostZar + platformCostsZar;
  const merchantProfitZar = (base * r.merchant_margin_pct) / 100;
  const recommendedPriceZar = round(base + merchantProfitZar, r.rounding);
  const to2 = (n: number) => Math.round(n * 100) / 100;
  return {
    supplierCost: to2(Number(supplierCost) || 0),
    supplierShipping: to2(Number(supplierShipping) || 0),
    fxRate,
    landedCostZar: to2(landedCostZar),
    platformCostsZar: to2(platformCostsZar),
    merchantProfitZar: to2(merchantProfitZar),
    recommendedPriceZar: to2(recommendedPriceZar),
  };
}

export function customerShipping(supplierShippingZar: number, rule: ShippingRule = {}, orderTotalZar = 0): number {
  const strategy = rule.strategy || "passthrough";
  if (rule.free_over_zar && orderTotalZar >= rule.free_over_zar) return 0;
  switch (strategy) {
    case "free":
      return 0;
    case "flat":
      return Number(rule.flat_zar || 0);
    case "markup":
      return Math.round(supplierShippingZar * (1 + Number(rule.markup_pct || 0) / 100) * 100) / 100;
    default:
      return Math.round(supplierShippingZar * 100) / 100;
  }
}
