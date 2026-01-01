import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ConsumerStreak, 
  BadgeDefinition, 
  ConsumerBadge, 
  FlashDeal,
  ConsumerPreferences,
  OrderInsurance 
} from '@/types/retention';
import { useToast } from '@/hooks/use-toast';

export function useConsumerRetention() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState<ConsumerStreak | null>(null);
  const [badges, setBadges] = useState<ConsumerBadge[]>([]);
  const [allBadges, setAllBadges] = useState<BadgeDefinition[]>([]);
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([]);
  const [preferences, setPreferences] = useState<ConsumerPreferences | null>(null);

  const fetchStreak = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('consumer_streaks')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setStreak(data as ConsumerStreak);
    }
  }, [user]);

  const fetchBadges = useCallback(async () => {
    if (!user) return;
    
    const [earnedRes, allRes] = await Promise.all([
      supabase
        .from('consumer_badges')
        .select('*, badge:badge_definitions(*)')
        .eq('user_id', user.id),
      supabase
        .from('badge_definitions')
        .select('*')
        .eq('is_active', true)
        .order('requirement_value', { ascending: true })
    ]);
    
    if (earnedRes.data) {
      setBadges(earnedRes.data as ConsumerBadge[]);
    }
    if (allRes.data) {
      setAllBadges(allRes.data as BadgeDefinition[]);
    }
  }, [user]);

  const fetchFlashDeals = useCallback(async () => {
    const now = new Date().toISOString();
    
    const { data } = await supabase
      .from('flash_deals')
      .select(`
        *,
        product:products(id, name, price, slug, store_id),
        store:stores(id, name, logo_url)
      `)
      .eq('is_active', true)
      .lte('start_time', now)
      .gt('end_time', now)
      .order('end_time', { ascending: true });
    
    if (data) {
      setFlashDeals(data as unknown as FlashDeal[]);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('consumer_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setPreferences(data as unknown as ConsumerPreferences);
    }
  }, [user]);

  const updatePreferences = async (updates: Partial<ConsumerPreferences>) => {
    if (!user) return;

    const { error } = await supabase
      .from('consumer_preferences')
      .upsert({
        user_id: user.id,
        ...updates,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast({ title: 'Error updating preferences', variant: 'destructive' });
    } else {
      await fetchPreferences();
      toast({ title: 'Preferences updated' });
    }
  };

  const checkAndAwardBadges = async () => {
    if (!user) return 0;

    const { data, error } = await supabase.rpc('check_and_award_badges', {
      p_user_id: user.id
    });

    if (!error && data && data > 0) {
      toast({ 
        title: `🎉 You earned ${data} new badge${data > 1 ? 's' : ''}!`,
        description: 'Check your profile to see your achievements.'
      });
      await fetchBadges();
    }

    return data || 0;
  };

  const logActivity = async (
    activity_type: 'view' | 'search' | 'cart_add' | 'purchase' | 'wishlist',
    data: { category?: string; product_id?: string; store_id?: string; metadata?: Record<string, unknown> }
  ) => {
    if (!user) return;

    await supabase.from('consumer_activity_log').insert([{
      user_id: user.id,
      activity_type,
      category: data.category || null,
      product_id: data.product_id || null,
      store_id: data.store_id || null,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null
    }]);
  };

  const purchaseOrderInsurance = async (
    orderId: string, 
    coverageType: 'full' | 'partial' | 'delay',
    ucoinCost: number,
    coverageAmount: number
  ): Promise<boolean> => {
    if (!user) return false;

    // Deduct UCoin first
    const { data: wallet } = await supabase
      .from('bigold_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (!wallet || wallet.balance < ucoinCost) {
      toast({ title: 'Insufficient UCoin balance', variant: 'destructive' });
      return false;
    }

    // Create insurance record
    const { error } = await supabase.from('order_insurance').insert({
      order_id: orderId,
      user_id: user.id,
      ucoin_cost: ucoinCost,
      coverage_type: coverageType,
      coverage_amount: coverageAmount
    });

    if (error) {
      toast({ title: 'Failed to purchase insurance', variant: 'destructive' });
      return false;
    }

    // Deduct UCoin
    await supabase
      .from('bigold_wallets')
      .update({ 
        balance: wallet.balance - ucoinCost,
        lifetime_spent: wallet.balance + ucoinCost
      })
      .eq('user_id', user.id);

    toast({ title: '✓ Order insurance purchased!' });
    return true;
  };

  const getNextBadgeProgress = useCallback(() => {
    if (!user || badges.length === 0) return null;

    const earnedIds = new Set(badges.map(b => b.badge_id));
    const unearnedBadges = allBadges.filter(b => !earnedIds.has(b.id));
    
    if (unearnedBadges.length === 0) return null;

    // Find the closest badge to earning
    // This is simplified - in production you'd calculate actual progress
    const nextBadge = unearnedBadges[0];
    
    return {
      badge: nextBadge,
      currentValue: 0, // Would need to query actual stats
      percentComplete: 0
    };
  }, [user, badges, allBadges]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchStreak(),
        fetchBadges(),
        fetchFlashDeals(),
        fetchPreferences()
      ]);
      setIsLoading(false);
    };

    loadData();
  }, [fetchStreak, fetchBadges, fetchFlashDeals, fetchPreferences]);

  return {
    isLoading,
    streak,
    badges,
    allBadges,
    flashDeals,
    preferences,
    updatePreferences,
    checkAndAwardBadges,
    logActivity,
    purchaseOrderInsurance,
    getNextBadgeProgress,
    refetch: {
      streak: fetchStreak,
      badges: fetchBadges,
      flashDeals: fetchFlashDeals,
      preferences: fetchPreferences
    }
  };
}
