-- Rolls back the 20261021* Merchant AI migrations.
--
-- Run by hand (it is not in supabase/migrations, so it never runs on deploy):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/rollback/20261021_merchant_ai_down.sql
--
-- Turning the feature flags off is enough to hide everything from merchants;
-- use this only to remove the schema. It DELETES Merchant AI data, including
-- the payment-request ledger: export merchant_payment_requests,
-- merchant_payment_events and merchant_payment_ledger first if any request
-- was ever paid. Orders moved in the console keep their merchant_status, and
-- their order_events rows stay.
--
-- Also revert supabase/functions/payfast-itn (the PREQ- branch) and undeploy
-- merchant-ai and merchant-payment-request; otherwise PayFast notifications for
-- old links would fail and be retried.

BEGIN;

-- 20261022100000 staff roles v2 (stock control, staff insights)
DROP FUNCTION IF EXISTS public.merchant_stock_history(uuid, integer);
DROP FUNCTION IF EXISTS public.merchant_stock_set(uuid, uuid, uuid, integer, text, text);
DROP FUNCTION IF EXISTS public.merchant_stock_list(uuid, text);
DROP TABLE IF EXISTS public.merchant_stock_adjustments;
DROP FUNCTION IF EXISTS public.merchant_store_analytics(integer, uuid);
DROP FUNCTION IF EXISTS public.merchant_analytics_for_stores(uuid[], integer);

-- 20261022090000 1145 Pay with saved card or UCoin (UCoin spent stays spent;
-- export merchant_payment_attempts first if any card payment needs review)
DROP FUNCTION IF EXISTS public.payment_request_finish_card_charge(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.payment_request_begin_card_charge(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.payment_request_pay_with_ucoin(text);
DROP FUNCTION IF EXISTS public.payment_request_lock_payable(text);
DROP FUNCTION IF EXISTS public.payment_request_pay_options(text);
DROP FUNCTION IF EXISTS public.payment_request_ucoin_needed(integer);
DROP TABLE IF EXISTS public.merchant_payment_attempts;
DROP FUNCTION IF EXISTS public.payment_request_settle(uuid, text, text, integer, text, text, uuid);

-- 20261021120000 dashboard analytics
DROP FUNCTION IF EXISTS public.merchant_store_analytics(integer);

-- 20261021110000 invites (store_members itself is dropped below)

-- 20261021090600 pilot metrics
DROP FUNCTION IF EXISTS public.admin_merchant_ai_pilot_metrics(text, date, date);

-- 20261021090500 console delivery (delivery_jobs rows already posted are kept)
DROP FUNCTION IF EXISTS public.merchant_order_drop_address(uuid, uuid);
DROP FUNCTION IF EXISTS public.merchant_order_request_delivery(uuid, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.store_set_pickup_address(uuid, text, text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.za_coords_ok(numeric, numeric);
ALTER TABLE public.stores DROP COLUMN IF EXISTS pickup_address;

-- 20261021090400 order line guard. Dropping it reopens audit finding R1;
-- keep it unless it is itself the problem.
DROP TRIGGER IF EXISTS guard_order_item_edits ON public.order_items;
DROP FUNCTION IF EXISTS public.guard_order_item_edits();

DROP FUNCTION IF EXISTS public.merchant_ai_draft_decide(uuid, text, text);
DROP FUNCTION IF EXISTS public.merchant_ai_record_tokens(uuid, bigint, bigint);
DROP FUNCTION IF EXISTS public.merchant_ai_reserve_request(uuid, integer);
DROP FUNCTION IF EXISTS public.merchant_find_products(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.merchant_fulfillment_metrics(uuid, date, date);
DROP FUNCTION IF EXISTS public.merchant_stock_alerts(uuid);
DROP FUNCTION IF EXISTS public.merchant_top_products(uuid, date, date, integer);
DROP FUNCTION IF EXISTS public.merchant_sales_summary(uuid, date, date);
DROP FUNCTION IF EXISTS public.merchant_check_period(date, date);
DROP TABLE IF EXISTS public.merchant_ai_usage;
DROP TABLE IF EXISTS public.merchant_ai_drafts;
DROP TABLE IF EXISTS public.merchant_ai_tool_executions;
DROP TABLE IF EXISTS public.merchant_ai_messages;
DROP TABLE IF EXISTS public.merchant_ai_conversations;

DROP FUNCTION IF EXISTS public.payment_request_record_event(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.payment_request_mark_paid(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.payment_request_public(text);
DROP FUNCTION IF EXISTS public.merchant_payment_request_cancel(uuid);
DROP FUNCTION IF EXISTS public.merchant_payment_request_create(uuid, integer, text, text, integer, text);
DROP TABLE IF EXISTS public.merchant_payment_ledger;  -- drops its append-only trigger too
DROP FUNCTION IF EXISTS public.merchant_payment_ledger_append_only();
DROP TABLE IF EXISTS public.merchant_payment_events;
DROP TABLE IF EXISTS public.merchant_payment_requests;

DROP FUNCTION IF EXISTS public.merchant_order_advance(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.merchant_order_queue(uuid, boolean);
DROP TABLE IF EXISTS public.merchant_order_actions;

DROP FUNCTION IF EXISTS public.admin_set_merchant_feature(uuid, text, boolean, text);
DROP FUNCTION IF EXISTS public.store_member_list(uuid);
DROP FUNCTION IF EXISTS public.store_member_set_status(uuid, text);
DROP FUNCTION IF EXISTS public.store_member_upsert(uuid, text, text);
DROP FUNCTION IF EXISTS public.merchant_my_access();
DROP TABLE IF EXISTS public.merchant_feature_flags CASCADE;
DROP TABLE IF EXISTS public.store_members CASCADE;
DROP FUNCTION IF EXISTS public.require_store_access(uuid, text, text);
DROP FUNCTION IF EXISTS public.store_feature_enabled(uuid, text);
DROP FUNCTION IF EXISTS public.merchant_feature_enabled(uuid, text);
DROP FUNCTION IF EXISTS public.store_has_permission(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.store_role(uuid, uuid);
DROP FUNCTION IF EXISTS public.store_role_permissions(text);

NOTIFY pgrst, 'reload schema';

COMMIT;
