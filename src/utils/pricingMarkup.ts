/**
 * Platform pricing markup configuration.
 * All merchant/vendor product prices are automatically marked up
 * by this percentage before being stored in the database.
 */
export const PLATFORM_MARKUP_PERCENTAGE = 10;

/**
 * Applies the platform markup to a merchant-set price.
 * @param merchantPrice - The price set by the merchant/vendor
 * @returns The price with platform markup applied, rounded to 2 decimal places
 */
export const applyPlatformMarkup = (merchantPrice: number): number => {
  return Math.round(merchantPrice * (1 + PLATFORM_MARKUP_PERCENTAGE / 100) * 100) / 100;
};
