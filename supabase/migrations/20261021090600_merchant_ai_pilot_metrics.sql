-- Pilot measurement for Merchant AI (Mbombela and later cohorts). Admins only.
--
-- A merchant is in a cohort when any of its feature flags carries that cohort
-- label and is on. "Active" in a period means the merchant's stores moved an
-- order in the console, created a payment link, or asked 1145 AI. Dates are
-- Africa/Johannesburg; money is cents. Success thresholds are agreed
-- separately; this only reports.

CREATE OR REPLACE FUNCTION public.admin_merchant_ai_pilot_metrics(p_cohort text, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  PERFORM public.merchant_check_period(p_from, p_to);

  WITH cohort AS (
    SELECT DISTINCT f.merchant_id
      FROM public.merchant_feature_flags f
     WHERE f.enabled AND (p_cohort IS NULL OR f.rollout_cohort = p_cohort)
  ),
  cohort_stores AS (
    SELECT s.id AS store_id, s.merchant_id FROM public.stores s JOIN cohort c ON c.merchant_id = s.merchant_id
  ),
  actions AS (
    SELECT cs.merchant_id, a.to_status, a.created_at, o.created_at AS order_created_at
      FROM public.merchant_order_actions a
      JOIN cohort_stores cs ON cs.store_id = a.store_id
      JOIN public.orders o ON o.id = a.order_id
     WHERE (a.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  ),
  links AS (
    SELECT cs.merchant_id, r.*
      FROM public.merchant_payment_requests r
      JOIN cohort_stores cs ON cs.store_id = r.store_id
     WHERE (r.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  ),
  ai AS (
    SELECT cs.merchant_id, u.*
      FROM public.merchant_ai_usage u
      JOIN cohort_stores cs ON cs.store_id = u.store_id
     WHERE u.usage_date BETWEEN p_from AND p_to
  ),
  drafts AS (
    SELECT cs.merchant_id, d.approval_state
      FROM public.merchant_ai_drafts d
      JOIN cohort_stores cs ON cs.store_id = d.store_id
     WHERE (d.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  ),
  activity AS (
    SELECT merchant_id, (created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day FROM actions
    UNION ALL SELECT merchant_id, (created_at AT TIME ZONE 'Africa/Johannesburg')::date FROM links
    UNION ALL SELECT merchant_id, usage_date FROM ai WHERE requests > 0
  ),
  exceptions AS (
    SELECT e.outcome, count(*) AS n
      FROM public.merchant_payment_events e
      JOIN public.merchant_payment_requests r ON r.id = e.request_id
      JOIN cohort_stores cs ON cs.store_id = r.store_id
     WHERE e.outcome IN ('amount_mismatch', 'not_found', 'paid_after_cancellation')
       AND (e.processed_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
     GROUP BY e.outcome
  )
  SELECT jsonb_build_object(
    'cohort', p_cohort,
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'timezone', 'Africa/Johannesburg',
    'as_of', now(),
    'merchants_in_cohort', (SELECT count(*) FROM cohort),
    'active_merchants', (SELECT count(DISTINCT merchant_id) FROM activity),
    'weekly_active_merchants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('week_start', wk, 'merchants', n) ORDER BY wk)
        FROM (SELECT date_trunc('week', day)::date AS wk, count(DISTINCT merchant_id) AS n FROM activity GROUP BY 1) w), '[]'::jsonb),
    'staff_members', (SELECT count(*) FROM public.store_members sm JOIN cohort_stores cs ON cs.store_id = sm.store_id WHERE sm.status = 'active'),
    'orders_accepted_in_console', (SELECT count(*) FROM actions WHERE to_status = 'accepted'),
    'orders_dispatched_in_console', (SELECT count(*) FROM actions WHERE to_status = 'shipped'),
    'median_minutes_to_accept', (
      SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM created_at - order_created_at) / 60))::numeric, 1)
        FROM actions WHERE to_status = 'accepted'),
    'payment_links_created', (SELECT count(*) FROM links),
    'payment_links_paid', (SELECT count(*) FROM links WHERE status IN ('paid', 'refund_due')),
    'payment_link_completion_rate', (
      SELECT round(count(*) FILTER (WHERE status IN ('paid', 'refund_due'))::numeric / NULLIF(count(*), 0), 3) FROM links),
    'payment_links_paid_minor', (SELECT COALESCE(sum(amount_minor), 0) FROM links WHERE status IN ('paid', 'refund_due')),
    'payment_links_refund_due', (SELECT count(*) FROM links WHERE status = 'refund_due'),
    'reconciliation_exceptions', COALESCE((SELECT jsonb_object_agg(outcome, n) FROM exceptions), '{}'::jsonb),
    'ai_questions', (SELECT COALESCE(sum(requests), 0) FROM ai),
    'ai_input_tokens', (SELECT COALESCE(sum(input_tokens), 0) FROM ai),
    'ai_output_tokens', (SELECT COALESCE(sum(output_tokens), 0) FROM ai),
    'ai_tool_errors', (
      SELECT count(*) FROM public.merchant_ai_tool_executions t JOIN cohort_stores cs ON cs.store_id = t.store_id
       WHERE t.outcome <> 'success' AND (t.created_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to),
    'ai_drafts', jsonb_build_object(
      'created', (SELECT count(*) FROM drafts),
      'approved', (SELECT count(*) FROM drafts WHERE approval_state = 'approved'),
      'rejected', (SELECT count(*) FROM drafts WHERE approval_state = 'rejected'),
      'approval_rate', (SELECT round(count(*) FILTER (WHERE approval_state = 'approved')::numeric
                                     / NULLIF(count(*) FILTER (WHERE approval_state <> 'draft'), 0), 3) FROM drafts)),
    'merchants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
          'merchant_id', m.id,
          'business_name', m.business_name,
          'last_active', (SELECT max(day) FROM activity a WHERE a.merchant_id = m.id),
          'active_days', (SELECT count(DISTINCT day) FROM activity a WHERE a.merchant_id = m.id),
          'orders_accepted', (SELECT count(*) FROM actions a WHERE a.merchant_id = m.id AND a.to_status = 'accepted'),
          'payment_links_paid', (SELECT count(*) FROM links l WHERE l.merchant_id = m.id AND l.status IN ('paid', 'refund_due')),
          'ai_questions', (SELECT COALESCE(sum(requests), 0) FROM ai WHERE ai.merchant_id = m.id))
        ORDER BY m.business_name)
        FROM public.merchants m JOIN cohort c ON c.merchant_id = m.id), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_merchant_ai_pilot_metrics(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merchant_ai_pilot_metrics(text, date, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
