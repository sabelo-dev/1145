
-- 1. Symmetry helper: is_influencer
CREATE OR REPLACE FUNCTION public.is_influencer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'influencer'::app_role
  ) OR EXISTS (
    SELECT 1 FROM public.influencer_profiles WHERE user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_influencer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_influencer(uuid) TO authenticated, service_role;

-- 2. influencer_profiles: allow the owner to create their own row
DROP POLICY IF EXISTS "Influencers can insert their own profile" ON public.influencer_profiles;
CREATE POLICY "Influencers can insert their own profile"
  ON public.influencer_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. user_roles: let a signed-in user add ONLY the driver or influencer role
--    to their own account (needed by onboarding upsert). Admins keep full control.
DROP POLICY IF EXISTS "Users can self-assign driver or influencer role" ON public.user_roles;
CREATE POLICY "Users can self-assign driver or influencer role"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role IN ('driver'::app_role, 'influencer'::app_role)
  );

-- 4. driver_locations: admins full manage (was only USING, no INSERT admin path)
DROP POLICY IF EXISTS "Admins manage all driver locations" ON public.driver_locations;
CREATE POLICY "Admins manage all driver locations"
  ON public.driver_locations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. Backfill user_roles for existing drivers / influencers / profile.role
INSERT INTO public.user_roles (user_id, role)
SELECT d.user_id, 'driver'::app_role FROM public.drivers d
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT ip.user_id, 'influencer'::app_role FROM public.influencer_profiles ip
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, p.role FROM public.profiles p
WHERE p.role IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Normalize influencer-social/mining admin coverage
DROP POLICY IF EXISTS "Admins manage all social accounts" ON public.social_accounts;
CREATE POLICY "Admins manage all social accounts"
  ON public.social_accounts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage all mining completions" ON public.mining_completions;
CREATE POLICY "Admins manage all mining completions"
  ON public.mining_completions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Approved social accounts: rewrite the influencer policy to use has_role
DROP POLICY IF EXISTS "Influencers can manage approved accounts" ON public.approved_social_accounts;
CREATE POLICY "Influencers can manage approved accounts"
  ON public.approved_social_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'influencer'::app_role) OR public.is_admin())
  WITH CHECK (public.has_role(auth.uid(), 'influencer'::app_role) OR public.is_admin());
