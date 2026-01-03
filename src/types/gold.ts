// Gold Pricing Types for 1145 Marketplace
// Gold (mgAu - milligrams) is the base unit of value

export interface GoldPrice {
  pricePerOzUsd: number;
  pricePerGramUsd: number;
  pricePerMgUsd: number;
  fetchedAt: string;
  source?: string;
}

export interface CurrencyRate {
  id: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  rateToUsd: number;
  isActive: boolean;
  updatedAt: string;
}

export interface UserCurrencyPreference {
  id: string;
  userId: string;
  preferredCurrency: string;
  displayMode: 'currency' | 'gold' | 'both';
  goldUnit: 'mg' | 'g' | 'oz';
  createdAt: string;
  updatedAt: string;
}

export type GoldUnit = 'mg' | 'g' | 'oz';

export interface GoldDisplayOptions {
  unit: GoldUnit;
  showSymbol?: boolean;
  decimals?: number;
}

// Conversion constants
export const GOLD_CONSTANTS = {
  MG_PER_GRAM: 1000,
  MG_PER_OZ: 31103.4768, // Troy ounce
  GRAMS_PER_OZ: 31.1034768,
} as const;

// Gold unit labels
export const GOLD_UNIT_LABELS: Record<GoldUnit, string> = {
  mg: 'mg Au',
  g: 'g Au',
  oz: 'oz Au',
};

export const GOLD_UNIT_FULL_LABELS: Record<GoldUnit, string> = {
  mg: 'milligrams of gold',
  g: 'grams of gold',
  oz: 'troy ounces of gold',
};
