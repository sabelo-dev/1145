-- Social Mining Affiliate Program Schema

-- Social connected accounts
CREATE TABLE public.social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'twitter', 'tiktok', 'youtube')),
  platform_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  follower_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Affiliate tiers for mining multipliers
CREATE TABLE public.affiliate_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  level INTEGER NOT NULL UNIQUE,
  min_conversions INTEGER NOT NULL DEFAULT 0,
  mining_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  daily_mining_cap INTEGER NOT NULL DEFAULT 20,
  badge_color TEXT DEFAULT '#6B7280',
  badge_icon TEXT DEFAULT 'Sprout',
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default affiliate tiers
INSERT INTO public.affiliate_tiers (name, display_name, level, min_conversions, mining_multiplier, daily_mining_cap, badge_color, badge_icon) VALUES
  ('seed', 'Seed', 1, 0, 1.0, 20, '#6B7280', 'Sprout'),
  ('growth', 'Growth', 2, 5, 1.2, 50, '#10B981', 'TrendingUp'),
  ('tribe', 'Tribe', 3, 25, 1.5, 120, '#8B5CF6', 'Users'),
  ('ubuntu', 'Ubuntu', 4, 100, 2.0, 300, '#F59E0B', 'Crown');

-- User affiliate status
CREATE TABLE public.user_affiliate_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier_id UUID REFERENCES public.affiliate_tiers(id),
  total_conversions INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  total_mined NUMERIC DEFAULT 0,
  today_mined NUMERIC DEFAULT 0,
  last_mining_date DATE,
  affiliate_code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mining task definitions
CREATE TABLE public.mining_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('affiliate', 'engagement', 'content')),
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'any')),
  base_reward INTEGER NOT NULL,
  reward_tier TEXT DEFAULT 'low' CHECK (reward_tier IN ('very_low', 'low', 'medium', 'high', 'very_high')),
  min_followers INTEGER DEFAULT 0,
  cooldown_hours INTEGER DEFAULT 24,
  requires_verification BOOLEAN DEFAULT false,
  verification_type TEXT DEFAULT 'auto' CHECK (verification_type IN ('auto', 'manual', 'ai')),
  is_active BOOLEAN DEFAULT true,
  max_daily_completions INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default mining tasks
INSERT INTO public.mining_tasks (category, task_type, title, description, platform, base_reward, reward_tier, cooldown_hours, max_daily_completions) VALUES
  -- Affiliate tasks
  ('affiliate', 'referral_link_share', 'Share Referral Link', 'Share your unique affiliate link on social media', 'any', 5, 'low', 24, 3),
  ('affiliate', 'conversion_referral', 'Successful Referral', 'Earn when someone signs up or purchases through your link', 'any', 50, 'high', 0, 999),
  ('affiliate', 'brand_mention', 'Brand Mention', 'Tag and mention a 1145 brand in your post', 'any', 15, 'medium', 24, 2),
  ('affiliate', 'promo_code_use', 'Promo Code Conversion', 'Earn when followers use your promo code', 'any', 40, 'high', 0, 999),
  -- Engagement tasks
  ('engagement', 'like_post', 'Like Campaign Post', 'Like an official campaign post', 'any', 2, 'very_low', 12, 5),
  ('engagement', 'comment_post', 'Comment on Post', 'Leave a meaningful comment on campaign content', 'any', 5, 'low', 12, 3),
  ('engagement', 'repost', 'Repost/Retweet', 'Share campaign content to your followers', 'any', 10, 'medium', 24, 2),
  ('engagement', 'story_share', 'Story Share', 'Share campaign content in your story', 'any', 10, 'medium', 24, 2),
  -- Content creation tasks
  ('content', 'short_video', 'Create Short Video', 'Create a TikTok, Reel, or YouTube Short featuring our products', 'any', 75, 'high', 72, 1),
  ('content', 'review_post', 'Product Review Post', 'Create a detailed product review post', 'any', 60, 'high', 168, 1),
  ('content', 'livestream_mention', 'Livestream Promotion', 'Mention and promote during a livestream', 'any', 100, 'very_high', 168, 1),
  ('content', 'ugc_upload', 'UGC Content Upload', 'Upload brand-approved user generated content', 'any', 80, 'high', 72, 1);

-- Mining campaigns (time-limited promotions)
CREATE TABLE public.mining_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  task_id UUID REFERENCES public.mining_tasks(id),
  bonus_multiplier NUMERIC(3,2) DEFAULT 1.0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task completions (mining history)
CREATE TABLE public.mining_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.mining_tasks(id),
  campaign_id UUID REFERENCES public.mining_campaigns(id),
  social_account_id UUID REFERENCES public.social_accounts(id),
  proof_url TEXT,
  proof_data JSONB,
  base_reward INTEGER NOT NULL,
  multiplier NUMERIC(4,2) DEFAULT 1.0,
  final_reward INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'paid')),
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Referral mining bonuses (tree structure)
CREATE TABLE public.referral_mining_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beneficiary_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  miner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_id UUID NOT NULL REFERENCES public.mining_completions(id) ON DELETE CASCADE,
  referral_level INTEGER NOT NULL CHECK (referral_level BETWEEN 1 AND 3),
  bonus_percent NUMERIC(4,2) NOT NULL,
  bonus_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily mining limits tracking
CREATE TABLE public.daily_mining_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_mined INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, mining_date)
);

-- Enable RLS
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_affiliate_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_mining_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_mining_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own social accounts" ON public.social_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own social accounts" ON public.social_accounts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view affiliate tiers" ON public.affiliate_tiers FOR SELECT USING (true);

CREATE POLICY "Users can view their own affiliate status" ON public.user_affiliate_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own affiliate status" ON public.user_affiliate_status FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active mining tasks" ON public.mining_tasks FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage mining tasks" ON public.mining_tasks FOR ALL USING (public.is_admin());

CREATE POLICY "Anyone can view active campaigns" ON public.mining_campaigns FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage campaigns" ON public.mining_campaigns FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view their own completions" ON public.mining_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create completions" ON public.mining_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bonuses" ON public.referral_mining_bonuses FOR SELECT USING (auth.uid() = beneficiary_id);

CREATE POLICY "Users can view their own daily limits" ON public.daily_mining_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own daily limits" ON public.daily_mining_limits FOR ALL USING (auth.uid() = user_id);

-- Function to get user's affiliate tier
CREATE OR REPLACE FUNCTION public.get_user_affiliate_tier(p_user_id UUID)
RETURNS TABLE (
  tier_id UUID,
  tier_name TEXT,
  display_name TEXT,
  level INTEGER,
  mining_multiplier NUMERIC,
  daily_cap INTEGER,
  badge_color TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT 
    at.id,
    at.name,
    at.display_name,
    at.level,
    at.mining_multiplier,
    at.daily_mining_cap,
    at.badge_color
  FROM user_affiliate_status uas
  JOIN affiliate_tiers at ON uas.tier_id = at.id
  WHERE uas.user_id = p_user_id;
END;
$$;

-- Function to complete a mining task
CREATE OR REPLACE FUNCTION public.complete_mining_task(
  p_user_id UUID,
  p_task_id UUID,
  p_social_account_id UUID DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL,
  p_proof_data JSONB DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_task RECORD;
  v_tier RECORD;
  v_daily_limit RECORD;
  v_base_reward INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_final_reward INTEGER;
  v_completion_id UUID;
  v_today DATE := CURRENT_DATE;
  v_task_completions_today INTEGER;
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM mining_tasks WHERE id = p_task_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found or inactive');
  END IF;

  -- Get user's affiliate tier
  SELECT at.* INTO v_tier
  FROM user_affiliate_status uas
  JOIN affiliate_tiers at ON uas.tier_id = at.id
  WHERE uas.user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Create default affiliate status
    INSERT INTO user_affiliate_status (user_id, tier_id)
    SELECT p_user_id, id FROM affiliate_tiers WHERE level = 1
    RETURNING tier_id INTO v_tier.id;
    
    SELECT * INTO v_tier FROM affiliate_tiers WHERE id = v_tier.id;
  END IF;

  -- Check daily limit
  SELECT * INTO v_daily_limit FROM daily_mining_limits 
  WHERE user_id = p_user_id AND mining_date = v_today;
  
  IF FOUND AND v_daily_limit.total_mined >= v_tier.daily_mining_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily mining limit reached');
  END IF;

  -- Check task cooldown and daily completions
  SELECT COUNT(*) INTO v_task_completions_today
  FROM mining_completions
  WHERE user_id = p_user_id 
    AND task_id = p_task_id 
    AND created_at::date = v_today
    AND status != 'rejected';
    
  IF v_task_completions_today >= v_task.max_daily_completions THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum daily completions for this task reached');
  END IF;

  -- Calculate reward with multiplier
  v_base_reward := v_task.base_reward;
  v_multiplier := v_tier.mining_multiplier;
  
  -- Check for campaign bonus
  IF p_campaign_id IS NOT NULL THEN
    SELECT bonus_multiplier INTO v_multiplier
    FROM mining_campaigns
    WHERE id = p_campaign_id AND is_active = true
      AND now() BETWEEN start_date AND end_date;
    IF FOUND THEN
      v_multiplier := v_multiplier * v_tier.mining_multiplier;
    END IF;
  END IF;
  
  v_final_reward := ROUND(v_base_reward * v_multiplier);

  -- Create completion record
  INSERT INTO mining_completions (
    user_id, task_id, campaign_id, social_account_id,
    proof_url, proof_data, base_reward, multiplier, final_reward,
    status
  ) VALUES (
    p_user_id, p_task_id, p_campaign_id, p_social_account_id,
    p_proof_url, p_proof_data, v_base_reward, v_multiplier, v_final_reward,
    CASE WHEN v_task.requires_verification THEN 'pending' ELSE 'verified' END
  ) RETURNING id INTO v_completion_id;

  -- Update daily limits
  INSERT INTO daily_mining_limits (user_id, mining_date, total_mined, tasks_completed)
  VALUES (p_user_id, v_today, v_final_reward, 1)
  ON CONFLICT (user_id, mining_date)
  DO UPDATE SET 
    total_mined = daily_mining_limits.total_mined + v_final_reward,
    tasks_completed = daily_mining_limits.tasks_completed + 1;

  -- If auto-verified, credit UCoin immediately
  IF NOT v_task.requires_verification THEN
    PERFORM award_ucoin(p_user_id, 'social_mining', v_completion_id, 'mining_completion');
    
    UPDATE mining_completions SET status = 'paid', verified_at = now() WHERE id = v_completion_id;
    
    -- Update affiliate status
    UPDATE user_affiliate_status 
    SET total_mined = total_mined + v_final_reward,
        today_mined = CASE WHEN last_mining_date = v_today THEN today_mined + v_final_reward ELSE v_final_reward END,
        last_mining_date = v_today,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Process referral bonuses
    PERFORM process_referral_mining_bonus(p_user_id, v_completion_id, v_final_reward);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'reward', v_final_reward,
    'status', CASE WHEN v_task.requires_verification THEN 'pending' ELSE 'paid' END
  );
END;
$$;

-- Function to process referral mining bonuses
CREATE OR REPLACE FUNCTION public.process_referral_mining_bonus(
  p_miner_id UUID,
  p_completion_id UUID,
  p_reward INTEGER
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_id UUID;
  v_level INTEGER := 1;
  v_bonus_percent NUMERIC;
  v_bonus_amount INTEGER;
  v_current_user_id UUID := p_miner_id;
BEGIN
  -- Walk up to 3 levels of referrers
  WHILE v_level <= 3 LOOP
    -- Find who referred the current user
    SELECT referrer_id INTO v_referrer_id
    FROM referrals
    WHERE referred_id = v_current_user_id AND status IN ('signup_completed', 'completed');
    
    EXIT WHEN v_referrer_id IS NULL;
    
    -- Calculate bonus based on level
    v_bonus_percent := CASE v_level
      WHEN 1 THEN 10.0
      WHEN 2 THEN 3.0
      WHEN 3 THEN 1.0
    END;
    
    v_bonus_amount := ROUND(p_reward * (v_bonus_percent / 100.0));
    
    IF v_bonus_amount > 0 THEN
      -- Record the bonus
      INSERT INTO referral_mining_bonuses (
        beneficiary_id, miner_id, completion_id, referral_level, bonus_percent, bonus_amount
      ) VALUES (
        v_referrer_id, p_miner_id, p_completion_id, v_level, v_bonus_percent, v_bonus_amount
      );
      
      -- Credit UCoin to referrer
      PERFORM award_ucoin(v_referrer_id, 'referral_mining_bonus', p_completion_id, 'referral_bonus');
    END IF;
    
    v_current_user_id := v_referrer_id;
    v_level := v_level + 1;
  END LOOP;
END;
$$;

-- Add social_mining to earning rules
INSERT INTO public.ucoin_earning_rules (category, amount, description, is_active, multiplier)
VALUES 
  ('social_mining', 1, 'UCoin earned from social mining tasks', true, 1),
  ('referral_mining_bonus', 1, 'Bonus UCoin from referral network mining', true, 1)
ON CONFLICT DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_affiliate_status_updated_at
  BEFORE UPDATE ON public.user_affiliate_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mining_tasks_updated_at
  BEFORE UPDATE ON public.mining_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();