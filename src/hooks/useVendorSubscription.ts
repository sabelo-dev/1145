import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionTierConfig {
  max_products: number | null;
  monthly_promotions: number | null;
  commission_rate: number;
  payout_days: number;
  search_boost: number;
  custom_theme: boolean;
  banner_images: boolean;
  store_video: boolean;
  custom_url: boolean;
  bulk_upload: boolean;
  bulk_edit: boolean;
  inventory_sync: boolean;
  product_scheduling: boolean;
  advanced_analytics: boolean;
  ab_testing: boolean;
  smart_discounts: boolean;
  verified_badge: boolean;
  premium_badge: boolean;
  leaderboard_access: boolean;
  priority_support: boolean;
  cross_border: boolean;
  bulk_buyer_access: boolean;
  api_access: boolean;
  homepage_exposure: boolean;
  category_priority: boolean;
  recommendation_full: boolean;
  ad_credits_monthly: number;
}

export interface UpgradeTrigger {
  type: 'product_limit_80' | 'promotion_cap' | 'high_traffic' | 'sales_threshold';
  message: string;
  percentage?: number;
  potential_savings?: number;
}

export interface VendorSubscriptionData {
  tier: 'standard' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  expiresAt?: string;
  commissionRate: number;
  payoutDays: number;
  searchBoost: number;
  adCredits: number;
  productCount: number;
  productLimit: number | null;
  promotionsUsed: number;
  promotionsLimit: number | null;
}

export const useVendorSubscription = (vendorId?: string) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<VendorSubscriptionData | null>(null);
  const [tierConfig, setTierConfig] = useState<SubscriptionTierConfig | null>(null);
  const [upgradeTriggers, setUpgradeTriggers] = useState<UpgradeTrigger[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionData = useCallback(async () => {
    if (!vendorId && !user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Get vendor data
      let query = supabase.from('vendors').select('*');
      
      if (vendorId) {
        query = query.eq('id', vendorId);
      } else if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data: vendor, error: vendorError } = await query.maybeSingle();

      if (vendorError) throw vendorError;
      if (!vendor) {
        setLoading(false);
        return;
      }

      // Get product count
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('vendor_id', vendor.id);

      const storeIds = stores?.map(s => s.id) || [];
      
      let productCount = 0;
      if (storeIds.length > 0) {
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds)
          .neq('status', 'deleted');
        productCount = count || 0;
      }

      // Get promotions used this month
      let promotionsUsed = 0;
      if (storeIds.length > 0) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('promotions')
          .select('*', { count: 'exact', head: true })
          .in('store_id', storeIds)
          .gte('created_at', startOfMonth.toISOString());
        promotionsUsed = count || 0;
      }

      const tier = vendor.subscription_tier === 'premium' ? 'premium' : 'standard';
      const isPremium = tier === 'premium';

      // Build tier config
      const config: SubscriptionTierConfig = {
        max_products: isPremium ? null : 25,
        monthly_promotions: isPremium ? null : 1,
        commission_rate: isPremium ? 6 : 10,
        payout_days: isPremium ? 2 : 7,
        search_boost: isPremium ? 1.5 : 1.0,
        custom_theme: isPremium,
        banner_images: isPremium,
        store_video: isPremium,
        custom_url: isPremium,
        bulk_upload: isPremium,
        bulk_edit: isPremium,
        inventory_sync: isPremium,
        product_scheduling: isPremium,
        advanced_analytics: isPremium,
        ab_testing: isPremium,
        smart_discounts: isPremium,
        verified_badge: isPremium,
        premium_badge: isPremium,
        leaderboard_access: isPremium,
        priority_support: isPremium,
        cross_border: isPremium,
        bulk_buyer_access: isPremium,
        api_access: isPremium,
        homepage_exposure: isPremium,
        category_priority: isPremium,
        recommendation_full: isPremium,
        ad_credits_monthly: isPremium ? 500 : 0,
      };

      setTierConfig(config);

      // Build subscription data
      const subscriptionData: VendorSubscriptionData = {
        tier,
        status: (vendor.subscription_status as 'active' | 'expired' | 'cancelled') || 'active',
        expiresAt: vendor.subscription_expires_at,
        commissionRate: vendor.commission_rate || (isPremium ? 6 : 10),
        payoutDays: vendor.payout_days || (isPremium ? 2 : 7),
        searchBoost: vendor.search_boost || (isPremium ? 1.5 : 1.0),
        adCredits: vendor.ad_credits || 0,
        productCount,
        productLimit: isPremium ? null : 25,
        promotionsUsed,
        promotionsLimit: isPremium ? null : 1,
      };

      setSubscription(subscriptionData);

      // Check upgrade triggers for Standard tier
      if (tier === 'standard') {
        const triggers: UpgradeTrigger[] = [];

        // Product limit trigger (80% threshold)
        if (productCount >= 20) {
          triggers.push({
            type: 'product_limit_80',
            message: `You've used ${productCount} of 25 product slots`,
            percentage: Math.round((productCount / 25) * 100),
          });
        }

        // Promotion cap trigger
        if (promotionsUsed >= 1) {
          triggers.push({
            type: 'promotion_cap',
            message: "You've used your monthly promotion. Upgrade for unlimited!",
          });
        }

        setUpgradeTriggers(triggers);
      } else {
        setUpgradeTriggers([]);
      }

    } catch (err: any) {
      console.error('Error fetching subscription data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [vendorId, user?.id]);

  useEffect(() => {
    fetchSubscriptionData();
  }, [fetchSubscriptionData]);

  const canAddProduct = useCallback(() => {
    if (!subscription) return false;
    if (subscription.tier === 'premium') return true;
    return subscription.productCount < (subscription.productLimit || 25);
  }, [subscription]);

  const canCreatePromotion = useCallback(() => {
    if (!subscription) return false;
    if (subscription.tier === 'premium') return true;
    return subscription.promotionsUsed < (subscription.promotionsLimit || 1);
  }, [subscription]);

  const hasFeature = useCallback((feature: keyof SubscriptionTierConfig) => {
    if (!tierConfig) return false;
    return !!tierConfig[feature];
  }, [tierConfig]);

  const getProductUsagePercent = useCallback(() => {
    if (!subscription || subscription.productLimit === null) return 0;
    return Math.round((subscription.productCount / subscription.productLimit) * 100);
  }, [subscription]);

  const getPromotionUsagePercent = useCallback(() => {
    if (!subscription || subscription.promotionsLimit === null) return 0;
    return Math.round((subscription.promotionsUsed / subscription.promotionsLimit) * 100);
  }, [subscription]);

  return {
    loading,
    error,
    subscription,
    tierConfig,
    upgradeTriggers,
    canAddProduct,
    canCreatePromotion,
    hasFeature,
    getProductUsagePercent,
    getPromotionUsagePercent,
    refresh: fetchSubscriptionData,
  };
};
