
-- Driver Tiers/Levels System
CREATE TABLE public.driver_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  level INTEGER NOT NULL UNIQUE,
  badge_color TEXT NOT NULL DEFAULT '#6B7280',
  min_deliveries INTEGER NOT NULL DEFAULT 0,
  min_ontime_rate NUMERIC NOT NULL DEFAULT 0,
  min_acceptance_rate NUMERIC NOT NULL DEFAULT 0,
  min_rating NUMERIC NOT NULL DEFAULT 0,
  base_pay_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  priority_job_access BOOLEAN NOT NULL DEFAULT false,
  cashout_fee_percent NUMERIC NOT NULL DEFAULT 5.0,
  insurance_coverage_percent NUMERIC NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default driver tiers
INSERT INTO public.driver_tiers (name, display_name, level, badge_color, min_deliveries, min_ontime_rate, min_acceptance_rate, min_rating, base_pay_multiplier, priority_job_access, cashout_fee_percent, insurance_coverage_percent, features) VALUES
('rookie', 'Rookie', 1, '#9CA3AF', 0, 0, 0, 0, 1.0, false, 5.0, 0, '["Basic delivery access", "Standard support"]'),
('pro', 'Pro', 2, '#3B82F6', 50, 85, 80, 4.0, 1.15, true, 3.0, 25, '["Priority job access", "Reduced cashout fees", "Basic insurance", "Pro badge"]'),
('elite', 'Elite', 3, '#F59E0B', 200, 92, 90, 4.5, 1.30, true, 1.5, 50, '["Top priority access", "Minimal cashout fees", "Premium insurance", "Elite badge", "Exclusive high-value deliveries"]'),
('champion', 'Champion', 4, '#8B5CF6', 500, 95, 95, 4.8, 1.50, true, 0, 100, '["Highest pay multiplier", "Zero cashout fees", "Full insurance coverage", "Champion badge", "VIP support", "Brand investment priority"]');

-- Driver Tier History
CREATE TABLE public.driver_tier_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.driver_tiers(id),
  previous_tier_id UUID REFERENCES public.driver_tiers(id),
  reason TEXT,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tier_id to drivers table
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES public.driver_tiers(id);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS acceptance_rate NUMERIC DEFAULT 100;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS ontime_rate NUMERIC DEFAULT 100;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS total_earnings NUMERIC DEFAULT 0;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS available_balance NUMERIC DEFAULT 0;

-- Set default tier for existing drivers
UPDATE public.drivers SET tier_id = (SELECT id FROM public.driver_tiers WHERE name = 'rookie') WHERE tier_id IS NULL;

-- Surge Zones (for surge pricing)
CREATE TABLE public.surge_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  polygon JSONB NOT NULL, -- GeoJSON polygon
  surge_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  days_active INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Delivery Earnings Breakdown (transparent earnings)
CREATE TABLE public.delivery_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_job_id UUID NOT NULL REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  base_pay NUMERIC NOT NULL DEFAULT 0,
  distance_pay NUMERIC NOT NULL DEFAULT 0,
  urgency_pay NUMERIC NOT NULL DEFAULT 0,
  surge_pay NUMERIC NOT NULL DEFAULT 0,
  tip_amount NUMERIC NOT NULL DEFAULT 0,
  tier_bonus NUMERIC NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  surge_multiplier NUMERIC DEFAULT 1.0,
  distance_km NUMERIC,
  is_priority BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tips (visible upfront)
CREATE TABLE public.delivery_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  delivery_job_id UUID REFERENCES public.delivery_jobs(id),
  driver_id UUID REFERENCES public.drivers(id),
  customer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  is_prepaid BOOLEAN NOT NULL DEFAULT true, -- Visible upfront
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Driver Cashouts
CREATE TABLE public.driver_cashouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_percent NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL, -- bank_transfer, mobile_money, etc
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Driver Investments (ownership loop)
CREATE TABLE public.driver_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL, -- brand_stake, vehicle_savings, storefront_fund
  target_vendor_id UUID REFERENCES public.vendors(id),
  amount NUMERIC NOT NULL,
  ucoin_spent INTEGER NOT NULL DEFAULT 0,
  returns_earned NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active, matured, withdrawn
  maturity_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Driver Vehicle Fund (reduce vehicle costs)
CREATE TABLE public.driver_vehicle_fund (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  total_saved NUMERIC NOT NULL DEFAULT 0,
  ucoin_contributed INTEGER NOT NULL DEFAULT 0,
  target_amount NUMERIC,
  purpose TEXT, -- maintenance, upgrade, new_vehicle
  status TEXT NOT NULL DEFAULT 'saving', -- saving, goal_reached, redeemed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Driver Performance Stats (for tier evaluation)
CREATE TABLE public.driver_performance_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  ontime_deliveries INTEGER NOT NULL DEFAULT 0,
  accepted_jobs INTEGER NOT NULL DEFAULT 0,
  offered_jobs INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC,
  total_tips NUMERIC NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(driver_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.driver_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_cashouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicle_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_performance_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Driver tiers are public read
CREATE POLICY "Driver tiers are viewable by everyone" ON public.driver_tiers FOR SELECT USING (true);

-- Drivers can view their own tier history
CREATE POLICY "Drivers can view own tier history" ON public.driver_tier_history FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Surge zones are public read
CREATE POLICY "Surge zones are viewable by everyone" ON public.surge_zones FOR SELECT USING (true);

-- Drivers can view their own earnings
CREATE POLICY "Drivers can view own earnings" ON public.delivery_earnings FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Tips policies
CREATE POLICY "Drivers can view tips for their deliveries" ON public.delivery_tips FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Customers can view their own tips" ON public.delivery_tips FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Customers can create tips" ON public.delivery_tips FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Cashout policies
CREATE POLICY "Drivers can view own cashouts" ON public.driver_cashouts FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Drivers can request cashouts" ON public.driver_cashouts FOR INSERT WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Investment policies
CREATE POLICY "Drivers can view own investments" ON public.driver_investments FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Drivers can create investments" ON public.driver_investments FOR INSERT WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Vehicle fund policies
CREATE POLICY "Drivers can view own vehicle fund" ON public.driver_vehicle_fund FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE POLICY "Drivers can manage own vehicle fund" ON public.driver_vehicle_fund FOR ALL USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Performance stats policies
CREATE POLICY "Drivers can view own performance stats" ON public.driver_performance_stats FOR SELECT USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Function to evaluate and update driver tier
CREATE OR REPLACE FUNCTION public.evaluate_driver_tier(p_driver_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_new_tier_id UUID;
  v_current_tier_id UUID;
BEGIN
  -- Get driver stats
  SELECT 
    d.id,
    d.tier_id,
    d.total_deliveries,
    d.ontime_rate,
    d.acceptance_rate,
    d.rating
  INTO v_driver
  FROM drivers d
  WHERE d.id = p_driver_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  v_current_tier_id := v_driver.tier_id;
  
  -- Find the highest tier the driver qualifies for
  SELECT id INTO v_new_tier_id
  FROM driver_tiers
  WHERE 
    COALESCE(v_driver.total_deliveries, 0) >= min_deliveries
    AND COALESCE(v_driver.ontime_rate, 100) >= min_ontime_rate
    AND COALESCE(v_driver.acceptance_rate, 100) >= min_acceptance_rate
    AND COALESCE(v_driver.rating, 5) >= min_rating
  ORDER BY level DESC
  LIMIT 1;
  
  -- Default to rookie if no tier found
  IF v_new_tier_id IS NULL THEN
    SELECT id INTO v_new_tier_id FROM driver_tiers WHERE name = 'rookie';
  END IF;
  
  -- Update tier if changed
  IF v_current_tier_id IS DISTINCT FROM v_new_tier_id THEN
    UPDATE drivers SET tier_id = v_new_tier_id WHERE id = p_driver_id;
    
    -- Record tier change
    INSERT INTO driver_tier_history (driver_id, tier_id, previous_tier_id, reason)
    VALUES (p_driver_id, v_new_tier_id, v_current_tier_id, 'Automatic tier evaluation');
  END IF;
  
  RETURN v_new_tier_id;
END;
$$;

-- Function to calculate delivery earnings
CREATE OR REPLACE FUNCTION public.calculate_delivery_earnings(
  p_delivery_job_id UUID,
  p_distance_km NUMERIC,
  p_is_urgent BOOLEAN DEFAULT false,
  p_surge_multiplier NUMERIC DEFAULT 1.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_tier RECORD;
  v_base_pay NUMERIC := 15.00; -- Base pay per delivery
  v_distance_rate NUMERIC := 5.00; -- Per km
  v_urgency_bonus NUMERIC := 0;
  v_distance_pay NUMERIC;
  v_surge_pay NUMERIC := 0;
  v_tier_bonus NUMERIC := 0;
  v_total NUMERIC;
  v_tip_amount NUMERIC := 0;
BEGIN
  -- Get driver from delivery job
  SELECT driver_id INTO v_driver_id FROM delivery_jobs WHERE id = p_delivery_job_id;
  
  IF v_driver_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get driver tier
  SELECT dt.* INTO v_tier
  FROM drivers d
  JOIN driver_tiers dt ON d.tier_id = dt.id
  WHERE d.id = v_driver_id;
  
  -- Calculate components
  v_distance_pay := COALESCE(p_distance_km, 0) * v_distance_rate;
  
  IF p_is_urgent THEN
    v_urgency_bonus := v_base_pay * 0.25; -- 25% urgency bonus
  END IF;
  
  IF p_surge_multiplier > 1.0 THEN
    v_surge_pay := v_base_pay * (p_surge_multiplier - 1.0);
  END IF;
  
  -- Tier bonus
  IF v_tier.base_pay_multiplier > 1.0 THEN
    v_tier_bonus := v_base_pay * (v_tier.base_pay_multiplier - 1.0);
  END IF;
  
  -- Get prepaid tip if any
  SELECT COALESCE(SUM(amount), 0) INTO v_tip_amount
  FROM delivery_tips
  WHERE delivery_job_id = p_delivery_job_id AND is_prepaid = true AND status = 'pending';
  
  v_total := v_base_pay + v_distance_pay + v_urgency_bonus + v_surge_pay + v_tier_bonus + v_tip_amount;
  
  -- Record earnings breakdown
  INSERT INTO delivery_earnings (
    delivery_job_id, driver_id, base_pay, distance_pay, urgency_pay, 
    surge_pay, tip_amount, tier_bonus, total_earnings, surge_multiplier,
    distance_km, is_priority
  ) VALUES (
    p_delivery_job_id, v_driver_id, v_base_pay, v_distance_pay, v_urgency_bonus,
    v_surge_pay, v_tip_amount, v_tier_bonus, v_total, p_surge_multiplier,
    p_distance_km, v_tier.priority_job_access
  );
  
  RETURN v_total;
END;
$$;
