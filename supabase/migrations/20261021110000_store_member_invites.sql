-- Team invitations by email.
--
-- The store-member-invite edge function creates an account for an email that
-- has none yet, with a temporary password it emails to the person. Such
-- accounts carry user_metadata.must_change_password = true until the person
-- sets their own password at first sign-in.
--
-- invited_at records when the latest invitation email went out (for the
-- team list and to slow down repeated resends). The team list also shows
-- whether the person still has to set their password.

ALTER TABLE public.store_members ADD COLUMN IF NOT EXISTS invited_at timestamptz;

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
      'name', p.name, 'email', p.email, 'created_at', sm.created_at,
      'invited_at', sm.invited_at,
      'invite_pending', COALESCE((u.raw_user_meta_data ->> 'must_change_password')::boolean, false))
      ORDER BY sm.created_at)
    FROM public.store_members sm
    LEFT JOIN public.profiles p ON p.id = sm.user_id
    LEFT JOIN auth.users u ON u.id = sm.user_id
    WHERE sm.store_id = p_store_id), '[]'::jsonb);
END;
$function$;

NOTIFY pgrst, 'reload schema';
