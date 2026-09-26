
-- 1. Reward tiers
INSERT INTO public.affiliate_tiers (name, display_name, level, min_conversions, mining_multiplier, daily_mining_cap, badge_color, badge_icon)
VALUES
  ('starter','Starter',1,0,1.0,50,'#6B7280','Sprout'),
  ('bronze','Bronze',2,5,1.25,120,'#CD7F32','Award'),
  ('silver','Silver',3,20,1.5,250,'#C0C0C0','Medal'),
  ('gold','Gold',4,50,2.0,500,'#D4AF37','Trophy'),
  ('diamond','Diamond',5,150,3.0,1000,'#00D4FF','Gem')
ON CONFLICT DO NOTHING;

-- 2. Real mining tasks
DELETE FROM public.mining_tasks WHERE task_type = 'rigister';

INSERT INTO public.mining_tasks (category, task_type, title, description, platform, base_reward, reward_tier, min_followers, cooldown_hours, requires_verification, max_daily_completions, is_active)
VALUES
  ('affiliate','referral_link_share','Share your referral link','Post your personal 1145 referral link on any social platform.','any',5,'low',0,6,false,4,true),
  ('affiliate','conversion_referral','Refer a new shopper','Someone signs up and places their first order with your link.','any',50,'very_high',0,0,false,10,true),
  ('affiliate','brand_mention','Mention 1145 Lifestyle','Tag @1145lifestyle in a public post.','any',8,'low',0,12,false,2,true),
  ('affiliate','promo_code_use','Share a promo code','Share an active 1145 promo code with your audience.','any',6,'low',0,12,false,2,true),
  ('engagement','like_post','Like a 1145 post','Like the latest 1145 post on the platform.','any',2,'very_low',0,6,false,5,true),
  ('engagement','comment_post','Comment on a 1145 post','Leave a genuine comment on a 1145 post.','any',4,'low',0,6,false,3,true),
  ('engagement','repost','Repost 1145 content','Share a 1145 post to your feed.','any',6,'medium',0,8,false,3,true),
  ('engagement','story_share','Share to your story','Add a 1145 product or post to your story.','instagram',7,'medium',0,12,false,2,true),
  ('content','short_video','Create a short video','Post a TikTok or Reel featuring a 1145 product.','tiktok',40,'very_high',0,24,false,1,true),
  ('content','review_post','Post a product review','Publish an honest review of a product you bought.','any',25,'high',0,24,false,2,true),
  ('content','livestream_mention','Mention us on a livestream','Talk about 1145 during a live broadcast.','any',30,'high',0,24,false,1,true),
  ('content','ugc_upload','Upload your own photo','Share your own photo using a 1145 product.','any',15,'medium',0,12,false,2,true)
ON CONFLICT DO NOTHING;

-- 3. Direct credit helper (bypasses the pending approval queue for auto-verified mining)
CREATE OR REPLACE FUNCTION public.mining_direct_credit(
  p_user_id uuid,
  p_activity_code text,
  p_reward_mg numeric,
  p_idempotency_key text,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_reward_mg,0) <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.mining_requests (
    user_id, activity_code, status, reward_mg, evidence, metadata,
    reference_type, reference_id, idempotency_key, validated_at, validator, expires_at
  ) VALUES (
    p_user_id, p_activity_code, 'approved', p_reward_mg, '{}'::jsonb, COALESCE(p_metadata,'{}'::jsonb),
    p_reference_type, p_reference_id, p_idempotency_key, now(), 'auto', now() + interval '720 hours'
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    SELECT id INTO v_request_id FROM public.mining_requests WHERE idempotency_key = p_idempotency_key;
    RETURN v_request_id;
  END IF;

  PERFORM public.mining_credit_request(v_request_id);
  RETURN v_request_id;
END;
$$;

-- 4. Fixed task completion
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
  v_base_reward INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_campaign_bonus NUMERIC;
  v_final_reward INTEGER;
  v_completion_id UUID;
  v_today DATE := CURRENT_DATE;
  v_task_completions_today INTEGER;
  v_last_completion TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_task FROM public.mining_tasks WHERE id = p_task_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found or inactive');
  END IF;

  SELECT at.* INTO v_tier
  FROM public.user_affiliate_status uas
  JOIN public.affiliate_tiers at ON uas.tier_id = at.id
  WHERE uas.user_id = p_user_id;

  IF NOT FOUND THEN
    SELECT id INTO v_tier_id FROM public.affiliate_tiers ORDER BY level ASC LIMIT 1;
    IF v_tier_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Mining tiers are not configured yet');
    END IF;
    INSERT INTO public.user_affiliate_status (user_id, tier_id)
    VALUES (p_user_id, v_tier_id)
    ON CONFLICT (user_id) DO UPDATE SET tier_id = COALESCE(public.user_affiliate_status.tier_id, EXCLUDED.tier_id);
    SELECT * INTO v_tier FROM public.affiliate_tiers WHERE id = v_tier_id;
  END IF;

  SELECT COALESCE(total_mined,0) INTO v_daily_total
  FROM public.daily_mining_limits
  WHERE user_id = p_user_id AND mining_date = v_today;

  IF COALESCE(v_daily_total,0) >= v_tier.daily_mining_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily mining limit reached. Come back tomorrow.');
  END IF;

  SELECT COUNT(*), MAX(created_at) INTO v_task_completions_today, v_last_completion
  FROM public.mining_completions
  WHERE user_id = p_user_id
    AND task_id = p_task_id
    AND created_at::date = v_today
    AND status NOT IN ('rejected', 'expired');

  IF v_task_completions_today >= COALESCE(v_task.max_daily_completions,1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum daily completions for this task reached');
  END IF;

  IF v_last_completion IS NOT NULL
     AND COALESCE(v_task.cooldown_hours,0) > 0
     AND v_last_completion > now() - make_interval(hours => v_task.cooldown_hours) THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('This task is cooling down. Try again in %s hours.', v_task.cooldown_hours));
  END IF;

  v_base_reward := v_task.base_reward;
  v_multiplier := COALESCE(v_tier.mining_multiplier, 1.0);

  IF p_campaign_id IS NOT NULL THEN
    SELECT bonus_multiplier INTO v_campaign_bonus
    FROM public.mining_campaigns
    WHERE id = p_campaign_id AND is_active = true
      AND now() BETWEEN start_date AND end_date;
    IF v_campaign_bonus IS NOT NULL THEN
      v_multiplier := v_multiplier * v_campaign_bonus;
    END IF;
  END IF;

  v_final_reward := GREATEST(1, ROUND(v_base_reward * v_multiplier));
  -- never exceed the remaining daily cap
  v_final_reward := LEAST(v_final_reward, v_tier.daily_mining_cap - COALESCE(v_daily_total,0));

  INSERT INTO public.mining_completions (
    user_id, task_id, campaign_id, social_account_id,
    proof_url, proof_data, base_reward, multiplier, final_reward,
    status, verified_at
  ) VALUES (
    p_user_id, p_task_id, p_campaign_id, p_social_account_id,
    COALESCE(p_proof_url, 'auto-verified'), p_proof_data, v_base_reward, v_multiplier, v_final_reward,
    'verified', now()
  ) RETURNING id INTO v_completion_id;

  INSERT INTO public.daily_mining_limits (user_id, mining_date, total_mined, tasks_completed)
  VALUES (p_user_id, v_today, v_final_reward, 1)
  ON CONFLICT (user_id, mining_date)
  DO UPDATE SET
    total_mined = daily_mining_limits.total_mined + v_final_reward,
    tasks_completed = daily_mining_limits.tasks_completed + 1;

  PERFORM public.mining_direct_credit(
    p_user_id,
    'social_share',
    v_final_reward,
    'mining_completion:' || v_completion_id::text,
    'mining_completion',
    v_completion_id::text,
    jsonb_build_object('task_type', v_task.task_type, 'task_title', v_task.title)
  );

  UPDATE public.mining_completions SET status = 'paid', paid_at = now() WHERE id = v_completion_id;

  UPDATE public.user_affiliate_status
  SET total_mined = COALESCE(total_mined,0) + v_final_reward,
      today_mined = CASE WHEN last_mining_date = v_today THEN COALESCE(today_mined,0) + v_final_reward ELSE v_final_reward END,
      last_mining_date = v_today,
      updated_at = now()
  WHERE user_id = p_user_id;

  PERFORM public.process_referral_mining_bonus(p_user_id, v_completion_id, v_final_reward);

  RETURN jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'reward', v_final_reward,
    'status', 'paid',
    'message', format('Task completed! %s UCoin credited to your wallet.', v_final_reward)
  );
END;
$$;

-- 5. Referral mining bonuses credit the real amount
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
  v_referrer_id UUID;
  v_level INTEGER := 1;
  v_bonus_percent NUMERIC;
  v_bonus_amount INTEGER;
  v_current_user_id UUID := p_miner_id;
BEGIN
  WHILE v_level <= 3 LOOP
    SELECT referrer_id INTO v_referrer_id
    FROM public.referrals
    WHERE referred_id = v_current_user_id AND status IN ('signup_completed', 'completed')
    LIMIT 1;

    EXIT WHEN v_referrer_id IS NULL;

    v_bonus_percent := CASE v_level WHEN 1 THEN 10.0 WHEN 2 THEN 3.0 ELSE 1.0 END;
    v_bonus_amount := ROUND(p_reward * (v_bonus_percent / 100.0));

    IF v_bonus_amount > 0 THEN
      INSERT INTO public.referral_mining_bonuses (
        beneficiary_id, miner_id, completion_id, referral_level, bonus_percent, bonus_amount
      ) VALUES (
        v_referrer_id, p_miner_id, p_completion_id, v_level, v_bonus_percent, v_bonus_amount
      );

      PERFORM public.mining_direct_credit(
        v_referrer_id,
        'referral',
        v_bonus_amount,
        'referral_mining_bonus:' || p_completion_id::text || ':' || v_referrer_id::text,
        'referral_bonus',
        p_completion_id::text,
        jsonb_build_object('level', v_level, 'percent', v_bonus_percent)
      );
    END IF;

    v_current_user_id := v_referrer_id;
    v_referrer_id := NULL;
    v_level := v_level + 1;
  END LOOP;
END;
$$;
