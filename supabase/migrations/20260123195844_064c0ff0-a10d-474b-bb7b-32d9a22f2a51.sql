-- Upgrade vendor subscription tiers to: starter (free), bronze, silver, gold
-- 1) Normalize existing vendor tier values
UPDATE public.vendors
SET subscription_tier = 'starter'
WHERE subscription_tier IS NULL OR subscription_tier IN ('trial', 'standard');

UPDATE public.vendors
SET subscription_tier = 'gold'
WHERE subscription_tier = 'premium';

-- Normalize statuses: legacy 'trial' should behave like 'active' on starter
UPDATE public.vendors
SET subscription_status = 'active'
WHERE subscription_status = 'trial' AND subscription_tier = 'starter';

-- 2) Update subscription_plans catalog
-- Rename existing plans if present
UPDATE public.subscription_plans SET name = 'Starter' WHERE lower(name) = 'standard';
UPDATE public.subscription_plans SET name = 'Gold' WHERE lower(name) = 'premium';

-- Keep only one row per (name,billing_period) by deleting duplicates (if any)
WITH ranked AS (
  SELECT id, name, billing_period,
         row_number() OVER (PARTITION BY lower(name), billing_period ORDER BY created_at DESC) AS rn
  FROM public.subscription_plans
)
DELETE FROM public.subscription_plans sp
USING ranked r
WHERE sp.id = r.id AND r.rn > 1;

-- Ensure monthly rows exist + update prices/features (placeholders)
-- Starter (Free)
INSERT INTO public.subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level)
SELECT 'Starter', 0, 'monthly',
  '[
    "Basic product listings",
    "Search ranking weight 1.0x",
    "Default store template",
    "Basic sales stats",
    "1 promotion per month",
    "Email support (48-72 hrs)",
    "Local selling only",
    "7-day payout speed"
  ]'::jsonb,
  25, NULL, 'basic'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name)='starter' AND billing_period='monthly'
);

UPDATE public.subscription_plans
SET price = 0,
    features = '[
      "Basic product listings",
      "Search ranking weight 1.0x",
      "Default store template",
      "Basic sales stats",
      "1 promotion per month",
      "Email support (48-72 hrs)",
      "Local selling only",
      "7-day payout speed"
    ]'::jsonb,
    max_products = 25,
    support_level = 'basic'
WHERE lower(name)='starter' AND billing_period='monthly';

-- Bronze (placeholder)
INSERT INTO public.subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level)
SELECT 'Bronze', 99, 'monthly',
  '[
    "Up to 100 products",
    "Up to 5 promotions per month",
    "5-day payout speed",
    "Search ranking weight 1.1x",
    "Basic branding upgrades",
    "Email support (24-48 hrs)"
  ]'::jsonb,
  100, NULL, 'standard'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name)='bronze' AND billing_period='monthly'
);

-- Silver (placeholder)
INSERT INTO public.subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level)
SELECT 'Silver', 199, 'monthly',
  '[
    "Up to 300 products",
    "Up to 20 promotions per month",
    "3-day payout speed",
    "Search ranking weight 1.25x",
    "Banner & hero images",
    "Priority support (24 hrs)"
  ]'::jsonb,
  300, NULL, 'standard'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name)='silver' AND billing_period='monthly'
);

-- Gold (placeholder)
INSERT INTO public.subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level)
SELECT 'Gold', 299, 'monthly',
  '[
    "Unlimited products",
    "Unlimited promotions",
    "24-48 hr payouts",
    "Search ranking weight 1.5x",
    "Advanced analytics",
    "Priority chat support (<12 hrs)",
    "R500 monthly ad credits"
  ]'::jsonb,
  NULL, NULL, 'premium'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name)='gold' AND billing_period='monthly'
);

UPDATE public.subscription_plans
SET price = 299,
    features = '[
      "Unlimited products",
      "Unlimited promotions",
      "24-48 hr payouts",
      "Search ranking weight 1.5x",
      "Advanced analytics",
      "Priority chat support (<12 hrs)",
      "R500 monthly ad credits"
    ]'::jsonb,
    max_products = NULL,
    support_level = 'premium'
WHERE lower(name)='gold' AND billing_period='monthly';

-- Create yearly rows (placeholder pricing)
INSERT INTO public.subscription_plans (name, price, billing_period, features, max_products, max_orders, support_level)
SELECT p.name,
       CASE lower(p.name)
         WHEN 'starter' THEN 0
         WHEN 'bronze' THEN 999
         WHEN 'silver' THEN 1999
         WHEN 'gold' THEN 2999
         ELSE p.price
       END,
       'yearly',
       p.features,
       p.max_products,
       p.max_orders,
       p.support_level
FROM public.subscription_plans p
WHERE p.billing_period = 'monthly'
  AND lower(p.name) IN ('starter','bronze','silver','gold')
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_plans y
    WHERE lower(y.name) = lower(p.name)
      AND y.billing_period = 'yearly'
  );

-- 3) Update subscription helper functions to support new tiers

-- Features lookup by tier (use monthly plan as canonical for features)
CREATE OR REPLACE FUNCTION public.get_vendor_features(vendor_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(sp.features, '[]'::jsonb)
  FROM public.vendors v
  LEFT JOIN public.subscription_plans sp
    ON lower(sp.name) = lower(initcap(v.subscription_tier))
   AND sp.billing_period = 'monthly'
  WHERE v.id = vendor_id;
$$;

-- Tier config (server-side canonical)
CREATE OR REPLACE FUNCTION public.get_vendor_tier_config(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_config JSONB;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.vendors WHERE id = p_vendor_id;

  IF v_tier = 'gold' THEN
    v_config := jsonb_build_object(
      'max_products', NULL,
      'monthly_promotions', NULL,
      'commission_rate', 6,
      'payout_days', 2,
      'search_boost', 1.5,
      'ad_credits_monthly', 500
    );
  ELSIF v_tier = 'silver' THEN
    v_config := jsonb_build_object(
      'max_products', 300,
      'monthly_promotions', 20,
      'commission_rate', 8,
      'payout_days', 3,
      'search_boost', 1.25,
      'ad_credits_monthly', 250
    );
  ELSIF v_tier = 'bronze' THEN
    v_config := jsonb_build_object(
      'max_products', 100,
      'monthly_promotions', 5,
      'commission_rate', 9,
      'payout_days', 5,
      'search_boost', 1.1,
      'ad_credits_monthly', 100
    );
  ELSE
    -- Starter (Free)
    v_config := jsonb_build_object(
      'max_products', 25,
      'monthly_promotions', 1,
      'commission_rate', 10,
      'payout_days', 7,
      'search_boost', 1.0,
      'ad_credits_monthly', 0
    );
  END IF;

  RETURN v_config;
END;
$$;

-- Enforce product limits
CREATE OR REPLACE FUNCTION public.can_vendor_add_product(p_vendor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_product_count INTEGER;
  v_max_products INTEGER;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.vendors WHERE id = p_vendor_id;

  IF v_tier = 'gold' THEN
    RETURN true; -- unlimited
  END IF;

  v_max_products := CASE v_tier
    WHEN 'silver' THEN 300
    WHEN 'bronze' THEN 100
    ELSE 25
  END;

  SELECT COUNT(*) INTO v_product_count
  FROM public.products p
  JOIN public.stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id
    AND p.status != 'deleted';

  RETURN v_product_count < v_max_products;
END;
$$;

-- Enforce promotion limits
CREATE OR REPLACE FUNCTION public.can_vendor_create_promotion(p_vendor_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier TEXT;
  v_promo_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.vendors WHERE id = p_vendor_id;

  IF v_tier = 'gold' THEN
    RETURN true; -- unlimited
  END IF;

  v_limit := CASE v_tier
    WHEN 'silver' THEN 20
    WHEN 'bronze' THEN 5
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_promo_count
  FROM public.promotions p
  JOIN public.stores s ON p.store_id = s.id
  WHERE s.vendor_id = p_vendor_id
    AND p.created_at >= date_trunc('month', now());

  RETURN v_promo_count < v_limit;
END;
$$;

-- Apply tier benefits onto vendor columns (used by app)
CREATE OR REPLACE FUNCTION public.apply_subscription_tier_benefits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.subscription_tier = 'gold' THEN
    NEW.commission_rate := 6;
    NEW.payout_days := 2;
    NEW.search_boost := 1.5;
    NEW.monthly_promotions_limit := NULL;
    NEW.ad_credits := COALESCE(NEW.ad_credits, 0) + 500;
  ELSIF NEW.subscription_tier = 'silver' THEN
    NEW.commission_rate := 8;
    NEW.payout_days := 3;
    NEW.search_boost := 1.25;
    NEW.monthly_promotions_limit := 20;
    NEW.ad_credits := COALESCE(NEW.ad_credits, 0) + 250;
  ELSIF NEW.subscription_tier = 'bronze' THEN
    NEW.commission_rate := 9;
    NEW.payout_days := 5;
    NEW.search_boost := 1.1;
    NEW.monthly_promotions_limit := 5;
    NEW.ad_credits := COALESCE(NEW.ad_credits, 0) + 100;
  ELSE
    -- Starter
    NEW.commission_rate := 10;
    NEW.payout_days := 7;
    NEW.search_boost := 1.0;
    NEW.monthly_promotions_limit := 1;
  END IF;

  RETURN NEW;
END;
$$;