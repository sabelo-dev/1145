-- Security hardening: privilege escalation, wallet RPCs, KYC self-approval,
-- and client-forged payment state on orders / auctions / auction registrations.
--
-- The guard triggers below only constrain direct API writes. They check
-- current_user, which is 'authenticated'/'anon' for PostgREST requests but is
-- the function owner inside SECURITY DEFINER functions and 'service_role' for
-- edge functions, so trusted server-side paths are unaffected.

-- ---------------------------------------------------------------------------
-- 1. Signup must never grant admin from user-controlled metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
BEGIN
  -- Only self-service roles are accepted here. Admins are granted manually.
  user_role := CASE NEW.raw_user_meta_data ->> 'role'
    WHEN 'vendor' THEN 'vendor'::app_role
    WHEN 'driver' THEN 'driver'::app_role
    WHEN 'influencer' THEN 'influencer'::app_role
    ELSE 'consumer'::app_role
  END;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    user_role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wallet mutation RPCs are server-only (edge functions use service_role).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_1145_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_1145_wallet(uuid) TO service_role;

-- Users may only read their own summary (service_role has no auth.uid()).
CREATE OR REPLACE FUNCTION public.get_wallet_summary(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_wallet public.wallets; v_kyc public.kyc_profiles; v_limits public.transaction_limits;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  SELECT * INTO v_kyc FROM public.kyc_profiles WHERE user_id = p_user_id;
  SELECT * INTO v_limits FROM public.transaction_limits WHERE kyc_level = COALESCE(v_kyc.level,'none'::public.kyc_level);
  RETURN jsonb_build_object('wallet',to_jsonb(v_wallet),'kyc',to_jsonb(v_kyc),'limits',to_jsonb(v_limits));
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. KYC: users submit details; only admins / server code set review outcome.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_email_confirmed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL);
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_email_confirmed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email_confirmed() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_kyc_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Every client submission goes back to review.
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;

  IF TG_OP = 'INSERT' THEN
    IF NEW.level NOT IN ('none', 'basic') THEN
      NEW.level := 'basic';
    END IF;
    NEW.mobile_verified := false;
    NEW.liveness_passed := false;
    NEW.rejection_reason := NULL;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.level := OLD.level;
    NEW.mobile_verified := OLD.mobile_verified;
    NEW.liveness_passed := OLD.liveness_passed;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;

  NEW.email_verified := public.current_user_email_confirmed();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_kyc_client_writes ON public.kyc_profiles;
CREATE TRIGGER trg_guard_kyc_client_writes
  BEFORE INSERT OR UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_client_writes();

-- ---------------------------------------------------------------------------
-- 4. Orders: payment state and money fields are server-controlled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.status := 'pending';
    NEW.ucoin_spent := 0;
    NEW.ucoin_value_zar := 0;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.total := OLD.total;
    NEW.payment_status := OLD.payment_status;
    NEW.ucoin_spent := OLD.ucoin_spent;
    NEW.ucoin_value_zar := OLD.ucoin_value_zar;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_order_client_writes ON public.orders;
CREATE TRIGGER trg_guard_order_client_writes
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_client_writes();

-- ---------------------------------------------------------------------------
-- 5. Auction registrations: deposit amount and payment come from the server.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_auction_registration_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.is_winner := false;
    NEW.deposit_applied := false;
    NEW.registration_fee_paid := COALESCE(
      (SELECT a.registration_fee FROM public.auctions a WHERE a.id = NEW.auction_id), 0);
  ELSE
    NEW.auction_id := OLD.auction_id;
    NEW.user_id := OLD.user_id;
    NEW.payment_status := OLD.payment_status;
    NEW.is_winner := OLD.is_winner;
    NEW.deposit_applied := OLD.deposit_applied;
    NEW.registration_fee_paid := OLD.registration_fee_paid;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_auction_registration_client_writes ON public.auction_registrations;
CREATE TRIGGER trg_guard_auction_registration_client_writes
  BEFORE INSERT OR UPDATE ON public.auction_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_auction_registration_client_writes();

-- ---------------------------------------------------------------------------
-- 6. Auctions: only admins / server code settle an auction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_auction_settlement_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.winner_id := OLD.winner_id;
  NEW.winning_bid := OLD.winning_bid;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('sold', 'completed', 'unsold') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_auction_settlement_client_writes ON public.auctions;
CREATE TRIGGER trg_guard_auction_settlement_client_writes
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.guard_auction_settlement_client_writes();
