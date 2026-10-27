-- Reserve the payment route before leaving for the gateway, so an open
-- PayFast checkout cannot also be paid with UCoin.
ALTER TABLE public.food_orders ADD COLUMN IF NOT EXISTS payment_route text CHECK (payment_route IN ('payfast', 'ucoin'));
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS payment_route text CHECK (payment_route IN ('payfast', 'ucoin'));
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payment_route text CHECK (payment_route IN ('payfast', 'ucoin'));

-- Existing pending purchases may already have an open gateway checkout.
-- Keep them on that route; newly created purchases can choose either route.
UPDATE public.food_orders SET payment_route = 'payfast' WHERE payment_status = 'pending' AND payment_route IS NULL;
UPDATE public.auctions SET payment_route = 'payfast' WHERE status = 'sold' AND payment_route IS NULL;
UPDATE public.service_orders SET payment_route = 'payfast' WHERE state = 'pending_payment' AND payment_route IS NULL;

-- All buyers can spend their available UCoin, irrespective of account tier.
-- Debit and fulfilment commit together. Repeated calls cannot debit twice.
CREATE OR REPLACE FUNCTION public.pay_purchase_with_ucoin(p_kind text, p_id uuid, p_expected_minor integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_amount numeric;
  v_needed integer;
  v_balance integer;
  v_tx uuid;
  v_food public.food_orders%ROWTYPE;
  v_auction public.auctions%ROWTYPE;
  v_service public.service_orders%ROWTYPE;
  v_deposit numeric := 0;
  v_order uuid;
  v_address jsonb := '{}'::jsonb;
  v_result text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to pay with UCoin'; END IF;
  IF p_kind = 'food' THEN
    SELECT * INTO v_food FROM public.food_orders WHERE id = p_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_food.status <> 'pending_payment' OR v_food.payment_status <> 'pending' THEN
      RAISE EXCEPTION 'This order is not awaiting payment';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.eateries WHERE id = v_food.eatery_id AND status = 'approved' AND accepting_orders) THEN
      RAISE EXCEPTION 'This eatery is not taking orders';
    END IF;
    IF v_food.payment_route = 'payfast' THEN RAISE EXCEPTION 'A PayFast checkout is already open. Complete that checkout to avoid paying twice'; END IF;
    UPDATE public.food_orders SET payment_route = 'ucoin' WHERE id = p_id;
    v_amount := v_food.total;
  ELSIF p_kind = 'auction' THEN
    SELECT * INTO v_auction FROM public.auctions WHERE id = p_id AND winner_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_auction.status <> 'sold' THEN RAISE EXCEPTION 'This auction is not awaiting payment'; END IF;
    SELECT CASE WHEN payment_status = 'paid' THEN registration_fee_paid ELSE 0 END INTO v_deposit
      FROM public.auction_registrations WHERE auction_id = p_id AND user_id = v_user FOR UPDATE;
    IF v_auction.payment_route = 'payfast' THEN RAISE EXCEPTION 'A PayFast checkout is already open. Complete that checkout to avoid paying twice'; END IF;
    UPDATE public.auctions SET payment_route = 'ucoin' WHERE id = p_id;
    v_amount := v_auction.winning_bid - COALESCE(v_deposit, 0);
  ELSIF p_kind = 'service' THEN
    SELECT * INTO v_service FROM public.service_orders WHERE id = p_id AND customer_user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_service.state <> 'pending_payment' THEN RAISE EXCEPTION 'This order is not awaiting payment'; END IF;
    IF v_service.payment_route = 'payfast' THEN RAISE EXCEPTION 'A PayFast checkout is already open. Complete that checkout to avoid paying twice'; END IF;
    UPDATE public.service_orders SET payment_route = 'ucoin' WHERE id = p_id;
    v_amount := v_service.gross_amount_minor / 100.0;
  ELSE
    RAISE EXCEPTION 'Unsupported purchase';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Invalid payment amount'; END IF;
  IF p_expected_minor IS DISTINCT FROM round(v_amount * 100)::integer THEN
    RAISE EXCEPTION 'The price changed. Review the current order amount before paying';
  END IF;
  v_needed := ceil(round(v_amount * 100) / 10)::integer;
  SELECT balance INTO v_balance FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_needed THEN RAISE EXCEPTION 'Insufficient UCoin balance'; END IF;
  UPDATE public.ucoin_wallets SET balance = balance - v_needed,
    lifetime_spent = COALESCE(lifetime_spent, 0) + v_needed, updated_at = now() WHERE user_id = v_user;
  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
    VALUES (v_user, v_needed, 'spend', 'marketplace_purchase', '1145 ' || p_kind || ' purchase', p_id::text, p_kind)
    RETURNING id INTO v_tx;
  IF p_kind = 'food' THEN
    UPDATE public.food_orders SET status = 'placed', payment_status = 'paid', payment_reference = 'ucoin:' || v_tx::text,
      placed_at = now() WHERE id = p_id;
  ELSIF p_kind = 'service' THEN
    v_result := public.service_order_mark_paid(p_id, 'ucoin:' || v_tx::text, v_service.gross_amount_minor);
    IF v_result <> 'paid' THEN RAISE EXCEPTION 'Payment could not complete: %', v_result; END IF;
  ELSE
    SELECT jsonb_build_object('name', name, 'street', street, 'city', city, 'province', province,
      'postal_code', postal_code, 'country', country, 'phone', phone) INTO v_address
      FROM public.user_addresses WHERE user_id = v_user AND is_default LIMIT 1;
    INSERT INTO public.orders (user_id, total, status, payment_status, payment_method, shipping_address, notes,
      ucoin_spent, ucoin_value_zar)
      VALUES (v_user, v_auction.winning_bid, 'processing', 'paid', 'ucoin', COALESCE(v_address, '{}'::jsonb),
        'Auction win: ' || p_id::text, v_needed, v_amount) RETURNING id INTO v_order;
    INSERT INTO public.order_items (order_id, product_id, store_id, quantity, price, status, merchant_status)
      SELECT v_order, id, store_id, 1, v_auction.winning_bid, 'pending', 'pending'
      FROM public.products WHERE id = v_auction.product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Auction product is unavailable'; END IF;
    UPDATE public.auctions SET status = 'completed' WHERE id = p_id;
    UPDATE public.auction_registrations SET deposit_applied = true WHERE auction_id = p_id AND user_id = v_user;
  END IF;
  RETURN jsonb_build_object('status', 'paid', 'ucoin_spent', v_needed, 'order_id', v_order);
END $$;
REVOKE ALL ON FUNCTION public.pay_purchase_with_ucoin(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_purchase_with_ucoin(text, uuid, integer) TO authenticated;

-- Enable QR acceptance for existing merchants and new merchants.
INSERT INTO public.merchant_feature_flags (merchant_id, flag_key, enabled)
  SELECT id, 'payment_requests', true FROM public.merchants
  ON CONFLICT (merchant_id, flag_key) DO UPDATE SET enabled = true;
CREATE OR REPLACE FUNCTION public.enable_merchant_pay()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.merchant_feature_flags (merchant_id, flag_key, enabled)
    VALUES (NEW.id, 'payment_requests', true) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enable_merchant_pay() FROM PUBLIC;
CREATE TRIGGER enable_merchant_pay AFTER INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.enable_merchant_pay();
CREATE OR REPLACE FUNCTION public.redeem_ucoin_for_order(p_order_id uuid, p_ucoin integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet RECORD;
  v_order RECORD;
  v_rate numeric := 0.10;
  v_value numeric;
  v_max_ucoin integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in.');
  END IF;
  IF p_ucoin IS NULL OR p_ucoin <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter how much UCoin to use.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order is already paid.');
  END IF;

  SELECT * INTO v_wallet FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No UCoin wallet found.');
  END IF;

  v_max_ucoin := LEAST(v_wallet.balance, CEIL(GREATEST(v_order.total - COALESCE(v_order.ucoin_value_zar, 0), 0) / v_rate));
  IF p_ucoin > v_max_ucoin THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('You can use at most %s UCoin on this order.', v_max_ucoin), 'max_ucoin', v_max_ucoin);
  END IF;

  v_value := LEAST(ROUND(p_ucoin * v_rate, 2), GREATEST(v_order.total - COALESCE(v_order.ucoin_value_zar, 0), 0));

  UPDATE public.ucoin_wallets
  SET balance = balance - p_ucoin,
      lifetime_spent = COALESCE(lifetime_spent, 0) + p_ucoin,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_user, p_ucoin, 'spend', 'marketplace_purchase',
          format('Paid R%s of order with UCoin', to_char(v_value, 'FM999999990.00')),
          p_order_id::text, 'order');

  UPDATE public.orders
  SET ucoin_spent = COALESCE(ucoin_spent, 0) + p_ucoin,
      ucoin_value_zar = COALESCE(ucoin_value_zar, 0) + v_value,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, event_type, status, title, description, metadata)
  VALUES (p_order_id, 'ucoin_applied', v_order.status, 'UCoin applied',
          format('%s UCoin (R%s) was used towards this order.', p_ucoin, to_char(v_value, 'FM999999990.00')),
          jsonb_build_object('ucoin', p_ucoin, 'zar', v_value));

  RETURN jsonb_build_object('success', true, 'ucoin', p_ucoin, 'zar_value', v_value, 'zar_amount', v_value,
                            'remaining_due', GREATEST(v_order.total - v_order.ucoin_value_zar - v_value, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_ucoin_for_order(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_ucoin_for_order(uuid, integer) TO authenticated;


NOTIFY pgrst, 'reload schema';
