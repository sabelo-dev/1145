import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UCoinWallet, UCoinTransaction, UCoinEarningRule, UCoinSpendingOption } from '@/types/ucoin';
import { useToast } from '@/hooks/use-toast';

export function useUCoin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<UCoinWallet | null>(null);
  const [transactions, setTransactions] = useState<UCoinTransaction[]>([]);
  const [earningRules, setEarningRules] = useState<UCoinEarningRule[]>([]);
  const [spendingOptions, setSpendingOptions] = useState<UCoinSpendingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ucoin_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet:', error);
      return;
    }

    if (data) {
      setWallet(data as UCoinWallet);
    } else {
      const { data: newWallet, error: createError } = await supabase
        .from('ucoin_wallets')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (!createError && newWallet) {
        setWallet(newWallet as UCoinWallet);
      }
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ucoin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setTransactions(data as UCoinTransaction[]);
    }
  }, [user]);

  const fetchRulesAndOptions = useCallback(async () => {
    const [rulesResult, optionsResult] = await Promise.all([
      supabase.from('ucoin_earning_rules').select('*').eq('is_active', true),
      supabase.from('ucoin_spending_options').select('*').eq('is_active', true)
    ]);

    if (rulesResult.data) {
      setEarningRules(rulesResult.data as UCoinEarningRule[]);
    }
    if (optionsResult.data) {
      setSpendingOptions(optionsResult.data as UCoinSpendingOption[]);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchWallet(), fetchTransactions(), fetchRulesAndOptions()]);
      setIsLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchWallet, fetchTransactions, fetchRulesAndOptions]);

  // Rewards are paid by the database when the event happens (uc_award and
  // the reward triggers); the browser can no longer change wallet balances.
  // Kept so existing callers keep compiling.
  const earnUCoin = async (_category: string, _referenceId?: string, _referenceType?: string) => false;

  // UC is spent at checkout (10 UC = R1, redeem_ucoin_for_order). The old
  // shop deducted UC here without giving anything back.
  const spendUCoin = async (_category: string) => {
    toast({
      title: 'Use your UC at checkout',
      description: 'Add items to your cart and choose to pay with UCoin at checkout: 10 UC = R1 off.',
    });
    return false;
  };

  return {
    wallet,
    transactions,
    earningRules,
    spendingOptions,
    isLoading,
    earnUCoin,
    spendUCoin,
    refreshWallet: fetchWallet,
    refreshTransactions: fetchTransactions
  };
}
