-- Direct app downloads and the app-install referral reward.
--
-- 1145.io/downloads offers the Android APKs (stored in the public
-- app-downloads bucket) and the iOS TestFlight links. Every signed-in user can
-- share 1145.io/downloads?ref=<their referral code>. When a friend signs in on
-- any of the three apps (1145, 1145 Driver, 1145 Orders) for the first time,
-- the app calls claim_app_install and the sharer earns 200 UC.
--
-- A download itself cannot be verified, so the reward follows the first
-- sign-in in an app instead: once per account, once per device, only for
-- accounts created in the last 14 days, and within the rule's daily cap.

INSERT INTO public.mining_activities
  (code, display_name, description, reward_mg, reward_kind, min_reward, max_reward, daily_cap, audience, conditions, admin_granted, sort_order, is_active)
VALUES
  ('app_install_referral', 'Friend installs the app', 'A friend you invited signs in on a 1145 app for the first time', 200, 'fixed', NULL, NULL, 20, 'Everyone', 'New account; once per account and device', false, 175, true)
ON CONFLICT (code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  reward_mg = EXCLUDED.reward_mg,
  reward_kind = EXCLUDED.reward_kind,
  daily_cap = EXCLUDED.daily_cap,
  audience = EXCLUDED.audience,
  conditions = EXCLUDED.conditions,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- One row per account that has been through the claim (rewarded or not).
-- No client policies: rows are only written by claim_app_install.
CREATE TABLE IF NOT EXISTS public.app_install_claims (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL UNIQUE,
  app text NOT NULL CHECK (app IN ('app', 'driver', 'orders')),
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rewarded numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_install_claims_referrer_idx ON public.app_install_claims (referrer_id);
ALTER TABLE public.app_install_claims ENABLE ROW LEVEL SECURITY;

-- Called by the apps after sign-in. The referrer is whoever referred this
-- account at sign-up, or the owner of p_code when the friend signed up
-- without one. Returns {status, amount}; status is one of awarded,
-- already_claimed, not_new, device_used, no_referrer, invalid_code.
CREATE OR REPLACE FUNCTION public.claim_app_install(
  p_app text,
  p_platform text,
  p_device_id text,
  p_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_created timestamptz;
  v_referrer uuid;
  v_code text := upper(btrim(p_code));
  v_paid numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF p_app NOT IN ('app', 'driver', 'orders') OR p_platform NOT IN ('android', 'ios')
     OR length(coalesce(p_device_id, '')) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'Invalid app install';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('app_install:' || p_device_id));

  IF EXISTS (SELECT 1 FROM public.app_install_claims WHERE user_id = v_user) THEN
    RETURN jsonb_build_object('status', 'already_claimed', 'amount', 0);
  END IF;

  SELECT created_at INTO v_created FROM auth.users WHERE id = v_user;
  IF v_created IS NULL OR v_created < now() - interval '14 days' THEN
    RETURN jsonb_build_object('status', 'not_new', 'amount', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.app_install_claims WHERE device_id = p_device_id) THEN
    RETURN jsonb_build_object('status', 'device_used', 'amount', 0);
  END IF;

  v_referrer := public.uc_referrer_of(v_user);
  IF v_referrer IS NULL AND v_code <> '' THEN
    SELECT user_id INTO v_referrer FROM public.user_referral_codes
    WHERE code = v_code AND is_active AND user_id <> v_user;
    IF v_referrer IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid_code', 'amount', 0);
    END IF;
  END IF;
  -- Nothing recorded yet, so the app can ask for a code and try again.
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('status', 'no_referrer', 'amount', 0);
  END IF;

  INSERT INTO public.app_install_claims (user_id, device_id, app, platform, referrer_id)
  VALUES (v_user, p_device_id, p_app, p_platform, v_referrer);

  v_paid := public.uc_award(v_referrer, 'app_install_referral', 'app_install:' || v_user::text,
    NULL, 'app_install', v_user::text, 'Friend installed the 1145 app');
  UPDATE public.app_install_claims SET rewarded = v_paid WHERE user_id = v_user;

  RETURN jsonb_build_object('status', 'awarded', 'amount', v_paid);
END;
$$;

-- How many friends installed through the caller's link, and what it paid.
CREATE OR REPLACE FUNCTION public.app_install_referral_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('installs', count(*), 'earned', coalesce(sum(rewarded), 0))
  FROM public.app_install_claims
  WHERE referrer_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.claim_app_install(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_app_install(text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.app_install_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_install_referral_stats() TO authenticated;

-- Android APKs for direct download: anyone can read, only admins upload.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app-downloads', 'app-downloads', true, 209715200, ARRAY['application/vnd.android.package-archive'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "App downloads: admin upload" ON storage.objects;
DROP POLICY IF EXISTS "App downloads: admin update" ON storage.objects;
DROP POLICY IF EXISTS "App downloads: admin delete" ON storage.objects;

CREATE POLICY "App downloads: admin upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-downloads' AND public.is_admin());
CREATE POLICY "App downloads: admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_admin())
  WITH CHECK (bucket_id = 'app-downloads' AND public.is_admin());
CREATE POLICY "App downloads: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_admin());
