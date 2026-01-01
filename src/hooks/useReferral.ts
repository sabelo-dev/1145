import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { UserReferralCode, Referral, ReferralStats } from '@/types/referral';
import { useBiGold } from './useBiGold';
import { useToast } from '@/hooks/use-toast';

export function useReferral() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { earnBiGold } = useBiGold();
  const [referralCode, setReferralCode] = useState<UserReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    signupsCompleted: 0,
    purchasesCompleted: 0,
    totalEarned: 0,
    pendingEarnings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchReferralCode = useCallback(async () => {
    if (!user) return;

    // Try to get existing code
    const { data: existing } = await supabase
      .from('user_referral_codes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      setReferralCode(existing as UserReferralCode);
      return existing.code;
    }

    // Generate new code using the database function
    const { data: newCode, error } = await supabase
      .rpc('get_or_create_referral_code', { p_user_id: user.id });

    if (error) {
      console.error('Error generating referral code:', error);
      return null;
    }

    // Fetch the created record
    const { data: created } = await supabase
      .from('user_referral_codes')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (created) {
      setReferralCode(created as UserReferralCode);
    }

    return newCode;
  }, [user]);

  const fetchReferrals = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch profile data for referred users
      const referredIds = data.map(r => r.referred_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', referredIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedReferrals = data.map(r => ({
        ...r,
        referred_profile: profileMap.get(r.referred_id),
      })) as Referral[];

      setReferrals(enrichedReferrals);

      // Calculate stats
      const signupsCompleted = enrichedReferrals.filter(r => 
        r.status === 'signup_completed' || r.status === 'purchase_completed'
      ).length;
      const purchasesCompleted = enrichedReferrals.filter(r => 
        r.status === 'purchase_completed'
      ).length;

      // BiGold rewards: 50 for signup, 25 for purchase
      const earnedFromSignups = enrichedReferrals.filter(r => r.signup_reward_paid).length * 50;
      const earnedFromPurchases = enrichedReferrals.filter(r => r.purchase_reward_paid).length * 25;
      const pendingSignups = enrichedReferrals.filter(r => 
        (r.status === 'signup_completed' || r.status === 'purchase_completed') && !r.signup_reward_paid
      ).length * 50;
      const pendingPurchases = enrichedReferrals.filter(r => 
        r.status === 'purchase_completed' && !r.purchase_reward_paid
      ).length * 25;

      setStats({
        totalReferrals: enrichedReferrals.length,
        signupsCompleted,
        purchasesCompleted,
        totalEarned: earnedFromSignups + earnedFromPurchases,
        pendingEarnings: pendingSignups + pendingPurchases,
      });
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchReferralCode(), fetchReferrals()]);
      setIsLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchReferralCode, fetchReferrals]);

  const applyReferralCode = async (code: string) => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to apply a referral code',
        variant: 'destructive',
      });
      return false;
    }

    const { data: success, error } = await supabase
      .rpc('process_referral_signup', { 
        p_referred_id: user.id, 
        p_referral_code: code.toUpperCase() 
      });

    if (error) {
      toast({
        title: 'Error applying referral code',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    if (!success) {
      toast({
        title: 'Invalid referral code',
        description: 'This code is invalid, expired, or you have already used a referral code',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Referral code applied!',
      description: 'You will receive rewards when you complete actions on the platform',
    });

    return true;
  };

  const claimReferralReward = async (referralId: string, rewardType: 'signup' | 'purchase') => {
    if (!user) return false;

    const referral = referrals.find(r => r.id === referralId);
    if (!referral) return false;

    if (rewardType === 'signup' && referral.signup_reward_paid) return false;
    if (rewardType === 'purchase' && referral.purchase_reward_paid) return false;

    const category = rewardType === 'signup' ? 'referral_signup' : 'referral_purchase';
    const success = await earnBiGold(category, referralId, 'referral');

    if (success) {
      const updateField = rewardType === 'signup' ? 'signup_reward_paid' : 'purchase_reward_paid';
      await supabase
        .from('referrals')
        .update({ [updateField]: true })
        .eq('id', referralId);

      // Update total earned on referral code
      const reward = rewardType === 'signup' ? 50 : 25;
      await supabase
        .from('user_referral_codes')
        .update({ total_earned: (referralCode?.total_earned || 0) + reward })
        .eq('user_id', user.id);

      await fetchReferrals();
    }

    return success;
  };

  const getReferralLink = () => {
    if (!referralCode) return '';
    return `${window.location.origin}/register?ref=${referralCode.code}`;
  };

  const copyReferralLink = async () => {
    const link = getReferralLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: 'Link copied!',
        description: 'Your referral link has been copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

  const copyReferralCode = async () => {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCode.code);
      toast({
        title: 'Code copied!',
        description: 'Your referral code has been copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the code manually',
        variant: 'destructive',
      });
    }
  };

  return {
    referralCode,
    referrals,
    stats,
    isLoading,
    applyReferralCode,
    claimReferralReward,
    getReferralLink,
    copyReferralLink,
    copyReferralCode,
    refreshReferrals: fetchReferrals,
  };
}
