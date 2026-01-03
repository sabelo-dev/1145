-- Update subscription_plans with comprehensive tier features based on the new spec
-- Standard = Free, Premium = Paid

-- First, delete existing plans and recreate with correct structure
DELETE FROM subscription_plans;

-- Insert the new Standard and Premium plans with comprehensive features
INSERT INTO subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level) VALUES
(
  'Standard', 
  0, 
  'monthly', 
  '[
    "Basic product listings",
    "Search ranking weight 1.0x",
    "Default store template",
    "Basic sales stats",
    "1 promotion per month",
    "Email support (48-72 hrs)",
    "Local selling only",
    "10% platform commission",
    "7-day payout speed"
  ]'::jsonb, 
  25, 
  NULL, 
  'basic'
),
(
  'Premium', 
  299, 
  'monthly', 
  '[
    "Search ranking weight 1.5x",
    "Category priority placement",
    "Homepage exposure",
    "Featured seller badge",
    "Full recommendation engine",
    "Custom store theme",
    "Banner & hero images",
    "Store video support",
    "Custom store URL",
    "Unlimited products",
    "Bulk upload & edit",
    "Inventory sync",
    "Product scheduling",
    "Advanced analytics",
    "A/B testing",
    "Smart discounts",
    "Unlimited promotions",
    "6% platform commission",
    "24-48 hr payouts",
    "Monthly ad credits",
    "Verified badge",
    "Premium badge",
    "Top Seller leaderboard",
    "Priority chat support (<12 hrs)",
    "Optional account manager",
    "Cross-border selling",
    "Bulk buyer access",
    "API access"
  ]'::jsonb, 
  NULL, 
  NULL, 
  'premium'
);

-- Create vendor_subscription_features table to track granular feature access
CREATE TABLE IF NOT EXISTS public.vendor_subscription_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  limit_value INTEGER,
  usage_count INTEGER DEFAULT 0,
  reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, feature_key)
);

-- Create vendor_subscription_usage table to track usage against limits
CREATE TABLE IF NOT EXISTS public.vendor_subscription_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'products', 'promotions', 'orders', etc.
  current_value INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, metric_type, period_start)
);

-- Create upgrade_triggers table to track when vendors hit limits
CREATE TABLE IF NOT EXISTS public.vendor_upgrade_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- 'product_limit_80', 'promotion_cap', 'high_traffic', 'sales_threshold'
  trigger_data JSONB,
  is_dismissed BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMP WITH TIME ZONE
);

-- Add commission_rate and payout_days directly to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 10,
ADD COLUMN IF NOT EXISTS payout_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS search_boost NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS monthly_promotions_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS monthly_promotions_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ad_credits NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS features_config JSONB DEFAULT '{}'::jsonb;

-- Enable RLS
ALTER TABLE public.vendor_subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_upgrade_triggers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_subscription_features
CREATE POLICY "Vendors can view their own features"
ON public.vendor_subscription_features FOR SELECT
USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all features"
ON public.vendor_subscription_features FOR ALL
USING (public.is_admin());

-- RLS Policies for vendor_subscription_usage
CREATE POLICY "Vendors can view their own usage"
ON public.vendor_subscription_usage FOR SELECT
USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

CREATE POLICY "System can manage usage"
ON public.vendor_subscription_usage FOR ALL
USING (public.is_admin());

-- RLS Policies for vendor_upgrade_triggers
CREATE POLICY "Vendors can view their own triggers"
ON public.vendor_upgrade_triggers FOR SELECT
USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

CREATE POLICY "Vendors can dismiss their own triggers"
ON public.vendor_upgrade_triggers FOR UPDATE
USING (vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all triggers"
ON public.vendor_upgrade_triggers FOR ALL
USING (public.is_admin());

-- Function to get tier-specific limits and features
CREATE OR REPLACE FUNCTION public.get_vendor_tier_config(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_config JSONB;
BEGIN
  SELECT subscription_tier INTO v_tier FROM vendors WHERE id = p_vendor_id;
  
  IF v_tier = 'premium' THEN
    v_config := jsonb_build_object(
      'max_products', NULL, -- unlimited
      'monthly_promotions', NULL, -- unlimited
      'commission_rate', 6,
      'payout_days', 2,
      'search_boost', 1.5,
      'custom_theme', true,
      'banner_images', true,
      'store_video', true,
      'custom_url', true,
      'bulk_upload', true,
      'bulk_edit', true,
      'inventory_sync', true,
      'product_scheduling', true,
      'advanced_analytics', true,
      'ab_testing', true,
      'smart_discounts', true,
      'verified_badge', true,
      'premium_badge', true,
      'leaderboard_access', true,
      'priority_support', true,
      'cross_border', true,
      'bulk_buyer_access', true,
      'api_access', true,
      'homepage_exposure', true,
      'category_priority', true,
      'recommendation_full', true,
      'ad_credits_monthly', 500
    );
  ELSE
    -- Standard tier (including trial)
    v_config := jsonb_build_object(
      'max_products', 25,
      'monthly_promotions', 1,
      'commission_rate', 10,
      'payout_days', 7,
      'search_boost', 1.0,
      'custom_theme', false,
      'banner_images', false,
      'store_video', false,
      'custom_url', false,
      'bulk_upload', false,
      'bulk_edit', false,
      'inventory_sync', false,
      'product_scheduling', false,
      'advanced_analytics', false,
      'ab_testing', false,
      'smart_discounts', false,
      'verified_badge', false,
      'premium_badge', false,
      'leaderboard_access', false,
      'priority_support', false,
      'cross_border', false,
      'bulk_buyer_access', false,
      'api_access', false,
      'homepage_exposure', false,
      'category_priority', false,
      'recommendation_full', false,
      'ad_credits_monthly', 0
    );
  END IF;
  
  RETURN v_config;
END;
$$;

-- Function to check if vendor can add more products
CREATE OR REPLACE FUNCTION public.can_vendor_add_product(p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_product_count INTEGER;
  v_max_products INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier FROM vendors WHERE id = p_vendor_id;
  
  -- Premium has unlimited products
  IF v_tier = 'premium' THEN
    RETURN true;
  END IF;
  
  -- Standard tier check
  SELECT COUNT(*) INTO v_product_count 
  FROM products p
  JOIN stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id AND p.status != 'deleted';
  
  v_max_products := 25; -- Standard limit
  
  RETURN v_product_count < v_max_products;
END;
$$;

-- Function to check if vendor can create promotion
CREATE OR REPLACE FUNCTION public.can_vendor_create_promotion(p_vendor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_promo_count INTEGER;
BEGIN
  SELECT subscription_tier INTO v_tier FROM vendors WHERE id = p_vendor_id;
  
  -- Premium has unlimited promotions
  IF v_tier = 'premium' THEN
    RETURN true;
  END IF;
  
  -- Standard tier: 1 promotion per month
  SELECT COUNT(*) INTO v_promo_count
  FROM promotions p
  JOIN stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id 
    AND p.created_at >= date_trunc('month', now());
  
  RETURN v_promo_count < 1;
END;
$$;

-- Function to check upgrade triggers
CREATE OR REPLACE FUNCTION public.check_vendor_upgrade_triggers(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_product_count INTEGER;
  v_max_products INTEGER := 25;
  v_promo_count INTEGER;
  v_monthly_revenue NUMERIC;
  v_triggers JSONB := '[]'::jsonb;
BEGIN
  SELECT subscription_tier INTO v_tier FROM vendors WHERE id = p_vendor_id;
  
  -- Only check for Standard tier
  IF v_tier = 'premium' THEN
    RETURN v_triggers;
  END IF;
  
  -- Check product limit (80% threshold)
  SELECT COUNT(*) INTO v_product_count 
  FROM products p
  JOIN stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id AND p.status != 'deleted';
  
  IF v_product_count >= (v_max_products * 0.8) THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'product_limit_80',
      'message', format('You''ve used %s of %s product slots', v_product_count, v_max_products),
      'percentage', round((v_product_count::numeric / v_max_products) * 100)
    );
  END IF;
  
  -- Check promotion cap
  SELECT COUNT(*) INTO v_promo_count
  FROM promotions p
  JOIN stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id 
    AND p.created_at >= date_trunc('month', now());
  
  IF v_promo_count >= 1 THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'promotion_cap',
      'message', 'You''ve used your monthly promotion. Upgrade for unlimited promotions!'
    );
  END IF;
  
  -- Check monthly revenue threshold (e.g., R10,000)
  SELECT COALESCE(SUM(oi.price * oi.quantity), 0) INTO v_monthly_revenue
  FROM order_items oi
  JOIN stores s ON oi.store_id = s.id
  WHERE s.vendor_id = p_vendor_id 
    AND oi.created_at >= date_trunc('month', now());
  
  IF v_monthly_revenue >= 10000 THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'sales_threshold',
      'message', format('You''ve earned R%s this month! Upgrade to Premium for lower fees.', round(v_monthly_revenue)),
      'potential_savings', round(v_monthly_revenue * 0.04) -- 4% difference
    );
  END IF;
  
  RETURN v_triggers;
END;
$$;

-- Function to apply tier benefits when subscription changes
CREATE OR REPLACE FUNCTION public.apply_subscription_tier_benefits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_tier = 'premium' THEN
    NEW.commission_rate := 6;
    NEW.payout_days := 2;
    NEW.search_boost := 1.5;
    NEW.monthly_promotions_limit := NULL; -- unlimited
    NEW.ad_credits := COALESCE(NEW.ad_credits, 0) + 500; -- monthly allocation
  ELSE
    NEW.commission_rate := 10;
    NEW.payout_days := 7;
    NEW.search_boost := 1.0;
    NEW.monthly_promotions_limit := 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription tier changes
DROP TRIGGER IF EXISTS apply_tier_benefits_trigger ON vendors;
CREATE TRIGGER apply_tier_benefits_trigger
  BEFORE UPDATE OF subscription_tier ON vendors
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
  EXECUTE FUNCTION apply_subscription_tier_benefits();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_tier ON vendors(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_vendor_upgrade_triggers_vendor ON vendor_upgrade_triggers(vendor_id, is_dismissed);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_usage_vendor ON vendor_subscription_usage(vendor_id, metric_type);