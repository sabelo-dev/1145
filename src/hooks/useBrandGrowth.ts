import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  BrandTier,
  BrandPerformance,
  PromoCredits,
  PromoCreditTransaction,
  SponsoredPlacement,
  AutoCampaign,
  BrandBundle,
  CrossPromotion,
  BrandImprovementTip
} from '@/types/brand';

export function useBrandGrowth(merchantId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [tier, setTier] = useState<BrandTier | null>(null);
  const [allTiers, setAllTiers] = useState<BrandTier[]>([]);
  const [performance, setPerformance] = useState<BrandPerformance | null>(null);
  const [promoCredits, setPromoCredits] = useState<PromoCredits | null>(null);
  const [transactions, setTransactions] = useState<PromoCreditTransaction[]>([]);
  const [placements, setPlacements] = useState<SponsoredPlacement[]>([]);
  const [campaigns, setCampaigns] = useState<AutoCampaign[]>([]);
  const [bundles, setBundles] = useState<BrandBundle[]>([]);
  const [crossPromos, setCrossPromos] = useState<CrossPromotion[]>([]);
  const [tips, setTips] = useState<BrandImprovementTip[]>([]);

  const fetchTiers = useCallback(async () => {
    const { data } = await supabase
      .from('brand_tiers')
      .select('*')
      .order('level', { ascending: true });
    
    if (data) {
      setAllTiers(data as unknown as BrandTier[]);
    }
  }, []);

  const fetchMerchantData = useCallback(async () => {
    if (!merchantId) return;

    // Get merchant's current tier
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('tier_id')
      .eq('id', merchantId)
      .maybeSingle();

    if (merchantData?.tier_id) {
      const { data: tierData } = await supabase
        .from('brand_tiers')
        .select('*')
        .eq('id', merchantData.tier_id)
        .maybeSingle();
      
      if (tierData) setTier(tierData as unknown as BrandTier);
    }

    // Get latest performance
    const { data: perfData } = await supabase
      .from('brand_performance')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (perfData) setPerformance(perfData as unknown as BrandPerformance);

    // Get promo credits
    const { data: creditsData } = await supabase
      .from('promo_credits')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    
    if (creditsData) setPromoCredits(creditsData as unknown as PromoCredits);

    // Get transactions
    const { data: txData } = await supabase
      .from('promo_credit_transactions')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (txData) setTransactions(txData as unknown as PromoCreditTransaction[]);

    // Get active placements
    const { data: placementData } = await supabase
      .from('sponsored_placements')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });
    
    if (placementData) setPlacements(placementData as unknown as SponsoredPlacement[]);

    // Get campaigns
    const { data: campaignData } = await supabase
      .from('auto_campaigns')
      .select('*')
      .eq('merchant_id', merchantId);
    
    if (campaignData) setCampaigns(campaignData as unknown as AutoCampaign[]);

    // Get bundles
    const { data: bundleData } = await supabase
      .from('brand_bundles')
      .select('*')
      .eq('created_by_merchant_id', merchantId);
    
    if (bundleData) setBundles(bundleData as unknown as BrandBundle[]);

    // Get cross promotions
    const { data: promoData } = await supabase
      .from('cross_promotions')
      .select('*')
      .or(`initiator_merchant_id.eq.${merchantId},partner_merchant_id.eq.${merchantId}`);
    
    if (promoData) setCrossPromos(promoData as unknown as CrossPromotion[]);

    // Get tips
    const { data: tipsData } = await supabase
      .from('brand_improvement_tips')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_dismissed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (tipsData) setTips(tipsData as unknown as BrandImprovementTip[]);
  }, [merchantId]);

  const spendCredits = async (amount: number, category: string, description: string, referenceId?: string) => {
    if (!merchantId || !promoCredits || promoCredits.balance < amount) {
      toast({ title: 'Insufficient promo credits', variant: 'destructive' });
      return false;
    }

    const { error: updateError } = await supabase
      .from('promo_credits')
      .update({
        balance: promoCredits.balance - amount,
        lifetime_spent: promoCredits.lifetime_spent + amount,
        updated_at: new Date().toISOString()
      })
      .eq('merchant_id', merchantId);

    if (updateError) {
      toast({ title: 'Failed to spend credits', variant: 'destructive' });
      return false;
    }

    await supabase.from('promo_credit_transactions').insert([{
      merchant_id: merchantId,
      amount: -amount,
      type: 'spend',
      category,
      description,
      reference_id: referenceId
    }]);

    await fetchMerchantData();
    toast({ title: `Spent ${amount} promo credits` });
    return true;
  };

  const createSponsoredPlacement = async (
    placementType: string,
    creditCost: number,
    duration: number,
    productId?: string,
    storeId?: string
  ) => {
    if (!merchantId) return null;

    const success = await spendCredits(creditCost, 'sponsored_placement', `Sponsored ${placementType}`);
    if (!success) return null;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('sponsored_placements')
      .insert([{
        merchant_id: merchantId,
        store_id: storeId,
        product_id: productId,
        placement_type: placementType,
        credit_cost: creditCost,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Failed to create placement', variant: 'destructive' });
      return null;
    }

    await fetchMerchantData();
    toast({ title: 'Sponsored placement created!' });
    return data;
  };

  const createAutoCampaign = async (
    campaignType: string,
    triggerConditions: Record<string, unknown>,
    actionConfig: Record<string, unknown>,
    creditBudget: number,
    storeId?: string
  ) => {
    if (!merchantId) return null;

    const { data, error } = await supabase
      .from('auto_campaigns')
      .insert([{
        merchant_id: merchantId,
        store_id: storeId || null,
        campaign_type: campaignType,
        trigger_conditions: JSON.parse(JSON.stringify(triggerConditions)),
        action_config: JSON.parse(JSON.stringify(actionConfig)),
        credit_budget: creditBudget
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Failed to create campaign', variant: 'destructive' });
      return null;
    }

    await fetchMerchantData();
    toast({ title: 'Auto campaign created!' });
    return data;
  };

  const createBundle = async (name: string, description: string, products: { productId: string; merchantId: string; discount: number }[]) => {
    if (!merchantId) return null;

    const { data: bundle, error } = await supabase
      .from('brand_bundles')
      .insert([{
        name,
        description,
        created_by_merchant_id: merchantId
      }])
      .select()
      .single();

    if (error || !bundle) {
      toast({ title: 'Failed to create bundle', variant: 'destructive' });
      return null;
    }

    // Add products
    await supabase.from('brand_bundle_products').insert(
      products.map(p => ({
        bundle_id: bundle.id,
        merchant_id: p.merchantId,
        product_id: p.productId,
        contribution_discount: p.discount,
        status: p.merchantId === merchantId ? 'accepted' : 'pending'
      }))
    );

    await fetchMerchantData();
    toast({ title: 'Bundle created!' });
    return bundle;
  };

  const createCrossPromotion = async (
    partnerMerchantId: string,
    promoType: string,
    terms: Record<string, unknown>,
    products: string[]
  ) => {
    if (!merchantId) return null;

    const { data, error } = await supabase
      .from('cross_promotions')
      .insert([{
        initiator_merchant_id: merchantId,
        partner_merchant_id: partnerMerchantId,
        promo_type: promoType,
        terms: JSON.parse(JSON.stringify(terms)),
        initiator_products: products
      }])
      .select()
      .single();

    if (error) {
      toast({ title: 'Failed to create cross-promotion', variant: 'destructive' });
      return null;
    }

    await fetchMerchantData();
    toast({ title: 'Cross-promotion request sent!' });
    return data;
  };

  const dismissTip = async (tipId: string) => {
    await supabase
      .from('brand_improvement_tips')
      .update({ is_dismissed: true })
      .eq('id', tipId);
    
    setTips(prev => prev.filter(t => t.id !== tipId));
  };

  const markTipRead = async (tipId: string) => {
    await supabase
      .from('brand_improvement_tips')
      .update({ is_read: true })
      .eq('id', tipId);
    
    setTips(prev => prev.map(t => t.id === tipId ? { ...t, is_read: true } : t));
  };

  const getNextTierProgress = useCallback(() => {
    if (!tier || !performance) return null;
    
    const nextTier = allTiers.find(t => t.level === tier.level + 1);
    if (!nextTier) return null;

    return {
      tier: nextTier,
      revenueProgress: Math.min((performance.total_revenue / nextTier.min_revenue) * 100, 100),
      fulfillmentProgress: Math.min(((performance.fulfillment_rate || 0) / nextTier.min_fulfillment_rate) * 100, 100),
      ratingProgress: Math.min(((performance.average_rating || 0) / nextTier.min_rating) * 100, 100),
      ordersProgress: Math.min((performance.total_orders / nextTier.min_orders) * 100, 100)
    };
  }, [tier, performance, allTiers]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTiers(), fetchMerchantData()]);
      setIsLoading(false);
    };

    loadData();
  }, [fetchTiers, fetchMerchantData]);

  return {
    isLoading,
    tier,
    allTiers,
    performance,
    promoCredits,
    transactions,
    placements,
    campaigns,
    bundles,
    crossPromos,
    tips,
    spendCredits,
    createSponsoredPlacement,
    createAutoCampaign,
    createBundle,
    createCrossPromotion,
    dismissTip,
    markTipRead,
    getNextTierProgress,
    refetch: fetchMerchantData
  };
}
