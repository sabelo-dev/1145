-- Update process_referral_signup to fully automate referral rewards
-- No proof URL required - the referral code usage IS the proof

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
  v_referral_code_id UUID;
  v_existing_referral UUID;
  v_referral_id UUID;
  v_referrer_reward INTEGER := 50;  -- UCoin for referrer
  v_referred_reward INTEGER := 25;  -- UCoin for new user
BEGIN
  -- Validate referral code exists and is active
  SELECT id, user_id INTO v_referral_code_id, v_referrer_id
  FROM user_referral_codes
  WHERE code = UPPER(p_referral_code) AND is_active = true;
  
  IF v_referrer_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Can't refer yourself
  IF v_referrer_id = p_referred_id THEN
    RETURN FALSE;
  END IF;
  
  -- Check if this user was already referred (can only use one referral code ever)
  SELECT id INTO v_existing_referral
  FROM referrals
  WHERE referred_id = p_referred_id;
  
  IF v_existing_referral IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Create referral record with signup completed and reward paid
  INSERT INTO referrals (
    referrer_id, 
    referred_id, 
    referral_code, 
    status, 
    signup_reward_paid
  ) VALUES (
    v_referrer_id, 
    p_referred_id, 
    UPPER(p_referral_code), 
    'signup_completed',
    true
  ) RETURNING id INTO v_referral_id;
  
  -- Increment uses count on the referral code
  UPDATE user_referral_codes
  SET uses_count = uses_count + 1,
      total_earned = total_earned + v_referrer_reward,
      updated_at = now()
  WHERE id = v_referral_code_id;
  
  -- ===== AUTO-AWARD UCOIN TO REFERRER =====
  -- Create wallet if not exists
  INSERT INTO ucoin_wallets (user_id, balance, lifetime_earned)
  VALUES (v_referrer_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create transaction for referrer
  INSERT INTO ucoin_transactions (
    user_id, amount, type, category, description, reference_id, reference_type
  ) VALUES (
    v_referrer_id, 
    v_referrer_reward, 
    'earn', 
    'referral_signup', 
    'Referral signup bonus - new user joined with your code',
    v_referral_id::text,
    'referral'
  );
  
  -- Update referrer wallet
  UPDATE ucoin_wallets
  SET balance = balance + v_referrer_reward,
      lifetime_earned = lifetime_earned + v_referrer_reward,
      updated_at = now()
  WHERE user_id = v_referrer_id;
  
  -- ===== AUTO-AWARD UCOIN TO NEW USER =====
  -- Create wallet if not exists
  INSERT INTO ucoin_wallets (user_id, balance, lifetime_earned)
  VALUES (p_referred_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create transaction for new user
  INSERT INTO ucoin_transactions (
    user_id, amount, type, category, description, reference_id, reference_type
  ) VALUES (
    p_referred_id, 
    v_referred_reward, 
    'earn', 
    'referral_welcome', 
    'Welcome bonus - joined using a referral code',
    v_referral_id::text,
    'referral'
  );
  
  -- Update new user wallet
  UPDATE ucoin_wallets
  SET balance = balance + v_referred_reward,
      lifetime_earned = lifetime_earned + v_referred_reward,
      updated_at = now()
  WHERE user_id = p_referred_id;
  
  RETURN TRUE;
END;
$$;

-- Create trigger to auto-generate referral code for new users
CREATE OR REPLACE FUNCTION public.auto_create_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN := TRUE;
BEGIN
  -- Generate unique code
  WHILE v_exists LOOP
    v_code := UPPER(SUBSTRING(MD5(NEW.id::text || random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM user_referral_codes WHERE code = v_code) INTO v_exists;
  END LOOP;
  
  -- Create referral code for the new user
  INSERT INTO user_referral_codes (user_id, code, is_active)
  VALUES (NEW.id, v_code, true)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_profile_created_create_referral_code ON profiles;
CREATE TRIGGER on_profile_created_create_referral_code
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_referral_code();

-- Also create referral codes for existing users who don't have one
INSERT INTO user_referral_codes (user_id, code, is_active)
SELECT 
  p.id,
  UPPER(SUBSTRING(MD5(p.id::text || random()::text || clock_timestamp()::text) FROM 1 FOR 8)),
  true
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_referral_codes urc WHERE urc.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Add referral_welcome to earning rules if not exists
INSERT INTO ucoin_earning_rules (category, amount, description, is_active, multiplier)
VALUES ('referral_welcome', 25, 'Welcome bonus for joining with a referral code', true, 1.0)
ON CONFLICT DO NOTHING;