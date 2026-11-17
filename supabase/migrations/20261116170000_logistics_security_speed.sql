-- =============================================================================
-- 1145 Logistics: security hardening & delivery speed
--   Security: settings + MFA enforcement, rate limiting, API scopes/IP lists,
--             webhook SSRF guard, audit log, OTP lock reset
--   Speed:    dispatch sweep (SLA risk, live ETAs), indexes. Marketplace
--             delivery jobs are offered by the platform's nearby dispatch
--             (driver_dispatch_requests); 20261117070000 bridges the two.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Settings (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  require_mfa BOOLEAN NOT NULL DEFAULT false,
  idle_timeout_minutes INTEGER NOT NULL DEFAULT 30 CHECK (idle_timeout_minutes BETWEEN 5 AND 480),
  sla_warning_minutes INTEGER NOT NULL DEFAULT 45 CHECK (sla_warning_minutes BETWEEN 10 AND 480),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.logistics_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.logistics_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. MFA-aware role resolution
-- ---------------------------------------------------------------------------
-- Raw role, ignoring MFA (internal use).
CREATE OR REPLACE FUNCTION public.logistics_role_raw(_user UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _user IS NULL THEN NULL
    WHEN public.is_admin(_user) THEN 'owner'
    ELSE (SELECT role FROM public.logistics_members WHERE user_id = _user AND is_active LIMIT 1)
  END
$$;

-- Effective role. When MFA is required, a session that hasn't completed a
-- second factor (JWT aal ≠ aal2) gets no logistics access at all: RLS, RPCs
-- and the dispatch function all route through here.
CREATE OR REPLACE FUNCTION public.logistics_role(_user UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _user IS NULL THEN NULL
    -- No probing other users' roles (service role has no auth.uid()).
    WHEN auth.uid() IS NOT NULL AND _user <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN NULL
    WHEN _user = auth.uid()
     AND (SELECT require_mfa FROM public.logistics_settings WHERE id)
     AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN NULL
    ELSE public.logistics_role_raw(_user)
  END
$$;

-- What the console needs to decide between: sign-in, MFA step, or access.
CREATE OR REPLACE FUNCTION public.logistics_access_status()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', public.logistics_role(auth.uid()),
    'member_role', public.logistics_role_raw(auth.uid()),
    'mfa_required', s.require_mfa,
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'idle_timeout_minutes', s.idle_timeout_minutes
  )
  FROM public.logistics_settings s WHERE s.id
$$;
GRANT EXECUTE ON FUNCTION public.logistics_access_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.logistics_role_raw(UUID) FROM PUBLIC, anon, authenticated;

-- Membership check for the caller only (usable in RLS; no user-id argument to probe).
CREATE OR REPLACE FUNCTION public.logistics_is_member()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.logistics_role_raw(auth.uid()) IS NOT NULL $$;
GRANT EXECUTE ON FUNCTION public.logistics_is_member() TO authenticated;

DROP POLICY IF EXISTS "Staff read settings" ON public.logistics_settings;
CREATE POLICY "Staff read settings" ON public.logistics_settings
  FOR SELECT TO authenticated USING ((SELECT public.logistics_is_member()));
DROP POLICY IF EXISTS "Owners update settings" ON public.logistics_settings;
CREATE POLICY "Owners update settings" ON public.logistics_settings
  FOR UPDATE TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner']))) WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));

-- Owners may only switch MFA on from an MFA session (no self-lockout).
CREATE OR REPLACE FUNCTION public.logistics_settings_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only user sessions are checked; SQL editor / service role (no auth.uid()) may toggle it.
  IF NEW.require_mfa AND NOT OLD.require_mfa AND auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'enable_mfa_yourself_first';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_logistics_settings_guard ON public.logistics_settings;
CREATE TRIGGER trg_logistics_settings_guard BEFORE UPDATE ON public.logistics_settings
  FOR EACH ROW EXECUTE FUNCTION public.logistics_settings_guard();

-- ---------------------------------------------------------------------------
-- 3. Rate limiting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_rate_counters (
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
ALTER TABLE public.logistics_rate_counters ENABLE ROW LEVEL SECURITY; -- no policies: definer functions only

-- First hop of X-Forwarded-For as seen by PostgREST; NULL for server-side callers.
CREATE OR REPLACE FUNCTION public.logistics_client_ip()
RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  v_headers JSON;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN NULLIF(trim(split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1)), '');
END;
$$;

-- Fixed-window counter. Returns true while under the limit.
CREATE OR REPLACE FUNCTION public.logistics_rate_hit(p_bucket TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits INTEGER;
BEGIN
  INSERT INTO public.logistics_rate_counters (bucket, window_start, hits)
  VALUES (left(p_bucket, 200), v_window, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = logistics_rate_counters.hits + 1
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_rate_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logistics_rate_hit(TEXT, INTEGER, INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. API key hardening
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_api_keys
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['shipments:read', 'shipments:write'],
  ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_per_min INTEGER NOT NULL DEFAULT 120 CHECK (rate_limit_per_min BETWEEN 1 AND 6000),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.logistics_api_keys DROP CONSTRAINT IF EXISTS logistics_api_keys_scopes_check;
ALTER TABLE public.logistics_api_keys ADD CONSTRAINT logistics_api_keys_scopes_check
  CHECK (scopes <@ ARRAY['shipments:read', 'shipments:write', 'quotes:read']);

-- ---------------------------------------------------------------------------
-- 5. Webhook SSRF guard (literal private/loopback/link-local targets)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.logistics_is_public_https_url(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_url ~ '^https://[^/\s:@]+(:[0-9]{2,5})?(/[^\s]*)?$'
     AND lower(substring(p_url FROM '^https://([^/:]+)')) !~ (
       '^(localhost|.*\.local|.*\.internal|.*\.localhost|metadata\.google\.internal|' ||
       '0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.|' ||
       '\[|.*:.*)'
     )
$$;

ALTER TABLE public.logistics_webhooks DROP CONSTRAINT IF EXISTS logistics_webhooks_url_check;
ALTER TABLE public.logistics_webhooks ADD CONSTRAINT logistics_webhooks_url_check
  CHECK (public.logistics_is_public_https_url(url));

-- ---------------------------------------------------------------------------
-- 6. Audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS logistics_audit_log_created_idx ON public.logistics_audit_log (created_at DESC);

DROP POLICY IF EXISTS "Owners read audit log" ON public.logistics_audit_log;
CREATE POLICY "Owners read audit log" ON public.logistics_audit_log
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));
-- No insert/update/delete policies: rows come only from definer triggers.

CREATE OR REPLACE FUNCTION public.logistics_audit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row JSONB := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  v_details JSONB;
  v_action TEXT := lower(TG_OP);
BEGIN
  -- Secrets never enter the log.
  v_row := v_row - 'secret' - 'key_hash' - 'delivery_otp';
  v_old := v_old - 'secret' - 'key_hash' - 'delivery_otp';

  IF TG_TABLE_NAME = 'shipments' THEN
    -- Only staff-driven, sensitive transitions.
    IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status
       OR NEW.status NOT IN ('cancelled', 'exception', 'returned', 'returning') THEN
      IF NEW.otp_failures < OLD.otp_failures THEN
        v_action := 'otp_reset';
      ELSE
        RETURN NULL;
      END IF;
    ELSE
      v_action := 'status_' || NEW.status;
    END IF;
    v_details := jsonb_build_object('tracking_number', NEW.tracking_number, 'from', OLD.status, 'to', NEW.status);
  ELSIF TG_TABLE_NAME = 'delivery_routes' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('dispatched', 'cancelled') THEN
      RETURN NULL;
    END IF;
    v_action := 'route_' || NEW.status;
    v_details := jsonb_build_object('name', NEW.name, 'driver_id', NEW.driver_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Record only the changed keys.
    SELECT jsonb_object_agg(k, jsonb_build_object('from', v_old->k, 'to', v_row->k)) INTO v_details
      FROM jsonb_object_keys(v_row) k
     WHERE (v_row->k) IS DISTINCT FROM (v_old->k) AND k NOT IN ('updated_at', 'last_used_at');
    IF v_details IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    v_details := v_row;
  END IF;

  INSERT INTO public.logistics_audit_log (actor_id, action, entity_type, entity_id, details, ip)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_row->>'id', v_details, public.logistics_client_ip());
  RETURN NULL;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['logistics_members', 'logistics_api_keys', 'logistics_webhooks', 'logistics_settings', 'logistics_hubs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.logistics_audit()', t);
  END LOOP;
END;
$$;
DROP TRIGGER IF EXISTS trg_audit ON public.shipments;
CREATE TRIGGER trg_audit AFTER UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.logistics_audit();
DROP TRIGGER IF EXISTS trg_audit ON public.delivery_routes;
CREATE TRIGGER trg_audit AFTER UPDATE OF status ON public.delivery_routes FOR EACH ROW EXECUTE FUNCTION public.logistics_audit();

-- Dispatch can unlock a parcel after OTP lockout, issuing a fresh code.
CREATE OR REPLACE FUNCTION public.logistics_reset_otp(p_shipment_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_otp TEXT := lpad((floor(random() * 10000))::int::text, 4, '0');
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.shipments SET otp_failures = 0, delivery_otp = v_otp WHERE id = p_shipment_id;
  INSERT INTO public.shipment_events (shipment_id, status, event_type, notes, actor_id)
  SELECT id, status, 'note', 'Delivery code reset by dispatch', auth.uid() FROM public.shipments WHERE id = p_shipment_id;
  RETURN v_otp;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_reset_otp(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Dispatch sweep (every minute)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS sla_risk_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS shipments_sla_risk_idx ON public.shipments (sla_risk_at) WHERE sla_risk_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.logistics_dispatch_sweep()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cfg public.logistics_settings;
  r RECORD;
  v_at_risk INTEGER := 0;
  v_etas INTEGER := 0;
BEGIN
  SELECT * INTO v_cfg FROM public.logistics_settings WHERE id;

  -- SLA watchdog: flag parcels close to their promise that aren't moving yet.
  WITH flagged AS (
    UPDATE public.shipments s
       SET sla_risk_at = now()
     WHERE s.sla_risk_at IS NULL
       AND s.promised_by IS NOT NULL
       AND s.promised_by < now() + make_interval(mins => v_cfg.sla_warning_minutes)
       AND s.status IN ('created', 'awaiting_pickup', 'picked_up', 'at_hub', 'failed_attempt', 'exception')
    RETURNING s.id, s.status, s.promised_by
  )
  INSERT INTO public.shipment_events (shipment_id, status, event_type, notes)
  SELECT id, status, 'sla_risk',
         CASE WHEN promised_by < now() THEN 'Past promised time and not yet out for delivery'
              ELSE 'At risk: due ' || to_char(promised_by AT TIME ZONE 'Africa/Johannesburg', 'HH24:MI') || ', not yet out for delivery' END
    FROM flagged;
  GET DIAGNOSTICS v_at_risk = ROW_COUNT;

  -- Clear the flag once it's moving or closed.
  UPDATE public.shipments SET sla_risk_at = NULL
   WHERE sla_risk_at IS NOT NULL AND status IN ('out_for_delivery', 'delivered', 'returned', 'cancelled', 'returning', 'ready_for_collection');

  -- Keep customer-facing ETAs live for routes on the road.
  FOR r IN SELECT id FROM public.delivery_routes WHERE status = 'in_progress' LIMIT 500 LOOP
    PERFORM public.route_refresh_etas(r.id);
    v_etas := v_etas + 1;
  END LOOP;

  -- Housekeeping.
  DELETE FROM public.logistics_rate_counters WHERE window_start < now() - interval '1 hour';

  RETURN jsonb_build_object('at_risk', v_at_risk, 'routes_reetad', v_etas);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_dispatch_sweep() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'logistics-dispatch-sweep';
    PERFORM cron.schedule('logistics-dispatch-sweep', '* * * * *', 'SELECT public.logistics_dispatch_sweep()');
  ELSE
    RAISE NOTICE 'pg_cron not installed: schedule public.logistics_dispatch_sweep() every minute manually';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Hot-path indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS delivery_jobs_driver_status_idx ON public.delivery_jobs (driver_id, status);
CREATE INDEX IF NOT EXISTS delivery_jobs_route_idx ON public.delivery_jobs (route_id) WHERE route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS route_stops_route_status_idx ON public.route_stops (route_id, status, sequence);
CREATE INDEX IF NOT EXISTS shipment_events_status_created_idx ON public.shipment_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_promised_open_idx ON public.shipments (promised_by)
  WHERE status IN ('created', 'awaiting_pickup', 'picked_up', 'at_hub', 'failed_attempt', 'exception');
CREATE INDEX IF NOT EXISTS shipments_preferred_date_idx ON public.shipments (preferred_date) WHERE preferred_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_locations_available_idx ON public.driver_locations (is_online, is_available, last_updated DESC);
CREATE INDEX IF NOT EXISTS shipments_metadata_idem_idx ON public.shipments (api_key_id, (metadata->>'idempotency_key'))
  WHERE api_key_id IS NOT NULL;

-- Realtime for the dispatch board.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_jobs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_jobs;
  END IF;
END;
$$;
