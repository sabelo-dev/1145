-- Payment requests: a store asks a customer to pay an amount through a link
-- or QR code, and the customer pays on PayFast's hosted page.
--
-- Money rules:
--   * Amounts are integer cents in ZAR. The store sets the amount when it
--     creates the request; the person paying can never change it.
--   * A request is only paid when payfast-itn passes PayFast's verified
--     notification to payment_request_mark_paid(). The return page never
--     marks anything paid.
--   * Each PayFast payment id is processed once (merchant_payment_events).
--   * Every confirmed payment adds a credit to merchant_payment_ledger, which
--     cannot be changed or deleted. It is a record of what was collected, not a
--     balance the merchant can withdraw: how this money reaches merchants (fees,
--     payout timing) is still to be decided and is NOT part of
--     merchant_payout_balance().
--
-- The link carries a random token, not the request id, and the public lookup
-- returns only what the payer needs to see.

CREATE TABLE IF NOT EXISTS public.merchant_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 100),
  reference text CHECK (reference IS NULL OR length(reference) <= 50),
  amount_minor integer NOT NULL CHECK (amount_minor BETWEEN 500 AND 10000000), -- R5 (PayFast minimum) to R100 000
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  provider text NOT NULL DEFAULT 'payfast' CHECK (provider = 'payfast'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refund_due')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL,
  provider_reference text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_requests_store ON public.merchant_payment_requests (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  request_id uuid REFERENCES public.merchant_payment_requests(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  amount_minor integer,
  payload_digest text NOT NULL,
  outcome text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id, event_type)
);

CREATE TABLE IF NOT EXISTS public.merchant_payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES public.merchant_payment_requests(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'ZAR',
  reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_payment_ledger_store ON public.merchant_payment_ledger (store_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.merchant_payment_ledger_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION 'merchant_payment_ledger rows cannot be changed or deleted; add a correcting entry instead';
END;
$function$;

DROP TRIGGER IF EXISTS merchant_payment_ledger_no_change ON public.merchant_payment_ledger;
CREATE TRIGGER merchant_payment_ledger_no_change
  BEFORE UPDATE OR DELETE ON public.merchant_payment_ledger
  FOR EACH ROW EXECUTE FUNCTION public.merchant_payment_ledger_append_only();

ALTER TABLE public.merchant_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payment_ledger ENABLE ROW LEVEL SECURITY;

-- The pay page reads through payment_request_public() only.
REVOKE ALL ON public.merchant_payment_requests, public.merchant_payment_events, public.merchant_payment_ledger FROM anon;

DROP POLICY IF EXISTS "Store finance staff see payment requests" ON public.merchant_payment_requests;
CREATE POLICY "Store finance staff see payment requests"
  ON public.merchant_payment_requests FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'payments', auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Store finance staff see ledger" ON public.merchant_payment_ledger;
CREATE POLICY "Store finance staff see ledger"
  ON public.merchant_payment_ledger FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'payments', auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins see payment events" ON public.merchant_payment_events;
CREATE POLICY "Admins see payment events"
  ON public.merchant_payment_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
-- No write policies on any of the three: writes go through the functions below.

CREATE OR REPLACE FUNCTION public.merchant_payment_request_create(
  p_store_id uuid, p_amount_minor integer, p_description text, p_reference text,
  p_expires_in_minutes integer, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'payments', 'payment_requests');

  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'A request key is required';
  END IF;
  SELECT * INTO v_row FROM public.merchant_payment_requests
   WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
  IF v_row.id IS NOT NULL THEN
    RETURN to_jsonb(v_row);
  END IF;

  IF p_amount_minor IS NULL OR p_amount_minor < 500 THEN
    RAISE EXCEPTION 'The smallest amount PayFast accepts is R5.00';
  END IF;
  IF p_amount_minor > 10000000 THEN
    RAISE EXCEPTION 'Payment requests are limited to R100 000';
  END IF;
  IF p_expires_in_minutes IS NULL OR p_expires_in_minutes NOT BETWEEN 5 AND 10080 THEN
    RAISE EXCEPTION 'Choose an expiry between 5 minutes and 7 days';
  END IF;

  INSERT INTO public.merchant_payment_requests
    (store_id, description, reference, amount_minor, expires_at, created_by, idempotency_key)
  VALUES (p_store_id, trim(p_description), NULLIF(trim(p_reference), ''), p_amount_minor,
          now() + make_interval(mins => p_expires_in_minutes), auth.uid(), p_idempotency_key)
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_payment_request_cancel(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
BEGIN
  SELECT * INTO v_row FROM public.merchant_payment_requests WHERE id = p_request_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;
  PERFORM public.require_store_access(v_row.store_id, 'payments', 'payment_requests');
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only an unpaid request can be cancelled';
  END IF;

  UPDATE public.merchant_payment_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_request_id
  RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_payment_request_create(uuid, integer, text, text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_payment_request_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_payment_request_create(uuid, integer, text, text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_payment_request_cancel(uuid) TO authenticated, service_role;

-- What the pay page shows. Anyone with the link may see it; it names the
-- store and the amount and nothing about the merchant's other business.
CREATE OR REPLACE FUNCTION public.payment_request_public(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'store_name', s.name,
    'store_logo_url', s.logo_url,
    'description', r.description,
    'reference', r.reference,
    'amount_minor', r.amount_minor,
    'currency', r.currency,
    'status', CASE WHEN r.status = 'pending' AND r.expires_at <= now() THEN 'expired' ELSE r.status END,
    'expires_at', r.expires_at,
    'paid_at', r.paid_at)
  FROM public.merchant_payment_requests r
  JOIN public.stores s ON s.id = r.store_id
  WHERE r.public_token = p_token AND length(p_token) = 36
    AND public.store_feature_enabled(r.store_id, 'payment_requests');
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_request_public(text) TO anon, authenticated, service_role;

-- Applies PayFast's verified notification. Called by payfast-itn only. Safe to
-- call again for a repeated notification. Returns what happened.
CREATE OR REPLACE FUNCTION public.payment_request_mark_paid(
  p_request_id uuid, p_pf_payment_id text, p_amount_minor integer, p_payload_digest text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.merchant_payment_requests;
  v_outcome text;
  v_owner uuid;
BEGIN
  SELECT * INTO v_row FROM public.merchant_payment_requests WHERE id = p_request_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    v_outcome := 'not_found';
  ELSIF v_row.status IN ('paid', 'refund_due') THEN
    v_outcome := 'already_processed';
  ELSIF p_amount_minor <> v_row.amount_minor THEN
    v_outcome := 'amount_mismatch';
  ELSIF v_row.status = 'cancelled' THEN
    -- Paid after the store cancelled it: the money is in, so record it and flag a refund.
    v_outcome := 'paid_after_cancellation';
  ELSE
    -- Pending, or expired while the customer was on PayFast: the payment stands.
    v_outcome := 'paid';
  END IF;

  INSERT INTO public.merchant_payment_events
    (provider, provider_event_id, request_id, event_type, amount_minor, payload_digest, outcome)
  VALUES ('payfast', p_pf_payment_id, v_row.id, 'COMPLETE', p_amount_minor, p_payload_digest, v_outcome)
  ON CONFLICT (provider, provider_event_id, event_type) DO NOTHING;
  IF NOT FOUND THEN
    RETURN 'duplicate_event';
  END IF;

  IF v_outcome NOT IN ('paid', 'paid_after_cancellation') THEN
    RETURN v_outcome;
  END IF;

  UPDATE public.merchant_payment_requests
     SET status = CASE WHEN v_outcome = 'paid' THEN 'paid' ELSE 'refund_due' END,
         provider_reference = p_pf_payment_id,
         paid_at = now()
   WHERE id = v_row.id;

  INSERT INTO public.merchant_payment_ledger (store_id, request_id, direction, amount_minor, currency, reference)
  VALUES (v_row.store_id, v_row.id, 'credit', v_row.amount_minor, v_row.currency, 'payfast:' || p_pf_payment_id);

  SELECT m.user_id INTO v_owner
    FROM public.stores s JOIN public.merchants m ON m.id = s.merchant_id
   WHERE s.id = v_row.store_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_owner, 'payment_request_paid',
            CASE WHEN v_outcome = 'paid' THEN 'Payment received' ELSE 'Payment received for a cancelled request' END,
            'R' || to_char(v_row.amount_minor / 100.0, 'FM999999990.00') || ' for "' || v_row.description || '"'
              || CASE WHEN v_outcome = 'paid' THEN ' was paid.' ELSE ' was paid after you cancelled it. Contact support to refund it.' END,
            jsonb_build_object('url', '/merchant/dashboard?tab=payment-requests'));
  END IF;

  RETURN v_outcome;
END;
$function$;

-- Records a failed or cancelled PayFast attempt; the request stays open.
CREATE OR REPLACE FUNCTION public.payment_request_record_event(
  p_request_id uuid, p_pf_payment_id text, p_event_type text, p_payload_digest text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO public.merchant_payment_events
    (provider, provider_event_id, request_id, event_type, payload_digest, outcome)
  SELECT 'payfast', COALESCE(NULLIF(p_pf_payment_id, ''), 'none:' || gen_random_uuid()), r.id,
         p_event_type, p_payload_digest, 'recorded'
    FROM public.merchant_payment_requests r WHERE r.id = p_request_id
  ON CONFLICT (provider, provider_event_id, event_type) DO NOTHING;
$function$;

REVOKE EXECUTE ON FUNCTION public.payment_request_mark_paid(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_request_record_event(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_request_mark_paid(uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payment_request_record_event(uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
