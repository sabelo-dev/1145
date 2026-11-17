-- =============================================================================
-- 1145 Logistics: pre-flight check. READ-ONLY, safe to run on the live database.
-- Every row must say "ok" before running logistics_apply.sql.
-- =============================================================================
WITH checks(item, ok, fix) AS (
  VALUES
  -- Not installed yet
  ('logistics not installed yet', to_regclass('public.shipments') IS NULL AND to_regclass('public.logistics_members') IS NULL,
     'Already installed: do not run logistics_apply.sql again'),
  -- Extensions
  ('pg_net available', EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net'),
     'Database > Extensions: pg_net must be available'),
  ('pg_cron installed', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'),
     'Database > Extensions: enable pg_cron (the daily jobs are scheduled with it)'),
  -- Platform tables the logistics schema builds on
  ('table drivers', to_regclass('public.drivers') IS NOT NULL, 'missing platform table'),
  ('table delivery_jobs', to_regclass('public.delivery_jobs') IS NOT NULL, 'missing platform table'),
  ('table delivery_earnings', to_regclass('public.delivery_earnings') IS NOT NULL, 'missing platform table'),
  ('table driver_locations', to_regclass('public.driver_locations') IS NOT NULL, 'missing platform table'),
  ('table orders / order_items / stores', to_regclass('public.orders') IS NOT NULL AND to_regclass('public.order_items') IS NOT NULL AND to_regclass('public.stores') IS NOT NULL, 'missing platform table'),
  ('table vehicles / fleets', to_regclass('public.vehicles') IS NOT NULL AND to_regclass('public.fleets') IS NOT NULL, 'missing platform table'),
  ('table merchants (vendor rename applied)', to_regclass('public.merchants') IS NOT NULL, 'apply production migrations first'),
  -- Platform nearby dispatch (20261022120000 / 20261022130000)
  ('nearby dispatch tables', to_regclass('public.driver_dispatch_requests') IS NOT NULL AND to_regclass('public.dispatch_assignments') IS NOT NULL,
     'apply 20261022120000_driver_nearby_dispatch.sql first'),
  ('dispatch_nearby(text, uuid)', to_regprocedure('public.dispatch_nearby(text,uuid)') IS NOT NULL, 'apply 20261022130000_driver_service_preferences.sql first'),
  ('driver_publish_position()', to_regprocedure('public.driver_publish_position(text,double precision,double precision,double precision)') IS NOT NULL, 'apply 20261022120000_driver_nearby_dispatch.sql first'),
  ('nearby claim guard on delivery_jobs', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'nearby_claim_guard' AND tgrelid = 'public.delivery_jobs'::regclass),
     'apply 20261022120000_driver_nearby_dispatch.sql first'),
  -- Platform functions and types called by logistics
  ('is_admin()', to_regprocedure('public.is_admin()') IS NOT NULL, 'missing platform function'),
  ('update_updated_at_column()', to_regprocedure('public.update_updated_at_column()') IS NOT NULL, 'missing platform function'),
  ('calculate_delivery_earnings()', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_delivery_earnings' AND pronamespace = 'public'::regnamespace), 'missing platform function'),
  ('wallet functions (credit_wallet / debit_wallet)', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'credit_wallet' AND pronamespace = 'public'::regnamespace)
                                                     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'debit_wallet' AND pronamespace = 'public'::regnamespace), 'missing platform function'),
  ('types wallet_bucket / ledger_type', to_regtype('public.wallet_bucket') IS NOT NULL AND to_regtype('public.ledger_type') IS NOT NULL, 'missing platform type'),
  ('ledger_type has purchase and refund', EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ledger_type' AND e.enumlabel = 'purchase')
                                          AND EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ledger_type' AND e.enumlabel = 'refund'), 'wallet ledger types changed'),
  -- Columns the logistics triggers read
  ('delivery_jobs columns', (SELECT count(*) = 7 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'delivery_jobs'
                              AND column_name IN ('order_id', 'food_order_id', 'driver_id', 'status', 'pickup_address', 'delivery_address', 'earnings')),
     'delivery_jobs changed shape'),
  ('driver_locations.driver_id is unique', EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
                                                    WHERE i.indrelid = 'public.driver_locations'::regclass AND i.indisunique AND i.indnatts = 1 AND a.attname = 'driver_id'),
     'driver_locations needs a unique driver_id'),
  -- Supabase pieces
  ('storage schema', to_regclass('storage.buckets') IS NOT NULL, 'Supabase storage missing'),
  ('auth.jwt()', to_regprocedure('auth.jwt()') IS NOT NULL, 'Supabase auth missing')
)
SELECT item, CASE WHEN ok THEN 'ok' ELSE 'FAIL' END AS result, CASE WHEN ok THEN '' ELSE fix END AS fix
  FROM checks
 ORDER BY ok, item;
