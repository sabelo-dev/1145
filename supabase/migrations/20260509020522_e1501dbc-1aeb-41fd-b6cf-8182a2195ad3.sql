DO $$
DECLARE
  admin_id uuid := '46b1d839-0d5e-47e6-8dde-e4d289dfe96f';
  r record;
  keep_tables text[] := ARRAY['profiles','user_roles','platform_settings','badge_definitions','ucoin_earning_rules','driver_tiers','subscription_plans','vehicle_types','ride_zones','dispatch_zones'];
BEGIN
  -- Disable triggers temporarily for clean wipe
  SET session_replication_role = replica;

  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND NOT (tablename = ANY(keep_tables))
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;

  -- Clean kept tables of non-admin rows where applicable
  DELETE FROM public.user_roles WHERE user_id <> admin_id;
  DELETE FROM public.profiles WHERE id <> admin_id;

  -- Delete all auth users except admin
  DELETE FROM auth.users WHERE id <> admin_id;

  SET session_replication_role = DEFAULT;
END $$;