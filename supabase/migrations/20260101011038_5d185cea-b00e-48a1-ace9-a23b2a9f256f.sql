
-- User referral codes table
CREATE TABLE public.user_referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Referrals tracking table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signup_completed', 'purchase_completed', 'expired')),
  signup_reward_paid BOOLEAN NOT NULL DEFAULT false,
  purchase_reward_paid BOOLEAN NOT NULL DEFAULT false,
  first_purchase_amount NUMERIC,
  first_purchase_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referral codes policies
CREATE POLICY "Users can view their own referral code" ON public.user_referral_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code" ON public.user_referral_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral code" ON public.user_referral_codes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view referral codes for validation" ON public.user_referral_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all referral codes" ON public.user_referral_codes
  FOR ALL USING (is_admin());

-- Referrals policies
CREATE POLICY "Users can view referrals they made" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view their own referral entry" ON public.referrals
  FOR SELECT USING (auth.uid() = referred_id);

CREATE POLICY "System can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update referrals" ON public.referrals
  FOR UPDATE USING (is_admin() OR auth.uid() = referrer_id);

CREATE POLICY "Admins can manage all referrals" ON public.referrals
  FOR ALL USING (is_admin());

-- Trigger for updating timestamps
CREATE TRIGGER update_user_referral_codes_updated_at
  BEFORE UPDATE ON public.user_referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to create referral code for user if not exists
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  existing_code TEXT;
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Check if user already has a code
  SELECT code INTO existing_code FROM public.user_referral_codes WHERE user_id = p_user_id;
  
  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;
  
  -- Generate unique code with retry logic
  LOOP
    new_code := public.generate_referral_code();
    attempts := attempts + 1;
    
    BEGIN
      INSERT INTO public.user_referral_codes (user_id, code)
      VALUES (p_user_id, new_code);
      RETURN new_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= 10 THEN
        RAISE EXCEPTION 'Could not generate unique referral code after 10 attempts';
      END IF;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process referral signup
CREATE OR REPLACE FUNCTION public.process_referral_signup(p_referred_id UUID, p_referral_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_referral_id UUID;
BEGIN
  -- Get the referrer
  SELECT user_id INTO v_referrer_id 
  FROM public.user_referral_codes 
  WHERE code = UPPER(p_referral_code) AND is_active = true;
  
  IF v_referrer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Don't allow self-referral
  IF v_referrer_id = p_referred_id THEN
    RETURN false;
  END IF;
  
  -- Check if user was already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
    RETURN false;
  END IF;
  
  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referred_id, referral_code, status)
  VALUES (v_referrer_id, p_referred_id, UPPER(p_referral_code), 'signup_completed')
  RETURNING id INTO v_referral_id;
  
  -- Update uses count
  UPDATE public.user_referral_codes 
  SET uses_count = uses_count + 1
  WHERE user_id = v_referrer_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
