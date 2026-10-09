-- Photos for eateries: menu items, logos and covers.
-- Public bucket (the Food Court shows these to everyone). Each signed-in user may
-- only write inside their own folder: <user id>/<file>. Images only, up to 5 MB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('eatery-images', 'eatery-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Owners can see their own files (needed to replace or delete them). Everyone else reads
-- photos through the public address; nobody can list another user's folder.
DROP POLICY IF EXISTS "Eatery images: owner list" ON storage.objects;
CREATE POLICY "Eatery images: owner list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eatery-images' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Eatery images: owner upload" ON storage.objects;
CREATE POLICY "Eatery images: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eatery-images' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Eatery images: owner update" ON storage.objects;
CREATE POLICY "Eatery images: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'eatery-images' AND split_part(name, '/', 1) = auth.uid()::text)
  WITH CHECK (bucket_id = 'eatery-images' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "Eatery images: owner delete" ON storage.objects;
CREATE POLICY "Eatery images: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eatery-images' AND split_part(name, '/', 1) = auth.uid()::text);
