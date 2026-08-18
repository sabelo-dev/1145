-- One subscription entry point makes anonymous sign-up, duplicate handling and
-- re-subscription work without exposing subscriber records to the public.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_scope_key
  ON public.newsletter_subscribers (email, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(p_email text, p_store_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := lower(trim(p_email));
BEGIN
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid email address is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.newsletter_subscribers (email, store_id, status, subscribed_at, unsubscribed_at, updated_at)
  VALUES (normalized_email, p_store_id, 'active', now(), NULL, now())
  ON CONFLICT DO NOTHING;

  UPDATE public.newsletter_subscribers
  SET status = 'active', subscribed_at = now(), unsubscribed_at = NULL, updated_at = now()
  WHERE email = normalized_email AND store_id IS NOT DISTINCT FROM p_store_id;
END;
$$;

-- Public users use the function above. Authenticated merchants retain only the
-- scoped UPDATE permission enforced by the store-owner RLS policy.
DROP POLICY IF EXISTS "Subscribers can manage their subscription" ON public.newsletter_subscribers;
REVOKE INSERT, UPDATE, DELETE ON public.newsletter_subscribers FROM anon;
REVOKE INSERT, DELETE ON public.newsletter_subscribers FROM authenticated;
GRANT UPDATE ON public.newsletter_subscribers TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(text, uuid) TO anon, authenticated;
