-- =============================================================================
-- FRESH START — STEP 1: PREVIEW (read-only, changes nothing)
--
-- Run this in the Supabase SQL Editor and review the result before running
-- 2_fresh_start_reset.sql. Keep the two settings below identical in both files.
--
-- Sections in the result:
--   1-keep-admin     accounts that will survive
--   2-other-admin    admin accounts NOT in the keep list (will be deleted)
--   3-users-deleted  number of non-admin accounts that will be deleted
--   4-KEEP / 4-WIPE  every table in public, what happens to it, current rows
--   5-BLOCKER        must be empty; otherwise the reset will abort safely
-- =============================================================================

WITH settings AS (
  SELECT
    -- Admin accounts to keep (by email). Everyone else is deleted.
    ARRAY['admin@1145.io']::text[] AS keep_admin_emails,
    -- Platform configuration tables to keep as-is. Every other table in
    -- public is emptied, except profiles/user_roles (admin rows kept).
    ARRAY[
      'categories', 'subcategories', 'attribute_types', 'attribute_values',
      'shipping_zones', 'shipping_rates', 'transaction_limits', 'subscription_plans',
      'platform_settings', 'service_modules', 'vehicle_types',
      'ride_zones', 'surge_zones', 'dispatch_zones',
      'driver_tiers', 'brand_tiers', 'badge_definitions', 'affiliate_tiers',
      'bigold_earning_rules', 'bigold_spending_options', 'ucoin_earning_rules',
      'daily_mining_limits', 'ucoin_transfer_limits', 'mining_tasks', 'mining_campaigns',
      'lease_asset_categories', 'currency_rates', 'gold_price_cache', 'ucoin_spending_options',
      'cms_pages', 'cms_banners'
    ]::text[] AS keep_tables
),
admins AS (
  SELECT u.id, u.email, u.created_at,
         lower(u.email) = ANY (SELECT lower(e) FROM settings, unnest(keep_admin_emails) e) AS kept
  FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
),
tbls AS (
  SELECT c.oid, c.relname AS name,
         CASE
           WHEN c.relname IN ('profiles', 'user_roles') THEN 'KEEP'
           WHEN c.relname = ANY (s.keep_tables) THEN 'KEEP'
           ELSE 'WIPE'
         END AS action,
         CASE WHEN c.relname IN ('profiles', 'user_roles') THEN 'admin rows only' ELSE '' END AS note
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN settings s
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    -- skip tables owned by extensions (e.g. postgis spatial_ref_sys)
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
)
SELECT '1-keep-admin' AS section, email AS item, 'created ' || created_at::date AS detail
FROM admins WHERE kept
UNION ALL
SELECT '2-other-admin', email, 'created ' || created_at::date || ' — WILL BE DELETED'
FROM admins WHERE NOT kept
UNION ALL
SELECT '3-users-deleted', count(*)::text || ' accounts', 'everyone except the kept admin(s)'
FROM auth.users u WHERE u.id NOT IN (SELECT id FROM admins WHERE kept)
UNION ALL
SELECT '4-' || t.action, t.name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', t.name), false, true, '')))[1]::text
       || ' rows' || CASE WHEN t.note <> '' THEN ' (' || t.note || ')' ELSE '' END
FROM tbls t
UNION ALL
-- TRUNCATE refuses when a kept table has a foreign key into a wiped table.
SELECT '5-BLOCKER', k.name || ' -> ' || w.name, con.conname
FROM pg_constraint con
JOIN tbls k ON k.oid = con.conrelid AND k.action = 'KEEP'
JOIN tbls w ON w.oid = con.confrelid AND w.action = 'WIPE'
WHERE con.contype = 'f'
ORDER BY section, item;
