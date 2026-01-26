-- Update complete_mining_task function to require actual verification before rewarding
CREATE OR REPLACE FUNCTION complete_mining_task(
  p_user_id UUID,
  p_task_id UUID,
  p_social_account_id UUID DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL,
  p_proof_data JSONB DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_verification_status TEXT;
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

  -- REQUIRE PROOF URL for all tasks (actual user action verification)
  IF p_proof_url IS NULL OR TRIM(p_proof_url) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proof of task completion is required');
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

  -- ALL completions start as 'pending' - rewards only given after verification
  v_verification_status := 'pending';

  -- Create completion record - NO IMMEDIATE REWARD
  INSERT INTO mining_completions (
    user_id, task_id, campaign_id, social_account_id,
    proof_url, proof_data, base_reward, multiplier, final_reward,
    status
  ) VALUES (
    p_user_id, p_task_id, p_campaign_id, p_social_account_id,
    p_proof_url, p_proof_data, v_base_reward, v_multiplier, v_final_reward,
    v_verification_status
  ) RETURNING id INTO v_completion_id;

  -- DO NOT update daily limits until verified
  -- DO NOT credit UCoin until verified
  -- All rewards are pending until verify_mining_completion is called

  RETURN jsonb_build_object(
    'success', true,
    'completion_id', v_completion_id,
    'reward', v_final_reward,
    'status', 'pending',
    'message', 'Task submitted for verification. UCoin will be credited once verified.'
  );
END;
$$;

-- Create function to verify and reward mining completion
CREATE OR REPLACE FUNCTION verify_mining_completion(
  p_completion_id UUID,
  p_verified BOOLEAN,
  p_verified_by UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get completion record
  SELECT mc.*, mt.task_type 
  INTO v_completion 
  FROM mining_completions mc
  JOIN mining_tasks mt ON mc.task_id = mt.id
  WHERE mc.id = p_completion_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Completion not found');
  END IF;
  
  IF v_completion.status NOT IN ('pending', 'under_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Completion already processed');
  END IF;
  
  IF p_verified THEN
    -- Update completion status to verified
    UPDATE mining_completions 
    SET status = 'verified', 
        verified_at = now(),
        verified_by = p_verified_by
    WHERE id = p_completion_id;
    
    -- NOW update daily limits
    INSERT INTO daily_mining_limits (user_id, mining_date, total_mined, tasks_completed)
    VALUES (v_completion.user_id, v_today, v_completion.final_reward, 1)
    ON CONFLICT (user_id, mining_date)
    DO UPDATE SET 
      total_mined = daily_mining_limits.total_mined + v_completion.final_reward,
      tasks_completed = daily_mining_limits.tasks_completed + 1;
    
    -- NOW credit UCoin
    PERFORM award_ucoin(v_completion.user_id, 'social_mining', p_completion_id, 'mining_completion');
    
    UPDATE mining_completions SET status = 'paid' WHERE id = p_completion_id;
    
    -- Update affiliate status
    UPDATE user_affiliate_status 
    SET total_mined = total_mined + v_completion.final_reward,
        today_mined = CASE WHEN last_mining_date = v_today THEN today_mined + v_completion.final_reward ELSE v_completion.final_reward END,
        last_mining_date = v_today,
        updated_at = now()
    WHERE user_id = v_completion.user_id;
    
    -- Process referral bonuses only after verification
    PERFORM process_referral_mining_bonus(v_completion.user_id, p_completion_id, v_completion.final_reward);
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'paid',
      'reward', v_completion.final_reward,
      'message', 'Task verified and UCoin credited'
    );
  ELSE
    -- Reject the completion
    UPDATE mining_completions 
    SET status = 'rejected',
        verified_at = now(),
        verified_by = p_verified_by,
        proof_data = COALESCE(proof_data, '{}'::jsonb) || jsonb_build_object('rejection_reason', p_rejection_reason)
    WHERE id = p_completion_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'message', COALESCE(p_rejection_reason, 'Task verification failed')
    );
  END IF;
END;
$$;

-- Update all mining tasks to require verification
UPDATE mining_tasks SET requires_verification = true WHERE requires_verification = false;

-- Add verified_by column to mining_completions if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mining_completions' AND column_name = 'verified_by') THEN
    ALTER TABLE mining_completions ADD COLUMN verified_by UUID REFERENCES auth.users(id);
  END IF;
END $$;