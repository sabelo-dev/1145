/**
 * Platform pricing markup configuration.
 * All merchant product prices are automatically marked up
 * by this percentage before being stored in the database.
 * Individual merchants may have a custom override set by admin.
 */
export const DEFAULT_PLATFORM_MARKUP_PERCENTAGE = 5;

/**
 * After the markup is added, prices are rounded UP to a clean number so
 * listings read well (R2090 -> R2100, R1980 -> R2000).
 * The step grows with the price so cheap items aren't over-inflated:
 *   R1000 and above  -> next R100   (R1900 + 10% = R2090 -> R2100)
 *   R100 – R999      -> next R10    (R455 + 10% = R500.50 -> R510)
 *   under R100       -> next R5     (R42 + 10% = R46.20 -> R50)
 * Change the tiers here to adjust the rounding everywhere.
 */
const ROUNDING_TIERS: { minPrice: number; step: number }[] = [
  { minPrice: 1000, step: 100 },
  { minPrice: 100, step: 10 },
  { minPrice: 0, step: 5 },
];

/** Rounds a price up to the next clean step for its price band. */
export const roundToCleanPrice = (price: number): number => {
  if (price == null || isNaN(price) || price <= 0) return 0;
  const { step } = ROUNDING_TIERS.find((t) => price >= t.minPrice) ?? ROUNDING_TIERS[ROUNDING_TIERS.length - 1];
  // Work in cents and subtract a tiny epsilon so exact values (e.g. 2000.00) don't get bumped a step.
  const cents = Math.round(price * 100);
  const stepCents = step * 100;
  return (Math.ceil((cents - 1e-6) / stepCents) * stepCents) / 100;
};

/**
 * Applies the platform markup to a merchant-set price, then rounds up to a clean price.
 * @param merchantPrice - The price set by the merchant
 * @param customMarkupPercentage - Optional per-merchant override. null/undefined = use default.
 * @returns The listed price: merchant price + markup, rounded up to a clean amount
 */
export const applyPlatformMarkup = (
  merchantPrice: number,
  customMarkupPercentage?: number | null
): number => {
  if (merchantPrice == null || isNaN(merchantPrice)) return 0;

  const markup = customMarkupPercentage !== null && customMarkupPercentage !== undefined
    ? customMarkupPercentage
    : DEFAULT_PLATFORM_MARKUP_PERCENTAGE;

  if (markup === 0) return merchantPrice;

  return roundToCleanPrice(merchantPrice * (1 + markup / 100));
};
