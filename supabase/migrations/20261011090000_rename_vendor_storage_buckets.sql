-- Rename the storage buckets vendor-logos / vendor-banners / vendor-videos /
-- vendor-documents to merchant-*.
--
-- A bucket id cannot be changed in place (stored files are keyed by it), so
-- this creates the new buckets with the same settings and the same access
-- rules. The files are copied across with the storage API, and the old
-- buckets are emptied and deleted there too (storage tables reject direct
-- deletes). On 2026-10-11 no database row referenced a file in the old
-- buckets, so there are no stored URLs to rewrite.
--
-- Part 2 at the bottom drops the old policies. Run it only once the web app
-- build that uploads to the merchant-* buckets is live.

-- 1. New buckets, same visibility and limits as the old ones.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
SELECT replace(id, 'vendor-', 'merchant-'), replace(name, 'vendor-', 'merchant-'), public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('vendor-logos', 'vendor-banners', 'vendor-videos', 'vendor-documents')
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES
  ('merchant-logos', 'merchant-logos', true),
  ('merchant-banners', 'merchant-banners', true),
  ('merchant-videos', 'merchant-videos', true),
  ('merchant-documents', 'merchant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Same access rules as the old buckets.
DROP POLICY IF EXISTS "Merchant logos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant logos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Merchant banners: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant banners: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant banners: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Merchant videos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant videos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant videos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Merchant documents: owner read" ON storage.objects;
DROP POLICY IF EXISTS "Merchant documents: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Merchant documents: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Merchant documents: owner delete" ON storage.objects;

CREATE POLICY "Merchant logos: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchant-logos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant logos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'merchant-logos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant logos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'merchant-logos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant banners: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchant-banners' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant banners: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'merchant-banners' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant banners: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'merchant-banners' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant videos: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchant-videos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant videos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'merchant-videos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant videos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'merchant-videos' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant documents: owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'merchant-documents' AND (public.is_admin(auth.uid()) OR public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2])));

CREATE POLICY "Merchant documents: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchant-documents' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant documents: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'merchant-documents' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Merchant documents: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'merchant-documents' AND public.is_merchant_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

-- Part 2: run after the web app that uses the merchant-* buckets is live.
-- DROP POLICY IF EXISTS "Vendor logos: owner upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor logos: owner update" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor logos: owner delete" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor banners: owner upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor banners: owner update" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor banners: owner delete" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor videos: owner upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor videos: owner update" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor videos: owner delete" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor documents: owner read" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor documents: owner upload" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor documents: owner update" ON storage.objects;
-- DROP POLICY IF EXISTS "Vendor documents: owner delete" ON storage.objects;
