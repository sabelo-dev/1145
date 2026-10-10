-- Restaurateur role assignment (needs 20261010090000_restaurateur_role_enum and
-- 20261010090050_rename_vendor_to_merchant first).
--
-- Until now a restaurateur was an ordinary consumer account remembered only by
-- the `joining_as` sign-up choice, so the admin panel showed them as "consumer".
-- Now, like the other roles (see 20261001080000_role_sync):
--  * signing up as a restaurateur, or registering an eatery, grants the role;
--  * profiles.role ranks it admin > merchant > restaurateur > driver > influencer > consumer;
--  * existing restaurateurs are backfilled.

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
       WHEN 'admin' THEN 1 WHEN 'merchant' THEN 2 WHEN 'restaurateur' THEN 3
       WHEN 'driver' THEN 4 WHEN 'influencer' THEN 5 WHEN 'consumer' THEN 6 ELSE 7 END
     LIMIT 1),
    'consumer'::public.app_role);
$$;

-- Registering an eatery implies the role. (grant_role_for_record reads user_id;
-- eateries are owned through owner_id.)
CREATE OR REPLACE FUNCTION public.grant_restaurateur_role_for_eatery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.owner_id, 'restaurateur'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_restaurateur_role ON public.eateries;
CREATE TRIGGER grant_restaurateur_role AFTER INSERT OR UPDATE OF owner_id ON public.eateries
  FOR EACH ROW EXECUTE FUNCTION public.grant_restaurateur_role_for_eatery();

-- Choosing "Restaurateur" at sign-up (or opening the eatery dashboard later)
-- sets joining_as on the account. It must never block sign-up or sign-in.
CREATE OR REPLACE FUNCTION public.grant_restaurateur_role_for_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'joining_as' = 'restaurateur' THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'restaurateur'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not grant restaurateur role to %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_restaurateur ON auth.users;
CREATE TRIGGER on_auth_user_restaurateur
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_restaurateur_role_for_account();

REVOKE EXECUTE ON FUNCTION public.grant_restaurateur_role_for_eatery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_restaurateur_role_for_account() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.primary_role(uuid) TO authenticated, service_role;

-- Backfill: eatery owners and accounts that signed up as restaurateurs.
-- The user_roles trigger then updates profiles.role for each of them.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT owner_id, 'restaurateur'::public.app_role FROM public.eateries WHERE owner_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'restaurateur'::public.app_role FROM auth.users
WHERE raw_user_meta_data->>'joining_as' = 'restaurateur'
ON CONFLICT (user_id, role) DO NOTHING;
