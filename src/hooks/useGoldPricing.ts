import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GoldPrice, CurrencyRate, UserCurrencyPreference, GOLD_CONSTANTS } from '@/types/gold';

type DisplayPreference = Pick<UserCurrencyPreference, 'preferredCurrency' | 'displayMode' | 'goldUnit'>;

/** Prices are stored and charged in this currency. */
export const BASE_CURRENCY = 'ZAR';
const DEFAULT_PREFERENCE: DisplayPreference = { preferredCurrency: BASE_CURRENCY, displayMode: 'currency', goldUnit: 'mg' };
const STORAGE_KEY = '1145.display-preference';
const DISPLAY_MODES: DisplayPreference['displayMode'][] = ['currency', 'gold', 'both'];
const GOLD_UNITS: DisplayPreference['goldUnit'][] = ['mg', 'g', 'oz'];

/** The choice made on this device, so it works signed out and survives a reload. */
const readStoredPreference = (): DisplayPreference => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return DEFAULT_PREFERENCE;
    return {
      preferredCurrency: typeof saved.preferredCurrency === 'string' ? saved.preferredCurrency : DEFAULT_PREFERENCE.preferredCurrency,
      displayMode: DISPLAY_MODES.includes(saved.displayMode) ? saved.displayMode : DEFAULT_PREFERENCE.displayMode,
      goldUnit: GOLD_UNITS.includes(saved.goldUnit) ? saved.goldUnit : DEFAULT_PREFERENCE.goldUnit,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
};

const storePreference = (preference: DisplayPreference) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // storage unavailable (private mode): the choice still applies for this visit
  }
};

export function useGoldPricing() {
  const { user } = useAuth();
  const [goldPrice, setGoldPrice] = useState<GoldPrice | null>(null);
  // Every rate, for the maths (gold is quoted in dollars even when USD isn't offered to customers).
  const [allRates, setAllRates] = useState<CurrencyRate[]>([]);
  const [userPreference, setUserPreference] = useState<UserCurrencyPreference | null>(null);
  // What the UI shows. Updated the moment the user picks; the account copy syncs in the background.
  const [preference, setPreference] = useState<DisplayPreference>(readStoredPreference);
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
      .order('currency_code');

    if (!error && data) {
      // Rates are stored per R1 (rate_to_zar). A database that has not had that
      // migration yet still stores them per US$1; convert so both give the same numbers.
      const rows = data as unknown as Array<Record<string, unknown> & { currency_code: string }>;
      const legacy = rows.length > 0 && rows[0].rate_to_zar === undefined;
      const zarPerUsd = legacy ? parseFloat(String(rows.find(r => r.currency_code === BASE_CURRENCY)?.rate_to_usd ?? 'NaN')) : NaN;
      const rates: CurrencyRate[] = rows.map(c => ({
        id: String(c.id),
        currencyCode: c.currency_code,
        currencyName: String(c.currency_name),
        currencySymbol: String(c.currency_symbol),
        rateToZar: legacy ? parseFloat(String(c.rate_to_usd)) / zarPerUsd : parseFloat(String(c.rate_to_zar)),
        isActive: (c.is_active as boolean | null) ?? true,
        updatedAt: String(c.updated_at),
      })).filter(c => c.rateToZar > 0);
      if (legacy && zarPerUsd > 0 && !rates.some(c => c.currencyCode === 'USD')) {
        rates.push({ id: 'usd', currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$', rateToZar: 1 / zarPerUsd, isActive: false, updatedAt: '' });
      }
      setAllRates(rates);
    }
  }, []);

  // What customers can choose to view prices in.
  const currencies = useMemo(() => allRates.filter(c => c.isActive), [allRates]);
  // US dollars per R1, to reach the gold price.
  const usdPerZar = useMemo(() => allRates.find(c => c.currencyCode === 'USD')?.rateToZar ?? null, [allRates]);

  // Fetch user preferences
  const fetchUserPreference = useCallback(async () => {
    if (!user) {
      setUserPreference(null);
      return;
    }

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
      // Signing in: the choice saved on the account wins over this device's.
      const fromAccount: DisplayPreference = {
        preferredCurrency: data.preferred_currency || DEFAULT_PREFERENCE.preferredCurrency,
        displayMode: DISPLAY_MODES.includes(data.display_mode as DisplayPreference['displayMode'])
          ? (data.display_mode as DisplayPreference['displayMode'])
          : DEFAULT_PREFERENCE.displayMode,
        goldUnit: GOLD_UNITS.includes(data.gold_unit as DisplayPreference['goldUnit'])
          ? (data.gold_unit as DisplayPreference['goldUnit'])
          : DEFAULT_PREFERENCE.goldUnit,
      };
      setPreference(fromAccount);
      storePreference(fromAccount);
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
    if (!goldPrice || !usdPerZar) return 0;

    const currency = allRates.find(c => c.currencyCode === currencyCode);
    if (!currency) return 0;

    // currency → rand → dollars → gold
    const amountUsd = (amount / currency.rateToZar) * usdPerZar;
    const mgGold = amountUsd / goldPrice.pricePerMgUsd;

    return Math.floor(mgGold);
  }, [goldPrice, allRates, usdPerZar]);

  // Convert mg gold to currency amount
  const mgGoldToCurrency = useCallback((mgGold: number, currencyCode: string): number => {
    if (!goldPrice || !usdPerZar) return 0;

    const currency = allRates.find(c => c.currencyCode === currencyCode);
    if (!currency) return 0;

    // gold → dollars → rand → currency
    const amountZar = (mgGold * goldPrice.pricePerMgUsd) / usdPerZar;
    const amountCurrency = amountZar * currency.rateToZar;

    return Math.round(amountCurrency * 100) / 100;
  }, [goldPrice, allRates, usdPerZar]);

  // Convert between two currencies directly (no detour through gold, so nothing is lost to rounding).
  // Returns null when either rate is missing, so callers can fall back instead of showing 0.
  const convertCurrency = useCallback((amount: number, from: string, to: string): number | null => {
    if (from === to) return amount;
    const fromRate = allRates.find(c => c.currencyCode === from)?.rateToZar;
    const toRate = allRates.find(c => c.currencyCode === to)?.rateToZar;
    if (!fromRate || !toRate) return null;
    // into rand, then out to the target currency
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  }, [allRates]);

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
    return allRates.find(c => c.currencyCode === code);
  }, [allRates]);

  // Format currency amount
  const formatCurrencyAmount = useCallback((amount: number, currencyCode: string): string => {
    const safeAmount = amount ?? 0;
    const currency = getCurrency(currencyCode);
    if (!currency) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(safeAmount);
    }

    return `${currency.currencySymbol}${safeAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [getCurrency]);

  // Update the display preference. Applies immediately (signed in or not) and is
  // remembered on this device; signed-in users also get it saved to their account.
  const updatePreference = useCallback(async (updates: Partial<DisplayPreference>) => {
    const next = { ...preference, ...updates };
    setPreference(next);
    storePreference(next);
    if (!user) return true;

    const { error } = await supabase
      .from('user_currency_preferences')
      .upsert({
        user_id: user.id,
        preferred_currency: next.preferredCurrency,
        display_mode: next.displayMode,
        gold_unit: next.goldUnit,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Could not save currency preference to the account:', error.message);
      return false;
    }
    return true;
  }, [user, preference]);

  // A saved currency that has since been switched off falls back to the base currency.
  const displayCurrency = useMemo(() => {
    if (!currencies.length) return preference.preferredCurrency;
    return currencies.some(c => c.currencyCode === preference.preferredCurrency)
      ? preference.preferredCurrency
      : BASE_CURRENCY;
  }, [preference.preferredCurrency, currencies]);

  const displayMode = preference.displayMode;
  const goldUnit = preference.goldUnit;

  // Format a price for display in the user's chosen mode. Never shows a bogus 0:
  // if a rate or the gold price is missing it falls back to the original currency.
  const formatPrice = useCallback((amount: number, currencyCode: string = BASE_CURRENCY): string => {
    const safeAmount = amount ?? 0;
    const converted = convertCurrency(safeAmount, currencyCode, displayCurrency);
    const currencyText = converted == null
      ? formatCurrencyAmount(safeAmount, currencyCode)
      : formatCurrencyAmount(converted, displayCurrency);
    const goldReady = !!goldPrice && !!usdPerZar && allRates.some(c => c.currencyCode === currencyCode);
    if (displayMode === 'currency' || !goldReady) return currencyText;
    const goldText = formatGold(currencyToMgGold(safeAmount, currencyCode), goldUnit);
    return displayMode === 'gold' ? goldText : `${currencyText} (${goldText})`;
  }, [convertCurrency, displayCurrency, displayMode, goldUnit, goldPrice, usdPerZar, allRates, formatCurrencyAmount, formatGold, currencyToMgGold]);

  // One stable object: consumers re-render only when something they can see changed,
  // and never hold a helper bound to an old user, rate or preference.
  return useMemo(() => ({
    goldPrice,
    currencies,
    userPreference,
    isLoading,
    displayCurrency,
    displayMode,
    goldUnit,
    currencyToMgGold,
    mgGoldToCurrency,
    convertCurrency,
    mgToGoldUnit,
    formatGold,
    formatCurrencyAmount,
    formatPrice,
    getCurrency,
    updatePreference,
    refreshGoldPrice: fetchGoldPrice,
    refreshCurrencies: fetchCurrencies,
  }), [
    goldPrice, currencies, userPreference, isLoading, displayCurrency, displayMode, goldUnit,
    currencyToMgGold, mgGoldToCurrency, convertCurrency, mgToGoldUnit, formatGold, formatCurrencyAmount,
    formatPrice, getCurrency, updatePreference, fetchGoldPrice, fetchCurrencies,
  ]);
}
