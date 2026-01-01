
-- BiGold wallet balances for all users
CREATE TABLE public.bigold_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC NOT NULL DEFAULT 0,
  lifetime_earned NUMERIC NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BiGold transactions history
CREATE TABLE public.bigold_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend')),
  category TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BiGold earning rules configuration
CREATE TABLE public.bigold_earning_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  amount NUMERIC NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  multiplier NUMERIC DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BiGold spending options configuration
CREATE TABLE public.bigold_spending_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  cost NUMERIC NOT NULL,
  value NUMERIC NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('percentage', 'fixed', 'boost')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_balance NUMERIC DEFAULT 0,
  user_types TEXT[] DEFAULT ARRAY['consumer', 'vendor', 'driver'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bigold_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bigold_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bigold_earning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bigold_spending_options ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view their own wallet" ON public.bigold_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage wallets" ON public.bigold_wallets
  FOR ALL USING (is_admin());

CREATE POLICY "Users can insert their own wallet" ON public.bigold_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet" ON public.bigold_wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Transaction policies
CREATE POLICY "Users can view their own transactions" ON public.bigold_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.bigold_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "Admins can manage all transactions" ON public.bigold_transactions
  FOR ALL USING (is_admin());

-- Earning rules policies (public read, admin write)
CREATE POLICY "Anyone can view active earning rules" ON public.bigold_earning_rules
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage earning rules" ON public.bigold_earning_rules
  FOR ALL USING (is_admin());

-- Spending options policies (public read, admin write)
CREATE POLICY "Anyone can view active spending options" ON public.bigold_spending_options
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage spending options" ON public.bigold_spending_options
  FOR ALL USING (is_admin());

-- Function to update wallet timestamps
CREATE TRIGGER update_bigold_wallets_updated_at
  BEFORE UPDATE ON public.bigold_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default earning rules
INSERT INTO public.bigold_earning_rules (category, amount, description) VALUES
  ('order_completed', 10, 'Complete an order'),
  ('delivery_completed', 15, 'Complete a delivery'),
  ('review_submitted', 5, 'Submit a product review'),
  ('referral_signup', 50, 'Refer a new user who signs up'),
  ('referral_purchase', 25, 'Referral makes their first purchase'),
  ('ontime_delivery', 10, 'On-time delivery bonus'),
  ('sales_milestone_100', 100, 'Reach 100 sales milestone'),
  ('sales_milestone_500', 300, 'Reach 500 sales milestone'),
  ('sales_milestone_1000', 500, 'Reach 1000 sales milestone'),
  ('daily_login', 2, 'Daily platform engagement'),
  ('profile_complete', 20, 'Complete your profile');

-- Insert default spending options
INSERT INTO public.bigold_spending_options (category, cost, value, value_type, description, user_types) VALUES
  ('discount_5_percent', 50, 5, 'percentage', '5% off your next order', ARRAY['consumer']),
  ('discount_10_percent', 90, 10, 'percentage', '10% off your next order', ARRAY['consumer']),
  ('free_delivery', 30, 100, 'percentage', 'Free delivery on your next order', ARRAY['consumer']),
  ('delivery_discount', 15, 50, 'percentage', '50% off delivery fee', ARRAY['consumer']),
  ('ad_boost_basic', 100, 24, 'boost', '24-hour product boost', ARRAY['vendor']),
  ('ad_boost_premium', 250, 72, 'boost', '72-hour premium product boost', ARRAY['vendor']),
  ('priority_listing', 200, 48, 'boost', '48-hour priority listing', ARRAY['vendor']),
  ('cashout_driver', 1000, 10, 'fixed', 'Cash out R10', ARRAY['driver']),
  ('cashout_vendor', 1000, 10, 'fixed', 'Cash out R10', ARRAY['vendor']);
