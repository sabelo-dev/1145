
-- Update complete_mining_task to auto-verify (no proof URL required, immediate reward)
CREATE OR REPLACE FUNCTION public.complete_mining_task(p_user_id uuid, p_task_id uuid, p_social_account_id uuid DEFAULT NULL::uuid, p_proof_url text DEFAULT NULL::text, p_proof_data jsonb DEFAULT NULL::jsonb, p_campaign_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND status NOT IN ('rejected', 'expired');
    
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

  -- Auto-verify: Create completion as 'verified' immediately
  INSERT INTO mining_completions (
    user_id, task_id, campaign_id, social_account_id,
    proof_url, proof_data, base_reward, multiplier, final_reward,
    status, verified_at
  ) VALUES (
    p_user_id, p_task_id, p_campaign_id, p_social_account_id,
    COALESCE(p_proof_url, 'auto-verified'), p_proof_data, v_base_reward, v_multiplier, v_final_reward,
    'verified', now()
  ) RETURNING id INTO v_completion_id;

  -- Update daily limits immediately
  INSERT INTO daily_mining_limits (user_id, mining_date, total_mined, tasks_completed)
  VALUES (p_user_id, v_today, v_final_reward, 1)
  ON CONFLICT (user_id, mining_date)
  DO UPDATE SET 
    total_mined = daily_mining_limits.total_mined + v_final_reward,
    tasks_completed = daily_mining_limits.tasks_completed + 1;

  -- Credit UCoin immediately
  PERFORM award_ucoin(p_user_id, 'social_mining', v_completion_id, 'mining_completion');
  
  UPDATE mining_completions SET status = 'paid' WHERE id = v_completion_id;

  -- Update affiliate status
  UPDATE user_affiliate_status 
  SET total_mined = total_mined + v_final_reward,
      today_mined = CASE WHEN last_mining_date = v_today THEN today_mined + v_final_reward ELSE v_final_reward END,
      last_mining_date = v_today,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Process referral bonuses
  PERFORM process_referral_mining_bonus(p_user_id, v_completion_id, v_final_reward);

  RETURN jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'reward', v_final_reward,
    'status', 'paid',
    'message', format('Task completed! %s UCoin awarded.', v_final_reward)
  );
END;
$function$;
