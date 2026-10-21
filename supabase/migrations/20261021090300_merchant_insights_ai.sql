-- Store insights and the 1145 AI assistant.
--
-- The assistant never writes SQL. It may only call the functions below, each
-- of which checks the signed-in user's permission in the store, works in
-- whole cents and Africa/Johannesburg dates, and says how its figures are
-- defined. The merchant-ai edge function calls them with the user's own
-- session, so the database decides access, not the model.
--
-- Sales definition used everywhere here:
--   gross sales = price x quantity of this store's order lines on paid orders,
--   leaving out cancelled orders and orders with an approved or completed
--   refund or return. Line prices are what the customer was charged per item
--   (including the 1145 markup, before VAT); shipping is not included.
--   Payment-request takings are reported separately.

-- ---------------------------------------------------------------------------
-- Insights
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.merchant_check_period(p_from date, p_to date)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Give a start date on or before the end date';
  END IF;
  IF p_to - p_from > 366 THEN
    RAISE EXCEPTION 'Periods are limited to one year';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_sales_summary(p_store_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'insights');
  PERFORM public.merchant_check_period(p_from, p_to);

  WITH lines AS (
    SELECT o.id AS order_id,
           (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
           round(oi.price * oi.quantity * 100)::bigint AS gross_minor,
           oi.quantity,
           COALESCE(o.refund_status, 'none') IN ('approved', 'completed')
             OR COALESCE(o.return_status, 'none') IN ('approved', 'completed') AS refunded
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.store_id = p_store_id
       AND o.payment_status = 'paid'
       AND o.status <> 'cancelled'
       AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  ),
  counted AS (SELECT * FROM lines WHERE NOT refunded),
  days AS (
    SELECT day, sum(gross_minor) AS gross_minor, count(DISTINCT order_id) AS orders
      FROM counted GROUP BY day
  ),
  requests AS (
    SELECT COALESCE(sum(amount_minor), 0) AS paid_minor, count(*) AS paid_count
      FROM public.merchant_payment_requests
     WHERE store_id = p_store_id AND status IN ('paid', 'refund_due')
       AND (paid_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  )
  SELECT jsonb_build_object(
    'metric', 'sales_summary',
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'timezone', 'Africa/Johannesburg',
    'currency', 'ZAR',
    'definition', 'Gross sales: price x quantity of this store''s lines on paid orders, excluding cancelled and refunded or returned orders; item prices as charged before VAT; shipping excluded.',
    'as_of', now(),
    'gross_sales_minor', COALESCE((SELECT sum(gross_minor) FROM counted), 0),
    'orders', (SELECT count(DISTINCT order_id) FROM counted),
    'units', COALESCE((SELECT sum(quantity) FROM counted), 0),
    'average_order_minor', COALESCE((SELECT round(sum(gross_minor)::numeric / NULLIF(count(DISTINCT order_id), 0))::bigint FROM counted), 0),
    'refunded_or_returned_orders', (SELECT count(DISTINCT order_id) FROM lines WHERE refunded),
    'payment_requests_paid_minor', (SELECT paid_minor FROM requests),
    'payment_requests_paid_count', (SELECT paid_count FROM requests),
    'by_day', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', day, 'gross_minor', gross_minor, 'orders', orders) ORDER BY day) FROM days), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_top_products(p_store_id uuid, p_from date, p_to date, p_limit integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'insights');
  PERFORM public.merchant_check_period(p_from, p_to);

  RETURN jsonb_build_object(
    'metric', 'top_products',
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'timezone', 'Africa/Johannesburg',
    'currency', 'ZAR',
    'definition', 'Products ranked by units sold on paid orders, excluding cancelled and refunded or returned orders; gross is price x quantity before VAT.',
    'as_of', now(),
    'products', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.units DESC, t.gross_minor DESC)
        FROM (
          SELECT oi.product_id, p.name, sum(oi.quantity)::bigint AS units,
                 round(sum(oi.price * oi.quantity) * 100)::bigint AS gross_minor
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            LEFT JOIN public.products p ON p.id = oi.product_id
           WHERE oi.store_id = p_store_id
             AND o.payment_status = 'paid'
             AND o.status <> 'cancelled'
             AND COALESCE(o.refund_status, 'none') NOT IN ('approved', 'completed')
             AND COALESCE(o.return_status, 'none') NOT IN ('approved', 'completed')
             AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
           GROUP BY oi.product_id, p.name
           ORDER BY units DESC, gross_minor DESC
           LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
        ) t), '[]'::jsonb));
END;
$function$;

-- Listed products at or below the low-stock line, with recent sales so the
-- merchant can see which ones will run out first. Stock counts a product's own
-- quantity plus all its options, as the storefront does.
CREATE OR REPLACE FUNCTION public.merchant_stock_alerts(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'insights');

  RETURN jsonb_build_object(
    'metric', 'stock_alerts',
    'low_stock_threshold', 5,
    'definition', 'Approved or active physical products whose stock (own quantity plus all options) is 5 or fewer; units_sold_30d counts paid, non-cancelled orders in the last 30 days.',
    'as_of', now(),
    'items', COALESCE((
      SELECT jsonb_agg(a ORDER BY a.stock, a.units_sold_30d DESC)
        FROM (
          SELECT p.id AS product_id, p.name, p.sku,
                 (p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0))::bigint AS stock,
                 CASE WHEN p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0) <= 0
                      THEN 'out_of_stock' ELSE 'low_stock' END AS state,
                 COALESCE((SELECT sum(oi.quantity) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                            WHERE oi.product_id = p.id AND o.payment_status = 'paid' AND o.status <> 'cancelled'
                              AND o.created_at > now() - interval '30 days'), 0)::bigint AS units_sold_30d
            FROM public.products p
           WHERE p.store_id = p_store_id
             AND p.status IN ('approved', 'active')
             AND p.product_type <> 'downloadable'
             AND p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0) <= 5
           LIMIT 50
        ) a), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_fulfillment_metrics(p_store_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'insights');
  PERFORM public.merchant_check_period(p_from, p_to);

  RETURN jsonb_build_object(
    'metric', 'fulfillment',
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'timezone', 'Africa/Johannesburg',
    'definition', 'Paid, non-cancelled orders with lines from this store placed in the period, counted by the store''s step. Acceptance time is minutes from order placed to accepted, measured only for orders accepted in the order console.',
    'as_of', now(),
    'orders_by_status', COALESCE((
      SELECT jsonb_object_agg(status, n) FROM (
        SELECT CASE WHEN oi.merchant_status = 'processing' THEN 'accepted' ELSE oi.merchant_status END AS status,
               count(DISTINCT o.id) AS n
          FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
         WHERE oi.store_id = p_store_id AND o.payment_status = 'paid' AND o.status <> 'cancelled'
           AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
         GROUP BY 1) s), '{}'::jsonb),
    'waiting_over_24h', (
      SELECT count(DISTINCT o.id)
        FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
       WHERE oi.store_id = p_store_id AND o.payment_status = 'paid' AND o.status <> 'cancelled'
         AND oi.merchant_status IN ('pending', 'processing', 'accepted', 'preparing', 'ready')
         AND o.created_at < now() - interval '24 hours'),
    'median_minutes_to_accept', (
      SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM a.created_at - o.created_at) / 60))::numeric, 1)
        FROM public.merchant_order_actions a JOIN public.orders o ON o.id = a.order_id
       WHERE a.store_id = p_store_id AND a.to_status = 'accepted'
         AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to),
    'accepted_in_console', (
      SELECT count(*) FROM public.merchant_order_actions a JOIN public.orders o ON o.id = a.order_id
       WHERE a.store_id = p_store_id AND a.to_status = 'accepted'
         AND (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to));
END;
$function$;

-- Product facts for writing copy. Either one product by id or a name search.
CREATE OR REPLACE FUNCTION public.merchant_find_products(p_store_id uuid, p_query text DEFAULT NULL, p_product_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.store_has_permission(p_store_id, 'catalog') OR public.store_has_permission(p_store_id, 'insights')) THEN
    RAISE EXCEPTION 'You do not have catalog access to this store' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'metric', 'products',
    'as_of', now(),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'product_id', p.id, 'name', p.name, 'sku', p.sku, 'category', p.category,
          'subcategory', p.subcategory, 'status', p.status, 'product_type', p.product_type,
          'price_minor', round(p.price * 100)::bigint,
          'stock', p.quantity + COALESCE((SELECT sum(v.quantity) FROM public.product_variations v WHERE v.product_id = p.id), 0),
          'description', left(COALESCE(p.description, ''), 1500)) ORDER BY p.name)
        FROM (
          SELECT * FROM public.products p
           WHERE p.store_id = p_store_id
             AND (p_product_id IS NULL OR p.id = p_product_id)
             AND (p_query IS NULL OR p.name ILIKE '%' || replace(replace(left(p_query, 60), '%', ''), '_', '') || '%')
           ORDER BY p.name
           LIMIT 10) p), '[]'::jsonb));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_sales_summary(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_top_products(uuid, date, date, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_stock_alerts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_fulfillment_metrics(uuid, date, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_find_products(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_sales_summary(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_top_products(uuid, date, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_stock_alerts(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_fulfillment_metrics(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_find_products(uuid, text, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Assistant records: conversations, tool calls, drafts and usage.
-- Written by the merchant-ai edge function with the service role.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.merchant_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_ai_conversations_actor ON public.merchant_ai_conversations (store_id, actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.merchant_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_ai_messages_conversation ON public.merchant_ai_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.merchant_ai_tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.merchant_ai_conversations(id) ON DELETE SET NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  parameters_digest text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'error', 'denied')),
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_ai_tool_executions_store ON public.merchant_ai_tool_executions (store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.merchant_ai_conversations(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('product_description', 'promotion')),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 5000),
  approval_state text NOT NULL DEFAULT 'draft' CHECK (approval_state IN ('draft', 'approved', 'rejected')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_type <> 'product_description' OR product_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_merchant_ai_drafts_store ON public.merchant_ai_drafts (store_id, approval_state, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_ai_usage (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, usage_date)
);

ALTER TABLE public.merchant_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ai_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ai_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ai_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.merchant_ai_conversations, public.merchant_ai_messages, public.merchant_ai_tool_executions,
  public.merchant_ai_drafts, public.merchant_ai_usage FROM anon;

-- A conversation belongs to the person who had it, in a store they still have access to.
DROP POLICY IF EXISTS "Own AI conversations" ON public.merchant_ai_conversations;
CREATE POLICY "Own AI conversations"
  ON public.merchant_ai_conversations FOR SELECT TO authenticated
  USING ((actor_user_id = auth.uid() AND public.store_has_permission(store_id, 'insights', auth.uid()))
    OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Own AI messages" ON public.merchant_ai_messages;
CREATE POLICY "Own AI messages"
  ON public.merchant_ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchant_ai_conversations c
                  WHERE c.id = merchant_ai_messages.conversation_id
                    AND ((c.actor_user_id = auth.uid() AND public.store_has_permission(c.store_id, 'insights', auth.uid()))
                      OR public.is_admin(auth.uid()))));

DROP POLICY IF EXISTS "Admins see AI tool executions" ON public.merchant_ai_tool_executions;
CREATE POLICY "Admins see AI tool executions"
  ON public.merchant_ai_tool_executions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.store_role(store_id, auth.uid()) = 'owner');

DROP POLICY IF EXISTS "Store editors see AI drafts" ON public.merchant_ai_drafts;
CREATE POLICY "Store editors see AI drafts"
  ON public.merchant_ai_drafts FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'catalog', auth.uid())
    OR public.store_has_permission(store_id, 'insights', auth.uid())
    OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Owners and admins see AI usage" ON public.merchant_ai_usage;
CREATE POLICY "Owners and admins see AI usage"
  ON public.merchant_ai_usage FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.store_role(store_id, auth.uid()) = 'owner');

-- Counts one assistant request against the store's daily allowance.
-- Returns false, without counting, when the allowance is used up.
CREATE OR REPLACE FUNCTION public.merchant_ai_reserve_request(p_store_id uuid, p_daily_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_requests integer;
BEGIN
  INSERT INTO public.merchant_ai_usage (store_id, usage_date) VALUES (p_store_id, v_today)
  ON CONFLICT (store_id, usage_date) DO NOTHING;

  UPDATE public.merchant_ai_usage
     SET requests = requests + 1
   WHERE store_id = p_store_id AND usage_date = v_today AND requests < p_daily_limit
  RETURNING requests INTO v_requests;

  RETURN v_requests IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.merchant_ai_record_tokens(p_store_id uuid, p_input bigint, p_output bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.merchant_ai_usage
     SET input_tokens = input_tokens + GREATEST(p_input, 0),
         output_tokens = output_tokens + GREATEST(p_output, 0)
   WHERE store_id = p_store_id AND usage_date = (now() AT TIME ZONE 'Africa/Johannesburg')::date;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_ai_reserve_request(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merchant_ai_record_tokens(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_ai_reserve_request(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.merchant_ai_record_tokens(uuid, bigint, bigint) TO service_role;

-- A person approves or rejects a draft. Approving a product description puts
-- it on the product (optionally after editing it); approving a promotion only
-- marks it approved, and the merchant creates the promotion themselves.
CREATE OR REPLACE FUNCTION public.merchant_ai_draft_decide(p_draft_id uuid, p_decision text, p_content text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_draft public.merchant_ai_drafts;
  v_content text;
BEGIN
  SELECT * INTO v_draft FROM public.merchant_ai_drafts WHERE id = p_draft_id FOR UPDATE;
  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;
  PERFORM public.require_store_access(v_draft.store_id, 'catalog', 'ai_assistant');
  IF v_draft.approval_state <> 'draft' THEN
    RAISE EXCEPTION 'This draft was already %', v_draft.approval_state;
  END IF;
  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Unknown decision %', p_decision;
  END IF;

  v_content := COALESCE(NULLIF(trim(p_content), ''), v_draft.content);
  IF length(v_content) > 5000 THEN
    RAISE EXCEPTION 'Descriptions are limited to 5000 characters';
  END IF;

  IF p_decision = 'approve' AND v_draft.target_type = 'product_description' THEN
    UPDATE public.products SET description = v_content, updated_at = now()
     WHERE id = v_draft.product_id AND store_id = v_draft.store_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The product is no longer in this store';
    END IF;
  END IF;

  UPDATE public.merchant_ai_drafts
     SET approval_state = CASE p_decision WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
         content = v_content,
         decided_by = auth.uid(),
         decided_at = now()
   WHERE id = p_draft_id
  RETURNING * INTO v_draft;

  RETURN to_jsonb(v_draft);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_ai_draft_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_ai_draft_decide(uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
