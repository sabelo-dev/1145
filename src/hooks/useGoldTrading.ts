import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { useToast } from '@/hooks/use-toast';

// Platform spread: buy at higher price, sell at lower price
const BUY_SPREAD_PERCENT = 1.5;  // 1.5% markup on buy
const SELL_SPREAD_PERCENT = 1.5; // 1.5% discount on sell

export interface GoldTrade {
  id: string;
  trade_type: 'buy' | 'sell';
  gold_mg: number;
  fiat_amount: number;
  fiat_currency: string;
  spread_percent: number;
  platform_fee: number;
  status: string;
  created_at: string;
}

export interface GoldQuote {
  goldMg: number;
  fiatAmount: number;
  spotPrice: number;
  effectivePrice: number;
  spreadPercent: number;
  spreadAmount: number;
  currency: string;
}

export function useGoldTrading() {
  const { user } = useAuth();
  const { goldPrice, mgGoldToCurrency, currencyToMgGold, displayCurrency, getCurrency } = useGoldPricingContext();
  const { toast } = useToast();
  const [trades, setTrades] = useState<GoldTrade[]>([]);
  const [isTrading, setIsTrading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('gold_trades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setTrades((data as GoldTrade[]) || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Get a quote for buying gold with fiat
  const getBuyQuote = useCallback((fiatAmount: number): GoldQuote | null => {
    if (!goldPrice) return null;
    const currency = getCurrency(displayCurrency);
    if (!currency) return null;

    const spreadAmount = fiatAmount * (BUY_SPREAD_PERCENT / 100);
    const effectiveFiat = fiatAmount - spreadAmount; // less gold for same fiat
    const goldMg = currencyToMgGold(effectiveFiat, displayCurrency);
    const spotPrice = mgGoldToCurrency(1, displayCurrency);
    const effectivePrice = fiatAmount / Math.max(goldMg, 1);

    return {
      goldMg,
      fiatAmount,
      spotPrice,
      effectivePrice,
      spreadPercent: BUY_SPREAD_PERCENT,
      spreadAmount,
      currency: displayCurrency,
    };
  }, [goldPrice, displayCurrency, getCurrency, currencyToMgGold, mgGoldToCurrency]);

  // Get a quote for selling gold for fiat
  const getSellQuote = useCallback((goldMg: number): GoldQuote | null => {
    if (!goldPrice) return null;
    const currency = getCurrency(displayCurrency);
    if (!currency) return null;

    const grossFiat = mgGoldToCurrency(goldMg, displayCurrency);
    const spreadAmount = grossFiat * (SELL_SPREAD_PERCENT / 100);
    const fiatAmount = grossFiat - spreadAmount;
    const spotPrice = mgGoldToCurrency(1, displayCurrency);
    const effectivePrice = fiatAmount / Math.max(goldMg, 1);

    return {
      goldMg,
      fiatAmount,
      spotPrice,
      effectivePrice,
      spreadPercent: SELL_SPREAD_PERCENT,
      spreadAmount,
      currency: displayCurrency,
    };
  }, [goldPrice, displayCurrency, getCurrency, mgGoldToCurrency]);

  // Execute buy gold trade
  const buyGold = useCallback(async (fiatAmount: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const quote = getBuyQuote(fiatAmount);
    if (!quote || quote.goldMg <= 0) return { success: false, error: 'Invalid quote' };

    setIsTrading(true);
    try {
      // Get wallet
      const { data: wallet, error: walletError } = await supabase
        .from('platform_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) throw new Error('Wallet not found');
      if (wallet.balance_zar < fiatAmount) throw new Error('Insufficient ZAR balance');

      // Deduct ZAR, add gold
      const { error: updateError } = await supabase
        .from('platform_wallets')
        .update({
          balance_zar: wallet.balance_zar - fiatAmount,
          gold_balance_mg: (wallet.gold_balance_mg || 0) + quote.goldMg,
          lifetime_gold_bought_mg: (wallet.lifetime_gold_bought_mg || 0) + quote.goldMg,
          lifetime_spent: wallet.lifetime_spent + fiatAmount,
        })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      // Record trade
      await supabase.from('gold_trades').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        trade_type: 'buy',
        gold_mg: quote.goldMg,
        gold_price_per_mg_usd: goldPrice!.pricePerMgUsd,
        fiat_amount: fiatAmount,
        fiat_currency: displayCurrency,
        spread_percent: BUY_SPREAD_PERCENT,
        platform_fee: quote.spreadAmount,
      });

      // Record in wallet_transactions ledger
      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'gold_buy',
        amount: fiatAmount,
        net_amount: -fiatAmount,
        asset_type: 'ZAR',
        status: 'completed',
        description: `Bought ${quote.goldMg.toLocaleString()} mg gold`,
        completed_at: new Date().toISOString(),
      });

      toast({ title: 'Gold purchased!', description: `${quote.goldMg.toLocaleString()} mg Au added to your vault` });
      await fetchTrades();
      return { success: true };
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Purchase failed', description: err.message });
      return { success: false, error: err.message };
    } finally {
      setIsTrading(false);
    }
  }, [user, getBuyQuote, goldPrice, displayCurrency, fetchTrades, toast]);

  // Execute sell gold trade
  const sellGold = useCallback(async (goldMg: number): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const quote = getSellQuote(goldMg);
    if (!quote || quote.fiatAmount <= 0) return { success: false, error: 'Invalid quote' };

    setIsTrading(true);
    try {
      const { data: wallet, error: walletError } = await supabase
        .from('platform_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) throw new Error('Wallet not found');
      if ((wallet.gold_balance_mg || 0) < goldMg) throw new Error('Insufficient gold balance');

      // Add ZAR, deduct gold
      const { error: updateError } = await supabase
        .from('platform_wallets')
        .update({
          balance_zar: wallet.balance_zar + quote.fiatAmount,
          gold_balance_mg: (wallet.gold_balance_mg || 0) - goldMg,
          lifetime_gold_sold_mg: (wallet.lifetime_gold_sold_mg || 0) + goldMg,
          lifetime_earned: wallet.lifetime_earned + quote.fiatAmount,
        })
        .eq('id', wallet.id);

      if (updateError) throw updateError;

      await supabase.from('gold_trades').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        trade_type: 'sell',
        gold_mg: goldMg,
        gold_price_per_mg_usd: goldPrice!.pricePerMgUsd,
        fiat_amount: quote.fiatAmount,
        fiat_currency: displayCurrency,
        spread_percent: SELL_SPREAD_PERCENT,
        platform_fee: quote.spreadAmount,
      });

      await supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: 'gold_sell',
        amount: quote.fiatAmount,
        net_amount: quote.fiatAmount,
        asset_type: 'ZAR',
        status: 'completed',
        description: `Sold ${goldMg.toLocaleString()} mg gold`,
        completed_at: new Date().toISOString(),
      });

      toast({ title: 'Gold sold!', description: `R${quote.fiatAmount.toFixed(2)} added to your balance` });
      await fetchTrades();
      return { success: true };
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Sale failed', description: err.message });
      return { success: false, error: err.message };
    } finally {
      setIsTrading(false);
    }
  }, [user, getSellQuote, goldPrice, displayCurrency, fetchTrades, toast]);

  return {
    trades,
    isTrading,
    isLoading,
    getBuyQuote,
    getSellQuote,
    buyGold,
    sellGold,
    refreshTrades: fetchTrades,
  };
}
