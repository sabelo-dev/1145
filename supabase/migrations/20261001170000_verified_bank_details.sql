-- The payout rule (20261001160000) for the other places bank details are
-- entered: the member wallet and merchant onboarding.
--
-- A bank account is only accepted from a user with a card verified through
-- PayFast, and only the edge functions (fintech-link-bank,
-- vendor-payout-method) may write it.
--
--  * user_linked_bank_accounts: members can no longer insert rows or mark
--    them verified. Rows added before this migration were self-declared
--    ("auto-verified"), so they become unverified until linked again.
--  * Bank transfers and UCoin cash-outs need a verified account.
--  * vendor_financial_details: merchants can no longer set the bank columns.

-- ---------------------------------------------------------------- 1. wallet
ALTER TABLE public.user_linked_bank_accounts
  ADD COLUMN IF NOT EXISTS verification_provider text;

UPDATE public.user_linked_bank_accounts
   SET is_verified = false, verified_at = NULL
 WHERE verification_provider IS NULL AND is_verified;

-- The app used to store base64(account number) as the "hash", which is the
-- full number in a readable form. Replace it with a real SHA-256.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id, account_number_hash FROM public.user_linked_bank_accounts
     WHERE verification_provider IS NULL AND length(account_number_hash) < 64
  LOOP
    BEGIN
      UPDATE public.user_linked_bank_accounts
         SET account_number_hash = encode(sha256(decode(r.account_number_hash, 'base64')), 'hex')
       WHERE id = r.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.user_linked_bank_accounts
         SET account_number_hash = encode(sha256(convert_to(r.account_number_hash, 'UTF8')), 'hex')
       WHERE id = r.id;
    END;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users can manage own bank accounts" ON public.user_linked_bank_accounts;
DROP POLICY IF EXISTS "Users view own bank accounts" ON public.user_linked_bank_accounts;
DROP POLICY IF EXISTS "Users choose own default bank account" ON public.user_linked_bank_accounts;
DROP POLICY IF EXISTS "Users remove own bank accounts" ON public.user_linked_bank_accounts;

CREATE POLICY "Users view own bank accounts" ON public.user_linked_bank_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users choose own default bank account" ON public.user_linked_bank_accounts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own bank accounts" ON public.user_linked_bank_accounts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Members may only change which account is the default.
REVOKE INSERT, UPDATE ON public.user_linked_bank_accounts FROM anon, authenticated;
GRANT SELECT, DELETE ON public.user_linked_bank_accounts TO authenticated;
GRANT UPDATE (is_default) ON public.user_linked_bank_accounts TO authenticated;
GRANT ALL ON public.user_linked_bank_accounts TO service_role;

-- A bank transfer needs the member's own, verified account.
CREATE OR REPLACE FUNCTION public.require_verified_transfer_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_linked_bank_accounts a
    WHERE a.id = NEW.bank_account_id AND a.user_id = NEW.user_id AND a.is_verified
  ) THEN
    RAISE EXCEPTION 'Link a verified bank account before making a bank transfer';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_verified_transfer_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS require_verified_transfer_account ON public.bank_transfer_requests;
CREATE TRIGGER require_verified_transfer_account
  BEFORE INSERT ON public.bank_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_transfer_account();

-- UCoin cash-out: same as before, plus the account must be verified.
CREATE OR REPLACE FUNCTION public.request_ucoin_cashout_to_bank(p_ucoin integer, p_bank_account_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance integer;
  v_acct record;
  v_zar numeric;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be signed in.');
  END IF;
  IF p_ucoin IS NULL OR p_ucoin < 500 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal is 500 UCoin.');
  END IF;

  SELECT * INTO v_acct FROM public.user_linked_bank_accounts
   WHERE id = p_bank_account_id AND user_id = v_user;
  IF v_acct IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'That bank account is not linked to your profile.');
  END IF;
  IF NOT COALESCE(v_acct.is_verified, false) THEN
    RETURN json_build_object('success', false, 'error', 'That bank account is not verified. Remove it and link it again.');
  END IF;

  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_ucoin THEN
    RETURN json_build_object('success', false, 'error', 'Not enough UCoin in your wallet.');
  END IF;

  v_zar := round(p_ucoin * 0.10, 2);

  UPDATE public.ucoin_wallets
     SET balance = balance - p_ucoin,
         lifetime_spent = COALESCE(lifetime_spent, 0) + p_ucoin
   WHERE user_id = v_user;

  INSERT INTO public.ucoin_cashouts (user_id, ucoin_amount, zar_amount, status, destination, bank_account_id)
  VALUES (v_user, p_ucoin, v_zar, 'pending',
          COALESCE(v_acct.bank_name, 'Bank') || ' ' || COALESCE(v_acct.account_number_masked, ''),
          p_bank_account_id)
  RETURNING id INTO v_id;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_user, p_ucoin, 'spend', 'cashout', 'Withdrawal to bank account', v_id, 'ucoin_cashout');

  RETURN json_build_object('success', true, 'cashout_id', v_id, 'zar_amount', v_zar);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_ucoin_cashout_to_bank(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_ucoin_cashout_to_bank(integer, uuid) TO authenticated;

-- ------------------------------------------------------ 2. merchant onboarding
-- Merchants still fill in tax and contact details here, but the bank columns
-- are written by vendor-payout-method only.
CREATE OR REPLACE FUNCTION public.guard_vendor_bank_details()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin tools and server-side jobs are not restricted.
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') <> 'authenticated'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_account_holder IS NOT NULL OR NEW.bank_account_number IS NOT NULL OR NEW.bank_routing_code IS NOT NULL THEN
      RAISE EXCEPTION 'Bank details must be added through bank verification';
    END IF;
  ELSIF NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
     OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
     OR NEW.bank_routing_code IS DISTINCT FROM OLD.bank_routing_code THEN
    RAISE EXCEPTION 'Bank details must be changed through bank verification';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_vendor_bank_details() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_vendor_bank_details ON public.vendor_financial_details;
CREATE TRIGGER guard_vendor_bank_details
  BEFORE INSERT OR UPDATE ON public.vendor_financial_details
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_bank_details();
