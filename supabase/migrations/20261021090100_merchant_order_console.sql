-- Order console: the queue a store works from, and the only way it moves an
-- order along.
--
-- A store's lines in an order (order_items.merchant_status) move:
--   pending -> accepted -> preparing -> ready -> shipped
-- 'processing' (set by the older dashboard) counts as accepted. Delivery
-- after 'shipped' stays with the existing driver flow, and cancellations and
-- refunds with the existing refund flow.
--
-- merchant_order_advance() checks the caller's store permission, allows only
-- the next step, locks the lines so two tablets cannot race, records an
-- order_events row and is safe to repeat with the same idempotency key.

CREATE TABLE IF NOT EXISTS public.merchant_order_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_merchant_order_actions_order ON public.merchant_order_actions (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_merchant_order_actions_store ON public.merchant_order_actions (store_id, created_at DESC);

ALTER TABLE public.merchant_order_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_order_actions FROM anon;

DROP POLICY IF EXISTS "Store staff see order actions" ON public.merchant_order_actions;
CREATE POLICY "Store staff see order actions"
  ON public.merchant_order_actions FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));
-- Written only by merchant_order_advance().

-- Paid orders with lines from this store that still need work, oldest first.
-- Customers appear by first name and town only.
CREATE OR REPLACE FUNCTION public.merchant_order_queue(p_store_id uuid, p_include_recent boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'order_console');

  RETURN COALESCE((
    SELECT jsonb_agg(q ORDER BY q.created_at)
    FROM (
      SELECT
        o.id AS order_id,
        o.created_at,
        o.shipping_method,
        o.notes,
        split_part(COALESCE(o.shipping_address ->> 'name', o.shipping_address ->> 'full_name', ''), ' ', 1) AS customer_first_name,
        o.shipping_address ->> 'city' AS customer_city,
        CASE WHEN count(DISTINCT CASE WHEN oi.merchant_status = 'processing' THEN 'accepted' ELSE oi.merchant_status END) = 1
             THEN max(CASE WHEN oi.merchant_status = 'processing' THEN 'accepted' ELSE oi.merchant_status END)
             ELSE 'mixed' END AS status,
        round(sum(oi.price * oi.quantity) * 100)::bigint AS store_total_minor,
        jsonb_agg(jsonb_build_object(
          'item_id', oi.id,
          'product_id', oi.product_id,
          'name', p.name,
          'quantity', oi.quantity,
          'unit_price_minor', round(oi.price * 100)::bigint,
          'variation_id', oi.variation_id) ORDER BY p.name) AS items,
        (SELECT max(a.created_at) FROM public.merchant_order_actions a
          WHERE a.order_id = o.id AND a.store_id = p_store_id) AS last_action_at
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id AND oi.store_id = p_store_id
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE o.payment_status = 'paid'
        AND o.status <> 'cancelled'
        AND (oi.merchant_status IN ('pending', 'processing', 'accepted', 'preparing', 'ready')
          OR (p_include_recent AND oi.merchant_status IN ('shipped', 'out_for_delivery', 'delivered')
              AND o.updated_at > now() - interval '24 hours'))
      GROUP BY o.id
    ) q), '[]'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_order_queue(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_order_queue(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.merchant_order_advance(
  p_store_id uuid, p_order_id uuid, p_to_status text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_done public.merchant_order_actions;
  v_from text;
  v_statuses text[];
  v_allowed text;
  v_payment text;
  v_order_status text;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'order_console');

  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'A request key is required';
  END IF;

  -- The same request again (a retry after a dropped connection): report the first result.
  SELECT * INTO v_done FROM public.merchant_order_actions
   WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
  IF v_done.id IS NOT NULL THEN
    IF v_done.order_id <> p_order_id OR v_done.to_status <> p_to_status THEN
      RAISE EXCEPTION 'That request key was already used for a different change';
    END IF;
    RETURN jsonb_build_object('order_id', p_order_id, 'status', v_done.to_status, 'repeated', true);
  END IF;

  SELECT payment_status, status INTO v_payment, v_order_status
    FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_payment <> 'paid' OR v_order_status = 'cancelled' THEN
    RAISE EXCEPTION 'This order is not paid or was cancelled';
  END IF;

  SELECT array_agg(DISTINCT CASE WHEN merchant_status = 'processing' THEN 'accepted' ELSE merchant_status END)
    INTO v_statuses
    FROM (SELECT merchant_status FROM public.order_items
           WHERE order_id = p_order_id AND store_id = p_store_id FOR UPDATE) lines;
  IF v_statuses IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF array_length(v_statuses, 1) <> 1 THEN
    RAISE EXCEPTION 'The items in this order are at different steps; update them from the Orders page';
  END IF;
  v_from := v_statuses[1];

  v_allowed := CASE v_from
    WHEN 'pending' THEN 'accepted'
    WHEN 'accepted' THEN 'preparing'
    WHEN 'preparing' THEN 'ready'
    WHEN 'ready' THEN 'shipped'
  END;
  IF v_allowed IS NULL OR v_allowed <> p_to_status THEN
    RAISE EXCEPTION 'An order that is % cannot be marked %', v_from, p_to_status;
  END IF;

  UPDATE public.order_items
     SET merchant_status = p_to_status, updated_at = now()
   WHERE order_id = p_order_id AND store_id = p_store_id;

  -- The whole order counts as shipped once every store has sent its part.
  IF p_to_status = 'shipped' AND NOT EXISTS (
       SELECT 1 FROM public.order_items
        WHERE order_id = p_order_id
          AND merchant_status NOT IN ('shipped', 'out_for_delivery', 'delivered')) THEN
    UPDATE public.orders SET status = 'shipped', updated_at = now()
     WHERE id = p_order_id AND status IN ('pending', 'processing');
  END IF;

  INSERT INTO public.merchant_order_actions (store_id, order_id, from_status, to_status, actor_user_id, idempotency_key)
  VALUES (p_store_id, p_order_id, v_from, p_to_status, auth.uid(), p_idempotency_key);

  INSERT INTO public.order_events (order_id, event_type, status, title, actor, metadata)
  VALUES (p_order_id, 'merchant_status', p_to_status,
          CASE p_to_status
            WHEN 'accepted' THEN 'Store accepted your order'
            WHEN 'preparing' THEN 'Store is preparing your order'
            WHEN 'ready' THEN 'Your order is ready'
            WHEN 'shipped' THEN 'Your order is on its way'
          END,
          'merchant',
          jsonb_build_object('store_id', p_store_id));

  RETURN jsonb_build_object('order_id', p_order_id, 'status', p_to_status, 'repeated', false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_order_advance(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_order_advance(uuid, uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
