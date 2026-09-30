-- Event rewards: sign-up, verified social connection, published post.
-- Plus: run the ucoin-mining worker on a schedule (queued rewards for orders,
-- reviews, deliveries, KYC, referrals were only processed when an admin
-- pressed "Run worker").

-- ---------------------------------------------------------------------------
-- 1. Reward catalogue. Amounts / caps are editable by admins in
--    mining_activities; existing rows are left untouched.
-- ---------------------------------------------------------------------------
INSERT INTO public.mining_activities (code, display_name, description, reward_mg, cooldown_seconds, daily_cap, requires_moderation, rules) VALUES
  ('signup_bonus',    'Welcome bonus',            'New account with a confirmed email address',          10, 0, 1, false, '{}'::jsonb),
  ('social_connect',  'Social account connected', 'Verified (OAuth) connection of a social account',     10, 0, 5, false, '{}'::jsonb),
  ('post_published',  'Post published',           'Post published to a connected social account',        5,  0, 3, false, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. award_activity: instant, idempotent credit for a server-verified event.
--    Uses the activity's reward and enforces its daily_cap. Server-only.
--    Returns the credited amount (0 when capped, inactive or already paid).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_activity(
  p_user_id uuid,
  p_activity_code text,
  p_idempotency_key text,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_title text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity public.mining_activities;
  v_today_count integer;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_activity FROM public.mining_activities
  WHERE code = p_activity_code AND is_active = true;
  IF NOT FOUND OR COALESCE(v_activity.reward_mg, 0) <= 0 THEN
    RETURN 0;
  END IF;

  -- Already paid for this exact event.
  IF EXISTS (SELECT 1 FROM public.mining_requests WHERE idempotency_key = p_idempotency_key) THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('award_activity:' || p_user_id::text || ':' || p_activity_code));

  IF v_activity.daily_cap IS NOT NULL THEN
    SELECT count(*) INTO v_today_count
    FROM public.mining_requests
    WHERE user_id = p_user_id
      AND activity_code = p_activity_code
      AND status IN ('approved', 'credited')
      AND created_at >= date_trunc('day', now());
    IF v_today_count >= v_activity.daily_cap THEN
      RETURN 0;
    END IF;
  END IF;

  PERFORM public.mining_direct_credit(
    p_user_id,
    p_activity_code,
    v_activity.reward_mg,
    p_idempotency_key,
    p_reference_type,
    p_reference_id,
    jsonb_build_object('task_title', COALESCE(p_title, v_activity.display_name))
  );

  RETURN v_activity.reward_mg;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_activity(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_activity(uuid, text, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Welcome bonus once the email is confirmed (OAuth sign-ups arrive
--    confirmed). Never blocks sign-up or confirmation if crediting fails.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_signup_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    BEGIN
      PERFORM public.award_activity(
        NEW.id, 'signup_bonus', 'signup_bonus:' || NEW.id::text,
        'user', NEW.id::text, 'Welcome bonus'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'signup bonus failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_signup_bonus() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_confirmed_award ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_award
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.award_signup_bonus();

-- ---------------------------------------------------------------------------
-- 4. Process queued rewards every minute (same mechanism as
--    process-scheduled-posts). Replaces any earlier job with this name.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ucoin-mining-worker';
    PERFORM cron.schedule(
      'ucoin-mining-worker',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/ucoin-mining?action=worker',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; enable it and re-run to schedule the ucoin-mining worker.';
  END IF;
END $$;
