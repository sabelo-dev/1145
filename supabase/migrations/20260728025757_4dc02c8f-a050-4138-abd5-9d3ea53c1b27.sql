
-- =====================================================================
-- UCoin Proof-of-Action Mining Engine
-- =====================================================================

-- ---------- mining_activities (config) ----------
CREATE TABLE public.mining_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  reward_mg numeric NOT NULL DEFAULT 0,
  evidence_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  daily_cap integer,
  requires_moderation boolean NOT NULL DEFAULT false,
  auto_expire_hours integer NOT NULL DEFAULT 720,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mining_activities TO anon, authenticated;
GRANT ALL ON public.mining_activities TO service_role;
ALTER TABLE public.mining_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mining_activities_public_read" ON public.mining_activities
  FOR SELECT USING (true);
CREATE POLICY "mining_activities_admin_write" ON public.mining_activities
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER mining_activities_updated_at BEFORE UPDATE ON public.mining_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- mining_requests ----------
CREATE TABLE public.mining_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_code text NOT NULL REFERENCES public.mining_activities(code),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','validating','awaiting_verification','approved','rejected','expired','failed','credited','reversed')),
  reward_mg numeric NOT NULL DEFAULT 0,
  fraud_score integer NOT NULL DEFAULT 0,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_type text,
  reference_id text,
  idempotency_key text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  credited_at timestamptz,
  expires_at timestamptz,
  validator text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mining_requests_user ON public.mining_requests(user_id, created_at DESC);
CREATE INDEX idx_mining_requests_status ON public.mining_requests(status);
CREATE INDEX idx_mining_requests_activity ON public.mining_requests(activity_code);
CREATE UNIQUE INDEX idx_mining_requests_dedupe
  ON public.mining_requests(user_id, activity_code, reference_type, reference_id)
  WHERE reference_id IS NOT NULL AND status IN ('approved','credited','awaiting_verification','validating','pending');
GRANT SELECT ON public.mining_requests TO authenticated;
GRANT ALL ON public.mining_requests TO service_role;
ALTER TABLE public.mining_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mining_requests_owner_read" ON public.mining_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "mining_requests_admin_write" ON public.mining_requests
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER mining_requests_updated_at BEFORE UPDATE ON public.mining_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- mining_events (append-only) ----------
CREATE TABLE public.mining_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mining_requests(id) ON DELETE CASCADE,
  stage text NOT NULL,
  actor text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mining_events_request ON public.mining_events(request_id, created_at);
GRANT SELECT ON public.mining_events TO authenticated;
GRANT ALL ON public.mining_events TO service_role;
ALTER TABLE public.mining_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mining_events_owner_read" ON public.mining_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.mining_requests r
      WHERE r.id = mining_events.request_id AND r.user_id = auth.uid()
    )
  );

-- ---------- mining_evidence ----------
CREATE TABLE public.mining_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mining_requests(id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_path text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mining_evidence_request ON public.mining_evidence(request_id);
GRANT SELECT ON public.mining_evidence TO authenticated;
GRANT ALL ON public.mining_evidence TO service_role;
ALTER TABLE public.mining_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mining_evidence_owner_read" ON public.mining_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.mining_requests r
      WHERE r.id = mining_evidence.request_id AND r.user_id = auth.uid()
    )
  );

-- ---------- ucoin_ledger (append-only) ----------
CREATE TABLE public.ucoin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.mining_requests(id) ON DELETE SET NULL,
  delta_mg numeric NOT NULL,
  kind text NOT NULL CHECK (kind IN ('credit','reversal','adjustment')),
  reason text,
  running_balance numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ucoin_ledger_user ON public.ucoin_ledger(user_id, created_at DESC);
CREATE INDEX idx_ucoin_ledger_request ON public.ucoin_ledger(request_id);
GRANT SELECT ON public.ucoin_ledger TO authenticated;
GRANT ALL ON public.ucoin_ledger TO service_role;
ALTER TABLE public.ucoin_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ucoin_ledger_owner_read" ON public.ucoin_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
-- No insert/update/delete for authenticated: only service_role writes.

-- ---------- fraud_signals ----------
CREATE TABLE public.fraud_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mining_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_fingerprint text,
  ip_address text,
  user_agent text,
  vpn_detected boolean DEFAULT false,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_signals_user ON public.fraud_signals(user_id, created_at DESC);
CREATE INDEX idx_fraud_signals_request ON public.fraud_signals(request_id);
GRANT SELECT ON public.fraud_signals TO authenticated;
GRANT ALL ON public.fraud_signals TO service_role;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fraud_signals_admin_or_self" ON public.fraud_signals
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- ---------- mining_queue_jobs ----------
CREATE TABLE public.mining_queue_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.mining_requests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','failed','deferred')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mining_queue_status ON public.mining_queue_jobs(status, next_run_at);
GRANT SELECT ON public.mining_queue_jobs TO authenticated;
GRANT ALL ON public.mining_queue_jobs TO service_role;
ALTER TABLE public.mining_queue_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mining_queue_admin_read" ON public.mining_queue_jobs
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE TRIGGER mining_queue_updated_at BEFORE UPDATE ON public.mining_queue_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- Helper functions
-- =====================================================================

-- Emit an action into the mining pipeline. Idempotent via idempotency_key.
CREATE OR REPLACE FUNCTION public.mining_emit_action(
  p_user_id uuid,
  p_activity_code text,
  p_idempotency_key text,
  p_evidence jsonb DEFAULT '{}'::jsonb,
  p_reference_type text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_activity public.mining_activities;
  v_request_id uuid;
BEGIN
  SELECT * INTO v_activity FROM public.mining_activities
    WHERE code = p_activity_code AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or inactive mining activity: %', p_activity_code;
  END IF;

  -- Idempotent insert
  INSERT INTO public.mining_requests (
    user_id, activity_code, status, reward_mg, evidence, metadata,
    reference_type, reference_id, idempotency_key, expires_at
  ) VALUES (
    p_user_id, p_activity_code, 'pending', v_activity.reward_mg,
    COALESCE(p_evidence, '{}'::jsonb), COALESCE(p_metadata, '{}'::jsonb),
    p_reference_type, p_reference_id, p_idempotency_key,
    now() + make_interval(hours => v_activity.auto_expire_hours)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_request_id;

  IF v_request_id IS NULL THEN
    SELECT id INTO v_request_id FROM public.mining_requests
      WHERE idempotency_key = p_idempotency_key;
    RETURN v_request_id;
  END IF;

  INSERT INTO public.mining_events(request_id, stage, actor, payload)
  VALUES (v_request_id, 'action_started', 'system',
    jsonb_build_object('activity', p_activity_code, 'reference_id', p_reference_id));

  INSERT INTO public.mining_queue_jobs(request_id) VALUES (v_request_id);

  RETURN v_request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.mining_emit_action FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mining_emit_action TO authenticated, service_role;

-- Credit a UCoin ledger row after approval (service-role driven).
CREATE OR REPLACE FUNCTION public.mining_credit_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.mining_requests;
  v_balance numeric;
BEGIN
  SELECT * INTO v_req FROM public.mining_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_req.status = 'credited' THEN RETURN true; END IF;
  IF v_req.status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot credit request not in approved state (status=%)', v_req.status;
  END IF;

  SELECT COALESCE(SUM(delta_mg),0) INTO v_balance
    FROM public.ucoin_ledger WHERE user_id = v_req.user_id;

  INSERT INTO public.ucoin_ledger(user_id, request_id, delta_mg, kind, reason, running_balance)
  VALUES (v_req.user_id, v_req.id, v_req.reward_mg, 'credit', v_req.activity_code, v_balance + v_req.reward_mg);

  -- Sync cached wallet
  INSERT INTO public.ucoin_wallets(user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (v_req.user_id, v_req.reward_mg, v_req.reward_mg, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = ucoin_wallets.balance + EXCLUDED.balance,
        lifetime_earned = ucoin_wallets.lifetime_earned + EXCLUDED.balance,
        updated_at = now();

  UPDATE public.mining_requests
    SET status = 'credited', credited_at = now(), updated_at = now()
    WHERE id = p_request_id;

  INSERT INTO public.mining_events(request_id, stage, actor, payload)
  VALUES (p_request_id, 'credited', 'system',
    jsonb_build_object('amount_mg', v_req.reward_mg));

  INSERT INTO public.user_notifications(user_id, type, title, message, metadata)
  VALUES (v_req.user_id, 'ucoin_credit',
    'You earned ' || v_req.reward_mg || ' UCoin',
    'Reward for: ' || v_req.activity_code,
    jsonb_build_object('request_id', v_req.id, 'activity', v_req.activity_code));

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mining_credit_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mining_credit_request TO service_role;

-- Reverse a previously credited request.
CREATE OR REPLACE FUNCTION public.mining_reverse_request(p_request_id uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.mining_requests;
  v_balance numeric;
BEGIN
  SELECT * INTO v_req FROM public.mining_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.status <> 'credited' THEN RETURN false; END IF;

  SELECT COALESCE(SUM(delta_mg),0) INTO v_balance
    FROM public.ucoin_ledger WHERE user_id = v_req.user_id;

  INSERT INTO public.ucoin_ledger(user_id, request_id, delta_mg, kind, reason, running_balance)
  VALUES (v_req.user_id, v_req.id, -v_req.reward_mg, 'reversal', p_reason, v_balance - v_req.reward_mg);

  UPDATE public.ucoin_wallets
    SET balance = balance - v_req.reward_mg, updated_at = now()
    WHERE user_id = v_req.user_id;

  UPDATE public.mining_requests
    SET status = 'reversed', rejection_reason = p_reason, updated_at = now()
    WHERE id = p_request_id;

  INSERT INTO public.mining_events(request_id, stage, actor, payload)
  VALUES (p_request_id, 'reversed', 'admin',
    jsonb_build_object('reason', p_reason, 'amount_mg', v_req.reward_mg));

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mining_reverse_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mining_reverse_request TO service_role;

-- =====================================================================
-- Seed default activities
-- =====================================================================
INSERT INTO public.mining_activities (code, display_name, description, reward_mg, cooldown_seconds, daily_cap, requires_moderation, rules) VALUES
  ('daily_login',   'Daily Login',        'Reward for logging in once per day',                  5,   86400, 1,  false, '{"require_trusted_device":true}'::jsonb),
  ('purchase',      'Verified Purchase',  'Order delivered and return window closed',            25,  0,     NULL, false, '{"await":"order_delivered_and_return_closed","return_window_days":7}'::jsonb),
  ('referral',      'Referral Reward',    'Referred user KYC + first delivered order',           50,  0,     NULL, false, '{"await":"referral_completed"}'::jsonb),
  ('delivery',      'Delivery Completed', 'Driver delivered with POD, OTP, photo, rating',       20,  0,     NULL, false, '{"await":"driver_pod_complete"}'::jsonb),
  ('review',        'Product Review',     'Verified purchase review, moderated',                 10,  0,     3,    true,  '{"min_words":20,"require_verified_purchase":true}'::jsonb),
  ('social_share',  'Social Share',       'Tracked share link with real unique visitor',         5,   0,     10,   false, '{"min_dwell_seconds":10,"require_unique_device":true}'::jsonb),
  ('video_watch',   'Video Watched',      '95% watched with quiz passed if applicable',          8,   0,     5,    false, '{"min_watched_percent":95}'::jsonb),
  ('kyc_complete',  'KYC Completed',      'User completed identity verification',                100, 0,     1,    false, '{"await":"kyc_verified"}'::jsonb);
