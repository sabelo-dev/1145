-- Merchant payout requests.
--
-- The dashboard used to add up every order item (cancelled and unpaid ones
-- included), never subtracted earlier payouts, and inserted the payout row
-- from the browser, which the payouts policies do not allow. The balance is
-- now worked out here, and a payout can only be requested through
-- request_merchant_payout(), for the amount the database calculates.
--
-- Money rules:
--   earned    = paid, delivered orders that are not refunded or returned,
--               less the commission of the merchant's current plan
--   pending   = paid orders not delivered yet, less commission
--   available = earned less every payout that is requested, in progress or paid

CREATE OR REPLACE FUNCTION public.merchant_payout_balance(p_merchant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_config jsonb := public.get_merchant_tier_config(p_merchant_id);
  v_rate numeric := COALESCE((v_config ->> 'commission_rate')::numeric, 10);
  v_gross_delivered numeric;
  v_gross_pending numeric;
  v_earned numeric;
  v_paid_out numeric;
BEGIN
  SELECT
    COALESCE(sum(oi.price * oi.quantity) FILTER (WHERE o.status = 'delivered'), 0),
    COALESCE(sum(oi.price * oi.quantity) FILTER (WHERE o.status IN ('pending', 'processing', 'shipped')), 0)
    INTO v_gross_delivered, v_gross_pending
  FROM public.order_items oi
  JOIN public.stores s ON s.id = oi.store_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE s.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND COALESCE(o.refund_status, 'none') NOT IN ('approved', 'completed')
    AND COALESCE(o.return_status, 'none') NOT IN ('approved', 'completed');

  v_earned := round(v_gross_delivered * (1 - v_rate / 100), 2);

  SELECT COALESCE(sum(amount), 0) INTO v_paid_out
  FROM public.payouts
  WHERE merchant_id = p_merchant_id AND status IN ('pending', 'processing', 'completed');

  RETURN jsonb_build_object(
    'commission_rate', v_rate,
    'payout_days', COALESCE((v_config ->> 'payout_days')::int, 7),
    'minimum_payout', 100,
    'gross_sales', v_gross_delivered,
    'commission', v_gross_delivered - v_earned,
    'total_earnings', v_earned,
    'pending_balance', round(v_gross_pending * (1 - v_rate / 100), 2),
    'paid_out', v_paid_out,
    'available_balance', GREATEST(v_earned - v_paid_out, 0),
    'has_verified_bank', EXISTS (
      SELECT 1 FROM public.merchant_payment_methods m
      WHERE m.merchant_id = p_merchant_id AND m.is_default AND m.verified_at IS NOT NULL),
    'has_open_request', EXISTS (
      SELECT 1 FROM public.payouts
      WHERE merchant_id = p_merchant_id AND status IN ('pending', 'processing'))
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_payout_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_payout_balance(uuid) TO service_role;

-- The signed-in merchant's own figures.
CREATE OR REPLACE FUNCTION public.merchant_payout_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
BEGIN
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user';
  END IF;
  RETURN public.merchant_payout_balance(v_merchant);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_payout_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_payout_summary() TO authenticated, service_role;

-- Requests a payout of the whole available balance.
CREATE OR REPLACE FUNCTION public.request_merchant_payout()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_balance jsonb;
  v_amount numeric;
  v_payout public.payouts;
BEGIN
  -- The lock makes two requests sent at once run one after the other.
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1 FOR UPDATE;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user';
  END IF;

  v_balance := public.merchant_payout_balance(v_merchant);
  v_amount := (v_balance ->> 'available_balance')::numeric;

  IF NOT (v_balance ->> 'has_verified_bank')::boolean THEN
    RAISE EXCEPTION 'Add a verified bank account before requesting a payout';
  END IF;
  IF (v_balance ->> 'has_open_request')::boolean THEN
    RAISE EXCEPTION 'You already have a payout request in progress';
  END IF;
  IF v_amount < (v_balance ->> 'minimum_payout')::numeric THEN
    RAISE EXCEPTION 'Your available balance is below the minimum payout of R%', v_balance ->> 'minimum_payout';
  END IF;

  INSERT INTO public.payouts (merchant_id, amount, status)
  VALUES (v_merchant, v_amount, 'pending')
  RETURNING * INTO v_payout;

  RETURN to_jsonb(v_payout);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_merchant_payout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_merchant_payout() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
