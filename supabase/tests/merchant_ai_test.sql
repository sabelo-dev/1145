-- Merchant AI security and money tests.
--
-- Run against a local or staging database after the 20261021* migrations:
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/merchant_ai_test.sql
-- Everything runs in one transaction that is rolled back. A failed check
-- raises an exception naming it; success prints "merchant ai tests passed".
--
-- Who is who:
--   owner_a    owns merchant A / store A
--   cashier_a  cashier in store A (orders, payments)
--   editor_a   catalog editor in store A
--   owner_b    owns merchant B / store B (the other tenant)
--   consumer   a shopper with no store
--   admin      platform admin

BEGIN;

-- Test helpers live in a schema that the final ROLLBACK removes.
CREATE SCHEMA mai_test;
GRANT USAGE, CREATE ON SCHEMA mai_test TO PUBLIC;

CREATE FUNCTION mai_test.act_as(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', CASE WHEN p_user IS NULL THEN 'anon' ELSE 'authenticated' END)::text, true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user::text, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', CASE WHEN p_user IS NULL THEN 'anon' ELSE 'authenticated' END);
END $$;

CREATE FUNCTION mai_test.act_as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE service_role;
END $$;

CREATE FUNCTION mai_test.reset_actor() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

CREATE FUNCTION mai_test.check(p_name text, p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAILED: %', p_name;
  END IF;
END $$;

-- Runs p_sql and passes if it raises an error whose message contains p_like.
CREATE FUNCTION mai_test.expect_error(p_name text, p_sql text, p_like text DEFAULT '') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%' || p_like || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'FAILED: % (wrong error: %)', p_name, SQLERRM;
  END;
  RAISE EXCEPTION 'FAILED: % (no error raised)', p_name;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mai_test TO PUBLIC;

-- ---------------------------------------------------------------- fixtures
CREATE TABLE mai_test.ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON mai_test.ids TO PUBLIC;
INSERT INTO mai_test.ids VALUES
  ('owner_a', gen_random_uuid()), ('cashier_a', gen_random_uuid()), ('editor_a', gen_random_uuid()),
  ('owner_b', gen_random_uuid()), ('consumer', gen_random_uuid()), ('admin', gen_random_uuid()),
  ('merchant_a', gen_random_uuid()), ('merchant_b', gen_random_uuid()),
  ('store_a', gen_random_uuid()), ('store_b', gen_random_uuid()),
  ('product_a', gen_random_uuid()), ('product_b', gen_random_uuid()),
  ('order_1', gen_random_uuid()), ('order_b', gen_random_uuid());

CREATE FUNCTION mai_test.id(p text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT v FROM mai_test.ids WHERE k = p $$;
GRANT EXECUTE ON FUNCTION mai_test.id(text) TO PUBLIC;

INSERT INTO auth.users (id, email)
SELECT v, k || '@merchant-ai-test.invalid' FROM mai_test.ids
 WHERE k IN ('owner_a', 'cashier_a', 'editor_a', 'owner_b', 'consumer', 'admin');

INSERT INTO public.profiles (id, email, name, role)
SELECT v, k || '@merchant-ai-test.invalid', k, (CASE WHEN k = 'admin' THEN 'admin' ELSE 'consumer' END)::public.app_role
  FROM mai_test.ids WHERE k IN ('owner_a', 'cashier_a', 'editor_a', 'owner_b', 'consumer', 'admin')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role;

INSERT INTO public.user_roles (user_id, role) VALUES (mai_test.id('admin'), 'admin') ON CONFLICT DO NOTHING;

INSERT INTO public.merchants (id, user_id, business_name, status) VALUES
  (mai_test.id('merchant_a'), mai_test.id('owner_a'), 'Test Merchant A', 'approved'),
  (mai_test.id('merchant_b'), mai_test.id('owner_b'), 'Test Merchant B', 'approved');

INSERT INTO public.stores (id, merchant_id, name, slug) VALUES
  (mai_test.id('store_a'), mai_test.id('merchant_a'), 'Store A', 'merchant-ai-test-a-' || left(mai_test.id('store_a')::text, 8)),
  (mai_test.id('store_b'), mai_test.id('merchant_b'), 'Store B', 'merchant-ai-test-b-' || left(mai_test.id('store_b')::text, 8));

INSERT INTO public.products (id, store_id, name, slug, price, quantity, category, status, product_type, listing_type) VALUES
  (mai_test.id('product_a'), mai_test.id('store_a'), 'Mango Chutney', 'mai-test-a-' || left(mai_test.id('product_a')::text, 8), 50.00, 3, 'Food', 'approved', 'physical', 'standard'),
  (mai_test.id('product_b'), mai_test.id('store_b'), 'Secret Sauce', 'mai-test-b-' || left(mai_test.id('product_b')::text, 8), 99.00, 10, 'Food', 'approved', 'physical', 'standard');

INSERT INTO public.orders (id, user_id, total, status, payment_status, shipping_address, created_at) VALUES
  (mai_test.id('order_1'), mai_test.id('consumer'), 115.00, 'processing', 'paid', '{"name": "Thandi Mokoena", "city": "Mbombela"}', now() - interval '2 hours'),
  (mai_test.id('order_b'), mai_test.id('consumer'), 99.00, 'processing', 'paid', '{"name": "Thandi Mokoena", "city": "Mbombela"}', now() - interval '2 hours');

INSERT INTO public.order_items (order_id, product_id, store_id, quantity, price, status, merchant_status) VALUES
  (mai_test.id('order_1'), mai_test.id('product_a'), mai_test.id('store_a'), 2, 50.00, 'pending', 'pending'),
  (mai_test.id('order_b'), mai_test.id('product_b'), mai_test.id('store_b'), 1, 99.00, 'pending', 'pending');

-- ------------------------------------------------- staff and feature flags
SELECT mai_test.act_as(mai_test.id('owner_a'));
SELECT public.store_member_upsert(mai_test.id('store_a'), 'cashier_a@merchant-ai-test.invalid', 'cashier');
SELECT public.store_member_upsert(mai_test.id('store_a'), 'editor_a@merchant-ai-test.invalid', 'catalog_editor');
SELECT mai_test.check('owner sees own store in access list',
  (SELECT jsonb_array_length(public.merchant_my_access())) = 1);
SELECT mai_test.check('owner role resolves', public.store_role(mai_test.id('store_a')) = 'owner');
SELECT mai_test.check('cannot ask about another user''s role',
  public.store_role(mai_test.id('store_a'), mai_test.id('cashier_a')) IS NULL);
SELECT mai_test.expect_error('owner cannot enable own features',
  format('SELECT public.admin_set_merchant_feature(%L, ''ai_assistant'', true)', mai_test.id('merchant_a')), 'Admins only');
SELECT mai_test.expect_error('owner cannot write flags directly',
  format('INSERT INTO public.merchant_feature_flags (merchant_id, flag_key, enabled) VALUES (%L, ''ai_assistant'', true)', mai_test.id('merchant_a')));
SELECT mai_test.expect_error('feature off by default blocks the order queue',
  format('SELECT public.merchant_order_queue(%L)', mai_test.id('store_a')), 'not enabled');

SELECT mai_test.act_as(mai_test.id('owner_b'));
SELECT mai_test.expect_error('other tenant cannot add staff to store A',
  format('SELECT public.store_member_upsert(%L, ''owner_b@merchant-ai-test.invalid'', ''manager'')', mai_test.id('store_a')), 'access');
SELECT mai_test.check('other tenant sees no store A memberships',
  (SELECT count(*) FROM public.store_members WHERE store_id = mai_test.id('store_a')) = 0);

SELECT mai_test.act_as(mai_test.id('admin'));
SELECT public.admin_set_merchant_feature(mai_test.id('merchant_a'), f, true, 'mbombela-pilot')
  FROM unnest(ARRAY['order_console', 'payment_requests', 'ai_assistant']) f;
SELECT public.admin_set_merchant_feature(mai_test.id('merchant_b'), f, true, 'mbombela-pilot')
  FROM unnest(ARRAY['order_console', 'payment_requests', 'ai_assistant']) f;

-- --------------------------------------------------------------- orders
SELECT mai_test.act_as(mai_test.id('cashier_a'));
SELECT mai_test.check('cashier sees store A order',
  (SELECT jsonb_array_length(public.merchant_order_queue(mai_test.id('store_a')))) = 1);
SELECT mai_test.check('queue shows first name only',
  (SELECT public.merchant_order_queue(mai_test.id('store_a')) -> 0 ->> 'customer_first_name') = 'Thandi');
SELECT mai_test.check('queue total in cents',
  (SELECT (public.merchant_order_queue(mai_test.id('store_a')) -> 0 ->> 'store_total_minor')::int) = 10000);
SELECT mai_test.expect_error('cashier cannot read store B queue',
  format('SELECT public.merchant_order_queue(%L)', mai_test.id('store_b')), 'access');
SELECT mai_test.expect_error('cannot skip a step',
  format('SELECT public.merchant_order_advance(%L, %L, ''ready'', ''key-skip-0001'')', mai_test.id('store_a'), mai_test.id('order_1')), 'cannot be marked');
SELECT public.merchant_order_advance(mai_test.id('store_a'), mai_test.id('order_1'), 'accepted', 'key-accept-0001');
SELECT mai_test.check('retry with same key is reported, not repeated',
  (public.merchant_order_advance(mai_test.id('store_a'), mai_test.id('order_1'), 'accepted', 'key-accept-0001') ->> 'repeated')::boolean);
SELECT mai_test.expect_error('same key for another change is refused',
  format('SELECT public.merchant_order_advance(%L, %L, ''preparing'', ''key-accept-0001'')', mai_test.id('store_a'), mai_test.id('order_1')), 'different change');
SELECT mai_test.expect_error('cannot move store B order through store A',
  format('SELECT public.merchant_order_advance(%L, %L, ''accepted'', ''key-cross-0001'')', mai_test.id('store_a'), mai_test.id('order_b')), 'not found');
SELECT mai_test.expect_error('cannot move store B order as store B',
  format('SELECT public.merchant_order_advance(%L, %L, ''accepted'', ''key-cross-0002'')', mai_test.id('store_b'), mai_test.id('order_b')), 'access');

SELECT mai_test.act_as(mai_test.id('editor_a'));
SELECT mai_test.expect_error('catalog editor cannot work orders',
  format('SELECT public.merchant_order_queue(%L)', mai_test.id('store_a')), 'access');

SELECT mai_test.reset_actor();
SELECT mai_test.check('one action and one customer event recorded',
  (SELECT count(*) FROM public.merchant_order_actions WHERE order_id = mai_test.id('order_1')) = 1
  AND (SELECT count(*) FROM public.order_events WHERE order_id = mai_test.id('order_1') AND event_type = 'merchant_status') = 1);

-- ------------------------------------------------------ payment requests
SELECT mai_test.act_as(mai_test.id('cashier_a'));
CREATE TABLE mai_test.req AS
  SELECT public.merchant_payment_request_create(mai_test.id('store_a'), 12900, 'Haircut and wash', 'INV-7', 30, 'pay-key-00001') AS r;
GRANT SELECT ON mai_test.req TO PUBLIC;
SELECT mai_test.check('same key returns the same request',
  (public.merchant_payment_request_create(mai_test.id('store_a'), 99999, 'Changed', NULL, 30, 'pay-key-00001') ->> 'id')
    = (SELECT r ->> 'id' FROM mai_test.req));
SELECT mai_test.expect_error('below PayFast minimum refused',
  format('SELECT public.merchant_payment_request_create(%L, 499, ''x'', NULL, 30, ''pay-key-00002'')', mai_test.id('store_a')), 'R5.00');
SELECT mai_test.expect_error('cashier cannot mark a request paid',
  format('SELECT public.payment_request_mark_paid(%L, ''pf-1'', 12900, ''d'')', (SELECT r ->> 'id' FROM mai_test.req)), 'permission denied');
SELECT mai_test.expect_error('cashier cannot write the ledger',
  format('INSERT INTO public.merchant_payment_ledger (store_id, direction, amount_minor, reference) VALUES (%L, ''credit'', 100, ''x'')', mai_test.id('store_a')));

SELECT mai_test.act_as(mai_test.id('owner_b'));
SELECT mai_test.check('other tenant cannot see store A requests',
  (SELECT count(*) FROM public.merchant_payment_requests WHERE store_id = mai_test.id('store_a')) = 0);
SELECT mai_test.expect_error('other tenant cannot cancel store A request',
  format('SELECT public.merchant_payment_request_cancel(%L)', (SELECT r ->> 'id' FROM mai_test.req)), 'access');

SELECT mai_test.act_as(NULL);
SELECT mai_test.check('anyone with the link sees amount and store',
  (public.payment_request_public((SELECT r ->> 'public_token' FROM mai_test.req)) ->> 'amount_minor')::int = 12900);
SELECT mai_test.check('a wrong token shows nothing',
  public.payment_request_public(repeat('0', 36)) IS NULL);
SELECT mai_test.expect_error('anon cannot list requests',
  'SELECT count(*) FROM public.merchant_payment_requests', 'permission denied');

SELECT mai_test.act_as_service();
SELECT mai_test.check('wrong amount is not accepted',
  public.payment_request_mark_paid((SELECT (r ->> 'id')::uuid FROM mai_test.req), 'pf-100', 100, 'digest') = 'amount_mismatch');
SELECT mai_test.check('right amount marks paid',
  public.payment_request_mark_paid((SELECT (r ->> 'id')::uuid FROM mai_test.req), 'pf-101', 12900, 'digest') = 'paid');
SELECT mai_test.check('repeated notification is ignored',
  public.payment_request_mark_paid((SELECT (r ->> 'id')::uuid FROM mai_test.req), 'pf-101', 12900, 'digest') IN ('duplicate_event', 'already_processed'));
SELECT mai_test.check('exactly one ledger credit',
  (SELECT count(*) FROM public.merchant_payment_ledger WHERE request_id = (SELECT (r ->> 'id')::uuid FROM mai_test.req)) = 1);
SELECT mai_test.expect_error('ledger is append-only',
  format('DELETE FROM public.merchant_payment_ledger WHERE request_id = %L', (SELECT r ->> 'id' FROM mai_test.req)), 'cannot be changed');

-- ------------------------------------------------------- insights and AI
SELECT mai_test.act_as(mai_test.id('owner_a'));
SELECT mai_test.check('sales summary counts store A line in cents',
  (public.merchant_sales_summary(mai_test.id('store_a'), (now() AT TIME ZONE 'Africa/Johannesburg')::date - 7,
     (now() AT TIME ZONE 'Africa/Johannesburg')::date) ->> 'gross_sales_minor')::bigint = 10000);
SELECT mai_test.check('sales summary includes payment-request takings',
  (public.merchant_sales_summary(mai_test.id('store_a'), (now() AT TIME ZONE 'Africa/Johannesburg')::date - 7,
     (now() AT TIME ZONE 'Africa/Johannesburg')::date) ->> 'payment_requests_paid_minor')::bigint = 12900);
SELECT mai_test.check('low stock product flagged',
  (public.merchant_stock_alerts(mai_test.id('store_a')) -> 'items' -> 0 ->> 'product_id')::uuid = mai_test.id('product_a'));
SELECT mai_test.expect_error('owner A cannot read store B sales',
  format('SELECT public.merchant_sales_summary(%L, current_date - 7, current_date)', mai_test.id('store_b')), 'access');
SELECT mai_test.expect_error('periods over a year refused',
  format('SELECT public.merchant_sales_summary(%L, current_date - 400, current_date)', mai_test.id('store_a')), 'one year');

SELECT mai_test.act_as(mai_test.id('cashier_a'));
SELECT mai_test.expect_error('cashier has no insights access',
  format('SELECT public.merchant_sales_summary(%L, current_date - 7, current_date)', mai_test.id('store_a')), 'access');

SELECT mai_test.act_as_service();
INSERT INTO public.merchant_ai_drafts (store_id, target_type, product_id, content, created_by)
VALUES (mai_test.id('store_a'), 'product_description', mai_test.id('product_a'), 'Sweet, tangy chutney.', mai_test.id('owner_a')),
       (mai_test.id('store_b'), 'product_description', mai_test.id('product_b'), 'Store B draft.', mai_test.id('owner_b'));

SELECT mai_test.act_as(mai_test.id('editor_a'));
SELECT mai_test.check('editor sees only store A drafts',
  (SELECT count(*) FROM public.merchant_ai_drafts) = 1);
SELECT mai_test.expect_error('editor cannot approve store B draft',
  format('SELECT public.merchant_ai_draft_decide(%L, ''approve'')',
    (SELECT id FROM public.merchant_ai_drafts WHERE store_id = mai_test.id('store_b') LIMIT 1)), '');
SELECT public.merchant_ai_draft_decide(
  (SELECT id FROM public.merchant_ai_drafts WHERE store_id = mai_test.id('store_a') LIMIT 1), 'approve', 'Sweet, tangy mango chutney.');
SELECT mai_test.reset_actor();
SELECT mai_test.check('approved draft published to product',
  (SELECT description FROM public.products WHERE id = mai_test.id('product_a')) = 'Sweet, tangy mango chutney.');
SELECT mai_test.check('store B product untouched',
  (SELECT description FROM public.products WHERE id = mai_test.id('product_b')) IS DISTINCT FROM 'Store B draft.');

SELECT mai_test.act_as_service();
SELECT mai_test.check('daily AI allowance enforced',
  public.merchant_ai_reserve_request(mai_test.id('store_a'), 1)
  AND NOT public.merchant_ai_reserve_request(mai_test.id('store_a'), 1));

-- ------------------------------------------ order line edits (audit R1)
SELECT mai_test.act_as(mai_test.id('owner_a'));
SELECT mai_test.expect_error('merchant cannot change a line price through the API',
  format('UPDATE public.order_items SET price = 9999 WHERE order_id = %L', mai_test.id('order_1')), 'Only the fulfilment status');
SELECT mai_test.expect_error('merchant cannot change a line quantity through the API',
  format('UPDATE public.order_items SET quantity = 50 WHERE order_id = %L', mai_test.id('order_1')), 'Only the fulfilment status');
UPDATE public.order_items SET merchant_status = 'preparing', updated_at = now() WHERE order_id = mai_test.id('order_1');
SELECT mai_test.reset_actor();
SELECT mai_test.check('merchant can still change the fulfilment status',
  (SELECT merchant_status FROM public.order_items WHERE order_id = mai_test.id('order_1')) = 'preparing');
SELECT mai_test.check('price unchanged',
  (SELECT price FROM public.order_items WHERE order_id = mai_test.id('order_1')) = 50.00);

-- --------------------------------------------------- driver delivery
SELECT mai_test.act_as(mai_test.id('cashier_a'));
SELECT mai_test.expect_error('cashier cannot set the pickup address',
  format('SELECT public.store_set_pickup_address(%L, ''1 Main St'', ''Mbombela'', ''Mpumalanga'', NULL)', mai_test.id('store_a')), 'access');
SELECT mai_test.expect_error('no driver before a pickup address exists or the order is ready',
  format('SELECT public.merchant_order_request_delivery(%L, %L)', mai_test.id('store_a'), mai_test.id('order_1')), '');

SELECT mai_test.act_as(mai_test.id('owner_a'));
SELECT mai_test.expect_error('pickup pin outside South Africa refused',
  format('SELECT public.store_set_pickup_address(%L, ''1 Main St'', ''Mbombela'', NULL, NULL, 51.5, -0.1)', mai_test.id('store_a')), 'South Africa');
SELECT public.store_set_pickup_address(mai_test.id('store_a'), '1 Brown St', 'Mbombela', 'Mpumalanga', '013 000 0000', -25.47, 30.97);

SELECT mai_test.reset_actor();
UPDATE public.orders SET shipping_address = shipping_address || '{"street": "5 Paul Kruger St"}' WHERE id = mai_test.id('order_1');

SELECT mai_test.act_as(mai_test.id('cashier_a'));
SELECT mai_test.expect_error('no driver until the order is ready',
  format('SELECT public.merchant_order_request_delivery(%L, %L)', mai_test.id('store_a'), mai_test.id('order_1')), 'ready');
SELECT public.merchant_order_advance(mai_test.id('store_a'), mai_test.id('order_1'), 'ready', 'key-ready-0001');
SELECT mai_test.check('driver requested once the order is ready',
  (public.merchant_order_request_delivery(mai_test.id('store_a'), mai_test.id('order_1'), -25.46, 30.98) ->> 'repeated')::boolean = false);
SELECT mai_test.check('asking again returns the same job',
  (public.merchant_order_request_delivery(mai_test.id('store_a'), mai_test.id('order_1')) ->> 'repeated')::boolean);
SELECT mai_test.check('queue shows the driver job',
  (SELECT public.merchant_order_queue(mai_test.id('store_a')) -> 0 ->> 'delivery_status') = 'pending');
SELECT mai_test.expect_error('cannot request a driver for another store''s order',
  format('SELECT public.merchant_order_request_delivery(%L, %L)', mai_test.id('store_a'), mai_test.id('order_b')), 'not found');
SELECT mai_test.reset_actor();
SELECT mai_test.check('job collects from the store and delivers to the order address',
  (SELECT pickup_address ->> 'city' = 'Mbombela' AND delivery_address ->> 'street' = '5 Paul Kruger St'
     FROM public.delivery_jobs WHERE order_id = mai_test.id('order_1')));

-- --------------------------------------------- suspension removes access
SELECT mai_test.act_as(mai_test.id('owner_a'));
SELECT public.store_member_set_status(
  (SELECT id FROM public.store_members WHERE user_id = mai_test.id('cashier_a')), 'suspended');
SELECT mai_test.act_as(mai_test.id('cashier_a'));
SELECT mai_test.expect_error('suspended staff lose access',
  format('SELECT public.merchant_order_queue(%L)', mai_test.id('store_a')), 'access');

SELECT mai_test.act_as(mai_test.id('consumer'));
SELECT mai_test.check('consumer has no stores', public.merchant_my_access() = '[]'::jsonb);

-- ------------------------------------------------ dashboard analytics
SELECT mai_test.act_as(mai_test.id('owner_a'));
CREATE TABLE mai_test.dash AS SELECT public.merchant_store_analytics(30) AS d;
SELECT mai_test.check('dashboard gross sales in cents', (SELECT (d -> 'kpis' -> 'gross_sales_minor' ->> 'current')::bigint FROM mai_test.dash) = 10000);
SELECT mai_test.check('dashboard orders, units and new customer',
  (SELECT (d -> 'kpis' -> 'orders' ->> 'current')::int = 1 AND (d -> 'kpis' -> 'units' ->> 'current')::int = 2
      AND (d -> 'kpis' -> 'customers' ->> 'new')::int = 1 FROM mai_test.dash));
SELECT mai_test.check('dashboard 1145 Pay takings', (SELECT (d -> 'kpis' -> 'pay_collected_minor' ->> 'current')::int FROM mai_test.dash) = 12900);
SELECT mai_test.check('dashboard daily series covers 30 days', (SELECT jsonb_array_length(d -> 'daily') FROM mai_test.dash) = 30);
SELECT mai_test.check('dashboard weekday series has 7 days', (SELECT jsonb_array_length(d -> 'by_weekday') FROM mai_test.dash) = 7);
SELECT mai_test.check('dashboard top product is store A''s', (SELECT (d -> 'top_products' -> 0 ->> 'product_id')::uuid FROM mai_test.dash) = mai_test.id('product_a'));
SELECT mai_test.check('dashboard stock health', (SELECT (d -> 'stock' ->> 'low_stock')::int = 1 AND (d -> 'stock' ->> 'listed')::int = 1 FROM mai_test.dash));
SELECT mai_test.check('unknown period falls back to 30 days', (public.merchant_store_analytics(12) -> 'period' ->> 'days')::int = 30);
SELECT mai_test.act_as(mai_test.id('owner_b'));
SELECT mai_test.check('other merchant sees only their own sales',
  (public.merchant_store_analytics(30) -> 'kpis' -> 'gross_sales_minor' ->> 'current')::bigint = 9900);
SELECT mai_test.act_as(mai_test.id('consumer'));
SELECT mai_test.expect_error('a shopper has no store analytics', 'SELECT public.merchant_store_analytics(30)', 'No merchant account');

-- -------------------------------------------------------- pilot metrics
SELECT mai_test.expect_error('only admins see pilot metrics',
  'SELECT public.admin_merchant_ai_pilot_metrics(''mbombela-pilot'', current_date - 7, current_date)', 'Admins only');
SELECT mai_test.act_as(mai_test.id('admin'));
CREATE TABLE mai_test.kpi AS SELECT public.admin_merchant_ai_pilot_metrics('mbombela-pilot',
  (now() AT TIME ZONE 'Africa/Johannesburg')::date - 7, (now() AT TIME ZONE 'Africa/Johannesburg')::date) AS k;
SELECT mai_test.check('both pilot merchants counted', (SELECT (k ->> 'merchants_in_cohort')::int FROM mai_test.kpi) = 2);
SELECT mai_test.check('one merchant active', (SELECT (k ->> 'active_merchants')::int FROM mai_test.kpi) = 1);
SELECT mai_test.check('console acceptance counted', (SELECT (k ->> 'orders_accepted_in_console')::int FROM mai_test.kpi) = 1);
SELECT mai_test.check('paid link counted with amount',
  (SELECT (k ->> 'payment_links_paid')::int = 1 AND (k ->> 'payment_links_paid_minor')::int = 12900 FROM mai_test.kpi));
SELECT mai_test.check('amount mismatch reported as an exception',
  (SELECT (k -> 'reconciliation_exceptions' ->> 'amount_mismatch')::int FROM mai_test.kpi) = 1);
SELECT mai_test.check('draft approval rate', (SELECT (k -> 'ai_drafts' ->> 'approval_rate')::numeric FROM mai_test.kpi) = 1);
SELECT mai_test.check('unknown cohort is empty',
  (public.admin_merchant_ai_pilot_metrics('nobody', current_date - 7, current_date) ->> 'merchants_in_cohort')::int = 0);

SELECT mai_test.reset_actor();
SELECT 'merchant ai tests passed' AS result;

ROLLBACK;
