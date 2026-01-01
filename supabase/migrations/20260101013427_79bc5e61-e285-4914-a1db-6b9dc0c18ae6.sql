-- Consumer Retention System Tables

-- 1. Consumer Preferences (for personalization)
CREATE TABLE public.consumer_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preferred_categories TEXT[] DEFAULT '{}',
  preferred_vendors UUID[] DEFAULT '{}',
  default_location JSONB,
  notification_preferences JSONB DEFAULT '{"flash_deals": true, "streak_reminders": true, "nearby_deals": true}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Consumer Streaks (for gamification)
CREATE TABLE public.consumer_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_order_week DATE,
  streak_start_date DATE,
  total_weeks_ordered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Consumer Badges
CREATE TABLE public.badge_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  category TEXT NOT NULL, -- 'loyalty', 'social', 'spending', 'special'
  requirement_type TEXT NOT NULL, -- 'orders', 'spending', 'streak', 'referrals', 'reviews', 'local_orders'
  requirement_value INTEGER NOT NULL,
  ucoin_reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.consumer_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_id UUID NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, badge_id)
);

-- 4. Flash Deals (limited-time promos)
CREATE TABLE public.flash_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed', 'flash_price'
  discount_value NUMERIC NOT NULL,
  original_price NUMERIC,
  flash_price NUMERIC,
  stock_limit INTEGER,
  claimed_count INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Order Insurance (points-based protection)
CREATE TABLE public.order_insurance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ucoin_cost INTEGER NOT NULL,
  coverage_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'partial', 'delay'
  coverage_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'claimed', 'expired', 'refunded'
  claim_reason TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Consumer Activity Log (for personalization engine)
CREATE TABLE public.consumer_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL, -- 'view', 'search', 'cart_add', 'purchase', 'wishlist'
  category TEXT,
  product_id UUID,
  store_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for activity queries
CREATE INDEX idx_consumer_activity_user_type ON public.consumer_activity_log(user_id, activity_type, created_at DESC);
CREATE INDEX idx_consumer_activity_recent ON public.consumer_activity_log(created_at DESC);
CREATE INDEX idx_flash_deals_active ON public.flash_deals(is_active, start_time, end_time);

-- Insert default badge definitions
INSERT INTO public.badge_definitions (name, display_name, description, icon, category, requirement_type, requirement_value, ucoin_reward) VALUES
-- Loyalty Badges
('first_order', 'First Timer', 'Complete your first order', 'ShoppingBag', 'loyalty', 'orders', 1, 10),
('power_buyer_10', 'Regular Shopper', 'Complete 10 orders', 'ShoppingCart', 'loyalty', 'orders', 10, 50),
('power_buyer_50', 'Power Buyer', 'Complete 50 orders', 'Zap', 'loyalty', 'orders', 50, 200),
('power_buyer_100', 'Elite Buyer', 'Complete 100 orders', 'Crown', 'loyalty', 'orders', 100, 500),
-- Streak Badges
('streak_3', 'Consistency Champion', 'Order 3 weeks in a row', 'Flame', 'loyalty', 'streak', 3, 30),
('streak_8', 'Streak Master', 'Order 8 weeks in a row', 'Trophy', 'loyalty', 'streak', 8, 100),
('streak_12', 'Unstoppable', 'Order 12 weeks in a row', 'Medal', 'loyalty', 'streak', 12, 250),
-- Social Badges
('first_referral', 'Connector', 'Refer your first friend', 'Users', 'social', 'referrals', 1, 25),
('referral_5', 'Community Builder', 'Refer 5 friends', 'Heart', 'social', 'referrals', 5, 100),
('referral_10', 'Ambassador', 'Refer 10 friends', 'Star', 'social', 'referrals', 10, 300),
-- Review Badges
('first_review', 'Voice Heard', 'Write your first review', 'MessageSquare', 'social', 'reviews', 1, 10),
('reviewer_10', 'Trusted Reviewer', 'Write 10 reviews', 'Award', 'social', 'reviews', 10, 75),
-- Local Support Badges
('local_supporter_5', 'Local Supporter', 'Order from 5 different local vendors', 'MapPin', 'special', 'local_orders', 5, 50),
('local_supporter_20', 'Community Champion', 'Order from 20 different local vendors', 'Home', 'special', 'local_orders', 20, 200),
-- Spending Badges
('big_spender_1000', 'Big Spender', 'Spend R1,000 total', 'Coins', 'spending', 'spending', 1000, 100),
('big_spender_5000', 'Premium Member', 'Spend R5,000 total', 'Gem', 'spending', 'spending', 5000, 300),
('big_spender_10000', 'VIP Shopper', 'Spend R10,000 total', 'Diamond', 'spending', 'spending', 10000, 750);

-- Enable RLS
ALTER TABLE public.consumer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flash_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Consumer Preferences
CREATE POLICY "Users can view own preferences" ON public.consumer_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.consumer_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.consumer_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Consumer Streaks
CREATE POLICY "Users can view own streaks" ON public.consumer_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage streaks" ON public.consumer_streaks FOR ALL USING (true);

-- Badge Definitions (public read)
CREATE POLICY "Anyone can view badges" ON public.badge_definitions FOR SELECT USING (true);

-- Consumer Badges
CREATE POLICY "Users can view own badges" ON public.consumer_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can award badges" ON public.consumer_badges FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own badges" ON public.consumer_badges FOR UPDATE USING (auth.uid() = user_id);

-- Flash Deals (public read for active deals)
CREATE POLICY "Anyone can view active flash deals" ON public.flash_deals FOR SELECT USING (is_active = true AND start_time <= now() AND end_time > now());
CREATE POLICY "Vendors can manage own flash deals" ON public.flash_deals FOR ALL USING (
  EXISTS (SELECT 1 FROM stores s JOIN vendors v ON s.vendor_id = v.id WHERE s.id = store_id AND v.user_id = auth.uid())
);

-- Order Insurance
CREATE POLICY "Users can view own insurance" ON public.order_insurance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can purchase insurance" ON public.order_insurance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can claim insurance" ON public.order_insurance FOR UPDATE USING (auth.uid() = user_id);

-- Activity Log
CREATE POLICY "Users can view own activity" ON public.consumer_activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can log own activity" ON public.consumer_activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update streak on order completion
CREATE OR REPLACE FUNCTION public.update_consumer_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_week DATE;
  last_week DATE;
  streak_record RECORD;
BEGIN
  -- Only process delivered/completed orders
  IF NEW.status NOT IN ('delivered', 'completed') THEN
    RETURN NEW;
  END IF;
  
  current_week := date_trunc('week', now())::DATE;
  
  -- Get or create streak record
  SELECT * INTO streak_record FROM consumer_streaks WHERE user_id = NEW.user_id;
  
  IF NOT FOUND THEN
    INSERT INTO consumer_streaks (user_id, current_streak, last_order_week, streak_start_date, total_weeks_ordered)
    VALUES (NEW.user_id, 1, current_week, current_week, 1);
  ELSE
    -- Check if already ordered this week
    IF streak_record.last_order_week = current_week THEN
      RETURN NEW;
    END IF;
    
    last_week := streak_record.last_order_week;
    
    -- Check if streak continues (ordered last week)
    IF last_week = current_week - INTERVAL '7 days' THEN
      UPDATE consumer_streaks 
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_order_week = current_week,
          total_weeks_ordered = total_weeks_ordered + 1,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      -- Streak broken, start new
      UPDATE consumer_streaks 
      SET current_streak = 1,
          streak_start_date = current_week,
          last_order_week = current_week,
          total_weeks_ordered = total_weeks_ordered + 1,
          updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for streak updates
CREATE TRIGGER update_streak_on_order
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.update_consumer_streak();

-- Function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  badge_record RECORD;
  user_stats RECORD;
  badges_awarded INTEGER := 0;
BEGIN
  -- Gather user statistics
  SELECT 
    COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = p_user_id AND status IN ('delivered', 'completed')), 0) as order_count,
    COALESCE((SELECT SUM(total) FROM orders WHERE user_id = p_user_id AND status IN ('delivered', 'completed')), 0) as total_spent,
    COALESCE((SELECT current_streak FROM consumer_streaks WHERE user_id = p_user_id), 0) as current_streak,
    COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND status = 'completed'), 0) as referral_count,
    COALESCE((SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id), 0) as review_count,
    COALESCE((SELECT COUNT(DISTINCT oi.store_id) FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = p_user_id AND o.status IN ('delivered', 'completed')), 0) as unique_vendors
  INTO user_stats;
  
  -- Check each badge
  FOR badge_record IN SELECT * FROM badge_definitions WHERE is_active = true LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM consumer_badges WHERE user_id = p_user_id AND badge_id = badge_record.id) THEN
      CONTINUE;
    END IF;
    
    -- Check requirements
    IF (badge_record.requirement_type = 'orders' AND user_stats.order_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'spending' AND user_stats.total_spent >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'streak' AND user_stats.current_streak >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'referrals' AND user_stats.referral_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'reviews' AND user_stats.review_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'local_orders' AND user_stats.unique_vendors >= badge_record.requirement_value) THEN
      
      -- Award badge
      INSERT INTO consumer_badges (user_id, badge_id) VALUES (p_user_id, badge_record.id);
      
      -- Award UCoin reward
      IF badge_record.ucoin_reward > 0 THEN
        PERFORM award_bigold(p_user_id, 'badge_earned', badge_record.ucoin_reward, badge_record.id::TEXT, 'badge');
      END IF;
      
      badges_awarded := badges_awarded + 1;
    END IF;
  END LOOP;
  
  RETURN badges_awarded;
END;
$$;

-- Update referrals table for 7-day bonus tracking
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS first_order_bonus_paid BOOLEAN DEFAULT false;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS signup_date TIMESTAMP WITH TIME ZONE DEFAULT now();