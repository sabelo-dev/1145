-- 1) Drop broken driver-vehicles policies (they referenced drivers.name instead of storage.objects.name)
DROP POLICY IF EXISTS "Drivers can upload their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can update their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can delete their own vehicle photos" ON storage.objects;

-- Recreate with correct reference to the storage object's name
CREATE POLICY "Drivers can upload their own vehicle photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'driver-vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Drivers can update their own vehicle photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'driver-vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Drivers can delete their own vehicle photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'driver-vehicles'
  AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- 2) Remove dead placeholder policies pointing at a non-existent bucket
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
