-- Push notifications for the iOS / Android apps.
--
--  * push_tokens: one row per device (FCM token on Android, APNs token on
--    iOS), written by the app after the user allows notifications.
--  * Every new user_notifications row (rewards, orders, ...) is also sent as
--    a push through the send-push edge function.
--
-- The trigger authenticates to send-push with a secret kept in Supabase
-- Vault. Create it once (same value as the PUSH_WEBHOOK_SECRET function
-- secret):
--   select vault.create_secret('<long random string>', 'push_webhook_secret');
-- Until it exists, notifications are simply not pushed.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Register (or move) this device's token to the signed-in user. A token
-- belongs to one device, so signing in as someone else on the same phone
-- takes it over.
CREATE OR REPLACE FUNCTION public.register_push_token(p_token text, p_platform text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(btrim(p_token), '') = '' OR p_platform NOT IN ('ios', 'android') THEN
    RETURN;
  END IF;
  INSERT INTO public.push_tokens (user_id, token, platform)
  VALUES (auth.uid(), p_token, p_platform)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;

-- Push each new in-app notification to the user's devices.
CREATE OR REPLACE FUNCTION public.push_user_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_tokens WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;
  IF v_secret IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'data', COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object('type', NEW.type, 'notification_id', NEW.id)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push_user_notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.push_user_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS push_user_notification ON public.user_notifications;
CREATE TRIGGER push_user_notification
  AFTER INSERT ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_user_notification();
