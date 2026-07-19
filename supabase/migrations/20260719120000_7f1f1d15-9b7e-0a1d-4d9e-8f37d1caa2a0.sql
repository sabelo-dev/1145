-- 4b. vendor-documents ownership
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vendor-documents') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('vendor-documents', 'vendor-documents', true);
  END IF;
END $$;

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

DROP POLICY IF EXISTS "Vendor documents: public read" ON storage.objects;
DROP POLICY IF EXISTS "Vendor documents: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Vendor documents: owner update" ON storage.objects;
DROP POLICY IF EXISTS "Vendor documents: owner delete" ON storage.objects;

CREATE POLICY "Vendor documents: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vendor-documents');

CREATE POLICY "Vendor documents: owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-documents' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor documents: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-documents' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

CREATE POLICY "Vendor documents: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-documents' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
