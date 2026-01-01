import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BiGoldWallet, BiGoldTransaction, BiGoldEarningRule, BiGoldSpendingOption } from '@/types/bigold';
import { useToast } from '@/hooks/use-toast';

export function useBiGold() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<BiGoldWallet | null>(null);
  const [transactions, setTransactions] = useState<BiGoldTransaction[]>([]);
  const [earningRules, setEarningRules] = useState<BiGoldEarningRule[]>([]);
  const [spendingOptions, setSpendingOptions] = useState<BiGoldSpendingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bigold_wallets')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet:', error);
      return;
    }

    if (data) {
      setWallet(data as BiGoldWallet);
    } else {
      // Create wallet if doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('bigold_wallets')
        .insert({ user_id: user.id })
        .select()
        .single();

      if (!createError && newWallet) {
        setWallet(newWallet as BiGoldWallet);
      }
    }
  }, [user]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bigold_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setTransactions(data as BiGoldTransaction[]);
    }
  }, [user]);

  const fetchRulesAndOptions = useCallback(async () => {
    const [rulesResult, optionsResult] = await Promise.all([
      supabase.from('bigold_earning_rules').select('*').eq('is_active', true),
      supabase.from('bigold_spending_options').select('*').eq('is_active', true)
    ]);

    if (rulesResult.data) {
      setEarningRules(rulesResult.data as BiGoldEarningRule[]);
    }
    if (optionsResult.data) {
      setSpendingOptions(optionsResult.data as BiGoldSpendingOption[]);
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

  const earnBiGold = async (category: string, referenceId?: string, referenceType?: string) => {
    if (!user || !wallet) return false;

    const rule = earningRules.find(r => r.category === category);
    if (!rule) return false;

    const amount = rule.amount * rule.multiplier;

    const { error: txError } = await supabase
      .from('bigold_transactions')
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
      .from('bigold_wallets')
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
      title: `+${amount} BiGold Earned!`,
      description: rule.description || `You earned BiGold for ${category.replace(/_/g, ' ')}`
    });

    await Promise.all([fetchWallet(), fetchTransactions()]);
    return true;
  };

  const spendBiGold = async (category: string) => {
    if (!user || !wallet) return false;

    const option = spendingOptions.find(o => o.category === category);
    if (!option) return false;

    if (wallet.balance < option.cost) {
      toast({
        title: 'Insufficient BiGold',
        description: `You need ${option.cost} BiGold but only have ${wallet.balance}`,
        variant: 'destructive'
      });
      return false;
    }

    const { error: txError } = await supabase
      .from('bigold_transactions')
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
      .from('bigold_wallets')
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
      title: 'BiGold Redeemed!',
      description: option.description || `You redeemed ${option.cost} BiGold`
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
    earnBiGold,
    spendBiGold,
    refreshWallet: fetchWallet,
    refreshTransactions: fetchTransactions
  };
}
