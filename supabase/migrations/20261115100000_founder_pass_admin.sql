-- Founders Pass: table grants and the admin screen's functions.
--
-- Adds the grants the first Founders Pass migration left out (signed-in users
-- read their own pass and orders through row level security; the payment
-- functions write with the service role), and the functions behind
-- Admin → Founders Passes. Each admin function checks the admin role itself.

GRANT SELECT ON public.founder_passes, public.founder_pass_orders, public.founder_pass_settings TO authenticated;
GRANT ALL ON public.founder_passes, public.founder_pass_orders, public.founder_pass_settings TO service_role;

-- Everything the admin screen shows: settings, issued passes and paid orders
-- that still need a refund, with each buyer's email.
CREATE OR REPLACE FUNCTION public.founder_pass_admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'settings', (SELECT jsonb_build_object(
        'price', s.price, 'total', s.total, 'claimed', s.next_number - 1,
        'is_open', s.is_open, 'valid_months', s.valid_months)
      FROM public.founder_pass_settings s),
    'passes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'pass_number', p.pass_number, 'user_id', p.user_id, 'email', u.email,
        'claimed_at', p.claimed_at, 'expires_at', p.expires_at, 'source', o.source)
        ORDER BY p.pass_number DESC)
      FROM public.founder_passes p
      JOIN auth.users u ON u.id = p.user_id
      JOIN public.founder_pass_orders o ON o.id = p.order_id), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'user_id', o.user_id, 'email', u.email, 'amount', o.amount,
        'status', o.status, 'paid_at', o.paid_at, 'payfast_payment_id', o.payfast_payment_id)
        ORDER BY o.paid_at)
      FROM public.founder_pass_orders o
      JOIN auth.users u ON u.id = o.user_id
      WHERE o.status IN ('refund_due', 'refunded')), '[]'::jsonb));
END;
$function$;

-- Opens or closes sales and changes the price or the cap. The cap cannot go
-- below the number of passes already issued.
CREATE OR REPLACE FUNCTION public.founder_pass_admin_update_settings(
  p_is_open boolean, p_price numeric, p_total integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.founder_pass_settings;
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settings FROM public.founder_pass_settings FOR UPDATE;
  IF p_price IS NULL OR p_price < 5 THEN RETURN 'price_too_low'; END IF;
  IF p_total IS NULL OR p_total < greatest(v_settings.next_number - 1, 1) THEN RETURN 'total_below_claimed'; END IF;

  UPDATE public.founder_pass_settings
    SET is_open = COALESCE(p_is_open, is_open), price = round(p_price, 2), total = p_total, updated_at = now();
  RETURN 'saved';
END;
$function$;

-- Marks a paid order as refunded, after the money has been sent back from
-- the PayFast dashboard. Tells the buyer.
CREATE OR REPLACE FUNCTION public.founder_pass_admin_mark_refunded(p_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.founder_pass_orders;
BEGIN
  IF public.is_admin(auth.uid()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.founder_pass_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RETURN 'not_found'; END IF;
  IF v_order.status = 'refunded' THEN RETURN 'already_refunded'; END IF;
  IF v_order.status <> 'refund_due' THEN RETURN 'not_refund_due'; END IF;

  UPDATE public.founder_pass_orders SET status = 'refunded' WHERE id = p_order_id;

  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_order.user_id, 'founder_pass_refunded', 'Founders Pass refunded',
          'Your Founders Pass payment of R' || to_char(v_order.amount, 'FM999990.00') || ' has been refunded.',
          jsonb_build_object('url', '/founders'));
  RETURN 'refunded';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.founder_pass_admin_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.founder_pass_admin_update_settings(boolean, numeric, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.founder_pass_admin_mark_refunded(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_pass_admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.founder_pass_admin_update_settings(boolean, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.founder_pass_admin_mark_refunded(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
