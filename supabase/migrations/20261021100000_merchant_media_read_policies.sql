-- Fix "new row violates row-level security policy" on logo and banner uploads.
--
-- 20261011090000 recreated the upload, update and delete policies for the
-- merchant-logos / merchant-banners / merchant-videos buckets but not the read
-- policy the vendor-* buckets had. Uploads with upsert (Shopfront, merchant
-- onboarding) run INSERT ... ON CONFLICT DO UPDATE, which Postgres also checks
-- against SELECT policies, so every such upload was refused.
--
-- The owner may read their own files, matching the other policies. The buckets
-- are public, so images still load by URL for everyone; unlike the old
-- "anyone can read" policy, other people cannot list a merchant's files.

DROP POLICY IF EXISTS "Merchant logos: owner read" ON storage.objects;
CREATE POLICY "Merchant logos: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-logos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

DROP POLICY IF EXISTS "Merchant banners: owner read" ON storage.objects;
CREATE POLICY "Merchant banners: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-banners' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

DROP POLICY IF EXISTS "Merchant videos: owner read" ON storage.objects;
CREATE POLICY "Merchant videos: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-videos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
