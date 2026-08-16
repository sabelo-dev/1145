CREATE OR REPLACE FUNCTION public.can_access_lease_agreement(p_contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lease_contracts lc
    LEFT JOIN public.leaseable_assets la ON la.id = lc.asset_id
    LEFT JOIN public.vendors v ON v.id = la.provider_id
    WHERE lc.id = p_contract_id
      AND (
        lc.user_id = auth.uid()
        OR v.user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_lease_agreement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_lease_agreement(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Lease agreement select" ON storage.objects;
CREATE POLICY "Lease agreement select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'lease-agreements'
  AND public.can_access_lease_agreement(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Lease agreement insert" ON storage.objects;
CREATE POLICY "Lease agreement insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lease-agreements'
  AND public.can_access_lease_agreement(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Lease agreement update" ON storage.objects;
CREATE POLICY "Lease agreement update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'lease-agreements'
  AND public.can_access_lease_agreement(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Lease agreement delete" ON storage.objects;
CREATE POLICY "Lease agreement delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'lease-agreements'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.lease_contracts lc
      LEFT JOIN public.leaseable_assets la ON la.id = lc.asset_id
      LEFT JOIN public.vendors v ON v.id = la.provider_id
      WHERE lc.id = ((storage.foldername(name))[1])::uuid
        AND v.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Lease parties can update agreement urls" ON public.lease_contracts;
CREATE POLICY "Lease parties can update agreement urls" ON public.lease_contracts
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leaseable_assets la
    JOIN public.vendors v ON v.id = la.provider_id
    WHERE la.id = lease_contracts.asset_id AND v.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leaseable_assets la
    JOIN public.vendors v ON v.id = la.provider_id
    WHERE la.id = lease_contracts.asset_id AND v.user_id = auth.uid()
  )
);