-- Customer cancels an unpaid marketplace order.
--
-- ConsumerOrders used to "cancel" by deleting the order and its children from
-- the browser. Customers have no DELETE policy on those tables, so nothing was
-- removed, the page reported success, and any UCoin already applied to the
-- order stayed spent. This function does it on the server instead.
--
-- Only unpaid orders can be cancelled here. Paid orders need a refund, which
-- stays a human-controlled workflow. The order row is kept (status
-- 'cancelled') for the audit trail; the existing order_events trigger logs the
-- status change.
--
-- UCoin applied to the order is returned to the wallet. orders.ucoin_spent and
-- ucoin_value_zar are left as they were, so a PayFast payment that completes
-- after the cancel still matches the expected amount in payfast-itn and the
-- customer is not charged for an order that no longer exists.

CREATE OR REPLACE FUNCTION public.customer_cancel_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_ucoin integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'ucoin_refunded', 0);
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This order is already paid. Contact support to request a refund.';
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'This order can no longer be cancelled.';
  END IF;

  -- Return UCoin spent on this order, once. The marker event makes a repeat call a no-op.
  v_ucoin := COALESCE(v_order.ucoin_spent, 0);
  IF v_ucoin > 0 AND NOT EXISTS (
    SELECT 1 FROM public.order_events WHERE order_id = p_order_id AND event_type = 'ucoin_refunded'
  ) THEN
    UPDATE public.ucoin_wallets
    SET balance = balance + v_ucoin,
        lifetime_spent = GREATEST(COALESCE(lifetime_spent, 0) - v_ucoin, 0),
        updated_at = now()
    WHERE user_id = v_user;

    INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
    VALUES (v_user, v_ucoin, 'earn', 'order_refund', 'UCoin returned: order cancelled', p_order_id::text, 'order');

    INSERT INTO public.order_events (order_id, event_type, status, title, description, actor, metadata)
    VALUES (p_order_id, 'ucoin_refunded', 'cancelled', 'UCoin returned',
            format('%s UCoin was returned to your wallet.', v_ucoin), 'customer',
            jsonb_build_object('ucoin', v_ucoin, 'zar', v_order.ucoin_value_zar));
  ELSE
    v_ucoin := 0;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      payment_status = 'cancelled',
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'ucoin_refunded', v_ucoin);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
