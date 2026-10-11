-- Renaming a table column does not rename the matching column label inside
-- its indexes, so 16 index columns still read vendor_id after
-- 20261010090050_rename_vendor_to_merchant. The labels are catalog-only (the
-- app and the API never see them); this brings them in line.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'i'
             AND a.attnum > 0 AND NOT a.attisdropped AND a.attname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.relname, r.attname, replace(r.attname, 'vendor', 'merchant'));
  END LOOP;
END $$;
