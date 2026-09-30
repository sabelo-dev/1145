-- Influencer flow fixes: reward security, publish status, onboarding socials.

-- ---------------------------------------------------------------------------
-- 1. Mining credit helpers are server-only.
--    mining_direct_credit (added 2026-09-08) never had EXECUTE revoked, so any
--    signed-in client could call it with an arbitrary user id and amount and
--    mint UCoin straight into a wallet.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.mining_direct_credit(uuid, text, numeric, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mining_direct_credit(uuid, text, numeric, text, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mining_credit_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mining_credit_request(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_referral_mining_bonus(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_mining_bonus(uuid, uuid, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 1b. The reward pipeline's activity catalogue is empty in production, so
--     every task completion failed on mining_requests_activity_code_fkey.
--     Re-seed the defaults from 20260728025757 (existing rows are kept).
-- ---------------------------------------------------------------------------
INSERT INTO public.mining_activities (code, display_name, description, reward_mg, cooldown_seconds, daily_cap, requires_moderation, rules) VALUES
  ('daily_login',   'Daily Login',        'Reward for logging in once per day',                  5,   86400, 1,  false, '{"require_trusted_device":true}'::jsonb),
  ('purchase',      'Verified Purchase',  'Order delivered and return window closed',            25,  0,     NULL, false, '{"await":"order_delivered_and_return_closed","return_window_days":7}'::jsonb),
  ('referral',      'Referral Reward',    'Referred user KYC + first delivered order',           50,  0,     NULL, false, '{"await":"referral_completed"}'::jsonb),
  ('delivery',      'Delivery Completed', 'Driver delivered with POD, OTP, photo, rating',       20,  0,     NULL, false, '{"await":"driver_pod_complete"}'::jsonb),
  ('review',        'Product Review',     'Verified purchase review, moderated',                 10,  0,     3,    true,  '{"min_words":20,"require_verified_purchase":true}'::jsonb),
  ('social_share',  'Social Share',       'Tracked share link with real unique visitor',         5,   0,     10,   false, '{"min_dwell_seconds":10,"require_unique_device":true}'::jsonb),
  ('video_watch',   'Video Watched',      '95% watched with quiz passed if applicable',          8,   0,     5,    false, '{"min_watched_percent":95}'::jsonb),
  ('kyc_complete',  'KYC Completed',      'User completed identity verification',                100, 0,     1,    false, '{"await":"kyc_verified"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. complete_mining_task: a client may only complete tasks for itself.
--    Same body as 20260908230124, plus the caller check at the top.
--    service_role / definer callers have no auth.uid() and are unaffected.
-- ---------------------------------------------------------------------------
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

  -- Outcome-based tasks are credited by the system when the event happens
  -- (e.g. a referred shopper's first order), never by clicking "complete".
  IF auth.uid() IS NOT NULL AND v_task.task_type IN ('conversion_referral') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'This reward is credited automatically when your referred shopper places their first order.');
  END IF;

  -- Serialise completions per user so two concurrent calls cannot both pass
  -- the cap / cooldown checks.
  PERFORM pg_advisory_xact_lock(hashtext('complete_mining_task:' || p_user_id::text));

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
    ON CONFLICT (user_id) DO UPDATE SET tier_id = EXCLUDED.tier_id;
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

  UPDATE public.mining_completions SET status = 'paid' WHERE id = v_completion_id;

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

REVOKE EXECUTE ON FUNCTION public.complete_mining_task(uuid, uuid, uuid, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_mining_task(uuid, uuid, uuid, text, jsonb, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Mining bookkeeping tables are read-only for clients. Previously users
--    could raise their own tier (bigger multiplier / cap), wipe their daily
--    limit row, or insert "paid" completions directly.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage their own affiliate status" ON public.user_affiliate_status;
DROP POLICY IF EXISTS "Users can create their default affiliate status" ON public.user_affiliate_status;
CREATE POLICY "Users can create their default affiliate status"
  ON public.user_affiliate_status FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tier_id = (SELECT id FROM public.affiliate_tiers ORDER BY level ASC LIMIT 1)
    AND COALESCE(total_conversions, 0) = 0
    AND COALESCE(total_referrals, 0) = 0
    AND COALESCE(total_mined, 0) = 0
    AND COALESCE(today_mined, 0) = 0
  );

DROP POLICY IF EXISTS "Users can manage their own daily limits" ON public.daily_mining_limits;
DROP POLICY IF EXISTS "Users can create completions" ON public.mining_completions;

-- ---------------------------------------------------------------------------
-- 4. social-publish records a mixed outcome as 'partial'; the old check
--    constraint rejected it, so the update failed and the external post ids
--    were lost (and a retry would publish duplicates).
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_media_posts DROP CONSTRAINT IF EXISTS social_media_posts_status_check;
ALTER TABLE public.social_media_posts
  ADD CONSTRAINT social_media_posts_status_check
  CHECK (status IN ('draft', 'scheduled', 'published', 'partial', 'failed'));

-- ---------------------------------------------------------------------------
-- 5. Onboarding saves manual socials as 'pending' until verified via OAuth;
--    the old constraint silently rejected every one of those rows.
-- ---------------------------------------------------------------------------
ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_status_check;
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_status_check
  CHECK (status IN ('pending', 'active', 'disconnected', 'suspended'));

-- ---------------------------------------------------------------------------
-- 6. One aggregate engagement row per influencer / platform / day so repeated
--    syncs update instead of piling up duplicates.
-- ---------------------------------------------------------------------------
DELETE FROM public.influencer_engagement_metrics a
USING public.influencer_engagement_metrics b
WHERE a.post_id IS NULL AND b.post_id IS NULL
  AND a.influencer_id = b.influencer_id
  AND a.platform = b.platform
  AND a.metric_date = b.metric_date
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS influencer_engagement_metrics_daily_unique
  ON public.influencer_engagement_metrics (influencer_id, platform, metric_date)
  WHERE post_id IS NULL;

-- ---------------------------------------------------------------------------
-- 7. Per-platform publish results (written by social-publish), one row each.
-- ---------------------------------------------------------------------------
DELETE FROM public.social_post_platforms a
USING public.social_post_platforms b
WHERE a.post_id = b.post_id AND a.platform = b.platform AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS social_post_platforms_post_platform_unique
  ON public.social_post_platforms (post_id, platform);

-- ---------------------------------------------------------------------------
-- 8. Public media for social posts. Instagram (and Facebook photo posts)
--    fetch media from a public URL, so uploads must be publicly readable.
--    Users write only under their own <uid>/ folder.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media', 'social-media', true, 104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Social media: public read" ON storage.objects;
CREATE POLICY "Social media: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'social-media');

DROP POLICY IF EXISTS "Social media: owner upload" ON storage.objects;
CREATE POLICY "Social media: owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Social media: owner delete" ON storage.objects;
CREATE POLICY "Social media: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- 9. Wallet history shows which task paid out, not just the activity code.
--    Same as 20260908230014 apart from the description / notification text.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mining_credit_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.mining_requests;
  v_balance numeric;
BEGIN
  SELECT * INTO v_req FROM public.mining_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_req.status = 'credited' THEN RETURN true; END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot credit request not in approved state (status=%)', v_req.status;
  END IF;

  SELECT COALESCE(SUM(delta_mg),0) INTO v_balance
    FROM public.ucoin_ledger WHERE user_id = v_req.user_id;

  INSERT INTO public.ucoin_ledger(user_id, request_id, delta_mg, kind, reason, running_balance)
  VALUES (v_req.user_id, v_req.id, v_req.reward_mg, 'credit', v_req.activity_code, v_balance + v_req.reward_mg);

  INSERT INTO public.ucoin_wallets(user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (v_req.user_id, v_req.reward_mg, v_req.reward_mg, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = ucoin_wallets.balance + EXCLUDED.balance,
        lifetime_earned = ucoin_wallets.lifetime_earned + EXCLUDED.balance,
        updated_at = now();

  INSERT INTO public.ucoin_transactions(user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_req.user_id, v_req.reward_mg::integer, 'earn', 'social_mining',
    'Mining reward: ' || COALESCE(v_req.metadata->>'task_title', v_req.activity_code), v_req.id, 'mining_request');

  UPDATE public.mining_requests
    SET status = 'credited', credited_at = now(), updated_at = now()
    WHERE id = p_request_id;

  INSERT INTO public.mining_events(request_id, stage, actor, payload)
  VALUES (p_request_id, 'credited', 'system',
    jsonb_build_object('amount_mg', v_req.reward_mg));

  INSERT INTO public.user_notifications(user_id, type, title, message, data)
  VALUES (v_req.user_id, 'ucoin_credit',
    'You earned ' || v_req.reward_mg || ' UCoin',
    'Reward for: ' || COALESCE(v_req.metadata->>'task_title', v_req.activity_code),
    jsonb_build_object('request_id', v_req.id, 'activity', v_req.activity_code));

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mining_credit_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mining_credit_request(uuid) TO service_role;
