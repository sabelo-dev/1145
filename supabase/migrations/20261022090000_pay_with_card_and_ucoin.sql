-- 1145 Pay: pay a request with a saved card or with UCoin.
--
-- Until now a 1145 Pay request could only be paid on PayFast's checkout page.
-- A signed-in 1145 member can now also pay it:
--   * with a card they saved in their 1145 Wallet (a PayFast token). The
--     merchant-payment-request function charges the token server-to-server;
--     the browser never sees the token and never decides the outcome;
--   * with UCoin, at the platform rate of R0.10 per UCoin (as for orders),
--     entirely inside this database transaction.
--
-- Safety rules:
--   * One payment at a time per request: merchant_payment_attempts allows a
--     single attempt that is processing, succeeded or needs review. A card
--     charge whose outcome is unknown (timeout) stays "needs_review" and blocks
--     further charges until someone checks PayFast, so a request is never
--     charged twice.
--   * The store's own owner and staff cannot pay their store's requests with
--     UCoin, which would otherwise turn UCoin into rand outside the cash-out
--     rules.
--   * Every way of paying ends in payment_request_settle(), so the event log,
--     ledger credit and merchant notification are the same for all of them.

ALTER TABLE public.merchant_payment_requests
  ADD COLUMN IF NOT EXISTS paid_with text CHECK (paid_with IN ('payfast', 'card', 'ucoin')),
  ADD COLUMN IF NOT EXISTS payer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.merchant_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.merchant_payment_requests(id) ON DELETE CASCADE,
  payer_user_id uuid NOT NULL REFERENCES auth.users(id),
  method text NOT NULL CHECK (method IN ('card', 'ucoin')),
  instrument_id uuid REFERENCES public.payment_instruments(id) ON DELETE SET NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  ucoin_spent integer,
  status text NOT NULL CHECK (status IN ('processing', 'succeeded', 'failed', 'needs_review')),
  provider_reference text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- At most one live attempt per request: this is the double-charge guard.
CREATE UNIQUE INDEX IF NOT EXISTS merchant_payment_attempts_one_live
  ON public.merchant_payment_attempts (request_id)
  WHERE status IN ('processing', 'succeeded', 'needs_review');

ALTER TABLE public.merchant_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_payment_attempts FROM anon;

DROP POLICY IF EXISTS "Payers, store finance and admins see attempts" ON public.merchant_payment_attempts;
CREATE POLICY "Payers, store finance and admins see attempts"
  ON public.merchant_payment_attempts FOR SELECT TO authenticated
  USING (payer_user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.merchant_payment_requests r
                WHERE r.id = merchant_payment_attempts.request_id
                  AND public.store_has_permission(r.store_id, 'payments', auth.uid())));

-- ---------------------------------------------------------------------------
-- Settling a payment (shared by PayFast checkout, saved cards and UCoin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_request_settle(
  p_request_id uuid, p_provider text, p_provider_event_id text, p_amount_minor integer,
  p_payload_digest text, p_paid_with text, p_payer uuid DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
  v_outcome text;
  v_owner uuid;
  v_how text;
BEGIN
  SELECT * INTO v_row FROM public.merchant_payment_requests WHERE id = p_request_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    v_outcome := 'not_found';
  ELSIF v_row.status IN ('paid', 'refund_due') THEN
    v_outcome := 'already_processed';
  ELSIF p_amount_minor <> v_row.amount_minor THEN
    v_outcome := 'amount_mismatch';
  ELSIF v_row.status = 'cancelled' THEN
    v_outcome := 'paid_after_cancellation';
  ELSE
    v_outcome := 'paid';
  END IF;

  INSERT INTO public.merchant_payment_events
    (provider, provider_event_id, request_id, event_type, amount_minor, payload_digest, outcome)
  VALUES (p_provider, p_provider_event_id, v_row.id, 'COMPLETE', p_amount_minor, p_payload_digest, v_outcome)
  ON CONFLICT (provider, provider_event_id, event_type) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'duplicate_event';
  END IF;

  IF v_outcome NOT IN ('paid', 'paid_after_cancellation') THEN
    RETURN v_outcome;
  END IF;

  UPDATE public.merchant_payment_requests
     SET status = CASE WHEN v_outcome = 'paid' THEN 'paid' ELSE 'refund_due' END,
         provider_reference = p_provider_event_id,
         paid_with = p_paid_with,
         payer_user_id = COALESCE(p_payer, payer_user_id),
         paid_at = now()
   WHERE id = v_row.id;

  INSERT INTO public.merchant_payment_ledger (store_id, request_id, direction, amount_minor, currency, reference)
  VALUES (v_row.store_id, v_row.id, 'credit', v_row.amount_minor, v_row.currency, p_provider || ':' || p_provider_event_id);

  v_how := CASE p_paid_with WHEN 'card' THEN ' by saved card' WHEN 'ucoin' THEN ' with UCoin' ELSE '' END;
  SELECT m.user_id INTO v_owner
    FROM public.stores s JOIN public.merchants m ON m.id = s.merchant_id
   WHERE s.id = v_row.store_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_owner, 'payment_request_paid',
            CASE WHEN v_outcome = 'paid' THEN 'Payment received' ELSE 'Payment received for a cancelled request' END,
            'R' || to_char(v_row.amount_minor / 100.0, 'FM999999990.00') || ' for "' || v_row.description || '"'
              || CASE WHEN v_outcome = 'paid' THEN ' was paid' || v_how || '.' ELSE ' was paid' || v_how || ' after you cancelled it. Contact support to refund it.' END,
            jsonb_build_object('url', '/merchant/dashboard?tab=payment-requests'));
  END IF;

  RETURN v_outcome;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_settle(uuid, text, text, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_settle(uuid, text, text, integer, text, text, uuid) TO service_role;

-- The PayFast checkout path (payfast-itn) now settles through the shared function.
CREATE OR REPLACE FUNCTION public.payment_request_mark_paid(
  p_request_id uuid, p_pf_payment_id text, p_amount_minor integer, p_payload_digest text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.payment_request_settle(p_request_id, 'payfast', p_pf_payment_id, p_amount_minor, p_payload_digest, 'payfast', NULL);
$function$;

-- ---------------------------------------------------------------------------
-- What the signed-in payer can pay with
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_request_ucoin_needed(p_amount_minor integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  -- R0.10 (10 cents) per UCoin, rounded up so the store is always paid in full.
  SELECT ceil(p_amount_minor / 10.0)::integer;
$function$;

CREATE OR REPLACE FUNCTION public.payment_request_pay_options(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
  v_needed integer;
  v_balance integer;
  v_own_store boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('signed_in', false);
  END IF;
  SELECT * INTO v_row FROM public.merchant_payment_requests WHERE public_token = p_token AND length(p_token) = 36;
  IF v_row.id IS NULL OR NOT public.store_feature_enabled(v_row.store_id, 'payment_requests') THEN
    RETURN NULL;
  END IF;

  v_needed := public.payment_request_ucoin_needed(v_row.amount_minor);
  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = auth.uid();
  v_own_store := public.store_role(v_row.store_id, auth.uid()) IS NOT NULL;

  RETURN jsonb_build_object(
    'signed_in', true,
    'ucoin', jsonb_build_object(
      'needed', v_needed,
      'balance', COALESCE(v_balance, 0),
      'rate_zar', 0.10,
      'allowed', NOT v_own_store,
      'enough', COALESCE(v_balance, 0) >= v_needed),
    'cards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'brand', c.brand, 'last4', c.last4,
                                          'exp_month', c.exp_month, 'exp_year', c.exp_year, 'is_default', c.is_default)
                       ORDER BY c.is_default DESC, c.created_at DESC)
        FROM public.payment_instruments c
       WHERE c.user_id = auth.uid() AND c.status = 'active' AND c.provider = 'payfast'
         AND (c.exp_year IS NULL OR make_date(c.exp_year, COALESCE(c.exp_month, 12), 1) + interval '1 month' > now())),
      '[]'::jsonb),
    'pending_attempt', EXISTS (SELECT 1 FROM public.merchant_payment_attempts a
                                WHERE a.request_id = v_row.id AND a.status IN ('processing', 'needs_review')));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_pay_options(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_request_pay_options(text) TO authenticated, service_role;

-- Checks shared by both ways of paying. Locks the request row.
CREATE OR REPLACE FUNCTION public.payment_request_lock_payable(p_token text)
 RETURNS public.merchant_payment_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
BEGIN
  SELECT * INTO v_row FROM public.merchant_payment_requests
   WHERE public_token = p_token AND length(p_token) = 36 FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.store_feature_enabled(v_row.store_id, 'payment_requests') THEN
    RAISE EXCEPTION 'This payment link is not valid';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This payment link is no longer open';
  END IF;
  IF v_row.expires_at <= now() THEN
    RAISE EXCEPTION 'This payment link has expired';
  END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_payment_attempts a
              WHERE a.request_id = v_row.id AND a.status IN ('processing', 'succeeded', 'needs_review')) THEN
    RAISE EXCEPTION 'A payment for this is already being processed. If it does not complete, contact support@1145.io before trying again.';
  END IF;
  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_lock_payable(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_lock_payable(text) TO service_role;

-- ---------------------------------------------------------------------------
-- Paying with UCoin (one transaction: debit, record, settle)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.payment_request_pay_with_ucoin(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_row public.merchant_payment_requests;
  v_needed integer;
  v_balance integer;
  v_tx uuid;
  v_attempt uuid;
  v_outcome text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to pay with UCoin';
  END IF;
  v_row := public.payment_request_lock_payable(p_token);

  IF public.store_role(v_row.store_id, v_user) IS NOT NULL THEN
    RAISE EXCEPTION 'You can''t pay your own store''s request with UCoin';
  END IF;

  v_needed := public.payment_request_ucoin_needed(v_row.amount_minor);
  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_needed THEN
    RAISE EXCEPTION 'You need % UCoin for this payment and have %', v_needed, COALESCE(v_balance, 0);
  END IF;

  UPDATE public.ucoin_wallets
     SET balance = balance - v_needed,
         lifetime_spent = COALESCE(lifetime_spent, 0) + v_needed,
         updated_at = now()
   WHERE user_id = v_user;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_user, v_needed, 'spend', 'marketplace_purchase',
          format('Paid R%s to %s with 1145 Pay', to_char(v_row.amount_minor / 100.0, 'FM999999990.00'),
                 (SELECT name FROM public.stores WHERE id = v_row.store_id)),
          v_row.id::text, 'payment_request')
  RETURNING id INTO v_tx;

  INSERT INTO public.merchant_payment_attempts
    (request_id, payer_user_id, method, amount_minor, ucoin_spent, status, provider_reference, finished_at)
  VALUES (v_row.id, v_user, 'ucoin', v_row.amount_minor, v_needed, 'succeeded', v_tx::text, now())
  RETURNING id INTO v_attempt;

  v_outcome := public.payment_request_settle(v_row.id, 'ucoin', v_tx::text, v_row.amount_minor,
                                             md5(v_attempt::text), 'ucoin', v_user);
  IF v_outcome <> 'paid' THEN
    RAISE EXCEPTION 'The payment could not be completed (%)', v_outcome;
  END IF;

  RETURN jsonb_build_object('status', 'paid', 'ucoin_spent', v_needed, 'ucoin_balance', v_balance - v_needed);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_pay_with_ucoin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payment_request_pay_with_ucoin(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Paying with a saved card (called by the merchant-payment-request function)
-- ---------------------------------------------------------------------------

-- Opens an attempt and returns what the function needs to charge the token.
CREATE OR REPLACE FUNCTION public.payment_request_begin_card_charge(p_token text, p_instrument_id uuid, p_payer uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
  v_card public.payment_instruments;
  v_attempt uuid;
BEGIN
  v_row := public.payment_request_lock_payable(p_token);

  SELECT * INTO v_card FROM public.payment_instruments
   WHERE id = p_instrument_id AND user_id = p_payer AND status = 'active' AND provider = 'payfast';
  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'That card is not available. Choose another card or pay with PayFast.';
  END IF;

  INSERT INTO public.merchant_payment_attempts (request_id, payer_user_id, method, instrument_id, amount_minor, status)
  VALUES (v_row.id, p_payer, 'card', v_card.id, v_row.amount_minor, 'processing')
  RETURNING id INTO v_attempt;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt,
    'request_id', v_row.id,
    'provider_token', v_card.provider_token,
    'amount_minor', v_row.amount_minor,
    'description', v_row.description,
    'reference', v_row.reference,
    'store_name', (SELECT name FROM public.stores WHERE id = v_row.store_id),
    'card', COALESCE(v_card.brand, 'Card') || ' •••• ' || COALESCE(v_card.last4, ''));
END;
$function$;

-- Records PayFast's answer. p_result: 'succeeded', 'failed', or 'unknown'
-- (no clear answer, e.g. a timeout: kept for review, blocking further charges).
CREATE OR REPLACE FUNCTION public.payment_request_finish_card_charge(
  p_attempt_id uuid, p_result text, p_provider_reference text, p_error text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.merchant_payment_attempts;
  v_outcome text;
BEGIN
  SELECT * INTO v_attempt FROM public.merchant_payment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_attempt.id IS NULL OR v_attempt.status <> 'processing' THEN
    RETURN 'not_processing';
  END IF;

  IF p_result = 'succeeded' THEN
    UPDATE public.merchant_payment_attempts
       SET status = 'succeeded', provider_reference = p_provider_reference, finished_at = now()
     WHERE id = p_attempt_id;
    v_outcome := public.payment_request_settle(v_attempt.request_id, 'payfast_token',
                   COALESCE(NULLIF(p_provider_reference, ''), 'attempt:' || p_attempt_id::text),
                   v_attempt.amount_minor, md5(p_attempt_id::text), 'card', v_attempt.payer_user_id);
    RETURN v_outcome;
  ELSIF p_result = 'failed' THEN
    UPDATE public.merchant_payment_attempts
       SET status = 'failed', error = left(p_error, 500), finished_at = now()
     WHERE id = p_attempt_id;
    RETURN 'failed';
  ELSE
    UPDATE public.merchant_payment_attempts
       SET status = 'needs_review', error = left(p_error, 500), finished_at = now()
     WHERE id = p_attempt_id;
    RETURN 'needs_review';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_begin_card_charge(text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_request_finish_card_charge(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_begin_card_charge(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_finish_card_charge(uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
