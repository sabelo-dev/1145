-- Close the client-writable "platform wallet", and apply the verified bank
-- rule to driver onboarding.
--
-- platform_wallets / wallet_transactions / gold_trades / bank_transfer_requests
-- were written by the browser: a member could set their own Rand or gold
-- balance, or record a "completed" deposit that never happened. Real money
-- lives in public.wallets + public.wallet_ledger (PayFast deposits,
-- admin-approved withdrawals), which only the server can write; the wallet
-- page now reads that. These tables become read-only for members.
--
-- Existing platform_wallets balances are left as they are (history only).
-- They were never backed by a payment and must not be moved into
-- public.wallets.

-- ------------------------------------------------------------ 1. demo wallet
DROP POLICY IF EXISTS "Users can create own wallet" ON public.platform_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.platform_wallets;
REVOKE INSERT, UPDATE, DELETE ON public.platform_wallets FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can create transactions" ON public.wallet_transactions;
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can create own gold trades" ON public.gold_trades;
REVOKE INSERT, UPDATE, DELETE ON public.gold_trades FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can manage own transfer requests" ON public.bank_transfer_requests;
DROP POLICY IF EXISTS "Users view own transfer requests" ON public.bank_transfer_requests;
CREATE POLICY "Users view own transfer requests" ON public.bank_transfer_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.bank_transfer_requests FROM anon, authenticated;

-- ------------------------------------------------------ 2. driver onboarding
-- A driver's payout account must be one linked through fintech-link-bank
-- (PayFast-verified cardholder), not typed into the form.
CREATE OR REPLACE FUNCTION public.guard_driver_bank_details()
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

  IF TG_OP = 'UPDATE'
     AND NEW.bank_name IS NOT DISTINCT FROM OLD.bank_name
     AND NEW.bank_account_last4 IS NOT DISTINCT FROM OLD.bank_account_last4 THEN
    RETURN NEW;
  END IF;
  IF NEW.bank_name IS NULL AND NEW.bank_account_last4 IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.linked_bank_accounts b
    WHERE b.user_id = NEW.user_id
      AND b.verification_status = 'verified'
      AND b.bank_name = NEW.bank_name
      AND b.account_last4 = NEW.bank_account_last4
  ) THEN
    RAISE EXCEPTION 'Add your payout account through card verification first';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_driver_bank_details() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_driver_bank_details ON public.driver_kyc;
CREATE TRIGGER guard_driver_bank_details
  BEFORE INSERT OR UPDATE ON public.driver_kyc
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_bank_details();
