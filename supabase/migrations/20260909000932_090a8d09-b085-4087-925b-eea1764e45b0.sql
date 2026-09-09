
CREATE POLICY "UCoin listing photos: owner upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'ucoin-listings'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "UCoin listing photos: owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'ucoin-listings'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
