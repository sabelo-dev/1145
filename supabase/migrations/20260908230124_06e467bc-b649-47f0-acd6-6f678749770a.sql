
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
