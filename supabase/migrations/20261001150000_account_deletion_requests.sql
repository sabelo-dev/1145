-- Account deletion requests (required by the App Store and Google Play for
-- apps with sign-up). The Settings "Delete account" button only showed a
-- message before; now the request is recorded for admins to complete within
-- 30 days (orders / payouts may need to be kept for legal reasons first).

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

DROP POLICY IF EXISTS "Users read own deletion request" ON public.account_deletion_requests;
CREATE POLICY "Users read own deletion request" ON public.account_deletion_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Admins manage deletion requests" ON public.account_deletion_requests
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_at timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.account_deletion_requests (user_id, email, reason)
  VALUES (v_user, (SELECT email FROM auth.users WHERE id = v_user), left(p_reason, 1000))
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'pending', requested_at = now(), reason = COALESCE(EXCLUDED.reason, account_deletion_requests.reason)
  RETURNING requested_at INTO v_at;

  -- Stop push notifications to this person's devices straight away.
  DELETE FROM public.push_tokens WHERE user_id = v_user;
  RETURN v_at;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_account_deletion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;
