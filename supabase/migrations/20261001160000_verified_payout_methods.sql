-- Payout bank details are only accepted once verified.
--
--  * A merchant's bank account is written by the vendor-payout-method edge
--    function, and only after (1) the merchant has a card verified through
--    PayFast (payment_instruments) and (2) the bank confirmed the account
--    number and holder through the account verification provider.
--  * Merchants can no longer insert or edit vendor_payment_methods directly.
--  * Rows saved before this migration stay unverified (verified_at IS NULL)
--    until the merchant re-enters them; payouts need a verified row.

ALTER TABLE public.vendor_payment_methods
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_provider text,
  ADD COLUMN IF NOT EXISTS verification_message text,
  ADD COLUMN IF NOT EXISTS card_instrument_id uuid REFERENCES public.payment_instruments(id) ON DELETE SET NULL;

-- Read (and remove) only; writes go through the edge function.
DROP POLICY IF EXISTS "Vendors can manage their payment methods" ON public.vendor_payment_methods;
DROP POLICY IF EXISTS "Vendors can view their payment methods" ON public.vendor_payment_methods;
DROP POLICY IF EXISTS "Vendors can remove their payment methods" ON public.vendor_payment_methods;

CREATE POLICY "Vendors can view their payment methods" ON public.vendor_payment_methods
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_payment_methods.vendor_id AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can remove their payment methods" ON public.vendor_payment_methods
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_payment_methods.vendor_id AND v.user_id = auth.uid()
    )
  );

REVOKE INSERT, UPDATE ON public.vendor_payment_methods FROM anon, authenticated;
GRANT SELECT, DELETE ON public.vendor_payment_methods TO authenticated;
GRANT ALL ON public.vendor_payment_methods TO service_role;

-- A payout can only be requested to a verified bank account.
CREATE OR REPLACE FUNCTION public.require_verified_payout_method()
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

  IF NOT EXISTS (
    SELECT 1 FROM public.vendor_payment_methods m
    WHERE m.vendor_id = NEW.vendor_id AND m.is_default AND m.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Add a verified bank account before requesting a payout';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_verified_payout_method() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS require_verified_payout_method ON public.payouts;
CREATE TRIGGER require_verified_payout_method
  BEFORE INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.require_verified_payout_method();
