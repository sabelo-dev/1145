-- Fix vendor logo/banner storage access for authenticated users
-- This is intended for direct execution in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.is_vendor_owned_path(p_first_segment text, p_second_segment text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_first_segment = auth.uid()::text
    OR p_second_segment = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id::text = p_first_segment AND v.user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.is_vendor_owned_path(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vendor_owned_path(text, text) TO authenticated;

DROP POLICY IF EXISTS "Vendor logos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor logos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor logos: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Vendor banners: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor banners: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor banners: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "Vendor videos: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor videos: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor videos: owner delete" ON storage.objects;

CREATE POLICY "Vendor logos: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor logos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor logos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor banners: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor banners: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor banners: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor videos: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor videos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor videos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
