-- UCoin Gold-Backed P2P Transfer System
-- 1 UCoin = 1 mg of gold (mgAu)

-- Add transfer-related columns to ucoin_transactions
ALTER TABLE public.ucoin_transactions 
ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS transfer_fee_mg numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS transfer_reference text;

-- Create transfer limits table
CREATE TABLE IF NOT EXISTS public.ucoin_transfer_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tier text NOT NULL DEFAULT 'standard',
  daily_limit_mg numeric NOT NULL DEFAULT 10000, -- 10g daily
  monthly_limit_mg numeric NOT NULL DEFAULT 100000, -- 100g monthly
  single_transfer_max_mg numeric NOT NULL DEFAULT 5000, -- 5g per transfer
  min_transfer_mg numeric NOT NULL DEFAULT 1, -- 1 mg minimum
  requires_2fa_above_mg numeric NOT NULL DEFAULT 1000, -- 2FA above 1g
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default transfer limits
INSERT INTO public.ucoin_transfer_limits (user_tier, daily_limit_mg, monthly_limit_mg, single_transfer_max_mg, min_transfer_mg, requires_2fa_above_mg)
VALUES 
  ('standard', 10000, 100000, 5000, 1, 1000),
  ('premium', 50000, 500000, 25000, 1, 5000),
  ('verified', 100000, 1000000, 50000, 1, 10000)
ON CONFLICT DO NOTHING;

-- Create transfer history table for tracking daily/monthly usage
CREATE TABLE IF NOT EXISTS public.ucoin_transfer_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  transfer_date date NOT NULL DEFAULT CURRENT_DATE,
  daily_transferred_mg numeric NOT NULL DEFAULT 0,
  monthly_transferred_mg numeric NOT NULL DEFAULT 0,
  transfer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, transfer_date)
);

-- Create user transfer settings
CREATE TABLE IF NOT EXISTS public.ucoin_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  user_tier text NOT NULL DEFAULT 'standard',
  is_transfer_enabled boolean NOT NULL DEFAULT true,
  requires_2fa boolean NOT NULL DEFAULT false,
  display_mode text NOT NULL DEFAULT 'ucoin' CHECK (display_mode IN ('ucoin', 'gold', 'currency')),
  preferred_gold_unit text NOT NULL DEFAULT 'mg' CHECK (preferred_gold_unit IN ('mg', 'g', 'oz')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create velocity tracking table for anti-fraud
CREATE TABLE IF NOT EXISTS public.ucoin_velocity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  action_type text NOT NULL, -- 'transfer_sent', 'transfer_received'
  amount_mg numeric NOT NULL,
  counterparty_id uuid REFERENCES auth.users(id),
  ip_address text,
  device_fingerprint text,
  is_flagged boolean NOT NULL DEFAULT false,
  flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for velocity checks
CREATE INDEX IF NOT EXISTS idx_ucoin_velocity_user_time ON public.ucoin_velocity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucoin_transfer_usage_user ON public.ucoin_transfer_usage(user_id, transfer_date);

-- Function to get user's transfer limits
CREATE OR REPLACE FUNCTION public.get_user_transfer_limits(p_user_id uuid)
RETURNS TABLE (
  daily_limit_mg numeric,
  monthly_limit_mg numeric,
  single_transfer_max_mg numeric,
  min_transfer_mg numeric,
  requires_2fa_above_mg numeric,
  daily_used_mg numeric,
  monthly_used_mg numeric,
  remaining_daily_mg numeric,
  remaining_monthly_mg numeric
) 
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_tier text;
  v_limits record;
  v_daily_used numeric := 0;
  v_monthly_used numeric := 0;
BEGIN
  -- Get user tier
  SELECT COALESCE(user_tier, 'standard') INTO v_user_tier
  FROM ucoin_user_settings WHERE user_id = p_user_id;
  
  IF v_user_tier IS NULL THEN
    v_user_tier := 'standard';
  END IF;
  
  -- Get tier limits
  SELECT * INTO v_limits
  FROM ucoin_transfer_limits WHERE user_tier = v_user_tier;
  
  IF NOT FOUND THEN
    SELECT * INTO v_limits FROM ucoin_transfer_limits WHERE user_tier = 'standard';
  END IF;
  
  -- Get daily usage
  SELECT COALESCE(SUM(daily_transferred_mg), 0) INTO v_daily_used
  FROM ucoin_transfer_usage
  WHERE user_id = p_user_id AND transfer_date = CURRENT_DATE;
  
  -- Get monthly usage
  SELECT COALESCE(SUM(daily_transferred_mg), 0) INTO v_monthly_used
  FROM ucoin_transfer_usage
  WHERE user_id = p_user_id 
    AND transfer_date >= date_trunc('month', CURRENT_DATE);
  
  RETURN QUERY SELECT
    v_limits.daily_limit_mg,
    v_limits.monthly_limit_mg,
    v_limits.single_transfer_max_mg,
    v_limits.min_transfer_mg,
    v_limits.requires_2fa_above_mg,
    v_daily_used,
    v_monthly_used,
    GREATEST(v_limits.daily_limit_mg - v_daily_used, 0),
    GREATEST(v_limits.monthly_limit_mg - v_monthly_used, 0);
END;
$$;

-- Main P2P transfer function
CREATE OR REPLACE FUNCTION public.transfer_ucoin(
  p_sender_id uuid,
  p_recipient_identifier text, -- username, phone, or user_id
  p_amount_mg numeric,
  p_note text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_wallet record;
  v_recipient_wallet record;
  v_limits record;
  v_transfer_ref text;
  v_fee_mg numeric := 0;
  v_net_amount numeric;
BEGIN
  -- Validate amount
  IF p_amount_mg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Find recipient by identifier (try UUID first, then lookup)
  BEGIN
    v_recipient_id := p_recipient_identifier::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Not a UUID, try to find by username/phone in profiles or other tables
    -- For now, we'll require UUID - can be extended later
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END;
  
  -- Cannot send to self
  IF p_sender_id = v_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;
  
  -- Get sender wallet with lock
  SELECT * INTO v_sender_wallet
  FROM ucoin_wallets WHERE user_id = p_sender_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  -- Get recipient wallet (create if not exists)
  SELECT * INTO v_recipient_wallet
  FROM ucoin_wallets WHERE user_id = v_recipient_id FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO ucoin_wallets (user_id, balance, lifetime_earned, lifetime_spent)
    VALUES (v_recipient_id, 0, 0, 0)
    RETURNING * INTO v_recipient_wallet;
  END IF;
  
  -- Get transfer limits
  SELECT * INTO v_limits FROM get_user_transfer_limits(p_sender_id);
  
  -- Validate against limits
  IF p_amount_mg < v_limits.min_transfer_mg THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Minimum transfer is ' || v_limits.min_transfer_mg || ' UCoin');
  END IF;
  
  IF p_amount_mg > v_limits.single_transfer_max_mg THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Maximum single transfer is ' || v_limits.single_transfer_max_mg || ' UCoin');
  END IF;
  
  IF p_amount_mg > v_limits.remaining_daily_mg THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Daily transfer limit exceeded. Remaining: ' || v_limits.remaining_daily_mg || ' UCoin');
  END IF;
  
  IF p_amount_mg > v_limits.remaining_monthly_mg THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Monthly transfer limit exceeded');
  END IF;
  
  -- Check sufficient balance
  v_net_amount := p_amount_mg + v_fee_mg;
  IF v_sender_wallet.balance < v_net_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Generate transfer reference
  v_transfer_ref := 'TXN-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8);
  
  -- Perform atomic transfer
  -- Debit sender
  UPDATE ucoin_wallets 
  SET 
    balance = balance - v_net_amount,
    lifetime_spent = lifetime_spent + v_net_amount,
    updated_at = now()
  WHERE user_id = p_sender_id;
  
  -- Credit recipient
  UPDATE ucoin_wallets 
  SET 
    balance = balance + p_amount_mg,
    lifetime_earned = lifetime_earned + p_amount_mg,
    updated_at = now()
  WHERE user_id = v_recipient_id;
  
  -- Record sender transaction
  INSERT INTO ucoin_transactions (
    user_id, amount, type, category, description, 
    sender_id, recipient_id, transfer_fee_mg, transfer_reference
  ) VALUES (
    p_sender_id, v_net_amount, 'spend', 'p2p_transfer_sent',
    COALESCE(p_note, 'UCoin transfer sent'),
    p_sender_id, v_recipient_id, v_fee_mg, v_transfer_ref
  );
  
  -- Record recipient transaction
  INSERT INTO ucoin_transactions (
    user_id, amount, type, category, description,
    sender_id, recipient_id, transfer_reference
  ) VALUES (
    v_recipient_id, p_amount_mg, 'earn', 'p2p_transfer_received',
    COALESCE(p_note, 'UCoin transfer received'),
    p_sender_id, v_recipient_id, v_transfer_ref
  );
  
  -- Update transfer usage
  INSERT INTO ucoin_transfer_usage (user_id, transfer_date, daily_transferred_mg, transfer_count)
  VALUES (p_sender_id, CURRENT_DATE, p_amount_mg, 1)
  ON CONFLICT (user_id, transfer_date) 
  DO UPDATE SET 
    daily_transferred_mg = ucoin_transfer_usage.daily_transferred_mg + p_amount_mg,
    transfer_count = ucoin_transfer_usage.transfer_count + 1,
    updated_at = now();
  
  -- Log velocity for anti-fraud
  INSERT INTO ucoin_velocity_log (user_id, action_type, amount_mg, counterparty_id, ip_address, device_fingerprint)
  VALUES (p_sender_id, 'transfer_sent', p_amount_mg, v_recipient_id, p_ip_address, p_device_fingerprint);
  
  INSERT INTO ucoin_velocity_log (user_id, action_type, amount_mg, counterparty_id)
  VALUES (v_recipient_id, 'transfer_received', p_amount_mg, p_sender_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'transfer_reference', v_transfer_ref,
    'amount', p_amount_mg,
    'fee', v_fee_mg,
    'sender_new_balance', v_sender_wallet.balance - v_net_amount,
    'recipient_id', v_recipient_id
  );
END;
$$;

-- Function to get user's transfer history
CREATE OR REPLACE FUNCTION public.get_ucoin_transfers(
  p_user_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  amount numeric,
  type text,
  direction text,
  counterparty_id uuid,
  transfer_reference text,
  note text,
  fee_mg numeric,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.amount,
    t.type,
    CASE 
      WHEN t.category = 'p2p_transfer_sent' THEN 'sent'
      WHEN t.category = 'p2p_transfer_received' THEN 'received'
      ELSE 'other'
    END as direction,
    CASE 
      WHEN t.sender_id = p_user_id THEN t.recipient_id
      ELSE t.sender_id
    END as counterparty_id,
    t.transfer_reference,
    t.description as note,
    COALESCE(t.transfer_fee_mg, 0) as fee_mg,
    t.created_at
  FROM ucoin_transactions t
  WHERE t.user_id = p_user_id
    AND t.category IN ('p2p_transfer_sent', 'p2p_transfer_received')
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

-- RLS Policies
ALTER TABLE public.ucoin_transfer_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucoin_transfer_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucoin_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucoin_velocity_log ENABLE ROW LEVEL SECURITY;

-- Transfer limits are readable by all authenticated users
CREATE POLICY "Transfer limits readable by authenticated" ON public.ucoin_transfer_limits
  FOR SELECT TO authenticated USING (true);

-- Users can only see their own usage
CREATE POLICY "Users view own transfer usage" ON public.ucoin_transfer_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Users can only see/modify their own settings
CREATE POLICY "Users view own settings" ON public.ucoin_user_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own settings" ON public.ucoin_user_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own settings" ON public.ucoin_user_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Velocity log - users can only see their own
CREATE POLICY "Users view own velocity log" ON public.ucoin_velocity_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);