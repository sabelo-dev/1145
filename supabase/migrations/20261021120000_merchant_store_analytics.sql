-- Store analytics for the merchant dashboard home.
--
-- The dashboard used to add up orders in the browser by reading orders and
-- order_items through the merchant's own access; merchants have no read
-- policy on orders, so those figures came back empty. This function works
-- them out in the database for every store the signed-in merchant owns.
--
-- Definitions match merchant_sales_summary():
--   gross sales = price x quantity of the merchant's order lines on paid,
--   non-cancelled orders, leaving out orders with an approved or completed
--   refund or return; item prices as charged before VAT; shipping excluded.
-- Dates are Africa/Johannesburg; money is integer cents. The current period
-- is the last p_days days including today; the previous period is the
-- p_days before it.

CREATE OR REPLACE FUNCTION public.merchant_store_analytics(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_days integer := CASE WHEN p_days IN (7, 30, 90, 365) THEN p_days ELSE 30 END;
  v_to date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_from date;
  v_prev_from date;
  v_result jsonb;
BEGIN
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user' USING ERRCODE = '42501';
  END IF;
  v_from := v_to - (v_days - 1);
  v_prev_from := v_from - v_days;

  WITH stores AS (
    SELECT id FROM public.stores WHERE merchant_id = v_merchant
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

REVOKE EXECUTE ON FUNCTION public.merchant_store_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_store_analytics(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
