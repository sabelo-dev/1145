-- Staff roles, version 2: manager, operator, cashier.
--
--   owner     orders, catalog, payments, insights, operations, settings
--   manager   orders, catalog, payments, insights, operations
--             (the old "catalogue editor" is merged in: managers run the catalogue)
--   operator  orders, payments, insights, operations
--             (replaces "finance": runs the store day to day)
--   cashier   orders, payments
--
-- "operations" is new. It covers stock levels (merchant_stock_set, with an
-- audit trail), the store's pickup address, and store insights for staff.
-- Existing members are converted: catalog_editor -> manager, finance -> operator.

-- 1. Roles ------------------------------------------------------------------
ALTER TABLE public.store_members DROP CONSTRAINT IF EXISTS store_members_role_check;
UPDATE public.store_members SET role = 'manager', updated_at = now() WHERE role = 'catalog_editor';
UPDATE public.store_members SET role = 'operator', updated_at = now() WHERE role = 'finance';
ALTER TABLE public.store_members
  ADD CONSTRAINT store_members_role_check CHECK (role IN ('manager', 'operator', 'cashier'));

CREATE OR REPLACE FUNCTION public.store_role_permissions(p_role text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY['orders', 'catalog', 'payments', 'insights', 'operations', 'settings']
    WHEN 'manager' THEN ARRAY['orders', 'catalog', 'payments', 'insights', 'operations']
    WHEN 'operator' THEN ARRAY['orders', 'payments', 'insights', 'operations']
    WHEN 'cashier' THEN ARRAY['orders', 'payments']
    ELSE ARRAY[]::text[]
  END;
$function$;

CREATE OR REPLACE FUNCTION public.store_member_upsert(p_store_id uuid, p_email text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_row public.store_members;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'settings');
  IF p_role NOT IN ('manager', 'operator', 'cashier') THEN
    RAISE EXCEPTION 'Unknown role %', p_role;
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No 1145 account uses that email. Ask them to sign up first.';
  END IF;
  IF v_user = auth.uid() THEN
    RAISE EXCEPTION 'You already own this store';
  END IF;

  INSERT INTO public.store_members (store_id, user_id, role, status, added_by)
  VALUES (p_store_id, v_user, p_role, 'active', auth.uid())
  ON CONFLICT (store_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$function$;

-- 2. Pickup address: an operations task now, not owner-only -------------------
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
  PERFORM public.require_store_access(p_store_id, 'operations');
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

-- 3. Stock control -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.merchant_stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  old_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('received', 'count', 'damaged', 'returned', 'other')),
  note text CHECK (note IS NULL OR length(note) <= 200),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_stock_adjustments_store ON public.merchant_stock_adjustments (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_stock_adjustments_product ON public.merchant_stock_adjustments (product_id, created_at DESC);

ALTER TABLE public.merchant_stock_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_stock_adjustments FROM anon;

DROP POLICY IF EXISTS "Store operations staff see stock adjustments" ON public.merchant_stock_adjustments;
CREATE POLICY "Store operations staff see stock adjustments"
  ON public.merchant_stock_adjustments FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'operations', auth.uid()) OR public.is_admin(auth.uid()));
-- Written only by merchant_stock_set().

-- The store's physical products with their stock, variants listed separately.
CREATE OR REPLACE FUNCTION public.merchant_stock_list(p_store_id uuid, p_query text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'operations');
  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY row ->> 'name')
      FROM (
        SELECT jsonb_build_object(
          'product_id', p.id,
          'name', p.name,
          'sku', p.sku,
          'status', p.status,
          'quantity', p.quantity,
          'total', p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0),
          'variations', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('variation_id', v.id, 'sku', v.sku, 'attributes', v.attributes, 'quantity', v.quantity)
                             ORDER BY v.sku NULLS LAST, v.id)
              FROM public.product_variations v WHERE v.product_id = p.id), '[]'::jsonb),
          'last_adjusted_at', (SELECT max(a.created_at) FROM public.merchant_stock_adjustments a WHERE a.product_id = p.id)
        ) AS row
          FROM public.products p
         WHERE p.store_id = p_store_id
           AND p.product_type <> 'downloadable'
           AND p.status IN ('approved', 'active', 'pending', 'draft')
           AND (p_query IS NULL OR p.name ILIKE '%' || replace(replace(left(p_query, 60), '%', ''), '_', '') || '%'
                OR p.sku ILIKE '%' || replace(replace(left(p_query, 60), '%', ''), '_', '') || '%')
         ORDER BY p.name
         LIMIT 200
      ) rows), '[]'::jsonb);
END;
$function$;

-- Sets the stock of a product (or one of its variants) to a counted number,
-- with the reason, and records who changed it from what.
CREATE OR REPLACE FUNCTION public.merchant_stock_set(
  p_store_id uuid, p_product_id uuid, p_variation_id uuid, p_quantity integer, p_reason text, p_note text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old integer;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'operations');
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 1000000 THEN
    RAISE EXCEPTION 'Enter a stock level from 0 to 1 000 000';
  END IF;
  IF p_reason NOT IN ('received', 'count', 'damaged', 'returned', 'other') THEN
    RAISE EXCEPTION 'Choose a reason for the change';
  END IF;

  IF p_variation_id IS NULL THEN
    SELECT quantity INTO v_old FROM public.products
     WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Product not found in this store';
    END IF;
    UPDATE public.products SET quantity = p_quantity, updated_at = now() WHERE id = p_product_id;
  ELSE
    SELECT v.quantity INTO v_old FROM public.product_variations v
      JOIN public.products p ON p.id = v.product_id
     WHERE v.id = p_variation_id AND v.product_id = p_product_id AND p.store_id = p_store_id
       FOR UPDATE OF v;
    IF v_old IS NULL THEN
      RAISE EXCEPTION 'Variant not found in this store';
    END IF;
    UPDATE public.product_variations SET quantity = p_quantity WHERE id = p_variation_id;
  END IF;

  INSERT INTO public.merchant_stock_adjustments
    (store_id, product_id, variation_id, old_quantity, new_quantity, reason, note, actor_user_id)
  VALUES (p_store_id, p_product_id, p_variation_id, v_old, p_quantity, p_reason, NULLIF(trim(p_note), ''), auth.uid());

  RETURN jsonb_build_object('product_id', p_product_id, 'variation_id', p_variation_id, 'old_quantity', v_old, 'new_quantity', p_quantity);
END;
$function$;

-- Recent stock changes for the store.
CREATE OR REPLACE FUNCTION public.merchant_stock_history(p_store_id uuid, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'operations');
  RETURN COALESCE((
    SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
      SELECT a.id, a.created_at, a.old_quantity, a.new_quantity, a.reason, a.note,
             p.name AS product_name, v.sku AS variation_sku, v.attributes AS variation_attributes,
             COALESCE(NULLIF(pr.name, ''), pr.email) AS changed_by
        FROM public.merchant_stock_adjustments a
        JOIN public.products p ON p.id = a.product_id
        LEFT JOIN public.product_variations v ON v.id = a.variation_id
        LEFT JOIN public.profiles pr ON pr.id = a.actor_user_id
       WHERE a.store_id = p_store_id
       ORDER BY a.created_at DESC
       LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)) h), '[]'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_stock_list(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_stock_set(uuid, uuid, uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_stock_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_stock_list(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_stock_set(uuid, uuid, uuid, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_stock_history(uuid, integer) TO authenticated, service_role;

-- 4. Store analytics for staff -------------------------------------------------
-- The analytics query, for a given list of stores. Internal: callers check access.
-- (Generated from 20261021120000 so owner and staff figures are always the same.)
CREATE OR REPLACE FUNCTION public.merchant_analytics_for_stores(p_store_ids uuid[], p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days integer := CASE WHEN p_days IN (7, 30, 90, 365) THEN p_days ELSE 30 END;
  v_to date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_from date;
  v_prev_from date;
  v_result jsonb;
BEGIN
  v_from := v_to - (v_days - 1);
  v_prev_from := v_from - v_days;

  WITH stores AS (
    SELECT unnest(p_store_ids) AS id
  ),
  lines AS (
    SELECT o.id AS order_id,
           o.user_id,
           (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
           oi.product_id,
           oi.quantity,
           round(oi.price * oi.quantity * 100)::bigint AS gross_minor,
           COALESCE(o.refund_status, 'none') IN ('approved', 'completed')
             OR COALESCE(o.return_status, 'none') IN ('approved', 'completed') AS refunded
      FROM public.order_items oi
      JOIN stores s ON s.id = oi.store_id
      JOIN public.orders o ON o.id = oi.order_id
     WHERE o.payment_status = 'paid'
       AND o.status <> 'cancelled'
       AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN v_prev_from AND v_to
  ),
  cur AS (SELECT * FROM lines WHERE day >= v_from AND NOT refunded),
  prev AS (SELECT * FROM lines WHERE day < v_from AND NOT refunded),
  -- A customer is new in the period if their first paid order with this merchant falls in it.
  first_orders AS (
    SELECT o.user_id, min((o.created_at AT TIME ZONE 'Africa/Johannesburg')::date) AS first_day
      FROM public.orders o
     WHERE o.payment_status = 'paid' AND o.status <> 'cancelled'
       AND EXISTS (SELECT 1 FROM public.order_items oi JOIN stores s ON s.id = oi.store_id WHERE oi.order_id = o.id)
     GROUP BY o.user_id
  ),
  kpi AS (
    SELECT
      (SELECT COALESCE(sum(gross_minor), 0) FROM cur) AS gross_cur,
      (SELECT COALESCE(sum(gross_minor), 0) FROM prev) AS gross_prev,
      (SELECT count(DISTINCT order_id) FROM cur) AS orders_cur,
      (SELECT count(DISTINCT order_id) FROM prev) AS orders_prev,
      (SELECT COALESCE(sum(quantity), 0) FROM cur) AS units_cur,
      (SELECT COALESCE(sum(quantity), 0) FROM prev) AS units_prev,
      (SELECT count(DISTINCT user_id) FROM cur) AS customers_cur,
      (SELECT count(DISTINCT user_id) FROM prev) AS customers_prev,
      (SELECT count(DISTINCT c.user_id) FROM cur c JOIN first_orders f ON f.user_id = c.user_id WHERE f.first_day >= v_from) AS new_customers,
      (SELECT count(DISTINCT order_id) FROM lines WHERE refunded AND day >= v_from) AS refunded_cur,
      (SELECT count(DISTINCT order_id) FROM lines WHERE day >= v_from) AS all_orders_cur,
      (SELECT count(DISTINCT order_id) FROM lines WHERE refunded AND day < v_from) AS refunded_prev,
      (SELECT count(DISTINCT order_id) FROM lines WHERE day < v_from) AS all_orders_prev
  ),
  pay AS (
    SELECT
      COALESCE(sum(r.amount_minor) FILTER (WHERE (r.paid_at AT TIME ZONE 'Africa/Johannesburg')::date >= v_from), 0) AS pay_cur,
      COALESCE(sum(r.amount_minor) FILTER (WHERE (r.paid_at AT TIME ZONE 'Africa/Johannesburg')::date < v_from), 0) AS pay_prev
      FROM public.merchant_payment_requests r
      JOIN stores s ON s.id = r.store_id
     WHERE r.status IN ('paid', 'refund_due')
       AND (r.paid_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN v_prev_from AND v_to
  ),
  stock AS (
    SELECT p.id, p.status,
           p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0) AS qty,
           p.product_type, p.rating, p.review_count
      FROM public.products p JOIN stores s ON s.id = p.store_id
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('days', v_days, 'from', v_from, 'to', v_to, 'previous_from', v_prev_from, 'previous_to', v_from - 1),
    'timezone', 'Africa/Johannesburg',
    'currency', 'ZAR',
    'as_of', now(),
    'definition', 'Gross sales: price x quantity of your lines on paid orders, excluding cancelled and refunded or returned orders; item prices as charged before VAT; shipping excluded.',
    'kpis', (SELECT jsonb_build_object(
      'gross_sales_minor', jsonb_build_object('current', gross_cur, 'previous', gross_prev),
      'orders', jsonb_build_object('current', orders_cur, 'previous', orders_prev),
      'average_order_minor', jsonb_build_object(
        'current', COALESCE(round(gross_cur::numeric / NULLIF(orders_cur, 0)), 0),
        'previous', COALESCE(round(gross_prev::numeric / NULLIF(orders_prev, 0)), 0)),
      'units', jsonb_build_object('current', units_cur, 'previous', units_prev),
      'customers', jsonb_build_object('current', customers_cur, 'previous', customers_prev,
                                      'new', new_customers, 'returning', customers_cur - new_customers),
      'refund_rate', jsonb_build_object(
        'current', COALESCE(round(refunded_cur::numeric / NULLIF(all_orders_cur, 0), 4), 0),
        'previous', COALESCE(round(refunded_prev::numeric / NULLIF(all_orders_prev, 0), 4), 0)),
      'pay_collected_minor', (SELECT jsonb_build_object('current', pay_cur, 'previous', pay_prev) FROM pay)
    ) FROM kpi),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('date', d.day, 'gross_minor', COALESCE(x.gross, 0), 'orders', COALESCE(x.orders, 0)) ORDER BY d.day)
        FROM generate_series(v_from, v_to, interval '1 day') AS d(day)
        LEFT JOIN (SELECT day, sum(gross_minor) AS gross, count(DISTINCT order_id) AS orders FROM cur GROUP BY day) x
          ON x.day = d.day::date), '[]'::jsonb),
    'by_weekday', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('weekday', w.dow, 'gross_minor', COALESCE(x.gross, 0), 'orders', COALESCE(x.orders, 0)) ORDER BY w.dow)
        FROM generate_series(1, 7) AS w(dow)
        LEFT JOIN (SELECT extract(isodow FROM day)::int AS dow, sum(gross_minor) AS gross, count(DISTINCT order_id) AS orders
                     FROM cur GROUP BY 1) x ON x.dow = w.dow), '[]'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.gross_minor DESC) FROM (
        SELECT c.product_id, COALESCE(p.name, 'Removed product') AS name, sum(c.quantity)::bigint AS units, sum(c.gross_minor)::bigint AS gross_minor
          FROM cur c LEFT JOIN public.products p ON p.id = c.product_id
         GROUP BY c.product_id, p.name ORDER BY gross_minor DESC LIMIT 8) t), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.gross_minor DESC) FROM (
        SELECT COALESCE(NULLIF(p.category, ''), 'Uncategorised') AS category, sum(c.gross_minor)::bigint AS gross_minor, sum(c.quantity)::bigint AS units
          FROM cur c LEFT JOIN public.products p ON p.id = c.product_id
         GROUP BY 1 ORDER BY gross_minor DESC LIMIT 8) t), '[]'::jsonb),
    'fulfilment', COALESCE((
      SELECT jsonb_object_agg(step, n) FROM (
        SELECT CASE WHEN oi.merchant_status = 'processing' THEN 'accepted' ELSE oi.merchant_status END AS step,
               count(DISTINCT oi.order_id) AS n
          FROM public.order_items oi JOIN stores s ON s.id = oi.store_id JOIN public.orders o ON o.id = oi.order_id
         WHERE o.payment_status = 'paid' AND o.status <> 'cancelled'
           AND oi.merchant_status IN ('pending', 'processing', 'accepted', 'preparing', 'ready', 'shipped', 'out_for_delivery')
         GROUP BY 1) f), '{}'::jsonb),
    'stock', (SELECT jsonb_build_object(
      'listed', count(*) FILTER (WHERE status IN ('approved', 'active')),
      'pending_approval', count(*) FILTER (WHERE status = 'pending'),
      'in_stock', count(*) FILTER (WHERE status IN ('approved', 'active') AND (product_type = 'downloadable' OR qty > 5)),
      'low_stock', count(*) FILTER (WHERE status IN ('approved', 'active') AND product_type <> 'downloadable' AND qty BETWEEN 1 AND 5),
      'out_of_stock', count(*) FILTER (WHERE status IN ('approved', 'active') AND product_type <> 'downloadable' AND qty <= 0),
      'rating', round((sum(COALESCE(rating, 0) * COALESCE(review_count, 0)) / NULLIF(sum(COALESCE(review_count, 0)), 0))::numeric, 2),
      'reviews', COALESCE(sum(review_count), 0)) FROM stock)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_analytics_for_stores(uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_analytics_for_stores(uuid[], integer) TO service_role;

-- Owners (no store given): every store they own. Staff: one store where they
-- have the insights permission (managers and operators).
DROP FUNCTION IF EXISTS public.merchant_store_analytics(integer);
CREATE OR REPLACE FUNCTION public.merchant_store_analytics(p_days integer DEFAULT 30, p_store_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_store_ids uuid[];
BEGIN
  IF p_store_id IS NULL THEN
    SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1;
    IF v_merchant IS NULL THEN
      RAISE EXCEPTION 'No merchant account found for this user' USING ERRCODE = '42501';
    END IF;
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_store_ids FROM public.stores WHERE merchant_id = v_merchant;
  ELSE
    PERFORM public.require_store_access(p_store_id, 'insights');
    v_store_ids := ARRAY[p_store_id];
  END IF;
  RETURN public.merchant_analytics_for_stores(v_store_ids, p_days);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_store_analytics(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_store_analytics(integer, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
