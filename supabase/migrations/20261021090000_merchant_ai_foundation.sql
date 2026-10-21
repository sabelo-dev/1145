-- Merchant AI foundation: store staff, permissions and feature flags.
--
-- Until now a store could only be run by the one user who owns the merchant
-- (merchants.user_id -> stores.merchant_id). Staff are added per store with a
-- role, and every Merchant AI function checks access through
-- store_has_permission(), never through what the browser says.
--
-- Roles and what they may do:
--   owner          everything (the merchant's own user; not stored here)
--   manager        orders, catalog, payments, insights
--   cashier        orders, payments
--   catalog_editor catalog
--   finance        payments, insights
--
-- New features stay off until an admin turns them on for a merchant
-- (merchant_feature_flags). Flags in use:
--   order_console     tablet order queue
--   payment_requests  payment links and QR codes
--   ai_assistant      Ask 1145 AI and content drafts

CREATE TABLE IF NOT EXISTS public.store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('manager', 'cashier', 'catalog_editor', 'finance')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_members_user ON public.store_members (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.merchant_feature_flags (
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  flag_key text NOT NULL CHECK (flag_key IN ('order_console', 'payment_requests', 'ai_assistant')),
  enabled boolean NOT NULL DEFAULT false,
  rollout_cohort text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (merchant_id, flag_key)
);

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_feature_flags ENABLE ROW LEVEL SECURITY;

-- Signed-in users only; rows are further limited by the policies below.
REVOKE ALL ON public.store_members, public.merchant_feature_flags FROM anon;

-- What a role may do. Kept in SQL so the rule lives in one place.
CREATE OR REPLACE FUNCTION public.store_role_permissions(p_role text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE p_role
    WHEN 'owner' THEN ARRAY['orders', 'catalog', 'payments', 'insights', 'settings']
    WHEN 'manager' THEN ARRAY['orders', 'catalog', 'payments', 'insights']
    WHEN 'cashier' THEN ARRAY['orders', 'payments']
    WHEN 'catalog_editor' THEN ARRAY['catalog']
    WHEN 'finance' THEN ARRAY['payments', 'insights']
    ELSE ARRAY[]::text[]
  END;
$function$;

-- The caller's role in a store: 'owner', a staff role, or NULL for no access.
-- A suspended merchant locks out its staff too; the owner keeps read access to
-- the existing dashboard, which does not use this function.
-- Signed-in users may only ask about themselves; the service role may ask about anyone.
CREATE OR REPLACE FUNCTION public.store_role(p_store_id uuid, p_user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN p_user_id IS DISTINCT FROM auth.uid() AND auth.role() IS DISTINCT FROM 'service_role'
    THEN NULL ELSE COALESCE(
    (SELECT 'owner'
       FROM public.stores s
       JOIN public.merchants m ON m.id = s.merchant_id
      WHERE s.id = p_store_id AND m.user_id = p_user_id
        AND m.status NOT IN ('suspended', 'rejected')),
    (SELECT sm.role
       FROM public.store_members sm
       JOIN public.stores s ON s.id = sm.store_id
       JOIN public.merchants m ON m.id = s.merchant_id
      WHERE sm.store_id = p_store_id AND sm.user_id = p_user_id AND sm.status = 'active'
        AND m.status NOT IN ('suspended', 'rejected'))
  ) END;
$function$;

CREATE OR REPLACE FUNCTION public.store_has_permission(p_store_id uuid, p_permission text, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_user_id IS NOT NULL
     AND p_permission = ANY (public.store_role_permissions(public.store_role(p_store_id, p_user_id)));
$function$;

CREATE OR REPLACE FUNCTION public.merchant_feature_enabled(p_merchant_id uuid, p_flag text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT enabled FROM public.merchant_feature_flags WHERE merchant_id = p_merchant_id AND flag_key = p_flag),
    false);
$function$;

CREATE OR REPLACE FUNCTION public.store_feature_enabled(p_store_id uuid, p_flag text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT public.merchant_feature_enabled(s.merchant_id, p_flag) FROM public.stores s WHERE s.id = p_store_id),
    false);
$function$;

-- Raises unless the caller has the permission in the store and the feature is on.
CREATE OR REPLACE FUNCTION public.require_store_access(p_store_id uuid, p_permission text, p_flag text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.store_has_permission(p_store_id, p_permission) THEN
    RAISE EXCEPTION 'You do not have % access to this store', p_permission USING ERRCODE = '42501';
  END IF;
  IF p_flag IS NOT NULL AND NOT public.store_feature_enabled(p_store_id, p_flag) THEN
    RAISE EXCEPTION 'This feature is not enabled for your store yet' USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.store_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_has_permission(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_feature_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_feature_enabled(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.require_store_access(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_has_permission(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_feature_enabled(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_feature_enabled(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.require_store_access(uuid, text, text) TO authenticated, service_role;

-- Staff rows: the owner manages them, staff see their own, admins see all.
DROP POLICY IF EXISTS "Store owners and staff see memberships" ON public.store_members;
CREATE POLICY "Store owners and staff see memberships"
  ON public.store_members FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR public.store_role(store_id, auth.uid()) = 'owner'
    OR public.is_admin(auth.uid()));
-- No INSERT/UPDATE/DELETE policies: changes go through the functions below.

DROP POLICY IF EXISTS "Merchants see own feature flags" ON public.merchant_feature_flags;
CREATE POLICY "Merchants see own feature flags"
  ON public.merchant_feature_flags FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_feature_flags.merchant_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.store_members sm JOIN public.stores s ON s.id = sm.store_id
               WHERE s.merchant_id = merchant_feature_flags.merchant_id AND sm.user_id = auth.uid() AND sm.status = 'active'));

DROP POLICY IF EXISTS "Admins manage feature flags" ON public.merchant_feature_flags;
CREATE POLICY "Admins manage feature flags"
  ON public.merchant_feature_flags FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Every store the caller can work in, with their role, permissions and the
-- merchant's enabled features. The dashboard and the tablet console start here.
CREATE OR REPLACE FUNCTION public.merchant_my_access()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'store_id', s.id,
      'store_name', s.name,
      'store_slug', s.slug,
      'merchant_id', s.merchant_id,
      'role', r.role,
      'permissions', to_jsonb(public.store_role_permissions(r.role)),
      'features', COALESCE((
        SELECT jsonb_agg(f.flag_key ORDER BY f.flag_key)
          FROM public.merchant_feature_flags f
         WHERE f.merchant_id = s.merchant_id AND f.enabled), '[]'::jsonb)
    ) ORDER BY s.name), '[]'::jsonb)
  FROM public.stores s
  CROSS JOIN LATERAL (SELECT public.store_role(s.id, auth.uid()) AS role) r
  WHERE r.role IS NOT NULL
    AND (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = s.merchant_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.store_members sm WHERE sm.store_id = s.id AND sm.user_id = auth.uid()));
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_my_access() TO authenticated, service_role;

-- The owner adds an existing 1145 account to a store, or changes its role.
CREATE OR REPLACE FUNCTION public.store_member_upsert(p_store_id uuid, p_email text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_row public.store_members;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'settings');
  IF p_role NOT IN ('manager', 'cashier', 'catalog_editor', 'finance') THEN
    RAISE EXCEPTION 'Unknown role %', p_role;
  END IF;

  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No 1145 account uses that email. Ask them to sign up first.';
  END IF;
  IF v_user = auth.uid() THEN
    RAISE EXCEPTION 'You already own this store';
  END IF;

  INSERT INTO public.store_members (store_id, user_id, role, status, added_by)
  VALUES (p_store_id, v_user, p_role, 'active', auth.uid())
  ON CONFLICT (store_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$function$;

CREATE OR REPLACE FUNCTION public.store_member_set_status(p_member_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
BEGIN
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Unknown status %', p_status;
  END IF;
  SELECT store_id INTO v_store FROM public.store_members WHERE id = p_member_id;
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Team member not found';
  END IF;
  PERFORM public.require_store_access(v_store, 'settings');
  UPDATE public.store_members SET status = p_status, updated_at = now() WHERE id = p_member_id;
END;
$function$;

-- Lists a store's team with names and emails; owner only.
CREATE OR REPLACE FUNCTION public.store_member_list(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'settings');
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sm.id, 'user_id', sm.user_id, 'role', sm.role, 'status', sm.status,
      'name', p.name, 'email', p.email, 'created_at', sm.created_at) ORDER BY sm.created_at)
    FROM public.store_members sm
    LEFT JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.store_id = p_store_id), '[]'::jsonb);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.store_member_upsert(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_member_set_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.store_member_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_member_upsert(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_member_set_status(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_member_list(uuid) TO authenticated, service_role;

-- Admins switch features on and off for a merchant.
CREATE OR REPLACE FUNCTION public.admin_set_merchant_feature(p_merchant_id uuid, p_flag text, p_enabled boolean, p_cohort text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.merchant_feature_flags (merchant_id, flag_key, enabled, rollout_cohort, updated_by, updated_at)
  VALUES (p_merchant_id, p_flag, p_enabled, p_cohort, auth.uid(), now())
  ON CONFLICT (merchant_id, flag_key) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        rollout_cohort = COALESCE(EXCLUDED.rollout_cohort, merchant_feature_flags.rollout_cohort),
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_set_merchant_feature(uuid, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_feature(uuid, text, boolean, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
