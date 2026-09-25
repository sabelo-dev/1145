-- =============================================================================
-- FRESH START — STEP 2: RESET  ⚠ PERMANENTLY DELETES DATA ⚠
--
-- Before running:
--   1. Take a backup (Dashboard → Database → Backups), or be sure you don't
--      need any of the data.
--   2. Run 1_fresh_start_preview.sql and check the result.
--   3. Make sure the two settings below match the preview file.
--
-- This is one atomic block: if anything fails, NOTHING is changed.
--
-- What it does:
--   * Keeps the admin account(s) listed below (auth user, profile, admin role).
--   * Empties every table in public except the platform configuration list.
--   * Deletes every other auth account (sessions/identities go with them).
--   * Recreates empty wallets for the kept admin(s).
--
-- Not covered (SQL can't do it on Supabase): uploaded files. Empty the
-- storage buckets from Dashboard → Storage afterwards.
-- =============================================================================

DO $$
DECLARE
  keep_admin_emails text[] := ARRAY['admin@1145.io'];
  keep_tables text[] := ARRAY[
    'categories', 'subcategories', 'attribute_types', 'attribute_values',
    'shipping_zones', 'shipping_rates', 'transaction_limits', 'subscription_plans',
    'platform_settings', 'service_modules', 'vehicle_types',
    'ride_zones', 'surge_zones', 'dispatch_zones',
    'driver_tiers', 'brand_tiers', 'badge_definitions', 'affiliate_tiers',
    'bigold_earning_rules', 'bigold_spending_options', 'ucoin_earning_rules',
    'daily_mining_limits', 'ucoin_transfer_limits', 'mining_tasks', 'mining_campaigns',
    'lease_asset_categories', 'currency_rates', 'gold_price_cache', 'ucoin_spending_options',
    'cms_pages', 'cms_banners',
    'profiles', 'user_roles'  -- filtered to admin rows below, never truncated
  ];
  keep_ids uuid[];
  wipe_oids oid[];
  wipe_list text;
  blockers text;
  users_deleted bigint;
BEGIN
  -- 1. Resolve the admin(s) to keep; abort if none match.
  SELECT array_agg(u.id) INTO keep_ids
  FROM auth.users u
  WHERE lower(u.email) = ANY (SELECT lower(e) FROM unnest(keep_admin_emails) e)
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin');

  IF keep_ids IS NULL THEN
    RAISE EXCEPTION 'None of % is an existing admin account. Nothing was changed.', keep_admin_emails;
  END IF;

  -- 2. Every user table in public that is not on the keep list.
  SELECT array_agg(c.oid), string_agg(format('public.%I', c.relname), ', ')
  INTO wipe_oids, wipe_list
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname <> ALL (keep_tables)
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e');

  -- 3. Refuse to run if a kept table has a foreign key into a wiped table.
  SELECT string_agg(format('%s -> %s (%s)', con.conrelid::regclass, con.confrelid::regclass, con.conname), '; ')
  INTO blockers
  FROM pg_constraint con
  WHERE con.contype = 'f'
    AND con.confrelid = ANY (wipe_oids)
    AND NOT (con.conrelid = ANY (wipe_oids));

  IF blockers IS NOT NULL THEN
    RAISE EXCEPTION 'Kept tables reference wiped tables: %. Nothing was changed.', blockers;
  END IF;

  -- 4. Empty everything else.
  IF wipe_list IS NOT NULL THEN
    EXECUTE 'TRUNCATE ' || wipe_list || ' RESTART IDENTITY';
  END IF;

  -- 5. Keep only the admin rows in the identity tables, then delete the accounts.
  DELETE FROM public.user_roles WHERE user_id <> ALL (keep_ids);
  DELETE FROM public.profiles WHERE id <> ALL (keep_ids);
  DELETE FROM auth.users WHERE id <> ALL (keep_ids);
  GET DIAGNOSTICS users_deleted = ROW_COUNT;

  -- 6. Give the kept admin(s) fresh, empty wallets.
  IF to_regprocedure('public.get_or_create_1145_wallet(uuid)') IS NOT NULL THEN
    PERFORM public.get_or_create_1145_wallet(id) FROM unnest(keep_ids) AS id;
  END IF;
  IF to_regprocedure('public.get_or_create_wallet(uuid)') IS NOT NULL THEN
    PERFORM public.get_or_create_wallet(id) FROM unnest(keep_ids) AS id;
  END IF;

  RAISE NOTICE 'Fresh start complete: kept % admin account(s), deleted % other account(s), emptied % table(s).',
    array_length(keep_ids, 1), users_deleted, coalesce(array_length(wipe_oids, 1), 0);
END $$;
