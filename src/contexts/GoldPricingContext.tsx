import React, { createContext, useContext, ReactNode } from 'react';
import { useGoldPricing } from '@/hooks/useGoldPricing';
import { GoldPrice, CurrencyRate, UserCurrencyPreference } from '@/types/gold';

interface GoldPricingContextType {
  goldPrice: GoldPrice | null;
  currencies: CurrencyRate[];
  userPreference: UserCurrencyPreference | null;
  isLoading: boolean;
  displayCurrency: string;
  displayMode: 'currency' | 'gold' | 'both';
  goldUnit: 'mg' | 'g' | 'oz';
  currencyToMgGold: (amount: number, currencyCode: string) => number;
  mgGoldToCurrency: (mgGold: number, currencyCode: string) => number;
  /** Direct currency conversion; null when a rate is missing. */
  convertCurrency: (amount: number, from: string, to: string) => number | null;
  mgToGoldUnit: (mg: number, unit: 'mg' | 'g' | 'oz') => number;
  formatGold: (mg: number, unit?: 'mg' | 'g' | 'oz') => string;
  formatCurrencyAmount: (amount: number, currencyCode: string) => string;
  /** A price as text in the user's chosen currency / gold mode. Amount defaults to ZAR. */
  formatPrice: (amount: number, currencyCode?: string) => string;
  getCurrency: (code: string) => CurrencyRate | undefined;
  updatePreference: (updates: Partial<Pick<UserCurrencyPreference, 'preferredCurrency' | 'displayMode' | 'goldUnit'>>) => Promise<boolean>;
  refreshGoldPrice: () => Promise<void>;
  refreshCurrencies: () => Promise<void>;
}

const GoldPricingContext = createContext<GoldPricingContextType | undefined>(undefined);

export function GoldPricingProvider({ children }: { children: ReactNode }) {
  // Already memoised in the hook with its full dependency list.
  const value = useGoldPricing();

  return (
    <GoldPricingContext.Provider value={value}>
      {children}
    </GoldPricingContext.Provider>
  );
}

export function useGoldPricingContext() {
  const context = useContext(GoldPricingContext);
  if (context === undefined) {
    throw new Error('useGoldPricingContext must be used within a GoldPricingProvider');
  }
  return context;
}
