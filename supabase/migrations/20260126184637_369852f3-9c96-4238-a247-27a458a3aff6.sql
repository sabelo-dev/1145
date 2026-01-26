-- Create or replace function to auto-complete referral tasks
-- This automatically awards UCoin when referral milestones are hit

CREATE OR REPLACE FUNCTION public.process_referral_signup(
  p_referred_id UUID,
  p_referral_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_code_record RECORD;
  v_existing_referral RECORD;
  v_signup_reward INTEGER := 50;
  v_referred_reward INTEGER := 25;
BEGIN
  -- Get the referral code and referrer
  SELECT * INTO v_referral_code_record
  FROM user_referral_codes
  WHERE code = UPPER(p_referral_code) AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  v_referrer_id := v_referral_code_record.user_id;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referred_id THEN
    RETURN false;
  END IF;
  
  -- Check if user was already referred
  SELECT * INTO v_existing_referral
  FROM referrals
  WHERE referred_id = p_referred_id;
  
  IF FOUND THEN
    RETURN false;
  END IF;
  
  -- Create the referral record with signup completed status
  INSERT INTO referrals (
    referrer_id,
    referred_id,
    referral_code,
    status,
    signup_reward_paid,
    created_at
  ) VALUES (
    v_referrer_id,
    p_referred_id,
    UPPER(p_referral_code),
    'signup_completed',
    true,
    now()
  );
  
  -- Update referral code usage count
  UPDATE user_referral_codes
  SET uses_count = uses_count + 1,
      total_earned = total_earned + v_signup_reward,
      updated_at = now()
  WHERE id = v_referral_code_record.id;
  
  -- AUTO-AWARD UCoin to referrer for successful signup
  INSERT INTO ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_referrer_id, v_signup_reward, 'earn', 'referral_signup', 'Referral signup bonus - someone joined using your link', p_referred_id, 'referral');
  
  UPDATE ucoin_wallets
  SET balance = balance + v_signup_reward,
      lifetime_earned = lifetime_earned + v_signup_reward
  WHERE user_id = v_referrer_id;
  
  -- AUTO-AWARD UCoin to referred user as welcome bonus
  INSERT INTO ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (p_referred_id, v_referred_reward, 'earn', 'referral_welcome', 'Welcome bonus for signing up with a referral link', v_referrer_id, 'referral');
  
  -- Create wallet for referred user if doesn't exist
  INSERT INTO ucoin_wallets (user_id, balance, lifetime_earned)
  VALUES (p_referred_id, v_referred_reward, v_referred_reward)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = ucoin_wallets.balance + v_referred_reward,
      lifetime_earned = ucoin_wallets.lifetime_earned + v_referred_reward;
  
  RETURN true;
END;
$$;

-- Create function to auto-complete purchase referral task
CREATE OR REPLACE FUNCTION public.process_referral_purchase(
  p_referred_id UUID,
  p_order_id UUID,
  p_order_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_purchase_reward INTEGER := 25;
BEGIN
  -- Find the referral record for this user
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_id = p_referred_id
    AND status = 'signup_completed'
    AND purchase_reward_paid = false;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update referral to purchase completed
  UPDATE referrals
  SET status = 'purchase_completed',
      purchase_reward_paid = true,
      first_purchase_amount = p_order_amount,
      first_purchase_date = now(),
      updated_at = now()
  WHERE id = v_referral.id;
  
  -- Update referral code total earned
  UPDATE user_referral_codes
  SET total_earned = total_earned + v_purchase_reward,
      updated_at = now()
  WHERE user_id = v_referral.referrer_id;
  
  -- AUTO-AWARD UCoin to referrer for purchase
  INSERT INTO ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_referral.referrer_id, v_purchase_reward, 'earn', 'referral_purchase', 'Referral purchase bonus - your referral made their first purchase', p_order_id, 'referral');
  
  UPDATE ucoin_wallets
  SET balance = balance + v_purchase_reward,
      lifetime_earned = lifetime_earned + v_purchase_reward
  WHERE user_id = v_referral.referrer_id;
  
  RETURN true;
END;
$$;