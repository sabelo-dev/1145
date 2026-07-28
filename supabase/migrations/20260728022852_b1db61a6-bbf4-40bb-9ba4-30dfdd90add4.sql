
CREATE POLICY "Drivers upload own KYC files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'driver-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Drivers read own KYC files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'driver-kyc' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

CREATE POLICY "Drivers update own KYC files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Drivers delete own KYC files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-kyc' AND (storage.foldername(name))[1] = auth.uid()::text);
