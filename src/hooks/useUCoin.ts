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

  const earnUCoin = async (category: string, referenceId?: string, referenceType?: string) => {
    if (!user || !wallet) return false;

    const rule = earningRules.find(r => r.category === category);
    if (!rule) return false;

    const amount = rule.amount * rule.multiplier;

    const { error: txError } = await supabase
      .from('ucoin_transactions')
      .insert({
        user_id: user.id,
        amount,
        type: 'earn',
        category,
        description: rule.description,
        reference_id: referenceId || null,
        reference_type: referenceType || null
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
      return false;
    }

    const { error: walletError } = await supabase
      .from('ucoin_wallets')
      .update({
        balance: wallet.balance + amount,
        lifetime_earned: wallet.lifetime_earned + amount
      })
      .eq('user_id', user.id);

    if (walletError) {
      console.error('Error updating wallet:', walletError);
      return false;
    }

    toast({
      title: `+${amount} UCoin Earned!`,
      description: rule.description || `You earned UCoin for ${category.replace(/_/g, ' ')}`
    });

    await Promise.all([fetchWallet(), fetchTransactions()]);
    return true;
  };

  const spendUCoin = async (category: string) => {
    if (!user || !wallet) return false;

    const option = spendingOptions.find(o => o.category === category);
    if (!option) return false;

    if (wallet.balance < option.cost) {
      toast({
        title: 'Insufficient UCoin',
        description: `You need ${option.cost} UCoin but only have ${wallet.balance}`,
        variant: 'destructive'
      });
      return false;
    }

    const { error: txError } = await supabase
      .from('ucoin_transactions')
      .insert({
        user_id: user.id,
        amount: option.cost,
        type: 'spend',
        category,
        description: option.description
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
      return false;
    }

    const { error: walletError } = await supabase
      .from('ucoin_wallets')
      .update({
        balance: wallet.balance - option.cost,
        lifetime_spent: wallet.lifetime_spent + option.cost
      })
      .eq('user_id', user.id);

    if (walletError) {
      console.error('Error updating wallet:', walletError);
      return false;
    }

    toast({
      title: 'UCoin Redeemed!',
      description: option.description || `You redeemed ${option.cost} UCoin`
    });

    await Promise.all([fetchWallet(), fetchTransactions()]);
    return true;
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
