-- Brand Owner Retention & Growth System

-- 1. Brand Tiers (Program Tiers)
CREATE TABLE public.brand_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  level INTEGER NOT NULL UNIQUE,
  min_revenue NUMERIC NOT NULL DEFAULT 0,
  min_fulfillment_rate NUMERIC NOT NULL DEFAULT 0,
  min_rating NUMERIC NOT NULL DEFAULT 0,
  min_orders INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 10,
  payout_days INTEGER NOT NULL DEFAULT 14,
  visibility_boost NUMERIC NOT NULL DEFAULT 1,
  promo_credits_monthly INTEGER NOT NULL DEFAULT 0,
  badge_color TEXT NOT NULL DEFAULT '#6b7280',
  features JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Brand Performance Metrics
CREATE TABLE public.brand_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  completed_orders INTEGER NOT NULL DEFAULT 0,
  cancelled_orders INTEGER NOT NULL DEFAULT 0,
  returned_orders INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  positive_reviews INTEGER NOT NULL DEFAULT 0,
  negative_reviews INTEGER NOT NULL DEFAULT 0,
  fulfillment_rate NUMERIC,
  average_delivery_time NUMERIC,
  conversion_rate NUMERIC,
  repeat_customer_rate NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, period_start, period_end)
);

-- 3. Brand Tier History
CREATE TABLE public.brand_tier_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.brand_tiers(id),
  previous_tier_id UUID REFERENCES public.brand_tiers(id),
  reason TEXT,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Promo Credits
CREATE TABLE public.promo_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  lifetime_spent INTEGER NOT NULL DEFAULT 0,
  last_monthly_grant TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Sponsored Placements
CREATE TABLE public.sponsored_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  placement_type TEXT NOT NULL,
  credit_cost INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Auto Campaigns
CREATE TABLE public.auto_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL,
  action_config JSONB NOT NULL,
  credit_budget INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Brand Bundles
CREATE TABLE public.brand_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by_vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  bundle_discount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_bundle_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.brand_bundles(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  contribution_discount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bundle_id, product_id)
);

-- 8. Cross-Promotions
CREATE TABLE public.cross_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  initiator_vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  partner_vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  promo_type TEXT NOT NULL,
  terms JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  initiator_products UUID[] DEFAULT '{}',
  partner_products UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. AI Tips / Improvement Suggestions
CREATE TABLE public.brand_improvement_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  tip_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_url TEXT,
  data_context JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tier_id to vendors table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.brand_tiers(id);
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tier_updated_at TIMESTAMP WITH TIME ZONE;

-- Insert default tiers
INSERT INTO public.brand_tiers (name, display_name, level, min_revenue, min_fulfillment_rate, min_rating, min_orders, commission_rate, payout_days, visibility_boost, promo_credits_monthly, badge_color, features) VALUES
('starter', 'Starter', 1, 0, 0, 0, 0, 12, 14, 1.0, 50, '#6b7280', '["Basic analytics", "Standard support", "Product listings"]'),
('growth', 'Growth', 2, 10000, 85, 3.5, 50, 10, 10, 1.2, 150, '#3b82f6', '["Advanced analytics", "Priority support", "Flash deal access", "Basic promotions"]'),
('partner', 'Partner', 3, 50000, 90, 4.0, 200, 8, 7, 1.5, 300, '#8b5cf6', '["Full analytics suite", "Dedicated support", "Premium placements", "Cross-promotions", "Auto campaigns"]'),
('elite', 'Elite', 4, 150000, 95, 4.5, 500, 6, 3, 2.0, 500, '#f59e0b', '["VIP analytics", "Account manager", "Homepage features", "Co-branded campaigns", "Exclusive events", "API access"]');

-- Enable RLS
ALTER TABLE public.brand_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_bundle_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_improvement_tips ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view tiers" ON public.brand_tiers FOR SELECT USING (true);

CREATE POLICY "Vendors view own performance" ON public.brand_performance FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_performance.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view own tier history" ON public.brand_tier_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_tier_history.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view own credits" ON public.promo_credits FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = promo_credits.vendor_id AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors manage own credits" ON public.promo_credits FOR ALL USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = promo_credits.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view own transactions" ON public.promo_credit_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = promo_credit_transactions.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors manage own placements" ON public.sponsored_placements FOR ALL USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = sponsored_placements.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors manage own campaigns" ON public.auto_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = auto_campaigns.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view relevant bundles" ON public.brand_bundles FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_bundles.created_by_vendor_id AND v.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM brand_bundle_products bbp JOIN vendors v ON bbp.vendor_id = v.id WHERE bbp.bundle_id = brand_bundles.id AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors create bundles" ON public.brand_bundles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = created_by_vendor_id AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors update own bundles" ON public.brand_bundles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_bundles.created_by_vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view bundle products" ON public.brand_bundle_products FOR SELECT USING (true);
CREATE POLICY "Vendors manage own bundle products" ON public.brand_bundle_products FOR ALL USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_bundle_products.vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view own cross promos" ON public.cross_promotions FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE (v.id = cross_promotions.initiator_vendor_id OR v.id = cross_promotions.partner_vendor_id) AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors create cross promos" ON public.cross_promotions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = initiator_vendor_id AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors update relevant cross promos" ON public.cross_promotions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM vendors v WHERE (v.id = cross_promotions.initiator_vendor_id OR v.id = cross_promotions.partner_vendor_id) AND v.user_id = auth.uid())
);

CREATE POLICY "Vendors view own tips" ON public.brand_improvement_tips FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_improvement_tips.vendor_id AND v.user_id = auth.uid())
);
CREATE POLICY "Vendors update own tips" ON public.brand_improvement_tips FOR UPDATE USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = brand_improvement_tips.vendor_id AND v.user_id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_brand_performance_vendor ON public.brand_performance(vendor_id, period_start DESC);
CREATE INDEX idx_promo_credits_vendor ON public.promo_credits(vendor_id);
CREATE INDEX idx_sponsored_placements_active ON public.sponsored_placements(status, start_time, end_time) WHERE status = 'active';
CREATE INDEX idx_cross_promotions_vendors ON public.cross_promotions(initiator_vendor_id, partner_vendor_id);
CREATE INDEX idx_brand_tips_vendor ON public.brand_improvement_tips(vendor_id, is_dismissed, created_at DESC);