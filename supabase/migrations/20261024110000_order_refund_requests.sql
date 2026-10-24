-- Refund and return requests for marketplace orders.
--
-- Before this there was nowhere for a customer to ask for their money back:
-- the Return button had no handler, and the merchant RefundReturnDialog wrote
-- orders.refund_status directly, which RLS does not allow.
--
-- Flow (every step is a function below; the table has no write policies):
--   customer_request_refund   paid order: 'refund' before delivery, 'return' up to 30 days after
--   customer_withdraw_refund_request   while still 'requested'
--   refund_request_decide     admin, or the owner/manager of every store in the request
--   refund_request_complete   admin only, after the money is refunded in PayFast by hand
--
-- No money moves automatically (spec v3 §6, §8.2). Each step also sets
-- orders.refund_status / return_status, which merchant_payout_balance already
-- reads: an approved or completed request takes the order out of payouts.

CREATE TABLE IF NOT EXISTS public.order_refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('refund', 'return')),
  reason text NOT NULL CHECK (reason IN ('not_received', 'damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other')),
  note text CHECK (char_length(note) <= 1000),
  -- [{order_item_id, product_id, quantity, price}] as they were when requested
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount_requested numeric(12, 2) NOT NULL CHECK (amount_requested >= 0),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'withdrawn', 'completed')),
  amount_approved numeric(12, 2) CHECK (amount_approved >= 0),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text CHECK (char_length(decision_note) <= 1000),
  completed_by uuid,
  completed_at timestamptz,
  refund_reference text CHECK (char_length(refund_reference) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open request per order.
CREATE UNIQUE INDEX IF NOT EXISTS order_refund_requests_open_idx
  ON public.order_refund_requests(order_id) WHERE status IN ('requested', 'approved');
CREATE INDEX IF NOT EXISTS order_refund_requests_status_idx ON public.order_refund_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS order_refund_requests_user_idx ON public.order_refund_requests(user_id, created_at DESC);

ALTER TABLE public.order_refund_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_refund_requests FROM anon;
REVOKE ALL ON public.order_refund_requests FROM authenticated;
GRANT SELECT ON public.order_refund_requests TO authenticated;
GRANT ALL ON public.order_refund_requests TO service_role;

DROP POLICY IF EXISTS "Customers view their refund requests" ON public.order_refund_requests;
CREATE POLICY "Customers view their refund requests" ON public.order_refund_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Store staff view refund requests for their orders" ON public.order_refund_requests;
CREATE POLICY "Store staff view refund requests for their orders" ON public.order_refund_requests
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = order_refund_requests.order_id
      AND public.store_has_permission(oi.store_id, 'orders')));

DROP POLICY IF EXISTS "Admins view refund requests" ON public.order_refund_requests;
CREATE POLICY "Admins view refund requests" ON public.order_refund_requests
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Sets refund_status or return_status on the order, whichever the request is.
CREATE OR REPLACE FUNCTION public.refund_request_sync_order(p_order_id uuid, p_kind text, p_status text,
                                                            p_reason text DEFAULT NULL, p_amount numeric DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind = 'refund' THEN
    UPDATE public.orders
    SET refund_status = p_status,
        refund_reason = COALESCE(p_reason, refund_reason),
        refund_amount = COALESCE(p_amount, refund_amount),
        updated_at = now()
    WHERE id = p_order_id;
  ELSE
    UPDATE public.orders
    SET return_status = p_status,
        return_reason = COALESCE(p_reason, return_reason),
        refund_amount = COALESCE(p_amount, refund_amount),
        updated_at = now()
    WHERE id = p_order_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.refund_request_sync_order(uuid, text, text, text, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.customer_request_refund(p_order_id uuid, p_reason text, p_note text DEFAULT NULL,
                                                          p_item_ids uuid[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_kind text;
  v_delivered_at timestamptz;
  v_items jsonb;
  v_count integer;
  v_amount numeric;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can be refunded. Unpaid orders can be cancelled instead.';
  END IF;

  IF v_order.status = 'delivered' THEN
    v_kind := 'return';
    SELECT max(created_at) INTO v_delivered_at
    FROM public.order_events WHERE order_id = p_order_id AND event_type = 'status_changed' AND status = 'delivered';
    IF COALESCE(v_delivered_at, v_order.updated_at) < now() - interval '30 days' THEN
      RAISE EXCEPTION 'The 30-day return window for this order has closed.';
    END IF;
  ELSIF v_order.status IN ('processing', 'shipped', 'in_transit', 'out_for_delivery') THEN
    v_kind := 'refund';
  ELSE
    RAISE EXCEPTION 'A refund cannot be requested for this order.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.order_refund_requests
             WHERE order_id = p_order_id AND status IN ('requested', 'approved', 'completed')) THEN
    RAISE EXCEPTION 'A request for this order already exists.';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('order_item_id', oi.id, 'product_id', oi.product_id,
                                               'quantity', oi.quantity, 'price', oi.price)), '[]'::jsonb),
         count(*), COALESCE(sum(oi.price * oi.quantity), 0)
    INTO v_items, v_count, v_amount
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id
    AND (p_item_ids IS NULL OR cardinality(p_item_ids) = 0 OR oi.id = ANY (p_item_ids));
  IF v_count = 0 OR (p_item_ids IS NOT NULL AND cardinality(p_item_ids) > 0 AND v_count <> cardinality(p_item_ids)) THEN
    RAISE EXCEPTION 'Choose items from this order.';
  END IF;
  v_amount := LEAST(v_amount, v_order.total);

  INSERT INTO public.order_refund_requests (order_id, user_id, kind, reason, note, items, amount_requested)
  VALUES (p_order_id, v_user, v_kind, p_reason, NULLIF(btrim(p_note), ''), v_items, v_amount)
  RETURNING id INTO v_id;

  PERFORM public.refund_request_sync_order(p_order_id, v_kind, 'requested', p_reason);

  INSERT INTO public.order_events (order_id, event_type, status, title, description, actor, metadata)
  VALUES (p_order_id, v_kind || '_requested', v_order.status,
          CASE v_kind WHEN 'refund' THEN 'Refund requested' ELSE 'Return requested' END,
          format('You asked for R%s back. We will let you know once it is reviewed.', to_char(v_amount, 'FM999999990.00')),
          'customer', jsonb_build_object('request_id', v_id, 'reason', p_reason, 'amount', v_amount));

  RETURN jsonb_build_object('success', true, 'request_id', v_id, 'kind', v_kind, 'amount_requested', v_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_withdraw_refund_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.order_refund_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.order_refund_requests
  WHERE id = p_request_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
  IF v_req.status <> 'requested' THEN
    RAISE EXCEPTION 'This request has already been reviewed.';
  END IF;

  UPDATE public.order_refund_requests SET status = 'withdrawn', updated_at = now() WHERE id = p_request_id;
  PERFORM public.refund_request_sync_order(v_req.order_id, v_req.kind, 'none');

  INSERT INTO public.order_events (order_id, event_type, title, description, actor, metadata)
  VALUES (v_req.order_id, v_req.kind || '_withdrawn', 'Request withdrawn',
          'You withdrew your request.', 'customer', jsonb_build_object('request_id', p_request_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admins decide any request, and may overturn a store's rejection. Store
-- owners and managers decide requests whose items all come from their stores.
CREATE OR REPLACE FUNCTION public.refund_request_decide(p_request_id uuid, p_approve boolean,
                                                        p_note text DEFAULT NULL, p_amount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req public.order_refund_requests%ROWTYPE;
  v_total numeric;
  v_is_admin boolean := public.is_admin(auth.uid());
  v_amount numeric;
  v_status text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  SELECT * INTO v_req FROM public.order_refund_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;

  IF NOT v_is_admin THEN
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_req.items) i
                   JOIN public.order_items oi ON oi.id = (i ->> 'order_item_id')::uuid
                   WHERE oi.order_id = v_req.order_id)
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_req.items) i
                  JOIN public.order_items oi ON oi.id = (i ->> 'order_item_id')::uuid
                  WHERE public.store_role(oi.store_id) IS DISTINCT FROM 'owner'
                    AND public.store_role(oi.store_id) IS DISTINCT FROM 'manager') THEN
      RAISE EXCEPTION 'Only an admin, or the store owner or manager, can decide this request.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT (v_req.status = 'requested' OR (v_is_admin AND v_req.status = 'rejected')) THEN
    RAISE EXCEPTION 'This request has already been decided.';
  END IF;
  IF NOT p_approve AND NULLIF(btrim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Give the customer a reason for the rejection.';
  END IF;

  IF p_approve THEN
    SELECT total INTO v_total FROM public.orders WHERE id = v_req.order_id;
    v_amount := round(COALESCE(p_amount, v_req.amount_requested), 2);
    IF v_amount <= 0 OR v_amount > v_total THEN
      RAISE EXCEPTION 'The refund must be more than R0 and at most the order total (R%).', to_char(v_total, 'FM999999990.00');
    END IF;
    v_status := 'approved';
  ELSE
    v_status := 'rejected';
  END IF;

  UPDATE public.order_refund_requests
  SET status = v_status,
      amount_approved = v_amount,
      decided_by = v_user,
      decided_at = now(),
      decision_note = NULLIF(btrim(p_note), ''),
      updated_at = now()
  WHERE id = p_request_id;

  PERFORM public.refund_request_sync_order(v_req.order_id, v_req.kind, v_status, NULL, v_amount);

  INSERT INTO public.order_events (order_id, event_type, title, description, actor, metadata)
  VALUES (v_req.order_id, v_req.kind || '_' || v_status,
          CASE WHEN p_approve THEN 'Refund approved' ELSE 'Refund declined' END,
          CASE WHEN p_approve
               THEN format('R%s will be refunded to your original payment method.', to_char(v_amount, 'FM999999990.00'))
               ELSE NULLIF(btrim(p_note), '') END,
          CASE WHEN v_is_admin THEN 'admin' ELSE 'merchant' END,
          jsonb_build_object('request_id', p_request_id, 'decided_by', v_user, 'amount', v_amount));

  RETURN jsonb_build_object('success', true, 'status', v_status, 'amount_approved', v_amount);
END;
$$;

-- Admin records that the money was refunded (through PayFast, by hand).
CREATE OR REPLACE FUNCTION public.refund_request_complete(p_request_id uuid, p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.order_refund_requests%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can mark a refund as paid.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the PayFast refund reference.';
  END IF;

  SELECT * INTO v_req FROM public.order_refund_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved requests can be marked as refunded.';
  END IF;

  UPDATE public.order_refund_requests
  SET status = 'completed', completed_by = auth.uid(), completed_at = now(),
      refund_reference = btrim(p_reference), updated_at = now()
  WHERE id = p_request_id;

  PERFORM public.refund_request_sync_order(v_req.order_id, v_req.kind, 'completed', NULL, v_req.amount_approved);

  INSERT INTO public.order_events (order_id, event_type, title, description, actor, metadata)
  VALUES (v_req.order_id, v_req.kind || '_completed', 'Refund paid',
          format('R%s was refunded to your original payment method.', to_char(v_req.amount_approved, 'FM999999990.00')),
          'admin', jsonb_build_object('request_id', p_request_id, 'reference', btrim(p_reference)));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_request_refund(uuid, text, text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_withdraw_refund_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_request_decide(uuid, boolean, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_request_complete(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_request_refund(uuid, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_withdraw_refund_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_request_decide(uuid, boolean, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_request_complete(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
