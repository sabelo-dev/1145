-- UC ecosystem: the 1145 reward rules (1 UC = R0.10).
--
--  * Catalogue of every rule in mining_activities (amount, range, audience,
--    conditions), readable by everyone for the rewards guide / admin UI.
--  * uc_award(): one idempotent, capped, server-only way to pay a reward.
--  * Triggers that pay automatically when the real event happens (orders,
--    reviews, rides, deliveries, stays, leases, KYC, referrals, influencers).
--  * Daily check-in with 7 / 30 day streaks.
--  * Admin-run rewards: tasks paid on approval, and admin grants within the
--    rule's range (surveys, targets, campaigns, sponsored tasks, ...).
--  * Birthday / anniversary rewards on a daily schedule.
--  * Tiers (Starter..Diamond): reached by qualified referrals or a paid
--    subscription; they set cashback %, base mining, and the daily / 30-day
--    caps on everyday earnings (one-off bonuses are not capped).
--
-- Safety rule used by every trigger: a reward is never paid for a change the
-- beneficiary made themselves from the app (e.g. a passenger marking their
-- own ride complete). Money fields such as orders.payment_status are already
-- server-controlled (20260924120000_security_hardening).

-- ---------------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------------
ALTER TABLE public.mining_activities
  ADD COLUMN IF NOT EXISTS reward_kind text NOT NULL DEFAULT 'fixed',   -- fixed | percent | range
  ADD COLUMN IF NOT EXISTS min_reward numeric,
  ADD COLUMN IF NOT EXISTS max_reward numeric,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS conditions text,
  ADD COLUMN IF NOT EXISTS admin_granted boolean NOT NULL DEFAULT false, -- paid by admins, not automatically
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 1000,
  -- Everyday earnings count towards the tier caps under this category;
  -- NULL = one-off bonus / milestone / sponsored reward, not capped.
  ADD COLUMN IF NOT EXISTS cap_category text;

ALTER TABLE public.affiliate_tiers
  ADD COLUMN IF NOT EXISTS cashback_percent numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS monthly_price numeric NOT NULL DEFAULT 0,       -- Rand; 0 = free
  ADD COLUMN IF NOT EXISTS monthly_mining_cap integer,                      -- max UC per 30 days
  ADD COLUMN IF NOT EXISTS base_mining integer NOT NULL DEFAULT 0;          -- UC paid with each check-in

-- Six tiers. daily_mining_cap = max UC/day, min_conversions = qualified
-- referrals needed. Diamond moves to level 6 to make room for Platinum.
UPDATE public.affiliate_tiers SET level = 6 WHERE name = 'diamond' AND level = 5;
INSERT INTO public.affiliate_tiers (name, display_name, level, min_conversions, mining_multiplier, daily_mining_cap, badge_color, badge_icon)
VALUES ('platinum', 'Platinum', 5, 60, 2.5, 750, '#8E9AAF', 'Crown')
ON CONFLICT (name) DO NOTHING;

UPDATE public.affiliate_tiers t SET
  min_conversions = v.refs, monthly_price = v.price, daily_mining_cap = v.day_cap,
  monthly_mining_cap = v.month_cap, base_mining = v.base, cashback_percent = v.cashback,
  mining_multiplier = v.multiplier
FROM (VALUES
  ('starter',  0,   0,    100,  3000,  20,  1.0,  1.0),
  ('bronze',   5,   199,  200,  6000,  40,  1.5,  1.25),
  ('silver',   15,  399,  350,  10500, 70,  2.0,  1.5),
  ('gold',     30,  699,  500,  15000, 100, 2.5,  2.0),
  ('platinum', 60,  1199, 750,  22500, 150, 2.75, 2.5),
  ('diamond',  100, 1799, 1000, 30000, 200, 3.0,  3.0)
) AS v(name, refs, price, day_cap, month_cap, base, cashback, multiplier)
WHERE t.name = v.name;

-- A referral counts towards tiers once it qualifies (verified email +
-- mobile, or a completed first purchase).
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

-- The old catalogue: replaced by the rules below. Rows stay (history / FKs).
UPDATE public.mining_activities SET is_active = false
WHERE code IN ('daily_login', 'purchase', 'referral', 'delivery', 'review', 'video_watch', 'kyc_complete', 'social_share');

INSERT INTO public.mining_activities
  (code, display_name, description, reward_mg, reward_kind, min_reward, max_reward, daily_cap, audience, conditions, admin_granted, sort_order, is_active)
VALUES
  -- Getting started
  ('signup_bonus',            'Create 1145 account',            'Welcome reward',                           100,  'fixed',   NULL, NULL, 1,    'Everyone', 'Once, when your email is confirmed', false, 10, true),
  ('profile_completed',       'Complete profile',               'Name, mobile number and profile photo',    50,   'fixed',   NULL, NULL, NULL, 'Everyone', 'Once', false, 20, true),
  ('email_mobile_verified',   'Verify email + mobile',          'Both verified',                            50,   'fixed',   NULL, NULL, NULL, 'Everyone', 'Once', false, 30, true),
  ('identity_verified',       'Complete identity verification', 'Identity verification approved',           200,  'fixed',   NULL, NULL, NULL, 'Everyone', 'Once, where required', false, 40, true),
  -- Shopping
  ('first_purchase',          'First purchase',                 'First completed order of R500 or more',    200,  'fixed',   NULL, NULL, NULL, 'Shoppers', 'Minimum spend R500', false, 50, true),
  ('purchase_cashback',       'Marketplace purchase',           'UC back on the amount you paid',           0,    'percent', 1,    3,    NULL, 'Shoppers', 'Completed order; 1-3% by tier', false, 60, true),
  ('product_review',          'Product review',                 'Review of a product you bought',           20,   'fixed',   NULL, NULL, 5,    'Shoppers', 'Verified purchase; once per product', false, 70, true),
  ('photo_review',            'Photo review',                   'Review with your own photos',              50,   'fixed',   NULL, NULL, NULL, 'Shoppers', 'Approved by 1145', true, 80, true),
  ('video_review',            'Video review',                   'Review with your own video',               100,  'fixed',   NULL, NULL, NULL, 'Shoppers', 'Approved by 1145', true, 90, true),
  -- Engagement
  ('daily_checkin',           'Daily check-in',                 'Check in once a day',                      5,    'fixed',   NULL, NULL, 1,    'Everyone', 'Daily', false, 100, true),
  ('base_mining',             'Base mining',                    'Paid with each check-in; set by your tier', 0,   'range',   20,   200,  1,    'Everyone', 'Daily, with check-in', false, 101, true),
  ('browse_activity',         'Browse/shop activity',           'Viewing products in the marketplace',      5,    'fixed',   NULL, NULL, 5,    'Everyone', '5 UC per product viewed, up to 25 UC a day', false, 102, true),
  ('streak_7',                '7-day streak',                   'Check in 7 days in a row',                 50,   'fixed',   NULL, NULL, 1,    'Everyone', 'Every 7 consecutive days', false, 110, true),
  ('streak_30',               '30-day streak',                  'Check in 30 days in a row',                300,  'fixed',   NULL, NULL, 1,    'Everyone', 'Every 30 consecutive days', false, 120, true),
  ('survey',                  'Complete survey',                'Surveys published by 1145',                0,    'range',   50,   300,  NULL, 'Everyone', 'Depends on length', true, 130, true),
  ('simple_task',             'Complete simple task',           'Tasks in the Rewards tab',                 0,    'range',   20,   100,  NULL, 'Everyone', 'Validated', true, 140, true),
  ('premium_task',            'Complete premium task',          'Sponsored or complex tasks',               0,    'range',   100,  1000, NULL, 'Everyone', 'Sponsored/complex', true, 150, true),
  -- Referrals
  ('referral_signup',         'Refer new user',                 'Your referral verifies email and mobile',  100,  'fixed',   NULL, NULL, NULL, 'Everyone', 'After qualification', false, 160, true),
  ('referral_first_purchase', 'Referral makes first purchase',  'Your referral completes their first order', 300, 'fixed',   NULL, NULL, NULL, 'Everyone', 'Completed purchase', false, 170, true),
  ('referral_first_ride',     'Referral completes first ride',  'Your referral completes their first ride', 200,  'fixed',   NULL, NULL, NULL, 'Everyone', 'Completed ride', false, 180, true),
  ('referral_driver',         'Refer active driver',            'Your referred driver completes 10 trips',  1000, 'fixed',   NULL, NULL, NULL, 'Everyone', 'Driver meets activation criteria', false, 190, true),
  ('referral_merchant',       'Refer active merchant',          'Your referred merchant makes a first sale', 1500, 'fixed',  NULL, NULL, NULL, 'Everyone', 'Merchant qualifies', false, 200, true),
  ('referral_mining_bonus',   'Referral activity',              'Share of the task rewards your referrals earn', 0, 'percent', 1, 10, NULL, 'Everyone', '10% / 3% / 1% over three levels', false, 205, true),
  -- Rides
  ('first_ride',              'First 1145 Ride',                'Your first completed trip',                100,  'fixed',   NULL, NULL, NULL, 'Riders', 'Completed trip', false, 210, true),
  ('ride_cashback',           'Every qualifying ride',          'UC back on the fare',                      0,    'percent', 1,    3,    NULL, 'Riders', 'Completed trip; 1-3% by tier', false, 220, true),
  ('rides_10',                'Complete 10 rides',              'Milestone',                                250,  'fixed',   NULL, NULL, NULL, 'Riders', 'Milestone', false, 230, true),
  ('rides_50',                'Complete 50 rides',              'Milestone',                                1000, 'fixed',   NULL, NULL, NULL, 'Riders', 'Milestone', false, 240, true),
  -- Stays & services
  ('first_stay',              'First Stay booking',             'Your first completed stay',                300,  'fixed',   NULL, NULL, NULL, 'Guests', 'Completed stay', false, 250, true),
  ('stay_cashback',           'Stay booking',                   'UC back on the booking',                   0,    'percent', 1,    3,    NULL, 'Guests', 'Completed stay; 1-3% by tier', false, 260, true),
  ('service_cashback',        'Service Hub booking',            'UC back on the booking',                   0,    'percent', 1,    3,    NULL, 'Everyone', 'Completed service', true, 270, true),
  -- Leasing
  ('lease_application',       'Lease application completed',    'Application approved as valid',            100,  'fixed',   NULL, NULL, NULL, 'Lessees', 'Valid application', false, 280, true),
  ('first_lease',             'First successful lease',         'Your first activated lease',               1000, 'fixed',   NULL, NULL, NULL, 'Lessees', 'Activated lease', false, 290, true),
  ('lease_payment_ontime',    'On-time lease payment',          'Paid on or before the due date',           100,  'fixed',   NULL, NULL, NULL, 'Lessees', 'Per qualifying payment', false, 300, true),
  -- Drivers
  ('driver_first_trip',       'Driver completes first trip',    'First completed ride or delivery',         500,  'fixed',   NULL, NULL, NULL, 'Drivers', 'Once', false, 310, true),
  ('driver_trips_10',         'Driver completes 10 trips',      'Milestone',                                500,  'fixed',   NULL, NULL, NULL, 'Drivers', 'Milestone', false, 320, true),
  ('driver_trips_50',         'Driver completes 50 trips',      'Milestone',                                2000, 'fixed',   NULL, NULL, NULL, 'Drivers', 'Milestone', false, 330, true),
  ('driver_trips_100',        'Driver completes 100 trips',     'Milestone',                                5000, 'fixed',   NULL, NULL, NULL, 'Drivers', 'Milestone', false, 340, true),
  ('driver_peak_hour',        'Driver peak-hour bonus',         'Peak-hour target met',                     0,    'range',   50,   200,  NULL, 'Drivers', 'Per qualifying target', true, 350, true),
  ('driver_weekly_target',    'Driver weekly target',           'Weekly target met',                        0,    'range',   500,  2000, NULL, 'Drivers', 'Target-based', true, 360, true),
  ('driver_referral',         'Driver referral',                'Referred driver completes 10 trips',       2000, 'fixed',   NULL, NULL, NULL, 'Everyone', 'Referred driver qualifies', false, 370, true),
  -- Merchants
  ('merchant_first_sale',     'Merchant first sale',            'First completed sale',                     500,  'fixed',   NULL, NULL, NULL, 'Merchants', 'Once', false, 380, true),
  ('merchant_sales_10',       'Merchant 10 sales',              'Milestone',                                500,  'fixed',   NULL, NULL, NULL, 'Merchants', 'Milestone', false, 390, true),
  ('merchant_sales_100',      'Merchant 100 sales',             'Milestone',                                3000, 'fixed',   NULL, NULL, NULL, 'Merchants', 'Milestone', false, 400, true),
  ('merchant_gmv_10k',        'Merchant R10k GMV',              'R10,000 in completed sales',               2000, 'fixed',   NULL, NULL, NULL, 'Merchants', 'Milestone', false, 410, true),
  ('merchant_referral',       'Merchant referral',              'Referred merchant makes a first sale',     2000, 'fixed',   NULL, NULL, NULL, 'Everyone', 'Merchant qualifies', false, 420, true),
  -- Influencers
  ('influencer_affiliate_sale','Influencer affiliate sale',     'Share of the sale value',                  0,    'percent', 1,    10,   NULL, 'Influencers', 'Campaign-defined', true, 430, true),
  ('influencer_first_sale',   'Influencer first sale',          'First sale through your content',          500,  'fixed',   NULL, NULL, NULL, 'Influencers', 'Once', false, 440, true),
  ('influencer_campaign',     'Influencer campaign',            'Sponsor-funded campaign',                  0,    'range',   500,  10000, NULL, 'Influencers', 'Sponsor-funded', true, 450, true),
  ('influencer_referral',     'Influencer referral',            'Your referral completes creator onboarding', 200, 'range',  200,  1000, NULL, 'Everyone', 'Qualification required', false, 460, true),
  ('social_content_task',     'Social/content task',            'Social and content tasks',                 0,    'range',   50,   500,  NULL, 'Everyone', 'Campaign-defined', true, 470, true),
  ('social_connect',          'Connect a social account',       'Verified social account connection',       50,   'fixed',   NULL, NULL, 5,    'Influencers', 'Once per social account', false, 480, true),
  ('post_published',          'Publish a post',                 'Post published to a connected account',    50,   'fixed',   NULL, NULL, 1,    'Influencers', 'Once per post', false, 490, true),
  -- Owners & hosts
  ('asset_owner_first_lease', 'Asset owner first lease',        'Your first leased asset',                  1000, 'fixed',   NULL, NULL, NULL, 'Asset owners', 'Completed lease', false, 500, true),
  ('host_first_booking',      'Property host first booking',    'First completed stay at your property',    1000, 'fixed',   NULL, NULL, NULL, 'Hosts', 'Completed stay', false, 510, true),
  -- Celebrations & campaigns
  ('birthday',                'Birthday reward',                'Happy birthday from 1145',                 1000, 'fixed',   NULL, NULL, NULL, 'Everyone', 'Annual; date of birth on your verified profile', false, 520, true),
  ('anniversary',             '1145 anniversary reward',        'Each year with 1145',                      200,  'fixed',   NULL, NULL, NULL, 'Everyone', 'Annual', false, 530, true),
  ('promo_challenge',         'Promotional challenge',          'Time-limited challenges',                  0,    'range',   100,  5000, NULL, 'Everyone', 'Campaign-defined', true, 540, true),
  ('sponsored_task',          'Sponsored partner task',         'Partner-funded tasks',                     0,    'range',   100,  10000, NULL, 'Everyone', 'Partner-funded', true, 550, true)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  reward_mg = EXCLUDED.reward_mg,
  reward_kind = EXCLUDED.reward_kind,
  min_reward = EXCLUDED.min_reward,
  max_reward = EXCLUDED.max_reward,
  daily_cap = EXCLUDED.daily_cap,
  audience = EXCLUDED.audience,
  conditions = EXCLUDED.conditions,
  admin_granted = EXCLUDED.admin_granted,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

UPDATE public.mining_activities SET cap_category = CASE
    WHEN code = 'base_mining' THEN 'base'
    WHEN code IN ('daily_checkin', 'streak_7', 'streak_30') THEN 'checkin'
    WHEN code = 'browse_activity' THEN 'browse'
    WHEN code IN ('purchase_cashback', 'stay_cashback', 'service_cashback', 'product_review', 'photo_review', 'video_review') THEN 'purchase'
    WHEN code = 'ride_cashback' THEN 'ride'
    WHEN code IN ('simple_task', 'social_content_task', 'survey', 'social_connect', 'post_published') THEN 'task'
    WHEN code = 'referral_mining_bonus' THEN 'referral'
    ELSE NULL END
WHERE code IN (SELECT code FROM public.mining_activities);

-- ---------------------------------------------------------------------------
-- 2. Engine
-- ---------------------------------------------------------------------------

-- Tier in effect: the higher of the referral tier and an active paid tier.
CREATE OR REPLACE FUNCTION public.uc_effective_tier(p_user_id uuid)
RETURNS public.affiliate_tiers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.* FROM public.affiliate_tiers t
  WHERE t.id = COALESCE(
    (SELECT tier_id FROM public.user_affiliate_status WHERE user_id = p_user_id),
    (SELECT id FROM public.affiliate_tiers ORDER BY level LIMIT 1));
$$;

-- UC earned from capped (everyday) rewards: today (SA day) and last 30 days.
CREATE OR REPLACE FUNCTION public.uc_capped_usage(p_user_id uuid, OUT today numeric, OUT last_30 numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(sum(r.reward_mg) FILTER (
      WHERE r.created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')), 0),
    COALESCE(sum(r.reward_mg) FILTER (WHERE r.created_at >= now() - interval '30 days'), 0)
  FROM public.mining_requests r
  JOIN public.mining_activities a ON a.code = r.activity_code
  WHERE r.user_id = p_user_id
    AND r.status IN ('approved', 'credited')
    AND a.cap_category IS NOT NULL
    AND r.created_at >= now() - interval '30 days';
$$;

CREATE OR REPLACE FUNCTION public.uc_remaining_capacity(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier public.affiliate_tiers := public.uc_effective_tier(p_user_id);
  v_usage record := public.uc_capped_usage(p_user_id);
BEGIN
  RETURN GREATEST(0, LEAST(
    COALESCE(v_tier.daily_mining_cap, 0) - v_usage.today,
    COALESCE(v_tier.monthly_mining_cap, v_tier.daily_mining_cap * 30, 0) - v_usage.last_30));
END;
$$;

-- Pay a reward once (per idempotency key), within the rule's daily cap.
-- p_amount overrides the rule amount (percent / range rules). Returns UC paid.
CREATE OR REPLACE FUNCTION public.uc_award(
  p_user_id uuid,
  p_code text,
  p_key text,
  p_amount numeric DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_title text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.mining_activities;
  v_amount numeric;
  v_today integer;
BEGIN
  IF p_user_id IS NULL OR p_key IS NULL THEN RETURN 0; END IF;

  SELECT * INTO v_rule FROM public.mining_activities WHERE code = p_code AND is_active = true;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_amount := ROUND(COALESCE(p_amount, v_rule.reward_mg));
  IF v_amount <= 0 THEN RETURN 0; END IF;

  IF EXISTS (SELECT 1 FROM public.mining_requests WHERE idempotency_key = p_key) THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('uc_award:' || p_user_id::text || ':' || p_code));

  IF v_rule.daily_cap IS NOT NULL THEN
    SELECT count(*) INTO v_today FROM public.mining_requests
    WHERE user_id = p_user_id AND activity_code = p_code
      AND status IN ('approved', 'credited')
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg');
    IF v_today >= v_rule.daily_cap THEN RETURN 0; END IF;
  END IF;

  -- Everyday earnings: pay up to what is left of the tier's daily and
  -- 30-day capacity.
  IF v_rule.cap_category IS NOT NULL THEN
    v_amount := LEAST(v_amount, public.uc_remaining_capacity(p_user_id));
    IF v_amount <= 0 THEN RETURN 0; END IF;
  END IF;

  PERFORM public.mining_direct_credit(
    p_user_id, p_code, v_amount, p_key, p_reference_type, p_reference_id,
    jsonb_build_object('task_title', COALESCE(p_title, v_rule.display_name))
  );
  RETURN v_amount;
END;
$$;

-- Kept for the edge functions (social-oauth-callback, social-publish).
CREATE OR REPLACE FUNCTION public.award_activity(
  p_user_id uuid,
  p_activity_code text,
  p_idempotency_key text,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_title text DEFAULT NULL
) RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.uc_award(p_user_id, p_activity_code, p_idempotency_key, NULL, p_reference_type, p_reference_id, p_title);
$$;

-- Take back rewards for something that was undone (e.g. a refunded order).
CREATE OR REPLACE FUNCTION public.uc_reverse(p_reference_type text, p_reference_id text, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_count integer := 0;
BEGIN
  FOR v_req IN
    SELECT r.id, r.user_id, r.reward_mg, a.display_name
    FROM public.mining_requests r
    JOIN public.mining_activities a ON a.code = r.activity_code
    WHERE r.reference_type = p_reference_type AND r.reference_id = p_reference_id AND r.status = 'credited'
  LOOP
    IF public.mining_reverse_request(v_req.id, p_reason) THEN
      INSERT INTO public.ucoin_transactions(user_id, amount, type, category, description, reference_id, reference_type)
      VALUES (v_req.user_id, v_req.reward_mg::integer, 'spend', 'reward_reversal',
        'Reward reversed: ' || v_req.display_name || ' (' || p_reason || ')', v_req.id, 'mining_request');
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- True when the signed-in app user making this change is p_user_id itself.
-- Reads the request's JWT role: inside SECURITY DEFINER triggers current_user
-- is the function owner, so it cannot tell app users from the server.
CREATE OR REPLACE FUNCTION public.uc_actor_is(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
           NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           NULLIF(current_setting('request.jwt.claim.role', true), '')
         ) IN ('authenticated', 'anon')
     AND auth.uid() IS NOT NULL
     AND auth.uid() = p_user_id
     AND NOT public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.uc_cashback_percent(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.uc_effective_tier(p_user_id)).cashback_percent, 1.0);
$$;

-- R x cashback% in UC (1 UC = R0.10).
CREATE OR REPLACE FUNCTION public.uc_cashback(p_user_id uuid, p_rand numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(GREATEST(COALESCE(p_rand, 0), 0) * public.uc_cashback_percent(p_user_id) / 100.0 * 10);
$$;

CREATE OR REPLACE FUNCTION public.uc_referrer_of(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT referrer_id FROM public.referrals
  WHERE referred_id = p_user_id AND referrer_id IS DISTINCT FROM p_user_id
  ORDER BY created_at LIMIT 1;
$$;

-- Recompute a user's tier: the higher of what their qualified referrals
-- reach and any paid tier they currently hold (uc_tier_subscriptions).
CREATE OR REPLACE FUNCTION public.uc_refresh_tier(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qualified integer;
  v_ref_level integer;
  v_paid_level integer := 0;
  v_tier_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_qualified FROM public.referrals
  WHERE referrer_id = p_user_id AND qualified_at IS NOT NULL;

  SELECT COALESCE(max(level), 1) INTO v_ref_level FROM public.affiliate_tiers
  WHERE min_conversions <= v_qualified;

  IF to_regclass('public.uc_tier_subscriptions') IS NOT NULL THEN
    EXECUTE 'SELECT COALESCE(max(t.level), 0) FROM public.uc_tier_subscriptions s
             JOIN public.affiliate_tiers t ON t.id = s.tier_id
             WHERE s.user_id = $1 AND s.status IN (''active'', ''cancelled'') AND s.current_period_end > now()'
      INTO v_paid_level USING p_user_id;
  END IF;

  SELECT id INTO v_tier_id FROM public.affiliate_tiers WHERE level = GREATEST(v_ref_level, v_paid_level);

  INSERT INTO public.user_affiliate_status (user_id, tier_id, total_conversions, total_referrals)
  VALUES (p_user_id, v_tier_id, v_qualified,
          (SELECT count(*) FROM public.referrals WHERE referrer_id = p_user_id))
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    total_conversions = EXCLUDED.total_conversions,
    total_referrals = EXCLUDED.total_referrals,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.uc_mark_referral_qualified(p_referred_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_referrer uuid;
BEGIN
  UPDATE public.referrals SET qualified_at = now(), updated_at = now()
  WHERE referred_id = p_referred_id AND qualified_at IS NULL
  RETURNING referrer_id INTO v_referrer;
  IF v_referrer IS NOT NULL THEN
    PERFORM public.uc_refresh_tier(v_referrer);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Milestone helpers
-- ---------------------------------------------------------------------------

-- Drivers: completed rides + delivered deliveries count as trips.
CREATE OR REPLACE FUNCTION public.uc_driver_milestones(p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_trips integer;
  v_referrer uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.drivers WHERE id = p_driver_id;
  IF v_user IS NULL THEN RETURN; END IF;

  SELECT (SELECT count(*) FROM public.rides WHERE driver_id = p_driver_id AND status = 'completed')
       + (SELECT count(*) FROM public.delivery_jobs WHERE driver_id = p_driver_id AND status = 'delivered')
    INTO v_trips;

  IF v_trips >= 1   THEN PERFORM public.uc_award(v_user, 'driver_first_trip', 'driver_first_trip:' || v_user, NULL, 'driver', p_driver_id::text); END IF;
  IF v_trips >= 10  THEN PERFORM public.uc_award(v_user, 'driver_trips_10',  'driver_trips_10:'  || v_user, NULL, 'driver', p_driver_id::text); END IF;
  IF v_trips >= 50  THEN PERFORM public.uc_award(v_user, 'driver_trips_50',  'driver_trips_50:'  || v_user, NULL, 'driver', p_driver_id::text); END IF;
  IF v_trips >= 100 THEN PERFORM public.uc_award(v_user, 'driver_trips_100', 'driver_trips_100:' || v_user, NULL, 'driver', p_driver_id::text); END IF;

  -- Referred driver is active at 10 trips: both referral rewards (they stack).
  IF v_trips >= 10 THEN
    v_referrer := public.uc_referrer_of(v_user);
    IF v_referrer IS NOT NULL THEN
      PERFORM public.uc_award(v_referrer, 'referral_driver', 'referral_driver:' || v_user, NULL, 'referral', v_user::text);
      PERFORM public.uc_award(v_referrer, 'driver_referral', 'driver_referral:' || v_user, NULL, 'referral', v_user::text);
    END IF;
  END IF;
END;
$$;

-- Merchants: completed, paid orders that contain the vendor's items.
CREATE OR REPLACE FUNCTION public.uc_merchant_milestones(p_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_sales integer;
  v_gmv numeric;
  v_referrer uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.vendors WHERE id = p_vendor_id;
  IF v_user IS NULL THEN RETURN; END IF;

  SELECT count(DISTINCT o.id), COALESCE(sum(oi.price * oi.quantity), 0)
    INTO v_sales, v_gmv
  FROM public.order_items oi
  JOIN public.stores s ON s.id = oi.store_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE s.vendor_id = p_vendor_id
    AND o.payment_status = 'paid'
    AND o.status IN ('delivered', 'completed');

  IF v_sales >= 1   THEN PERFORM public.uc_award(v_user, 'merchant_first_sale', 'merchant_first_sale:' || v_user, NULL, 'vendor', p_vendor_id::text); END IF;
  IF v_sales >= 10  THEN PERFORM public.uc_award(v_user, 'merchant_sales_10',   'merchant_sales_10:'   || v_user, NULL, 'vendor', p_vendor_id::text); END IF;
  IF v_sales >= 100 THEN PERFORM public.uc_award(v_user, 'merchant_sales_100',  'merchant_sales_100:'  || v_user, NULL, 'vendor', p_vendor_id::text); END IF;
  IF v_gmv >= 10000 THEN PERFORM public.uc_award(v_user, 'merchant_gmv_10k',    'merchant_gmv_10k:'    || v_user, NULL, 'vendor', p_vendor_id::text); END IF;

  -- Referred merchant qualifies at the first sale: both referral rewards stack.
  IF v_sales >= 1 THEN
    v_referrer := public.uc_referrer_of(v_user);
    IF v_referrer IS NOT NULL THEN
      PERFORM public.uc_award(v_referrer, 'referral_merchant', 'referral_merchant:' || v_user, NULL, 'referral', v_user::text);
      PERFORM public.uc_award(v_referrer, 'merchant_referral', 'merchant_referral:' || v_user, NULL, 'referral', v_user::text);
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Event triggers (each one never blocks the original write)
-- ---------------------------------------------------------------------------

-- Profile complete: name, mobile number and photo.
CREATE OR REPLACE FUNCTION public.uc_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF COALESCE(btrim(NEW.name), '') <> '' AND COALESCE(btrim(NEW.phone), '') <> ''
       AND COALESCE(btrim(NEW.avatar_url), '') <> '' THEN
      PERFORM public.uc_award(NEW.id, 'profile_completed', 'profile_completed:' || NEW.id, NULL, 'user', NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_profile: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_profile_rewards ON public.profiles;
CREATE TRIGGER uc_profile_rewards AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_profile();

-- KYC: verified email + mobile, identity approved; referral qualification.
-- The verification flags are server-controlled (guard_kyc_client_writes).
CREATE OR REPLACE FUNCTION public.uc_on_kyc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid;
BEGIN
  BEGIN
    IF NEW.email_verified AND NEW.mobile_verified THEN
      PERFORM public.uc_award(NEW.user_id, 'email_mobile_verified', 'email_mobile_verified:' || NEW.user_id, NULL, 'user', NEW.user_id::text);
      v_referrer := public.uc_referrer_of(NEW.user_id);
      IF v_referrer IS NOT NULL THEN
        PERFORM public.uc_award(v_referrer, 'referral_signup', 'referral_signup:' || NEW.user_id, NULL, 'referral', NEW.user_id::text);
        PERFORM public.uc_mark_referral_qualified(NEW.user_id);
      END IF;
    END IF;
    IF NEW.status = 'approved' THEN
      PERFORM public.uc_award(NEW.user_id, 'identity_verified', 'identity_verified:' || NEW.user_id, NULL, 'user', NEW.user_id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_kyc: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_kyc_rewards ON public.kyc_profiles;
CREATE TRIGGER uc_kyc_rewards AFTER INSERT OR UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_kyc();

-- Orders: paid + delivered/completed pays cashback, first purchase (R500+),
-- the referrer's first-purchase reward and merchant milestones.
-- A refund takes the order's rewards back.
CREATE OR REPLACE FUNCTION public.uc_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paid numeric;
  v_referrer uuid;
  v_vendor uuid;
  v_done boolean;
  v_was_done boolean;
BEGIN
  BEGIN
    v_done := NEW.payment_status = 'paid' AND NEW.status IN ('delivered', 'completed');
    v_was_done := TG_OP = 'UPDATE' AND OLD.payment_status = 'paid' AND OLD.status IN ('delivered', 'completed');

    IF v_done AND NOT v_was_done AND NOT public.uc_actor_is(NEW.user_id) THEN
      v_paid := GREATEST(COALESCE(NEW.total, 0) - COALESCE(NEW.ucoin_value_zar, 0), 0);

      PERFORM public.uc_award(NEW.user_id, 'purchase_cashback', 'purchase_cashback:' || NEW.id,
        public.uc_cashback(NEW.user_id, v_paid), 'order', NEW.id::text,
        'Cashback on order ' || left(NEW.id::text, 8));

      IF v_paid >= 500 THEN
        PERFORM public.uc_award(NEW.user_id, 'first_purchase', 'first_purchase:' || NEW.user_id, NULL, 'order', NEW.id::text);
      END IF;

      v_referrer := public.uc_referrer_of(NEW.user_id);
      IF v_referrer IS NOT NULL THEN
        PERFORM public.uc_award(v_referrer, 'referral_first_purchase', 'referral_first_purchase:' || NEW.user_id, NULL, 'referral', NEW.user_id::text);
        UPDATE public.referrals
          SET status = 'completed',
              first_purchase_date = COALESCE(first_purchase_date, now()),
              first_purchase_amount = COALESCE(first_purchase_amount, v_paid),
              updated_at = now()
        WHERE referred_id = NEW.user_id AND status IS DISTINCT FROM 'completed';
        PERFORM public.uc_mark_referral_qualified(NEW.user_id);
      END IF;

      FOR v_vendor IN
        SELECT DISTINCT s.vendor_id FROM public.order_items oi JOIN public.stores s ON s.id = oi.store_id
        WHERE oi.order_id = NEW.id
      LOOP
        PERFORM public.uc_merchant_milestones(v_vendor);
      END LOOP;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (COALESCE(NEW.refund_status, '') IN ('refunded', 'completed', 'processed') OR NEW.status IN ('refunded', 'returned'))
       AND NOT (COALESCE(OLD.refund_status, '') IN ('refunded', 'completed', 'processed') OR OLD.status IN ('refunded', 'returned')) THEN
      PERFORM public.uc_reverse('order', NEW.id::text, 'order refunded');
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_order: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_order_rewards ON public.orders;
CREATE TRIGGER uc_order_rewards AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_order();

-- Product review: verified purchase (paid, delivered order that contains it).
CREATE OR REPLACE FUNCTION public.uc_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.user_id IS NOT NULL AND NEW.product_id IS NOT NULL AND NOT COALESCE(NEW.flagged, false)
       AND EXISTS (
         SELECT 1 FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
         WHERE o.user_id = NEW.user_id AND oi.product_id = NEW.product_id
           AND o.payment_status = 'paid' AND o.status IN ('delivered', 'completed')
       ) THEN
      PERFORM public.uc_award(NEW.user_id, 'product_review', 'product_review:' || NEW.user_id || ':' || NEW.product_id,
        NULL, 'review', NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_review: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_review_rewards ON public.reviews;
CREATE TRIGGER uc_review_rewards AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_review();

-- Rides: passenger cashback / first ride / milestones, referral first ride,
-- and driver trip milestones.
CREATE OR REPLACE FUNCTION public.uc_on_ride()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rides integer;
  v_referrer uuid;
BEGIN
  BEGIN
    IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
      IF NEW.passenger_id IS NOT NULL AND NOT public.uc_actor_is(NEW.passenger_id) THEN
        PERFORM public.uc_award(NEW.passenger_id, 'ride_cashback', 'ride_cashback:' || NEW.id,
          public.uc_cashback(NEW.passenger_id, COALESCE(NEW.actual_fare, NEW.estimated_fare)), 'ride', NEW.id::text,
          'Cashback on ride ' || left(NEW.id::text, 8));
        PERFORM public.uc_award(NEW.passenger_id, 'first_ride', 'first_ride:' || NEW.passenger_id, NULL, 'ride', NEW.id::text);

        SELECT count(*) INTO v_rides FROM public.rides WHERE passenger_id = NEW.passenger_id AND status = 'completed';
        IF v_rides >= 10 THEN PERFORM public.uc_award(NEW.passenger_id, 'rides_10', 'rides_10:' || NEW.passenger_id, NULL, 'ride', NEW.id::text); END IF;
        IF v_rides >= 50 THEN PERFORM public.uc_award(NEW.passenger_id, 'rides_50', 'rides_50:' || NEW.passenger_id, NULL, 'ride', NEW.id::text); END IF;

        v_referrer := public.uc_referrer_of(NEW.passenger_id);
        IF v_referrer IS NOT NULL THEN
          PERFORM public.uc_award(v_referrer, 'referral_first_ride', 'referral_first_ride:' || NEW.passenger_id, NULL, 'referral', NEW.passenger_id::text);
        END IF;
      END IF;

      IF NEW.driver_id IS NOT NULL THEN
        PERFORM public.uc_driver_milestones(NEW.driver_id);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_ride: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_ride_rewards ON public.rides;
CREATE TRIGGER uc_ride_rewards AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_ride();

CREATE OR REPLACE FUNCTION public.uc_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'delivered' AND NEW.driver_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered') THEN
      PERFORM public.uc_driver_milestones(NEW.driver_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_delivery: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_delivery_rewards ON public.delivery_jobs;
CREATE TRIGGER uc_delivery_rewards AFTER INSERT OR UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_delivery();

-- Stays: guest cashback + first stay, host's first booking.
CREATE OR REPLACE FUNCTION public.uc_on_stay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host uuid;
BEGIN
  BEGIN
    IF NEW.status IN ('checked_out', 'completed')
       AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('checked_out', 'completed'))
       AND NOT public.uc_actor_is(NEW.user_id) THEN
      PERFORM public.uc_award(NEW.user_id, 'stay_cashback', 'stay_cashback:' || NEW.id,
        public.uc_cashback(NEW.user_id, NEW.total_price), 'stay', NEW.id::text,
        'Cashback on stay ' || left(NEW.id::text, 8));
      PERFORM public.uc_award(NEW.user_id, 'first_stay', 'first_stay:' || NEW.user_id, NULL, 'stay', NEW.id::text);

      SELECT owner_id INTO v_host FROM public.lodging_properties WHERE id = NEW.property_id;
      IF v_host IS NOT NULL AND v_host IS DISTINCT FROM NEW.user_id THEN
        PERFORM public.uc_award(v_host, 'host_first_booking', 'host_first_booking:' || v_host, NULL, 'stay', NEW.id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_stay: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_stay_rewards ON public.lodging_bookings;
CREATE TRIGGER uc_stay_rewards AFTER INSERT OR UPDATE OF status ON public.lodging_bookings
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_stay();

-- Leasing
CREATE OR REPLACE FUNCTION public.uc_on_lease_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
       AND NOT public.uc_actor_is(NEW.user_id) THEN
      PERFORM public.uc_award(NEW.user_id, 'lease_application', 'lease_application:' || NEW.id, NULL, 'lease_application', NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_lease_application: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_lease_application_rewards ON public.lease_applications;
CREATE TRIGGER uc_lease_application_rewards AFTER INSERT OR UPDATE OF status ON public.lease_applications
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_lease_application();

CREATE OR REPLACE FUNCTION public.uc_on_lease_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  BEGIN
    IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active')
       AND NOT public.uc_actor_is(NEW.user_id) THEN
      PERFORM public.uc_award(NEW.user_id, 'first_lease', 'first_lease:' || NEW.user_id, NULL, 'lease_contract', NEW.id::text);

      SELECT p.user_id INTO v_owner
      FROM public.leaseable_assets a JOIN public.asset_providers p ON p.id = a.provider_id
      WHERE a.id = NEW.asset_id;
      IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM NEW.user_id THEN
        PERFORM public.uc_award(v_owner, 'asset_owner_first_lease', 'asset_owner_first_lease:' || v_owner, NULL, 'lease_contract', NEW.id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_lease_contract: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_lease_contract_rewards ON public.lease_contracts;
CREATE TRIGGER uc_lease_contract_rewards AFTER INSERT OR UPDATE OF status ON public.lease_contracts
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_lease_contract();

CREATE OR REPLACE FUNCTION public.uc_on_lease_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF NEW.status = 'paid' AND NEW.paid_at IS NOT NULL AND NEW.due_date IS NOT NULL
       AND NEW.paid_at::date <= NEW.due_date
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid')
       AND NOT public.uc_actor_is(NEW.user_id) THEN
      PERFORM public.uc_award(NEW.user_id, 'lease_payment_ontime', 'lease_payment_ontime:' || NEW.id, NULL, 'lease_payment', NEW.id::text);
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_lease_payment: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_lease_payment_rewards ON public.lease_payments;
CREATE TRIGGER uc_lease_payment_rewards AFTER INSERT OR UPDATE OF status ON public.lease_payments
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_lease_payment();

-- Influencers: first sale; referral qualifies at creator onboarding.
CREATE OR REPLACE FUNCTION public.uc_on_influencer_conversion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  BEGIN
    IF NEW.event_type = 'purchase' THEN
      SELECT user_id INTO v_user FROM public.influencer_profiles WHERE id = NEW.influencer_id;
      IF v_user IS NOT NULL THEN
        PERFORM public.uc_award(v_user, 'influencer_first_sale', 'influencer_first_sale:' || v_user, NULL, 'influencer_conversion', NEW.id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_influencer_conversion: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_influencer_conversion_rewards ON public.influencer_conversions;
CREATE TRIGGER uc_influencer_conversion_rewards AFTER INSERT ON public.influencer_conversions
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_influencer_conversion();

CREATE OR REPLACE FUNCTION public.uc_on_influencer_onboarded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_referrer uuid;
BEGIN
  BEGIN
    IF NEW.onboarding_completed_at IS NOT NULL
       AND (TG_OP = 'INSERT' OR OLD.onboarding_completed_at IS NULL) THEN
      v_referrer := public.uc_referrer_of(NEW.user_id);
      IF v_referrer IS NOT NULL THEN
        PERFORM public.uc_award(v_referrer, 'influencer_referral', 'influencer_referral:' || NEW.user_id, NULL, 'referral', NEW.user_id::text);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_influencer_onboarded: %', SQLERRM;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_influencer_onboarded_rewards ON public.influencer_profiles;
CREATE TRIGGER uc_influencer_onboarded_rewards AFTER INSERT OR UPDATE OF onboarding_completed_at ON public.influencer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.uc_on_influencer_onboarded();

-- ---------------------------------------------------------------------------
-- 5. Referral capture. The signed-in new user applies a code; nothing is paid
--    here any more: the referrer earns when the referral qualifies (above).
--    (The old version paid instantly and was blocked for clients in July.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_signup(
  p_referred_id uuid,
  p_referral_code text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code record;
  v_created timestamptz;
BEGIN
  IF auth.uid() IS NOT NULL AND p_referred_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT id, user_id, code INTO v_code FROM public.user_referral_codes
  WHERE code = upper(btrim(p_referral_code)) AND is_active = true;
  IF v_code.user_id IS NULL OR v_code.user_id = p_referred_id THEN
    RETURN false;
  END IF;

  -- One referrer per account, applied within 30 days of joining.
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
    RETURN false;
  END IF;
  SELECT created_at INTO v_created FROM auth.users WHERE id = p_referred_id;
  IF v_created IS NULL OR v_created < now() - interval '30 days' THEN
    RETURN false;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status, signup_date)
  VALUES (v_code.user_id, p_referred_id, v_code.code, 'signup_completed', now());

  UPDATE public.user_referral_codes SET uses_count = COALESCE(uses_count, 0) + 1, updated_at = now()
  WHERE id = v_code.id;

  -- The referral may already qualify (verified before applying the code).
  IF EXISTS (SELECT 1 FROM public.kyc_profiles
             WHERE user_id = p_referred_id AND email_verified AND mobile_verified) THEN
    PERFORM public.uc_award(v_code.user_id, 'referral_signup', 'referral_signup:' || p_referred_id,
      NULL, 'referral', p_referred_id::text);
  END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_referral_signup(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral_signup(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Daily check-in and streaks (South African calendar day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uc_checkins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  streak integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, checkin_date)
);
ALTER TABLE public.uc_checkins ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.uc_checkins TO authenticated;
GRANT ALL ON public.uc_checkins TO service_role;
DROP POLICY IF EXISTS "Users read own check-ins" ON public.uc_checkins;
CREATE POLICY "Users read own check-ins" ON public.uc_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.uc_daily_check_in()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_prev integer;
  v_streak integer;
  v_earned numeric := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please sign in to check in.');
  END IF;

  SELECT streak INTO v_streak FROM public.uc_checkins WHERE user_id = v_user AND checkin_date = v_today;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'streak', v_streak, 'earned', 0);
  END IF;

  SELECT streak INTO v_prev FROM public.uc_checkins WHERE user_id = v_user AND checkin_date = v_today - 1;
  v_streak := COALESCE(v_prev, 0) + 1;

  INSERT INTO public.uc_checkins (user_id, checkin_date, streak) VALUES (v_user, v_today, v_streak)
  ON CONFLICT DO NOTHING;

  v_earned := v_earned + public.uc_award(v_user, 'daily_checkin', 'daily_checkin:' || v_user || ':' || v_today, NULL, 'checkin', v_today::text);
  v_earned := v_earned + public.uc_award(v_user, 'base_mining', 'base_mining:' || v_user || ':' || v_today,
    (public.uc_effective_tier(v_user)).base_mining, 'checkin', v_today::text, 'Base mining (' || (public.uc_effective_tier(v_user)).display_name || ')');
  IF v_streak % 7 = 0 THEN
    v_earned := v_earned + public.uc_award(v_user, 'streak_7', 'streak_7:' || v_user || ':' || v_today, NULL, 'checkin', v_today::text, v_streak || '-day streak');
  END IF;
  IF v_streak % 30 = 0 THEN
    v_earned := v_earned + public.uc_award(v_user, 'streak_30', 'streak_30:' || v_user || ':' || v_today, NULL, 'checkin', v_today::text, v_streak || '-day streak');
  END IF;

  RETURN jsonb_build_object('success', true, 'already', false, 'streak', v_streak, 'earned', v_earned);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.uc_daily_check_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uc_daily_check_in() TO authenticated;

-- Browse/shop activity: 5 UC per product viewed (once per product per day),
-- up to 5 products (25 UC) a day.
CREATE OR REPLACE FUNCTION public.uc_record_product_view(p_product_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
  IF v_user IS NULL OR p_product_id IS NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN RETURN 0; END IF;
  RETURN public.uc_award(v_user, 'browse_activity',
    'browse:' || v_user || ':' || p_product_id || ':' || v_today, NULL, 'product_view', p_product_id || ':' || v_today);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.uc_record_product_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uc_record_product_view(uuid) TO authenticated;

-- Mining capacity for the signed-in user: tier, caps, and today's capped
-- earnings by category (the "Mining capacity" card).
CREATE OR REPLACE FUNCTION public.uc_capacity()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tier public.affiliate_tiers;
  v_usage record;
  v_by_category jsonb;
BEGIN
  IF v_user IS NULL THEN RETURN NULL; END IF;
  v_tier := public.uc_effective_tier(v_user);
  v_usage := public.uc_capped_usage(v_user);

  SELECT COALESCE(jsonb_object_agg(cat, total), '{}'::jsonb) INTO v_by_category FROM (
    SELECT a.cap_category AS cat, sum(r.reward_mg) AS total
    FROM public.mining_requests r JOIN public.mining_activities a ON a.code = r.activity_code
    WHERE r.user_id = v_user AND r.status IN ('approved', 'credited') AND a.cap_category IS NOT NULL
      AND r.created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg')
    GROUP BY a.cap_category
  ) x;

  RETURN jsonb_build_object(
    'tier', jsonb_build_object('name', v_tier.display_name, 'level', v_tier.level, 'daily_cap', v_tier.daily_mining_cap,
      'monthly_cap', v_tier.monthly_mining_cap, 'base_mining', v_tier.base_mining, 'cashback_percent', v_tier.cashback_percent,
      'monthly_price', v_tier.monthly_price),
    'today', v_usage.today,
    'last_30_days', v_usage.last_30,
    'remaining', public.uc_remaining_capacity(v_user),
    'by_category', v_by_category,
    'qualified_referrals', (SELECT count(*) FROM public.referrals WHERE referrer_id = v_user AND qualified_at IS NOT NULL)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.uc_capacity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.uc_capacity() TO authenticated;

-- Referral activity (10% / 3% / 1% of task rewards) is an everyday earning,
-- so it goes through uc_award and counts towards the referrer's caps.
CREATE OR REPLACE FUNCTION public.process_referral_mining_bonus(
  p_miner_id uuid,
  p_completion_id uuid,
  p_reward integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
  v_level integer := 1;
  v_bonus_percent numeric;
  v_bonus_amount numeric;
  v_paid numeric;
  v_current_user_id uuid := p_miner_id;
BEGIN
  WHILE v_level <= 3 LOOP
    v_referrer_id := public.uc_referrer_of(v_current_user_id);
    EXIT WHEN v_referrer_id IS NULL;

    v_bonus_percent := CASE v_level WHEN 1 THEN 10.0 WHEN 2 THEN 3.0 ELSE 1.0 END;
    v_bonus_amount := ROUND(p_reward * (v_bonus_percent / 100.0));

    IF v_bonus_amount > 0 THEN
      v_paid := public.uc_award(v_referrer_id, 'referral_mining_bonus',
        'referral_mining_bonus:' || p_completion_id || ':' || v_referrer_id, v_bonus_amount,
        'referral_bonus', p_completion_id || ':' || v_level,
        format('Referral activity (level %s, %s%%)', v_level, v_bonus_percent));
      IF v_paid > 0 THEN
        INSERT INTO public.referral_mining_bonuses (beneficiary_id, miner_id, completion_id, referral_level, bonus_percent, bonus_amount)
        VALUES (v_referrer_id, p_miner_id, p_completion_id, v_level, v_bonus_percent, v_paid);
      END IF;
    END IF;

    v_current_user_id := v_referrer_id;
    v_level := v_level + 1;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Tasks: admin-created, each tied to a rule with a UC range, paid when an
--    admin approves the submission.
-- ---------------------------------------------------------------------------
ALTER TABLE public.mining_tasks ADD COLUMN IF NOT EXISTS reward_rule text;

-- Existing social tasks move to the Social/content range (50-500 UC) and
-- need approval. "Refer a new shopper" is replaced by the referral rules.
-- Only tasks without a rule yet, so re-running does not rescale again.
UPDATE public.mining_tasks
SET reward_rule = 'social_content_task',
    base_reward = LEAST(500, GREATEST(50, base_reward * 10)),
    requires_verification = true
WHERE reward_rule IS NULL;
UPDATE public.mining_tasks SET is_active = false WHERE task_type = 'conversion_referral';

CREATE OR REPLACE FUNCTION public.uc_check_task_reward()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_rule public.mining_activities;
BEGIN
  NEW.reward_rule := COALESCE(NEW.reward_rule, 'social_content_task');
  SELECT * INTO v_rule FROM public.mining_activities WHERE code = NEW.reward_rule;
  IF NOT FOUND OR NOT v_rule.admin_granted OR v_rule.reward_kind <> 'range' THEN
    RAISE EXCEPTION 'Task reward rule % must be an admin-run range rule', NEW.reward_rule;
  END IF;
  IF NEW.base_reward < v_rule.min_reward OR NEW.base_reward > v_rule.max_reward THEN
    RAISE EXCEPTION '% tasks pay % to % UC', v_rule.display_name, v_rule.min_reward, v_rule.max_reward;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS uc_task_reward_range ON public.mining_tasks;
CREATE TRIGGER uc_task_reward_range BEFORE INSERT OR UPDATE OF base_reward, reward_rule ON public.mining_tasks
  FOR EACH ROW EXECUTE FUNCTION public.uc_check_task_reward();

-- Submitting a task: same checks as before, but tasks that need approval are
-- stored as "pending" and paid by admin_review_task_completion.
CREATE OR REPLACE FUNCTION public.complete_mining_task(
  p_user_id uuid,
  p_task_id uuid,
  p_social_account_id uuid DEFAULT NULL,
  p_proof_url text DEFAULT NULL,
  p_proof_data jsonb DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_tier RECORD;
  v_tier_id uuid;
  v_daily_total INTEGER := 0;
  v_multiplier NUMERIC := 1.0;
  v_campaign_bonus NUMERIC;
  v_final_reward INTEGER;
  v_completion_id UUID;
  v_today DATE := CURRENT_DATE;
  v_task_completions_today INTEGER;
  v_last_completion TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is required');
  END IF;
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_social_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.social_accounts WHERE id = p_social_account_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Social account not found');
  END IF;

  SELECT * INTO v_task FROM public.mining_tasks WHERE id = p_task_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found or inactive');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('complete_mining_task:' || p_user_id::text));

  SELECT at.* INTO v_tier
  FROM public.user_affiliate_status uas JOIN public.affiliate_tiers at ON uas.tier_id = at.id
  WHERE uas.user_id = p_user_id;
  IF NOT FOUND THEN
    SELECT id INTO v_tier_id FROM public.affiliate_tiers ORDER BY level ASC LIMIT 1;
    IF v_tier_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mining tiers are not configured yet');
    END IF;
    INSERT INTO public.user_affiliate_status (user_id, tier_id) VALUES (p_user_id, v_tier_id)
    ON CONFLICT (user_id) DO UPDATE SET tier_id = EXCLUDED.tier_id;
    SELECT * INTO v_tier FROM public.affiliate_tiers WHERE id = v_tier_id;
  END IF;

  SELECT COALESCE(total_mined,0) INTO v_daily_total
  FROM public.daily_mining_limits WHERE user_id = p_user_id AND mining_date = v_today;
  IF COALESCE(v_daily_total,0) >= v_tier.daily_mining_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily task limit reached. Come back tomorrow.');
  END IF;

  SELECT COUNT(*), MAX(created_at) INTO v_task_completions_today, v_last_completion
  FROM public.mining_completions
  WHERE user_id = p_user_id AND task_id = p_task_id
    AND created_at::date = v_today AND status NOT IN ('rejected', 'expired');
  IF v_task_completions_today >= COALESCE(v_task.max_daily_completions,1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum daily completions for this task reached');
  END IF;
  IF v_last_completion IS NOT NULL AND COALESCE(v_task.cooldown_hours,0) > 0
     AND v_last_completion > now() - make_interval(hours => v_task.cooldown_hours) THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('This task is cooling down. Try again in %s hours.', v_task.cooldown_hours));
  END IF;

  v_multiplier := COALESCE(v_tier.mining_multiplier, 1.0);
  IF p_campaign_id IS NOT NULL THEN
    SELECT bonus_multiplier INTO v_campaign_bonus FROM public.mining_campaigns
    WHERE id = p_campaign_id AND is_active = true AND now() BETWEEN start_date AND end_date;
    IF v_campaign_bonus IS NOT NULL THEN v_multiplier := v_multiplier * v_campaign_bonus; END IF;
  END IF;
  v_final_reward := GREATEST(1, ROUND(v_task.base_reward * v_multiplier));

  IF COALESCE(v_task.requires_verification, true) THEN
    INSERT INTO public.mining_completions (
      user_id, task_id, campaign_id, social_account_id, proof_url, proof_data,
      base_reward, multiplier, final_reward, status
    ) VALUES (
      p_user_id, p_task_id, p_campaign_id, p_social_account_id, p_proof_url, p_proof_data,
      v_task.base_reward, v_multiplier, v_final_reward, 'pending'
    ) RETURNING id INTO v_completion_id;

    RETURN jsonb_build_object(
      'success', true, 'completion_id', v_completion_id, 'reward', v_final_reward, 'status', 'pending',
      'message', format('Submitted for review. %s UC will be added when it is approved.', v_final_reward)
    );
  END IF;

  -- Tasks an admin marked as not needing approval pay straight away.
  v_final_reward := LEAST(v_final_reward, v_tier.daily_mining_cap - COALESCE(v_daily_total,0));
  INSERT INTO public.mining_completions (
    user_id, task_id, campaign_id, social_account_id, proof_url, proof_data,
    base_reward, multiplier, final_reward, status, verified_at
  ) VALUES (
    p_user_id, p_task_id, p_campaign_id, p_social_account_id, COALESCE(p_proof_url, 'auto-verified'), p_proof_data,
    v_task.base_reward, v_multiplier, v_final_reward, 'verified', now()
  ) RETURNING id INTO v_completion_id;

  PERFORM public.uc_pay_completion(v_completion_id);
  RETURN jsonb_build_object(
    'success', true, 'completion_id', v_completion_id, 'reward', v_final_reward, 'status', 'paid',
    'message', format('Task completed! %s UC added to your wallet.', v_final_reward)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_mining_task(uuid, uuid, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_mining_task(uuid, uuid, uuid, text, jsonb, uuid) TO authenticated, service_role;

-- Pay a verified completion (task reward rule, daily totals, referral bonus).
CREATE OR REPLACE FUNCTION public.uc_pay_completion(p_completion_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.mining_completions;
  v_task public.mining_tasks;
  v_paid numeric;
  v_day date;
BEGIN
  SELECT * INTO v_c FROM public.mining_completions WHERE id = p_completion_id FOR UPDATE;
  IF NOT FOUND OR v_c.status = 'paid' THEN RETURN 0; END IF;
  SELECT * INTO v_task FROM public.mining_tasks WHERE id = v_c.task_id;

  -- Range rules have no daily cap of their own; the tier cap applied at submit.
  v_paid := public.uc_award(v_c.user_id, COALESCE(v_task.reward_rule, 'social_content_task'),
    'mining_completion:' || v_c.id, v_c.final_reward, 'mining_completion', v_c.id::text, v_task.title);

  UPDATE public.mining_completions SET status = 'paid', verified_at = COALESCE(verified_at, now())
  WHERE id = v_c.id;

  -- The tier cap may have paid less than the task's reward.
  UPDATE public.mining_completions SET final_reward = v_paid WHERE id = v_c.id;

  v_day := v_c.created_at::date;
  INSERT INTO public.daily_mining_limits (user_id, mining_date, total_mined, tasks_completed)
  VALUES (v_c.user_id, v_day, v_paid, 1)
  ON CONFLICT (user_id, mining_date) DO UPDATE SET
    total_mined = daily_mining_limits.total_mined + v_paid,
    tasks_completed = daily_mining_limits.tasks_completed + 1;

  UPDATE public.user_affiliate_status
  SET total_mined = COALESCE(total_mined,0) + v_paid,
      today_mined = CASE WHEN last_mining_date = CURRENT_DATE THEN COALESCE(today_mined,0) + v_paid ELSE v_paid END,
      last_mining_date = CURRENT_DATE,
      updated_at = now()
  WHERE user_id = v_c.user_id;

  IF v_paid > 0 THEN
    PERFORM public.process_referral_mining_bonus(v_c.user_id, v_c.id, v_paid::integer);
  END IF;
  RETURN v_paid;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_task_completion(
  p_completion_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.mining_completions;
  v_paid numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_c FROM public.mining_completions WHERE id = p_completion_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Submission not found'); END IF;
  IF v_c.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This submission was already ' || v_c.status);
  END IF;

  IF p_approve THEN
    v_paid := public.uc_pay_completion(p_completion_id);
    RETURN jsonb_build_object('success', true, 'status', 'paid', 'reward', v_paid);
  END IF;

  UPDATE public.mining_completions
  SET status = 'rejected',
      proof_data = COALESCE(proof_data, '{}'::jsonb) || jsonb_build_object('rejection_reason', p_reason, 'reviewed_by', auth.uid())
  WHERE id = p_completion_id;
  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_review_task_completion(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_task_completion(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Admin grants: surveys, targets, campaigns, sponsored tasks, photo/video
--    reviews, Service Hub cashback, affiliate sales, referral top-ups.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_reward(
  p_user_id uuid,
  p_rule text,
  p_amount numeric,
  p_reason text,
  p_reference text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule public.mining_activities;
  v_amount numeric := ROUND(p_amount);
  v_paid numeric;
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Give a reason for the grant');
  END IF;

  SELECT * INTO v_rule FROM public.mining_activities WHERE code = p_rule AND is_active = true;
  IF NOT FOUND OR NOT (v_rule.admin_granted OR v_rule.reward_kind IN ('range', 'percent')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This reward is paid automatically, not by admins');
  END IF;

  IF v_rule.reward_kind = 'fixed' THEN
    v_amount := v_rule.reward_mg;
  ELSIF v_rule.reward_kind = 'range' AND (v_amount < v_rule.min_reward OR v_amount > v_rule.max_reward) THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('%s pays %s to %s UC', v_rule.display_name, v_rule.min_reward, v_rule.max_reward));
  ELSIF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter a positive UC amount');
  END IF;

  -- A reference (e.g. survey or campaign id) makes the grant once-only.
  v_key := 'admin:' || p_rule || ':' || p_user_id || ':' || COALESCE(NULLIF(btrim(p_reference), ''), gen_random_uuid()::text);
  v_paid := public.uc_award(p_user_id, p_rule, v_key, v_amount, 'admin_grant', NULLIF(btrim(p_reference), ''),
    v_rule.display_name || ': ' || btrim(p_reason));

  IF v_paid <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already granted for this reference');
  END IF;

  INSERT INTO public.mining_events (request_id, stage, actor, payload)
  SELECT id, 'admin_grant', 'admin', jsonb_build_object('admin_id', auth.uid(), 'reason', p_reason)
  FROM public.mining_requests WHERE idempotency_key = v_key;

  RETURN jsonb_build_object('success', true, 'reward', v_paid);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_reward(uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_reward(uuid, text, numeric, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Birthdays and anniversaries (daily, 07:00 SAST)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.uc_award_annual_rewards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_year text := to_char(v_today, 'YYYY');
  v_leap boolean := (extract(year FROM v_today)::int % 4 = 0 AND extract(year FROM v_today)::int % 100 <> 0)
                    OR extract(year FROM v_today)::int % 400 = 0;
  v_row record;
  v_count integer := 0;
BEGIN
  -- Birthday from the verified identity profile (or the creator profile).
  FOR v_row IN
    SELECT DISTINCT ON (u.id) u.id AS user_id, COALESCE(k.dob, i.date_of_birth) AS dob
    FROM auth.users u
    LEFT JOIN public.kyc_profiles k ON k.user_id = u.id
    LEFT JOIN public.influencer_profiles i ON i.user_id = u.id
    WHERE COALESCE(k.dob, i.date_of_birth) IS NOT NULL
  LOOP
    IF to_char(v_row.dob, 'MM-DD') = to_char(v_today, 'MM-DD')
       OR (to_char(v_row.dob, 'MM-DD') = '02-29' AND NOT v_leap AND to_char(v_today, 'MM-DD') = '02-28') THEN
      IF public.uc_award(v_row.user_id, 'birthday', 'birthday:' || v_row.user_id || ':' || v_year, NULL, 'birthday', v_row.user_id || ':' || v_year) > 0 THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Anniversary of joining (confirmed accounts, one year or more).
  FOR v_row IN
    SELECT id AS user_id, (created_at AT TIME ZONE 'Africa/Johannesburg')::date AS joined
    FROM auth.users WHERE email_confirmed_at IS NOT NULL
  LOOP
    IF v_row.joined <= v_today - interval '1 year'
       AND (to_char(v_row.joined, 'MM-DD') = to_char(v_today, 'MM-DD')
            OR (to_char(v_row.joined, 'MM-DD') = '02-29' AND NOT v_leap AND to_char(v_today, 'MM-DD') = '02-28')) THEN
      IF public.uc_award(v_row.user_id, 'anniversary', 'anniversary:' || v_row.user_id || ':' || v_year, NULL, 'anniversary', v_row.user_id || ':' || v_year) > 0 THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'uc-annual-rewards';
    PERFORM cron.schedule('uc-annual-rewards', '0 5 * * *', 'SELECT public.uc_award_annual_rewards();');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; birthday and anniversary rewards are not scheduled.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. All engine functions are server-only (triggers run as definer).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.uc_award(uuid, text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_activity(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_reverse(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_driver_milestones(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_merchant_milestones(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_pay_completion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_award_annual_rewards() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_actor_is(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_referrer_of(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_cashback(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_cashback_percent(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_effective_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_capped_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_remaining_capacity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_refresh_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_mark_referral_qualified(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_mining_bonus(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uc_refresh_tier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uc_award(uuid, text, text, numeric, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_activity(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.uc_reverse(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.uc_award_annual_rewards() TO service_role;
DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.uc_on_profile(), public.uc_on_kyc(), public.uc_on_order(), public.uc_on_review(),
    public.uc_on_ride(), public.uc_on_delivery(), public.uc_on_stay(), public.uc_on_lease_application(),
    public.uc_on_lease_contract(), public.uc_on_lease_payment(), public.uc_on_influencer_conversion(),
    public.uc_on_influencer_onboarded(), public.uc_check_task_reward() FROM PUBLIC, anon, authenticated;
END $$;

-- ---------------------------------------------------------------------------
-- 11. Backfill: referrals that already made a purchase count as qualified;
--     recompute tiers for everyone with a referral or a mining status.
-- ---------------------------------------------------------------------------
UPDATE public.referrals SET qualified_at = COALESCE(first_purchase_date, updated_at, now())
WHERE qualified_at IS NULL AND status = 'completed';

DO $$
DECLARE v_user uuid;
BEGIN
  FOR v_user IN
    SELECT referrer_id FROM public.referrals WHERE referrer_id IS NOT NULL
    UNION SELECT user_id FROM public.user_affiliate_status
  LOOP
    PERFORM public.uc_refresh_tier(v_user);
  END LOOP;
END $$;
