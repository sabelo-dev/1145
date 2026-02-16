/**
 * Platform pricing markup configuration.
 * All merchant/vendor product prices are automatically marked up
 * by this percentage before being stored in the database.
 * Individual vendors may have a custom override set by admin.
 */
export const DEFAULT_PLATFORM_MARKUP_PERCENTAGE = 10;

/**
 * Applies the platform markup to a merchant-set price.
 * @param merchantPrice - The price set by the merchant/vendor
 * @param customMarkupPercentage - Optional per-vendor override. null/undefined = use default.
 * @returns The price with platform markup applied, rounded to 2 decimal places
 */
export const applyPlatformMarkup = (
  merchantPrice: number,
  customMarkupPercentage?: number | null
): number => {
  const markup = customMarkupPercentage !== null && customMarkupPercentage !== undefined
    ? customMarkupPercentage
    : DEFAULT_PLATFORM_MARKUP_PERCENTAGE;
  
  if (markup === 0) return merchantPrice;
  
  return Math.round(merchantPrice * (1 + markup / 100) * 100) / 100;
};
