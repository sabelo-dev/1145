-- Driver delivery from the order console.
--
-- Stores get a pickup address (stores.pickup_address). Until now delivery was
-- requested from the browser with the pickup address hard-coded to
-- Johannesburg. merchant_order_request_delivery() posts the delivery_jobs row
-- for an order instead: pickup from the store, drop-off from the order's own
-- shipping address. One job per order (delivery_jobs_order_id_key), so asking
-- twice returns the existing job.
--
-- An order with lines from more than one store is not posted here: one job
-- cannot collect from two shops. Those stay with the Orders page for now.

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pickup_address jsonb;

-- Rough South Africa bounds, to catch a pin dropped in the wrong place.
CREATE OR REPLACE FUNCTION public.za_coords_ok(p_lat numeric, p_lng numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT p_lat BETWEEN -35.5 AND -21.5 AND p_lng BETWEEN 16 AND 33.5;
$function$;

-- The owner sets where drivers collect from. Coordinates come from the
-- browser's geocoder and are optional.
CREATE OR REPLACE FUNCTION public.store_set_pickup_address(
  p_store_id uuid, p_street text, p_city text, p_province text, p_phone text,
  p_lat numeric DEFAULT NULL, p_lng numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_address jsonb;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'settings');
  IF COALESCE(trim(p_street), '') = '' OR COALESCE(trim(p_city), '') = '' THEN
    RAISE EXCEPTION 'Street and town are required';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL) OR (p_lat IS NOT NULL AND NOT public.za_coords_ok(p_lat, p_lng)) THEN
    RAISE EXCEPTION 'That location is not in South Africa';
  END IF;

  v_address := jsonb_strip_nulls(jsonb_build_object(
    'name', (SELECT name FROM public.stores WHERE id = p_store_id),
    'street', left(trim(p_street), 200),
    'city', left(trim(p_city), 100),
    'province', NULLIF(left(trim(COALESCE(p_province, '')), 100), ''),
    'country', 'South Africa',
    'phone', NULLIF(left(trim(COALESCE(p_phone, '')), 30), ''),
    'lat', p_lat,
    'lng', p_lng));

  UPDATE public.stores SET pickup_address = v_address, updated_at = now() WHERE id = p_store_id;
  RETURN v_address;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_order_request_delivery(
  p_store_id uuid, p_order_id uuid, p_drop_lat numeric DEFAULT NULL, p_drop_lng numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders;
  v_pickup jsonb;
  v_drop jsonb;
  v_steps text[];
  v_job record;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'order_console');

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND store_id = p_store_id) THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.payment_status <> 'paid' OR v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'This order is not paid or was cancelled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND store_id IS DISTINCT FROM p_store_id) THEN
    RAISE EXCEPTION 'This order includes items from other stores; arrange its delivery from the Orders page';
  END IF;

  SELECT id, status INTO v_job FROM public.delivery_jobs WHERE order_id = p_order_id;
  IF v_job.id IS NOT NULL THEN
    RETURN jsonb_build_object('delivery_job_id', v_job.id, 'status', v_job.status, 'repeated', true);
  END IF;

  SELECT array_agg(DISTINCT merchant_status) INTO v_steps
    FROM public.order_items WHERE order_id = p_order_id AND store_id = p_store_id;
  IF NOT v_steps <@ ARRAY['ready', 'shipped'] THEN
    RAISE EXCEPTION 'Mark the order ready before requesting a driver';
  END IF;

  SELECT pickup_address INTO v_pickup FROM public.stores WHERE id = p_store_id;
  IF v_pickup IS NULL THEN
    RAISE EXCEPTION 'Add the store''s pickup address first';
  END IF;

  v_drop := COALESCE(v_order.shipping_address, '{}'::jsonb);
  IF COALESCE(v_drop ->> 'street', v_drop ->> 'address', '') = '' THEN
    RAISE EXCEPTION 'This order has no delivery address';
  END IF;
  -- The drop-off pin may come from the browser's geocoder; the address itself never does.
  IF p_drop_lat IS NOT NULL AND p_drop_lng IS NOT NULL AND public.za_coords_ok(p_drop_lat, p_drop_lng)
     AND v_drop ->> 'lat' IS NULL THEN
    v_drop := v_drop || jsonb_build_object('lat', p_drop_lat, 'lng', p_drop_lng);
  END IF;

  INSERT INTO public.delivery_jobs (order_id, status, pickup_address, delivery_address, notes)
  VALUES (p_order_id, 'pending', v_pickup, v_drop, 'Order from ' || COALESCE(v_pickup ->> 'name', 'a 1145 store'))
  ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING
  RETURNING id, status INTO v_job;

  IF v_job.id IS NULL THEN
    SELECT id, status INTO v_job FROM public.delivery_jobs WHERE order_id = p_order_id;
    RETURN jsonb_build_object('delivery_job_id', v_job.id, 'status', v_job.status, 'repeated', true);
  END IF;

  INSERT INTO public.order_events (order_id, event_type, status, title, actor, metadata)
  VALUES (p_order_id, 'delivery_requested', 'pending', 'A driver is being found for your order', 'merchant',
          jsonb_build_object('store_id', p_store_id, 'delivery_job_id', v_job.id));

  RETURN jsonb_build_object('delivery_job_id', v_job.id, 'status', v_job.status, 'repeated', false);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.store_set_pickup_address(uuid, text, text, text, text, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_order_request_delivery(uuid, uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_set_pickup_address(uuid, text, text, text, text, numeric, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_order_request_delivery(uuid, uuid, numeric, numeric) TO authenticated, service_role;

-- The queue now also says whether a driver job exists, and the store's pickup address.
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
          WHERE a.order_id = o.id AND a.store_id = p_store_id) AS last_action_at,
        (SELECT dj.status FROM public.delivery_jobs dj WHERE dj.order_id = o.id) AS delivery_status,
        NOT EXISTS (SELECT 1 FROM public.order_items x WHERE x.order_id = o.id AND x.store_id IS DISTINCT FROM p_store_id) AS single_store,
        COALESCE(o.shipping_address ->> 'street', o.shipping_address ->> 'address', '') <> '' AS has_delivery_address
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

-- The order's drop-off address for geocoding the driver pin, for the store's own single-store orders.
CREATE OR REPLACE FUNCTION public.merchant_order_drop_address(p_store_id uuid, p_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_address jsonb;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'order_console');
  SELECT o.shipping_address INTO v_address FROM public.orders o
   WHERE o.id = p_order_id AND o.payment_status = 'paid'
     AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.store_id = p_store_id);
  IF v_address IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN concat_ws(', ', COALESCE(v_address ->> 'street', v_address ->> 'address'), v_address ->> 'city',
                   v_address ->> 'province', v_address ->> 'postal_code', 'South Africa');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_order_drop_address(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_order_drop_address(uuid, uuid) TO authenticated, service_role;

-- merchant_my_access() also reports the pickup address, so the console can ask for it.
CREATE OR REPLACE FUNCTION public.merchant_my_access()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'store_id', s.id,
      'store_name', s.name,
      'store_slug', s.slug,
      'merchant_id', s.merchant_id,
      'role', r.role,
      'permissions', to_jsonb(public.store_role_permissions(r.role)),
      'features', COALESCE((
        SELECT jsonb_agg(f.flag_key ORDER BY f.flag_key)
          FROM public.merchant_feature_flags f
         WHERE f.merchant_id = s.merchant_id AND f.enabled), '[]'::jsonb),
      'pickup_address', s.pickup_address
    ) ORDER BY s.name), '[]'::jsonb)
  FROM public.stores s
  CROSS JOIN LATERAL (SELECT public.store_role(s.id, auth.uid()) AS role) r
  WHERE r.role IS NOT NULL
    AND (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = s.merchant_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.store_id = s.id AND sm.user_id = auth.uid()));
$function$;

NOTIFY pgrst, 'reload schema';
