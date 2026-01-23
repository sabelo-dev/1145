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
  tier: 'starter' | 'bronze' | 'silver' | 'gold';
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

      const tier = (vendor.subscription_tier as VendorSubscriptionData['tier']) || 'starter';

      const configByTier: Record<VendorSubscriptionData['tier'], SubscriptionTierConfig> = {
        starter: {
          max_products: 25,
          monthly_promotions: 1,
          commission_rate: 10,
          payout_days: 7,
          search_boost: 1.0,
          custom_theme: false,
          banner_images: false,
          store_video: false,
          custom_url: false,
          bulk_upload: false,
          bulk_edit: false,
          inventory_sync: false,
          product_scheduling: false,
          advanced_analytics: false,
          ab_testing: false,
          smart_discounts: false,
          verified_badge: false,
          premium_badge: false,
          leaderboard_access: false,
          priority_support: false,
          cross_border: false,
          bulk_buyer_access: false,
          api_access: false,
          homepage_exposure: false,
          category_priority: false,
          recommendation_full: false,
          ad_credits_monthly: 0,
        },
        bronze: {
          max_products: 100,
          monthly_promotions: 5,
          commission_rate: 9,
          payout_days: 5,
          search_boost: 1.1,
          custom_theme: false,
          banner_images: false,
          store_video: false,
          custom_url: false,
          bulk_upload: false,
          bulk_edit: false,
          inventory_sync: false,
          product_scheduling: false,
          advanced_analytics: false,
          ab_testing: false,
          smart_discounts: false,
          verified_badge: false,
          premium_badge: false,
          leaderboard_access: false,
          priority_support: false,
          cross_border: false,
          bulk_buyer_access: false,
          api_access: false,
          homepage_exposure: false,
          category_priority: false,
          recommendation_full: false,
          ad_credits_monthly: 100,
        },
        silver: {
          max_products: 300,
          monthly_promotions: 20,
          commission_rate: 8,
          payout_days: 3,
          search_boost: 1.25,
          custom_theme: true,
          banner_images: true,
          store_video: false,
          custom_url: true,
          bulk_upload: true,
          bulk_edit: true,
          inventory_sync: false,
          product_scheduling: true,
          advanced_analytics: true,
          ab_testing: false,
          smart_discounts: false,
          verified_badge: true,
          premium_badge: false,
          leaderboard_access: false,
          priority_support: true,
          cross_border: false,
          bulk_buyer_access: false,
          api_access: false,
          homepage_exposure: false,
          category_priority: true,
          recommendation_full: true,
          ad_credits_monthly: 250,
        },
        gold: {
          max_products: null,
          monthly_promotions: null,
          commission_rate: 6,
          payout_days: 2,
          search_boost: 1.5,
          custom_theme: true,
          banner_images: true,
          store_video: true,
          custom_url: true,
          bulk_upload: true,
          bulk_edit: true,
          inventory_sync: true,
          product_scheduling: true,
          advanced_analytics: true,
          ab_testing: true,
          smart_discounts: true,
          verified_badge: true,
          premium_badge: true,
          leaderboard_access: true,
          priority_support: true,
          cross_border: true,
          bulk_buyer_access: true,
          api_access: true,
          homepage_exposure: true,
          category_priority: true,
          recommendation_full: true,
          ad_credits_monthly: 500,
        },
      };

      const config: SubscriptionTierConfig = configByTier[tier] || configByTier.starter;

      setTierConfig(config);

      // Build subscription data
      const subscriptionData: VendorSubscriptionData = {
        tier,
        status: (vendor.subscription_status as 'active' | 'expired' | 'cancelled') || 'active',
        expiresAt: vendor.subscription_expires_at,
        commissionRate: vendor.commission_rate || config.commission_rate,
        payoutDays: vendor.payout_days || config.payout_days,
        searchBoost: vendor.search_boost || config.search_boost,
        adCredits: vendor.ad_credits || 0,
        productCount,
        productLimit: config.max_products,
        promotionsUsed,
        promotionsLimit: config.monthly_promotions,
      };

      setSubscription(subscriptionData);

      // Check upgrade triggers for non-top tiers
      if (tier !== 'gold') {
        const triggers: UpgradeTrigger[] = [];

        const nextTier: VendorSubscriptionData['tier'] =
          tier === 'starter' ? 'bronze' : tier === 'bronze' ? 'silver' : 'gold';

        const maxProducts = config.max_products;
        const promoLimit = config.monthly_promotions;

        // Product limit trigger (80% threshold)
        if (typeof maxProducts === 'number' && maxProducts > 0 && productCount >= Math.floor(maxProducts * 0.8)) {
          triggers.push({
            type: 'product_limit_80',
            message: `You've used ${productCount} of ${maxProducts} product slots. Upgrade to ${nextTier.toUpperCase()} for more.`,
            percentage: Math.round((productCount / maxProducts) * 100),
          });
        }

        // Promotion cap trigger
        if (typeof promoLimit === 'number' && promotionsUsed >= promoLimit) {
          triggers.push({
            type: 'promotion_cap',
            message: `You've used your monthly promotions. Upgrade to ${nextTier.toUpperCase()} for more.`,
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
    if (subscription.productLimit === null) return true;
    return subscription.productCount < subscription.productLimit;
  }, [subscription]);

  const canCreatePromotion = useCallback(() => {
    if (!subscription) return false;
    if (subscription.promotionsLimit === null) return true;
    return subscription.promotionsUsed < subscription.promotionsLimit;
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
