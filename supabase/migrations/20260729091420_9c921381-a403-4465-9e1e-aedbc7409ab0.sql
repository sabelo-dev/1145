
DO $$ BEGIN CREATE TYPE public.wallet_bucket AS ENUM ('available','pending','withdrawal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ledger_direction AS ENUM ('credit','debit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ledger_type AS ENUM ('deposit','purchase','refund','vendor_payout','driver_earning','influencer_commission','referral_reward','subscription','withdrawal_request','withdrawal_completed','reversal','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.kyc_level AS ENUM ('none','basic','enhanced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  withdrawal_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_self_select" ON public.wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  direction public.ledger_direction NOT NULL,
  bucket public.wallet_bucket NOT NULL DEFAULT 'available',
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  type public.ledger_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  provider TEXT,
  provider_reference TEXT,
  bank_reference TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  balance_after NUMERIC(18,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON public.wallet_ledger(user_id, created_at DESC);
GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_self_select" ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.wallet_ledger_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'wallet_ledger is append-only'; END; $$;
DROP TRIGGER IF EXISTS wallet_ledger_no_update ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_update BEFORE UPDATE OR DELETE ON public.wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION public.wallet_ledger_immutable();

CREATE TABLE IF NOT EXISTS public.payment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'payfast',
  provider_token TEXT NOT NULL,
  brand TEXT, last4 TEXT, exp_month INT, exp_year INT, holder_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed','expired')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_token)
);
GRANT SELECT ON public.payment_instruments TO authenticated;
GRANT ALL ON public.payment_instruments TO service_role;
ALTER TABLE public.payment_instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_self" ON public.payment_instruments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.linked_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_account_ref TEXT,
  bank_name TEXT NOT NULL,
  account_last4 TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'checking',
  branch_code TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','failed','removed')),
  verified_at TIMESTAMPTZ, verified_by UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.linked_bank_accounts TO authenticated;
GRANT ALL ON public.linked_bank_accounts TO service_role;
ALTER TABLE public.linked_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_self" ON public.linked_bank_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.linked_bank_accounts(id),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','completed','rejected','failed','cancelled')),
  fraud_score NUMERIC(5,2), reviewer_id UUID, reviewed_at TIMESTAMPTZ,
  provider_reference TEXT, rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_self" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE IF NOT EXISTS public.kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  legal_name TEXT, dob DATE, id_number_hash TEXT, id_document_ref TEXT,
  address_line1 TEXT, address_line2 TEXT, city TEXT, province TEXT, postal_code TEXT, country TEXT DEFAULT 'ZA',
  mobile_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  selfie_ref TEXT, liveness_passed BOOLEAN NOT NULL DEFAULT false,
  level public.kyc_level NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID, reviewed_at TIMESTAMPTZ, rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_profiles TO authenticated;
GRANT ALL ON public.kyc_profiles TO service_role;
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_self_read" ON public.kyc_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "kyc_self_insert" ON public.kyc_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "kyc_self_update" ON public.kyc_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status <> 'approved')
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.fintech_fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT, device_fingerprint TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fintech_fraud_events TO authenticated;
GRANT ALL ON public.fintech_fraud_events TO service_role;
ALTER TABLE public.fintech_fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_admin_only" ON public.fintech_fraud_events FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.fintech_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL, action TEXT NOT NULL,
  target_type TEXT, target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fintech_admin_audit TO authenticated;
GRANT ALL ON public.fintech_admin_audit TO service_role;
ALTER TABLE public.fintech_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_only" ON public.fintech_admin_audit FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.transaction_limits (
  kyc_level public.kyc_level PRIMARY KEY,
  daily_deposit NUMERIC(18,2) NOT NULL,
  daily_withdrawal NUMERIC(18,2) NOT NULL,
  single_withdrawal_max NUMERIC(18,2) NOT NULL,
  monthly_withdrawal NUMERIC(18,2) NOT NULL
);
GRANT SELECT ON public.transaction_limits TO authenticated, anon;
GRANT ALL ON public.transaction_limits TO service_role;
ALTER TABLE public.transaction_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limits_public_read" ON public.transaction_limits FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.transaction_limits VALUES
  ('none',     1000,      0,      0,      0),
  ('basic',    25000,  5000,  5000,  25000),
  ('enhanced', 250000, 50000, 25000, 500000)
ON CONFLICT (kyc_level) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_or_create_1145_wallet(p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.wallets WHERE user_id = p_user_id;
  IF v_id IS NULL THEN
    INSERT INTO public.wallets(user_id) VALUES (p_user_id) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id UUID, p_bucket public.wallet_bucket, p_amount NUMERIC,
  p_type public.ledger_type, p_provider TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL, p_related_type TEXT DEFAULT NULL,
  p_related_id TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet UUID; v_new NUMERIC; v_ledger UUID;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  v_wallet := public.get_or_create_1145_wallet(p_user_id);
  UPDATE public.wallets SET
    available_balance = CASE WHEN p_bucket='available' THEN available_balance + p_amount ELSE available_balance END,
    pending_balance   = CASE WHEN p_bucket='pending'   THEN pending_balance   + p_amount ELSE pending_balance END,
    withdrawal_balance= CASE WHEN p_bucket='withdrawal'THEN withdrawal_balance+ p_amount ELSE withdrawal_balance END,
    updated_at = now()
  WHERE id = v_wallet
  RETURNING CASE p_bucket WHEN 'available' THEN available_balance WHEN 'pending' THEN pending_balance ELSE withdrawal_balance END INTO v_new;
  INSERT INTO public.wallet_ledger(wallet_id,user_id,direction,bucket,amount,type,provider,provider_reference,related_entity_type,related_entity_id,balance_after,metadata)
  VALUES (v_wallet,p_user_id,'credit',p_bucket,p_amount,p_type,p_provider,p_provider_reference,p_related_type,p_related_id,v_new,p_metadata)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END; $$;

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id UUID, p_bucket public.wallet_bucket, p_amount NUMERIC,
  p_type public.ledger_type, p_provider TEXT DEFAULT NULL,
  p_provider_reference TEXT DEFAULT NULL, p_related_type TEXT DEFAULT NULL,
  p_related_id TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet UUID; v_new NUMERIC; v_current NUMERIC; v_ledger UUID; v_status TEXT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  v_wallet := public.get_or_create_1145_wallet(p_user_id);
  SELECT status, CASE p_bucket WHEN 'available' THEN available_balance WHEN 'pending' THEN pending_balance ELSE withdrawal_balance END
    INTO v_status, v_current FROM public.wallets WHERE id = v_wallet FOR UPDATE;
  IF v_status <> 'active' THEN RAISE EXCEPTION 'wallet is %', v_status; END IF;
  IF v_current < p_amount THEN RAISE EXCEPTION 'insufficient funds'; END IF;
  UPDATE public.wallets SET
    available_balance = CASE WHEN p_bucket='available' THEN available_balance - p_amount ELSE available_balance END,
    pending_balance   = CASE WHEN p_bucket='pending'   THEN pending_balance   - p_amount ELSE pending_balance END,
    withdrawal_balance= CASE WHEN p_bucket='withdrawal'THEN withdrawal_balance- p_amount ELSE withdrawal_balance END,
    updated_at = now()
  WHERE id = v_wallet
  RETURNING CASE p_bucket WHEN 'available' THEN available_balance WHEN 'pending' THEN pending_balance ELSE withdrawal_balance END INTO v_new;
  INSERT INTO public.wallet_ledger(wallet_id,user_id,direction,bucket,amount,type,provider,provider_reference,related_entity_type,related_entity_id,balance_after,metadata)
  VALUES (v_wallet,p_user_id,'debit',p_bucket,p_amount,p_type,p_provider,p_provider_reference,p_related_type,p_related_id,v_new,p_metadata)
  RETURNING id INTO v_ledger;
  RETURN v_ledger;
END; $$;

CREATE OR REPLACE FUNCTION public.get_wallet_summary(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_wallet public.wallets; v_kyc public.kyc_profiles; v_limits public.transaction_limits;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  SELECT * INTO v_kyc FROM public.kyc_profiles WHERE user_id = p_user_id;
  SELECT * INTO v_limits FROM public.transaction_limits WHERE kyc_level = COALESCE(v_kyc.level,'none'::public.kyc_level);
  RETURN jsonb_build_object('wallet',to_jsonb(v_wallet),'kyc',to_jsonb(v_kyc),'limits',to_jsonb(v_limits));
END; $$;

CREATE OR REPLACE FUNCTION public.autocreate_wallet_on_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.get_or_create_1145_wallet(NEW.id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_autocreate_wallet ON public.profiles;
CREATE TRIGGER trg_autocreate_wallet AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.autocreate_wallet_on_profile();

INSERT INTO public.wallets (user_id)
SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.wallets);

DROP TRIGGER IF EXISTS trg_wallets_updated ON public.wallets;
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_kyc_updated ON public.kyc_profiles;
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_wd_updated ON public.withdrawal_requests;
CREATE TRIGGER trg_wd_updated BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "kyc_docs_owner_rw" ON storage.objects;
CREATE POLICY "kyc_docs_owner_rw" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "kyc_docs_admin_read" ON storage.objects;
CREATE POLICY "kyc_docs_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_admin());
