-- Role assignment: one source of truth.
--
-- Roles were set in several places from the browser (driver register,
-- merchant register, influencer onboarding after Google/Facebook sign-up).
-- profiles.role can only be changed by admins (prevent_profile_role_change),
-- and users may only self-assign the driver/influencer role, so those writes
-- failed silently: e.g. an influencer who signed up with Google stayed
-- "consumer" in profiles.role (what the admin panel shows).
--
-- Now:
--  * creating a vendor / driver / creator profile grants the matching role;
--  * profiles.role always follows the user's highest role in user_roles
--    (admin > vendor > driver > influencer > consumer);
--  * existing users are backfilled.

-- Allow the role sync below (and only it) past the admin-only guard.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin(auth.uid())
     AND COALESCE(current_setting('app.role_sync', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Only admins can change profile role';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.primary_role(p_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = p_user_id
     ORDER BY CASE role::text
       WHEN 'admin' THEN 1 WHEN 'vendor' THEN 2 WHEN 'driver' THEN 3
       WHEN 'influencer' THEN 4 WHEN 'consumer' THEN 5 ELSE 6 END
     LIMIT 1),
    'consumer'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_role(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role public.app_role := public.primary_role(p_user_id);
BEGIN
  PERFORM set_config('app.role_sync', 'on', true);
  UPDATE public.profiles SET role = v_role WHERE id = p_user_id AND role IS DISTINCT FROM v_role;
  PERFORM set_config('app.role_sync', 'off', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.on_user_roles_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_profile_role(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS sync_profile_role_on_roles ON public.user_roles;
CREATE TRIGGER sync_profile_role_on_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.on_user_roles_changed();

-- A role record implies the role.
CREATE OR REPLACE FUNCTION public.grant_role_for_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, TG_ARGV[0]::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_vendor_role ON public.vendors;
CREATE TRIGGER grant_vendor_role AFTER INSERT OR UPDATE OF user_id ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.grant_role_for_record('vendor');

DROP TRIGGER IF EXISTS grant_driver_role ON public.drivers;
CREATE TRIGGER grant_driver_role AFTER INSERT OR UPDATE OF user_id ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.grant_role_for_record('driver');

DROP TRIGGER IF EXISTS grant_influencer_role ON public.influencer_profiles;
CREATE TRIGGER grant_influencer_role AFTER INSERT OR UPDATE OF user_id ON public.influencer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_role_for_record('influencer');

REVOKE EXECUTE ON FUNCTION public.primary_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_user_roles_changed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_role_for_record() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.primary_role(uuid) TO authenticated, service_role;

-- Backfill: roles from existing records, then every profile's primary role.
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'vendor'::public.app_role FROM public.vendors WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'driver'::public.app_role FROM public.drivers WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'influencer'::public.app_role FROM public.influencer_profiles WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

DO $$
BEGIN
  PERFORM set_config('app.role_sync', 'on', true);
  UPDATE public.profiles p SET role = public.primary_role(p.id)
  WHERE p.role IS DISTINCT FROM public.primary_role(p.id);
  PERFORM set_config('app.role_sync', 'off', true);
END $$;
