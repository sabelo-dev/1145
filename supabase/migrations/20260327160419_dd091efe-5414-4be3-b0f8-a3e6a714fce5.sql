
-- Credit scores table for behavioral scoring
CREATE TABLE IF NOT EXISTS public.lease_credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  max_lease_value NUMERIC DEFAULT 0,
  order_history_score INTEGER DEFAULT 0,
  wallet_activity_score INTEGER DEFAULT 0,
  delivery_reliability_score INTEGER DEFAULT 0,
  ride_performance_score INTEGER DEFAULT 0,
  payment_history_score INTEGER DEFAULT 0,
  platform_tenure_score INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  total_rides INTEGER DEFAULT 0,
  wallet_balance NUMERIC DEFAULT 0,
  on_time_rate NUMERIC DEFAULT 0,
  factors JSONB DEFAULT '{}',
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Asset categories for structured marketplace
CREATE TABLE IF NOT EXISTS public.lease_asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES public.lease_asset_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pricing tiers for flexible pricing
ALTER TABLE public.leaseable_assets 
  ADD COLUMN IF NOT EXISTS lease_price_daily NUMERIC,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS asset_year INTEGER,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS location_address TEXT,
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lease_category_id UUID REFERENCES public.lease_asset_categories(id);

-- Asset tracking/IoT data
CREATE TABLE IF NOT EXISTS public.asset_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.leaseable_assets(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.lease_contracts(id),
  latitude NUMERIC,
  longitude NUMERIC,
  usage_hours NUMERIC DEFAULT 0,
  mileage_km NUMERIC DEFAULT 0,
  battery_level NUMERIC,
  is_disabled BOOLEAN DEFAULT false,
  last_ping_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revenue splits for platform/owner/financier
CREATE TABLE IF NOT EXISTS public.lease_revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.lease_contracts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.lease_payments(id),
  owner_amount NUMERIC NOT NULL DEFAULT 0,
  platform_amount NUMERIC NOT NULL DEFAULT 0,
  insurance_amount NUMERIC DEFAULT 0,
  financier_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lease_credit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_revenue_splits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own credit scores" ON public.lease_credit_scores FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage credit scores" ON public.lease_credit_scores FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view active categories" ON public.lease_asset_categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage categories" ON public.lease_asset_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own asset tracking" ON public.asset_tracking FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM lease_contracts lc WHERE lc.id = contract_id AND lc.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM leaseable_assets la JOIN asset_providers ap ON la.provider_id = ap.id WHERE la.id = asset_id AND ap.user_id = auth.uid())
    OR public.is_admin(auth.uid()));

CREATE POLICY "Users can view own revenue splits" ON public.lease_revenue_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM lease_contracts lc WHERE lc.id = contract_id AND (lc.user_id = auth.uid() OR public.is_admin(auth.uid()))));

-- Credit scoring function
CREATE OR REPLACE FUNCTION public.calculate_lease_credit_score(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_count INTEGER;
  v_order_total NUMERIC;
  v_delivery_count INTEGER;
  v_ride_count INTEGER;
  v_wallet_bal NUMERIC;
  v_ontime_rate NUMERIC;
  v_tenure_days INTEGER;
  v_late_payments INTEGER;
  v_score INTEGER := 0;
  v_risk TEXT;
  v_max_value NUMERIC;
  v_factors JSONB := '{}';
  v_s_orders INTEGER;
  v_s_wallet INTEGER;
  v_s_delivery INTEGER;
  v_s_rides INTEGER;
  v_s_payments INTEGER;
  v_s_tenure INTEGER;
BEGIN
  -- Order history
  SELECT COUNT(*), COALESCE(SUM(total), 0) INTO v_order_count, v_order_total
  FROM orders WHERE user_id = p_user_id AND status IN ('delivered','completed');
  v_s_orders := LEAST(GREATEST(v_order_count * 2, 0), 200);

  -- Wallet activity
  SELECT COALESCE(balance_zar, 0) INTO v_wallet_bal FROM platform_wallets WHERE user_id = p_user_id;
  v_s_wallet := LEAST(GREATEST((COALESCE(v_wallet_bal, 0) / 100)::INTEGER, 0), 150);

  -- Delivery reliability (if driver)
  SELECT COALESCE(d.total_deliveries, 0), COALESCE(d.ontime_rate, 0) 
  INTO v_delivery_count, v_ontime_rate
  FROM drivers d WHERE d.user_id = p_user_id;
  v_s_delivery := LEAST(GREATEST(COALESCE(v_delivery_count, 0) + (COALESCE(v_ontime_rate, 0) / 2)::INTEGER, 0), 150);

  -- Ride performance
  SELECT COUNT(*) INTO v_ride_count FROM rides WHERE passenger_id = p_user_id AND status = 'completed';
  v_s_rides := LEAST(GREATEST(COALESCE(v_ride_count, 0) * 3, 0), 100);

  -- Payment history (lease)
  SELECT COUNT(*) INTO v_late_payments 
  FROM lease_payments lp JOIN lease_contracts lc ON lp.contract_id = lc.id
  WHERE lc.user_id = p_user_id AND lp.status = 'overdue';
  v_s_payments := GREATEST(100 - COALESCE(v_late_payments, 0) * 20, 0);

  -- Platform tenure
  SELECT EXTRACT(DAY FROM now() - created_at)::INTEGER INTO v_tenure_days FROM profiles WHERE id = p_user_id;
  v_s_tenure := LEAST(GREATEST(COALESCE(v_tenure_days, 0) / 3, 0), 100);

  -- Composite score (max 850)
  v_score := LEAST(v_s_orders + v_s_wallet + v_s_delivery + v_s_rides + v_s_payments + v_s_tenure + 150, 850);

  -- Risk level
  v_risk := CASE
    WHEN v_score >= 700 THEN 'low'
    WHEN v_score >= 500 THEN 'medium'
    WHEN v_score >= 300 THEN 'high'
    ELSE 'very_high'
  END;

  -- Max lease value
  v_max_value := CASE
    WHEN v_score >= 700 THEN 250000
    WHEN v_score >= 500 THEN 120000
    WHEN v_score >= 300 THEN 50000
    ELSE 15000
  END;

  v_factors := jsonb_build_object(
    'order_history', jsonb_build_object('count', v_order_count, 'total', v_order_total, 'score', v_s_orders),
    'wallet', jsonb_build_object('balance', v_wallet_bal, 'score', v_s_wallet),
    'delivery', jsonb_build_object('count', v_delivery_count, 'ontime_rate', v_ontime_rate, 'score', v_s_delivery),
    'rides', jsonb_build_object('count', v_ride_count, 'score', v_s_rides),
    'payments', jsonb_build_object('late_count', v_late_payments, 'score', v_s_payments),
    'tenure', jsonb_build_object('days', v_tenure_days, 'score', v_s_tenure)
  );

  -- Upsert score
  INSERT INTO lease_credit_scores (user_id, overall_score, risk_level, max_lease_value,
    order_history_score, wallet_activity_score, delivery_reliability_score, ride_performance_score,
    payment_history_score, platform_tenure_score, total_orders, total_deliveries, total_rides,
    wallet_balance, on_time_rate, factors, last_calculated_at)
  VALUES (p_user_id, v_score, v_risk, v_max_value,
    v_s_orders, v_s_wallet, v_s_delivery, v_s_rides, v_s_payments, v_s_tenure,
    v_order_count, COALESCE(v_delivery_count, 0), COALESCE(v_ride_count, 0),
    COALESCE(v_wallet_bal, 0), COALESCE(v_ontime_rate, 0), v_factors, now())
  ON CONFLICT (user_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score, risk_level = EXCLUDED.risk_level, max_lease_value = EXCLUDED.max_lease_value,
    order_history_score = EXCLUDED.order_history_score, wallet_activity_score = EXCLUDED.wallet_activity_score,
    delivery_reliability_score = EXCLUDED.delivery_reliability_score, ride_performance_score = EXCLUDED.ride_performance_score,
    payment_history_score = EXCLUDED.payment_history_score, platform_tenure_score = EXCLUDED.platform_tenure_score,
    total_orders = EXCLUDED.total_orders, total_deliveries = EXCLUDED.total_deliveries, total_rides = EXCLUDED.total_rides,
    wallet_balance = EXCLUDED.wallet_balance, on_time_rate = EXCLUDED.on_time_rate, factors = EXCLUDED.factors,
    last_calculated_at = EXCLUDED.last_calculated_at, updated_at = now();

  RETURN jsonb_build_object('score', v_score, 'risk_level', v_risk, 'max_lease_value', v_max_value, 'factors', v_factors);
END;
$$;

-- Seed default categories
INSERT INTO public.lease_asset_categories (name, slug, icon, sort_order) VALUES
  ('Vehicles', 'vehicles', 'Car', 1),
  ('POS Systems', 'pos-systems', 'CreditCard', 2),
  ('Kitchen Equipment', 'kitchen-equipment', 'ChefHat', 3),
  ('Electronics', 'electronics', 'Monitor', 4),
  ('Tools & Machinery', 'tools-machinery', 'Wrench', 5),
  ('Office Equipment', 'office-equipment', 'Printer', 6)
ON CONFLICT (slug) DO NOTHING;
