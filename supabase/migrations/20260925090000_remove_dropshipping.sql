-- Remove the third-party dropshipping integration (CJ Dropshipping, WeFulfil)
-- and everything built on it. Safe to run on a database where some of these
-- objects never existed.

-- 1. Products imported from CJ were copied into the normal catalogue
--    (external_source = 'dropship'). Delete the ones nobody ordered; keep the
--    rest as hidden (rejected) so past orders still point at a real product.
DO $$
BEGIN
  DELETE FROM public.products p
  WHERE p.external_source = 'dropship'
    AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'Some imported products are still referenced; hiding them instead.';
END $$;

UPDATE public.products SET status = 'rejected' WHERE external_source = 'dropship';

-- 2. The "1145 Marketplace" store the dropship admin created to hold imports
--    (not the "marketplace" store used for 1145 merchandise). Remove it once
--    it is empty.
DO $$
BEGIN
  DELETE FROM public.stores s
  WHERE s.slug = '1145-marketplace'
    AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.store_id = s.id);
  DELETE FROM public.vendors v
  WHERE v.business_name = '1145 Marketplace'
    AND NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.vendor_id = v.id);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'The 1145 Marketplace dropship store is still referenced; left in place.';
END $$;

-- 3. Stop any scheduled sync jobs (none are in these migrations, but they may
--    have been added from the dashboard).
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE command ILIKE '%dropship%' OR command ILIKE '%wefulfil%' OR command ILIKE '%wefullfil%';
  END IF;
END $$;

-- 4. Driver jobs no longer link to supplier shipments.
ALTER TABLE IF EXISTS public.delivery_jobs DROP COLUMN IF EXISTS fulfillment_id;

-- 5. Views, tables and functions.
DROP VIEW IF EXISTS public.dropship_public_variants CASCADE;
DROP VIEW IF EXISTS public.dropship_public_products CASCADE;

DROP TABLE IF EXISTS
  public.dropship_tracking_events,
  public.dropship_fulfillment_items,
  public.dropship_refunds,
  public.dropship_returns,
  public.dropship_fulfillments,
  public.dropship_price_history,
  public.dropship_listings,
  public.dropship_variants,
  public.dropship_products,
  public.dropship_sync_jobs,
  public.dropship_webhook_events,
  public.dropship_api_logs,
  public.dropship_audit_log,
  public.dropship_merchant_settings,
  public.dropship_suppliers,
  public.wefullfil_product_variants,
  public.wefullfil_products
CASCADE;

DROP FUNCTION IF EXISTS public.dropship_available_stock(uuid);
DROP FUNCTION IF EXISTS public.dropship_auto_stock_visibility();
DROP FUNCTION IF EXISTS public.dropship_audit_immutable();
DROP FUNCTION IF EXISTS public.dropship_fx_mode_valid();
DROP FUNCTION IF EXISTS public.update_wefullfil_product_variants_updated_at();
DROP FUNCTION IF EXISTS public.update_wefullfil_products_updated_at();
