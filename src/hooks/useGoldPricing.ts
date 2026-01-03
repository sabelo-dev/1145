import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GoldPrice, CurrencyRate, UserCurrencyPreference, GOLD_CONSTANTS } from '@/types/gold';

export function useGoldPricing() {
  const { user } = useAuth();
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRate[]>([]);
  const [userPreference, setUserPreference] = useState<UserCurrencyPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current gold price
  const fetchGoldPrice = useCallback(async () => {
    const { data, error } = await supabase
      .from('gold_price_cache')
      .select('*')
      .eq('is_current', true)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setGoldPrice({
        pricePerOzUsd: parseFloat(String(data.price_per_oz_usd)),
        pricePerGramUsd: parseFloat(String(data.price_per_gram_usd)),
        pricePerMgUsd: parseFloat(String(data.price_per_mg_usd)),
        fetchedAt: data.fetched_at,
        source: data.source ?? undefined,
      });
    }
  }, []);

  // Fetch currency rates
  const fetchCurrencies = useCallback(async () => {
    const { data, error } = await supabase
      .from('currency_rates')
      .select('*')
      .eq('is_active', true)
      .order('currency_code');

    if (!error && data) {
      setCurrencies(data.map(c => ({
        id: c.id,
        currencyCode: c.currency_code,
        currencyName: c.currency_name,
        currencySymbol: c.currency_symbol,
        rateToUsd: parseFloat(String(c.rate_to_usd)),
        isActive: c.is_active ?? true,
        updatedAt: c.updated_at,
      })));
    }
  }, []);

  // Fetch user preferences
  const fetchUserPreference = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_currency_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setUserPreference({
        id: data.id,
        userId: data.user_id,
        preferredCurrency: data.preferred_currency,
        displayMode: data.display_mode as UserCurrencyPreference['displayMode'],
        goldUnit: data.gold_unit as UserCurrencyPreference['goldUnit'],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchGoldPrice(), fetchCurrencies(), fetchUserPreference()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchGoldPrice, fetchCurrencies, fetchUserPreference]);

  // Convert currency amount to mg gold
  const currencyToMgGold = useCallback((amount: number, currencyCode: string): number => {
    if (!goldPrice || !currencies.length) return 0;

    const currency = currencies.find(c => c.currencyCode === currencyCode);
    if (!currency) return 0;

    const amountUsd = amount / currency.rateToUsd;
    const mgGold = amountUsd / goldPrice.pricePerMgUsd;

    return Math.floor(mgGold);
  }, [goldPrice, currencies]);

  // Convert mg gold to currency amount
  const mgGoldToCurrency = useCallback((mgGold: number, currencyCode: string): number => {
    if (!goldPrice || !currencies.length) return 0;

    const currency = currencies.find(c => c.currencyCode === currencyCode);
    if (!currency) return 0;

    const amountUsd = mgGold * goldPrice.pricePerMgUsd;
    const amountCurrency = amountUsd * currency.rateToUsd;

    return Math.round(amountCurrency * 100) / 100;
  }, [goldPrice, currencies]);

  // Convert mg gold to different gold units
  const mgToGoldUnit = useCallback((mg: number, unit: 'mg' | 'g' | 'oz'): number => {
    switch (unit) {
      case 'g':
        return mg / GOLD_CONSTANTS.MG_PER_GRAM;
      case 'oz':
        return mg / GOLD_CONSTANTS.MG_PER_OZ;
      default:
        return mg;
    }
  }, []);

  // Format gold display
  const formatGold = useCallback((mg: number, unit: 'mg' | 'g' | 'oz' = 'mg'): string => {
    const value = mgToGoldUnit(mg, unit);
    const decimals = unit === 'mg' ? 0 : unit === 'g' ? 3 : 6;
    
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    const unitLabel = unit === 'mg' ? 'mg' : unit === 'g' ? 'g' : 'oz';
    return `${formatted} ${unitLabel} Au`;
  }, [mgToGoldUnit]);

  // Get currency by code
  const getCurrency = useCallback((code: string): CurrencyRate | undefined => {
    return currencies.find(c => c.currencyCode === code);
  }, [currencies]);

  // Format currency amount
  const formatCurrencyAmount = useCallback((amount: number, currencyCode: string): string => {
    const currency = getCurrency(currencyCode);
    if (!currency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    }

    return `${currency.currencySymbol}${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [getCurrency]);

  // Update user preference
  const updatePreference = useCallback(async (
    updates: Partial<Pick<UserCurrencyPreference, 'preferredCurrency' | 'displayMode' | 'goldUnit'>>
  ) => {
    if (!user) return false;

    const { error } = await supabase
      .from('user_currency_preferences')
      .upsert({
        user_id: user.id,
        preferred_currency: updates.preferredCurrency ?? userPreference?.preferredCurrency ?? 'ZAR',
        display_mode: updates.displayMode ?? userPreference?.displayMode ?? 'currency',
        gold_unit: updates.goldUnit ?? userPreference?.goldUnit ?? 'mg',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (!error) {
      await fetchUserPreference();
      return true;
    }
    return false;
  }, [user, userPreference, fetchUserPreference]);

  // Get display currency (user preferred or default)
  const displayCurrency = useMemo(() => {
    return userPreference?.preferredCurrency ?? 'ZAR';
  }, [userPreference]);

  // Get display mode
  const displayMode = useMemo(() => {
    return userPreference?.displayMode ?? 'currency';
  }, [userPreference]);

  // Get gold unit preference
  const goldUnit = useMemo(() => {
    return userPreference?.goldUnit ?? 'mg';
  }, [userPreference]);

  return {
    goldPrice,
    currencies,
    userPreference,
    isLoading,
    displayCurrency,
    displayMode,
    goldUnit,
    currencyToMgGold,
    mgGoldToCurrency,
    mgToGoldUnit,
    formatGold,
    formatCurrencyAmount,
    getCurrency,
    updatePreference,
    refreshGoldPrice: fetchGoldPrice,
    refreshCurrencies: fetchCurrencies,
  };
}
