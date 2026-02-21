import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube';
  platform_user_id: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_verified: boolean;
  status: 'active' | 'disconnected' | 'suspended';
  connected_at: string;
  last_synced_at: string | null;
}

export interface AffiliateTier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  min_conversions: number;
  mining_multiplier: number;
  daily_mining_cap: number;
  badge_color: string;
  badge_icon: string;
}

export interface UserAffiliateStatus {
  id: string;
  user_id: string;
  tier_id: string;
  total_conversions: number;
  total_referrals: number;
  total_mined: number;
  today_mined: number;
  last_mining_date: string | null;
  affiliate_code: string | null;
  is_active: boolean;
  tier?: AffiliateTier;
}

export interface MiningTask {
  id: string;
  category: 'affiliate' | 'engagement' | 'content';
  task_type: string;
  title: string;
  description: string | null;
  platform: string | null;
  base_reward: number;
  reward_tier: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  min_followers: number;
  cooldown_hours: number;
  requires_verification: boolean;
  max_daily_completions: number;
  is_active: boolean;
}

export interface MiningCompletion {
  id: string;
  user_id: string;
  task_id: string;
  campaign_id: string | null;
  proof_url: string | null;
  base_reward: number;
  multiplier: number;
  final_reward: number;
  status: 'pending' | 'verified' | 'rejected' | 'paid';
  created_at: string;
  task?: MiningTask;
}

export interface DailyMiningLimit {
  total_mined: number;
  tasks_completed: number;
  daily_cap: number;
  remaining: number;
  percentage: number;
}

export function useSocialMining() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [affiliateStatus, setAffiliateStatus] = useState<UserAffiliateStatus | null>(null);
  const [affiliateTiers, setAffiliateTiers] = useState<AffiliateTier[]>([]);
  const [miningTasks, setMiningTasks] = useState<MiningTask[]>([]);
  const [completions, setCompletions] = useState<MiningCompletion[]>([]);
  const [dailyLimit, setDailyLimit] = useState<DailyMiningLimit | null>(null);

  const fetchSocialAccounts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (data) setSocialAccounts(data as SocialAccount[]);
  }, [user]);

  const fetchAffiliateTiers = useCallback(async () => {
    const { data } = await supabase
      .from('affiliate_tiers')
      .select('*')
      .order('level', { ascending: true });
    if (data) setAffiliateTiers(data as AffiliateTier[]);
  }, []);

  const fetchAffiliateStatus = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_affiliate_status')
      .select('*, tier:affiliate_tiers(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setAffiliateStatus(data as UserAffiliateStatus);
    } else if (!error) {
      // Create default status
      const { data: defaultTier } = await supabase
        .from('affiliate_tiers')
        .select('id')
        .eq('level', 1)
        .single();

      if (defaultTier) {
        const { data: newStatus } = await supabase
          .from('user_affiliate_status')
          .insert({ user_id: user.id, tier_id: defaultTier.id })
          .select('*, tier:affiliate_tiers(*)')
          .single();
        if (newStatus) setAffiliateStatus(newStatus as UserAffiliateStatus);
      }
    }
  }, [user]);

  const fetchMiningTasks = useCallback(async () => {
    const { data } = await supabase
      .from('mining_tasks')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });
    if (data) setMiningTasks(data as MiningTask[]);
  }, []);

  const fetchCompletions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('mining_completions')
      .select('*, task:mining_tasks(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setCompletions(data as MiningCompletion[]);
  }, [user]);

  const fetchDailyLimit = useCallback(async () => {
    if (!user || !affiliateStatus?.tier) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_mining_limits')
      .select('*')
      .eq('user_id', user.id)
      .eq('mining_date', today)
      .maybeSingle();

    const totalMined = data?.total_mined || 0;
    const dailyCap = affiliateStatus.tier.daily_mining_cap;
    
    setDailyLimit({
      total_mined: totalMined,
      tasks_completed: data?.tasks_completed || 0,
      daily_cap: dailyCap,
      remaining: Math.max(0, dailyCap - totalMined),
      percentage: Math.min(100, (totalMined / dailyCap) * 100)
    });
  }, [user, affiliateStatus]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchAffiliateTiers(),
        fetchMiningTasks()
      ]);
      
      if (user) {
        await Promise.all([
          fetchSocialAccounts(),
          fetchAffiliateStatus(),
          fetchCompletions()
        ]);
      }
      setIsLoading(false);
    };

    loadData();
  }, [user, fetchAffiliateTiers, fetchMiningTasks, fetchSocialAccounts, fetchAffiliateStatus, fetchCompletions]);

  useEffect(() => {
    if (affiliateStatus?.tier) {
      fetchDailyLimit();
    }
  }, [affiliateStatus, fetchDailyLimit]);

  const connectSocialAccount = async (
    platform: SocialAccount['platform'],
    platformData: {
      platform_user_id: string;
      username: string;
      display_name?: string;
      profile_url?: string;
      avatar_url?: string;
      follower_count?: number;
    }
  ) => {
    if (!user) return false;

    const { error } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        platform,
        ...platformData,
        status: 'active',
        connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,platform' });

    if (error) {
      toast({ title: 'Failed to connect account', variant: 'destructive' });
      return false;
    }

    toast({ title: `${platform} connected successfully!` });
    await fetchSocialAccounts();
    return true;
  };

  const disconnectSocialAccount = async (accountId: string) => {
    const { error } = await supabase
      .from('social_accounts')
      .update({ status: 'disconnected' })
      .eq('id', accountId);

    if (!error) {
      toast({ title: 'Account disconnected' });
      await fetchSocialAccounts();
    }
  };

  const completeTask = async (
    taskId: string,
    proofUrl?: string,
    socialAccountId?: string
  ) => {
    if (!user) return null;

    const { data, error } = await supabase.rpc('complete_mining_task', {
      p_user_id: user.id,
      p_task_id: taskId,
      p_social_account_id: socialAccountId || null,
      p_proof_url: proofUrl || null,
      p_proof_data: null,
      p_campaign_id: null
    });

    if (error) {
      toast({ title: 'Failed to complete task', description: error.message, variant: 'destructive' });
      return null;
    }

    const result = data as { success: boolean; error?: string; reward?: number; status?: string; message?: string };

    if (!result.success) {
      toast({ title: 'Task not completed', description: result.error, variant: 'destructive' });
      return null;
    }

    toast({
      title: 'Task Completed! 🎉',
      description: result.message || `${result.reward} UCoin has been credited to your wallet.`
    });

    await Promise.all([fetchCompletions(), fetchDailyLimit(), fetchAffiliateStatus()]);
    return result;
  };

  const getTaskCompletionsToday = (taskId: string): number => {
    const today = new Date().toISOString().split('T')[0];
    return completions.filter(
      c => c.task_id === taskId && 
      c.created_at.startsWith(today) && 
      c.status !== 'rejected'
    ).length;
  };

  const canCompleteTask = (task: MiningTask): boolean => {
    if (!dailyLimit) return false;
    if (dailyLimit.remaining <= 0) return false;
    
    const completionsToday = getTaskCompletionsToday(task.id);
    if (completionsToday >= task.max_daily_completions) return false;

    if (task.min_followers > 0) {
      const hasQualifyingAccount = socialAccounts.some(
        acc => (!task.platform || task.platform === 'any' || acc.platform === task.platform) &&
               acc.follower_count >= task.min_followers
      );
      if (!hasQualifyingAccount) return false;
    }

    return true;
  };

  const getNextTier = (): AffiliateTier | null => {
    if (!affiliateStatus?.tier) return affiliateTiers[0] || null;
    const currentLevel = affiliateStatus.tier.level;
    return affiliateTiers.find(t => t.level === currentLevel + 1) || null;
  };

  const getTierProgress = (): number => {
    if (!affiliateStatus) return 0;
    const nextTier = getNextTier();
    if (!nextTier) return 100;
    
    const current = affiliateStatus.total_conversions;
    const required = nextTier.min_conversions;
    const prev = affiliateStatus.tier?.min_conversions || 0;
    
    return Math.min(100, ((current - prev) / (required - prev)) * 100);
  };

  return {
    isLoading,
    socialAccounts,
    affiliateStatus,
    affiliateTiers,
    miningTasks,
    completions,
    dailyLimit,
    connectSocialAccount,
    disconnectSocialAccount,
    completeTask,
    canCompleteTask,
    getTaskCompletionsToday,
    getNextTier,
    getTierProgress,
    refresh: async () => {
      await Promise.all([
        fetchSocialAccounts(),
        fetchAffiliateStatus(),
        fetchCompletions(),
        fetchDailyLimit()
      ]);
    }
  };
}
