-- Paid tiers: monthly PayFast subscriptions (Bronze..Diamond).
-- A paid tier applies while the subscription is paid up; the user's tier is
-- the higher of this and their referral tier (uc_refresh_tier).
-- All writes come from the payfast-payment / payfast-itn / tier-subscription
-- edge functions (service role); users can only read their own rows.

CREATE TABLE IF NOT EXISTS public.uc_tier_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.affiliate_tiers(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'superseded')),
  amount numeric NOT NULL,                 -- monthly price at sign-up (Rand)
  payfast_token text,                      -- recurring billing token
  current_period_end timestamptz,          -- tier is valid until this moment
  last_payment_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uc_tier_subscriptions_user ON public.uc_tier_subscriptions (user_id, status);

CREATE TABLE IF NOT EXISTS public.uc_tier_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.uc_tier_subscriptions(id) ON DELETE CASCADE,
  pf_payment_id text NOT NULL UNIQUE,      -- PayFast retries ITNs: one row per payment
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uc_tier_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uc_tier_subscription_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.uc_tier_subscriptions, public.uc_tier_subscription_payments TO authenticated;
GRANT ALL ON public.uc_tier_subscriptions, public.uc_tier_subscription_payments TO service_role;

DROP POLICY IF EXISTS "Users read own tier subscriptions" ON public.uc_tier_subscriptions;
CREATE POLICY "Users read own tier subscriptions" ON public.uc_tier_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users read own tier payments" ON public.uc_tier_subscription_payments;
CREATE POLICY "Users read own tier payments" ON public.uc_tier_subscription_payments
  FOR SELECT TO authenticated USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.uc_tier_subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));

-- A PayFast payment for a subscription (first or recurring). Idempotent per
-- pf_payment_id. Extends the paid period by a month and refreshes the tier.
-- Returns the ids of the user's other live subscriptions (to cancel at PayFast).
CREATE OR REPLACE FUNCTION public.uc_tier_payment_received(
  p_subscription_id uuid,
  p_pf_payment_id text,
  p_amount numeric,
  p_token text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.uc_tier_subscriptions;
  v_superseded jsonb;
BEGIN
  SELECT * INTO v_sub FROM public.uc_tier_subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  IF round(p_amount, 2) <> round(v_sub.amount, 2) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount does not match the tier price');
  END IF;

  INSERT INTO public.uc_tier_subscription_payments (subscription_id, pf_payment_id, amount)
  VALUES (p_subscription_id, p_pf_payment_id, p_amount)
  ON CONFLICT (pf_payment_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  UPDATE public.uc_tier_subscriptions SET
    status = CASE WHEN status IN ('cancelled', 'superseded') THEN status ELSE 'active' END,
    payfast_token = COALESCE(p_token, payfast_token),
    current_period_end = GREATEST(COALESCE(current_period_end, now()), now()) + interval '1 month',
    last_payment_at = now(),
    updated_at = now()
  WHERE id = p_subscription_id;

  -- Only one paid tier at a time: the newest payment wins.
  WITH other AS (
    UPDATE public.uc_tier_subscriptions SET status = 'superseded', cancelled_at = now(), updated_at = now()
    WHERE user_id = v_sub.user_id AND id <> p_subscription_id AND status = 'active'
    RETURNING id, payfast_token
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'token', payfast_token)), '[]'::jsonb)
  INTO v_superseded FROM other;

  PERFORM public.uc_refresh_tier(v_sub.user_id);
  RETURN jsonb_build_object('success', true, 'superseded', v_superseded);
END;
$$;

-- Cancelled at PayFast (or by the user): no more renewals, the tier stays
-- until the paid period ends.
CREATE OR REPLACE FUNCTION public.uc_tier_subscription_cancelled(p_subscription_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.uc_tier_subscriptions
  SET status = CASE WHEN status = 'pending' THEN 'expired' ELSE 'cancelled' END,
      cancelled_at = COALESCE(cancelled_at, now()), updated_at = now()
  WHERE id = p_subscription_id AND status IN ('pending', 'active');
END;
$$;

-- Daily: paid periods that ended (2 days' grace for late debit orders) stop
-- counting; cancelled ones whose period ended lose the tier too.
CREATE OR REPLACE FUNCTION public.uc_expire_tier_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    UPDATE public.uc_tier_subscriptions SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND current_period_end < now() - interval '2 days'
    RETURNING user_id
  LOOP
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.uc_tier_subscriptions SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND created_at < now() - interval '2 days';

  -- Refresh everyone whose paid period ended recently (active or cancelled).
  FOR v_row IN
    SELECT DISTINCT user_id FROM public.uc_tier_subscriptions
    WHERE current_period_end BETWEEN now() - interval '4 days' AND now()
  LOOP
    PERFORM public.uc_refresh_tier(v_row.user_id);
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.uc_tier_payment_received(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_tier_subscription_cancelled(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.uc_expire_tier_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uc_tier_payment_received(uuid, text, numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.uc_tier_subscription_cancelled(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.uc_expire_tier_subscriptions() TO service_role;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'uc-expire-tier-subscriptions';
    PERFORM cron.schedule('uc-expire-tier-subscriptions', '30 0 * * *', 'SELECT public.uc_expire_tier_subscriptions();');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; paid tiers will not expire automatically.';
  END IF;
END $$;
