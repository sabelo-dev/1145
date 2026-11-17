-- =============================================================================
-- 1145 Logistics: delivery windows, high-value controls, COD, POPIA, learned ETAs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Delivery time windows
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS delivery_window TEXT NOT NULL DEFAULT 'any';
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_delivery_window_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_delivery_window_check
  CHECK (delivery_window IN ('any', 'morning', 'afternoon', 'evening'));

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS planned_eta TIMESTAMPTZ;   -- first ETA promised (for accuracy reporting)

-- Local (SAST) bounds of a window on a given day.
CREATE OR REPLACE FUNCTION public.logistics_window_bounds(p_window TEXT, p_day DATE)
RETURNS TABLE (window_start TIMESTAMPTZ, window_end TIMESTAMPTZ)
LANGUAGE sql STABLE
AS $$
  SELECT (p_day + s) AT TIME ZONE 'Africa/Johannesburg', (p_day + e) AT TIME ZONE 'Africa/Johannesburg'
    FROM (VALUES
      ('morning',   time '08:00', time '12:00'),
      ('afternoon', time '12:00', time '17:00'),
      ('evening',   time '17:00', time '20:00')
    ) AS w(name, s, e)
   WHERE w.name = p_window
$$;

-- ---------------------------------------------------------------------------
-- 2. High-value / large-COD approval (four-eyes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_settings
  ADD COLUMN IF NOT EXISTS approval_declared_value NUMERIC NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS approval_cod_amount NUMERIC NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS pii_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (pii_retention_days BETWEEN 30 AND 3650);

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;
CREATE INDEX IF NOT EXISTS shipments_awaiting_approval_idx ON public.shipments (created_at)
  WHERE requires_approval AND approved_at IS NULL;

CREATE OR REPLACE FUNCTION public.shipments_flag_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cfg public.logistics_settings;
BEGIN
  SELECT * INTO v_cfg FROM public.logistics_settings WHERE id;
  IF coalesce(NEW.declared_value, 0) >= v_cfg.approval_declared_value
     OR coalesce(NEW.cod_amount, 0) >= v_cfg.approval_cod_amount THEN
    NEW.requires_approval := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_flag_approval ON public.shipments;
CREATE TRIGGER trg_shipments_flag_approval
  BEFORE INSERT OR UPDATE OF declared_value, cod_amount ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_flag_approval();

-- Approve or reject. The approver must differ from whoever booked it (owners exempt).
CREATE OR REPLACE FUNCTION public.logistics_review_shipment(p_shipment_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL OR NOT v_ship.requires_approval OR v_ship.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'not_pending_approval';
  END IF;
  IF v_ship.created_by = auth.uid() AND NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'cannot_approve_own_booking';
  END IF;

  IF p_approve THEN
    UPDATE public.shipments SET approved_by = auth.uid(), approved_at = now(), approval_note = p_note WHERE id = v_ship.id;
    INSERT INTO public.shipment_events (shipment_id, status, event_type, notes, actor_id)
    VALUES (v_ship.id, v_ship.status, 'note', 'Released after high-value review' || coalesce(': ' || p_note, ''), auth.uid());
    -- Releasing the hold reopens nearby dispatch for the job (trg_shipments_sync_nearby_dispatch).
  ELSE
    PERFORM set_config('logistics.event_notes', 'Rejected at high-value review' || coalesce(': ' || p_note, ''), true);
    UPDATE public.shipments SET status = 'cancelled', approval_note = p_note WHERE id = v_ship.id;
    IF v_ship.delivery_job_id IS NOT NULL THEN
      UPDATE public.delivery_jobs SET status = 'cancelled' WHERE id = v_ship.delivery_job_id AND status IN ('pending', 'accepted');
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_review_shipment(UUID, BOOLEAN, TEXT) TO authenticated;

-- Unreviewed parcels can't be offered, claimed or assigned.
CREATE OR REPLACE FUNCTION public.logistics_shipment_on_hold(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.shipments s
                  WHERE s.delivery_job_id = p_job_id AND s.requires_approval AND s.approved_at IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.delivery_job_guard_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL AND OLD.driver_id IS NULL AND public.logistics_shipment_on_hold(NEW.id) THEN
    RAISE EXCEPTION 'awaiting_approval' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_job_guard_approval ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_guard_approval
  BEFORE UPDATE OF driver_id ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.delivery_job_guard_approval();

-- ---------------------------------------------------------------------------
-- 3. Cash-on-delivery ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cod_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL UNIQUE REFERENCES public.shipments(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remitted_at TIMESTAMPTZ,
  remitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  remittance_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cod_collections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS cod_collections_outstanding_idx ON public.cod_collections (driver_id) WHERE remitted_at IS NULL;

DROP POLICY IF EXISTS "Staff view COD" ON public.cod_collections;
CREATE POLICY "Staff view COD" ON public.cod_collections
  FOR SELECT TO authenticated
  USING ((SELECT public.is_logistics_staff()) OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = (SELECT auth.uid())));

-- Delivered COD parcel → the delivering driver owes the cash.
CREATE OR REPLACE FUNCTION public.shipments_record_cod()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID := NULLIF(current_setting('logistics.event_driver', true), '')::uuid;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND coalesce(NEW.cod_amount, 0) > 0 THEN
    IF v_driver IS NULL AND NEW.delivery_job_id IS NOT NULL THEN
      SELECT driver_id INTO v_driver FROM public.delivery_jobs WHERE id = NEW.delivery_job_id;
    END IF;
    IF v_driver IS NULL THEN
      SELECT r.driver_id INTO v_driver
        FROM public.route_stops rs JOIN public.delivery_routes r ON r.id = rs.route_id
       WHERE rs.shipment_id = NEW.id AND rs.stop_type = 'delivery' AND rs.status = 'completed'
       ORDER BY rs.completed_at DESC LIMIT 1;
    END IF;
    INSERT INTO public.cod_collections (shipment_id, driver_id, amount, collected_at)
    VALUES (NEW.id, v_driver, NEW.cod_amount, coalesce(NEW.delivered_at, now()))
    ON CONFLICT (shipment_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_record_cod ON public.shipments;
CREATE TRIGGER trg_shipments_record_cod
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_record_cod();

CREATE OR REPLACE FUNCTION public.logistics_remit_cod(p_collection_ids UUID[], p_reference TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'reference_required';
  END IF;
  WITH done AS (
    UPDATE public.cod_collections
       SET remitted_at = now(), remitted_by = auth.uid(), remittance_ref = left(trim(p_reference), 80)
     WHERE id = ANY (p_collection_ids) AND remitted_at IS NULL
    RETURNING amount
  )
  SELECT coalesce(sum(amount), 0) INTO v_total FROM done;
  INSERT INTO public.logistics_audit_log (actor_id, action, entity_type, details, ip)
  VALUES (auth.uid(), 'cod_remitted', 'cod_collections',
          jsonb_build_object('count', array_length(p_collection_ids, 1), 'total', v_total, 'reference', p_reference),
          public.logistics_client_ip());
  RETURN v_total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_remit_cod(UUID[], TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. POPIA: retention, access and erasure
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS pii_redacted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.logistics_storage_purge (
  path TEXT PRIMARY KEY,
  bucket TEXT NOT NULL DEFAULT 'delivery-proofs',
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purged_at TIMESTAMPTZ
);
ALTER TABLE public.logistics_storage_purge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners view purge queue" ON public.logistics_storage_purge;
CREATE POLICY "Owners view purge queue" ON public.logistics_storage_purge
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));

-- Strip personal data from the given shipments, keeping what analytics needs
-- (status, timings, city, ~1 km location, fees, ratings).
CREATE OR REPLACE FUNCTION public.logistics_redact_shipments(p_ids UUID[], p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_coarse TEXT := $q$
    jsonb_strip_nulls(jsonb_build_object(
      'city', %1$s->>'city', 'suburb', %1$s->>'suburb', 'country', %1$s->>'country',
      'lat', round((%1$s->>'lat')::numeric, 2), 'lng', round((%1$s->>'lng')::numeric, 2),
      'redacted', true))
  $q$;
BEGIN
  -- Queue proof photos/signatures for storage deletion.
  INSERT INTO public.logistics_storage_purge (path)
  SELECT p FROM (
    SELECT rs.proof->>'photo_path' AS p FROM public.route_stops rs WHERE rs.shipment_id = ANY (p_ids)
    UNION SELECT j.proof->>'photo_path' FROM public.shipments s JOIN public.delivery_jobs j ON j.id = s.delivery_job_id WHERE s.id = ANY (p_ids)
    UNION SELECT j.proof->>'signature_path' FROM public.shipments s JOIN public.delivery_jobs j ON j.id = s.delivery_job_id WHERE s.id = ANY (p_ids)
  ) x WHERE p IS NOT NULL
  ON CONFLICT (path) DO NOTHING;

  EXECUTE format($u$
    UPDATE public.shipments SET
      recipient_name = split_part(recipient_name, ' ', 1),
      recipient_phone = NULL, recipient_email = NULL, sender_phone = NULL,
      delivery_address = %s, pickup_address = CASE WHEN source = 'consumer' THEN %s ELSE pickup_address END,
      delivery_preferences = '{}'::jsonb, notes = NULL, rating_comment = NULL, delivery_otp = NULL,
      metadata = metadata - 'idempotency_key',
      pii_redacted_at = now()
    WHERE id = ANY ($1) AND pii_redacted_at IS NULL
  $u$, format(v_coarse, 'delivery_address'), format(v_coarse, 'pickup_address'))
  USING p_ids;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.route_stops SET
    contact_name = split_part(coalesce(contact_name, ''), ' ', 1), contact_phone = NULL, notes = NULL,
    address = jsonb_strip_nulls(jsonb_build_object('city', address->>'city', 'redacted', true)),
    proof = CASE WHEN proof IS NULL THEN NULL ELSE (proof - 'photo_path' - 'received_by') || '{"redacted": true}'::jsonb END
  WHERE shipment_id = ANY (p_ids);

  UPDATE public.delivery_jobs j SET
    notes = NULL,
    delivery_address = jsonb_strip_nulls(jsonb_build_object('city', j.delivery_address->>'city', 'redacted', true)),
    proof = CASE WHEN j.proof IS NULL THEN NULL ELSE (j.proof - 'photo_path' - 'signature_path') || '{"redacted": true}'::jsonb END
  FROM public.shipments s
  WHERE s.delivery_job_id = j.id AND s.id = ANY (p_ids) AND j.order_id IS NULL;  -- marketplace orders keep their own retention

  UPDATE public.shipment_events SET notes = NULL, lat = NULL, lng = NULL WHERE shipment_id = ANY (p_ids);

  IF v_count > 0 THEN
    INSERT INTO public.logistics_audit_log (actor_id, action, entity_type, details, ip)
    VALUES (auth.uid(), 'pii_redacted', 'shipments', jsonb_build_object('count', v_count, 'reason', p_reason), public.logistics_client_ip());
  END IF;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_redact_shipments(UUID[], TEXT) FROM PUBLIC, anon, authenticated;

-- Nightly retention job.
CREATE OR REPLACE FUNCTION public.logistics_apply_retention()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_days INTEGER := (SELECT pii_retention_days FROM public.logistics_settings WHERE id);
  v_ids UUID[];
BEGIN
  SELECT array_agg(id) INTO v_ids FROM (
    SELECT id FROM public.shipments
     WHERE pii_redacted_at IS NULL
       AND status IN ('delivered', 'returned', 'cancelled')
       AND updated_at < now() - make_interval(days => v_days)
       AND NOT EXISTS (SELECT 1 FROM public.cod_collections c WHERE c.shipment_id = shipments.id AND c.remitted_at IS NULL)
     LIMIT 5000) x;
  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;
  RETURN public.logistics_redact_shipments(v_ids, 'retention_' || v_days || 'd');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_apply_retention() FROM PUBLIC, anon, authenticated;

-- Data-subject access: what do we hold for this phone/email? (owners only)
CREATE OR REPLACE FUNCTION public.logistics_find_personal_data(p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, tracking_number TEXT, role TEXT, status TEXT, created_at TIMESTAMPTZ, redacted BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_digits TEXT := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9);
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF length(v_digits) < 9 AND coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'phone_or_email_required';
  END IF;
  RETURN QUERY
    SELECT s.id, s.tracking_number,
           CASE WHEN length(v_digits) >= 9 AND right(regexp_replace(coalesce(s.sender_phone, ''), '\D', '', 'g'), 9) = v_digits THEN 'sender' ELSE 'recipient' END,
           s.status, s.created_at, s.pii_redacted_at IS NOT NULL
      FROM public.shipments s
     WHERE (length(v_digits) >= 9 AND (right(regexp_replace(coalesce(s.recipient_phone, ''), '\D', '', 'g'), 9) = v_digits
                                     OR right(regexp_replace(coalesce(s.sender_phone, ''), '\D', '', 'g'), 9) = v_digits))
        OR (coalesce(trim(p_email), '') <> '' AND lower(s.recipient_email) = lower(trim(p_email)))
     ORDER BY s.created_at DESC
     LIMIT 500;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_find_personal_data(TEXT, TEXT) TO authenticated;

-- Erasure request (owners): closed shipments are redacted now; open ones are refused.
CREATE OR REPLACE FUNCTION public.logistics_erase_personal_data(p_shipment_ids UUID[], p_request_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_closed UUID[];
  v_open INTEGER;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_request_ref), '') = '' THEN
    RAISE EXCEPTION 'request_reference_required';
  END IF;
  SELECT array_agg(id) FILTER (WHERE status IN ('delivered', 'returned', 'cancelled')),
         count(*) FILTER (WHERE status NOT IN ('delivered', 'returned', 'cancelled'))
    INTO v_closed, v_open
    FROM public.shipments WHERE id = ANY (p_shipment_ids);
  RETURN jsonb_build_object(
    'redacted', CASE WHEN v_closed IS NULL THEN 0 ELSE public.logistics_redact_shipments(v_closed, 'erasure_request:' || left(p_request_ref, 60)) END,
    'still_open', v_open);
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_erase_personal_data(UUID[], TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Learned ETAs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_eta_profiles (
  hub_key UUID NOT NULL,          -- hub id, or the nil UUID for the network-wide profile
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  avg_kmh NUMERIC(6,2) NOT NULL,
  service_mins NUMERIC(6,2) NOT NULL,
  samples INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_key, hour)
);
ALTER TABLE public.logistics_eta_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view eta profiles" ON public.logistics_eta_profiles;
CREATE POLICY "Staff view eta profiles" ON public.logistics_eta_profiles FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

-- Fit per-hub, per-hour speed and dwell time from the last 30 days of stops.
CREATE OR REPLACE FUNCTION public.logistics_train_eta()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  WITH legs AS (
    SELECT r.hub_id,
           extract(hour FROM s.arrived_at AT TIME ZONE 'Africa/Johannesburg')::smallint AS hour,
           2 * 6371 * asin(sqrt(
             power(sin(radians(s.lat - p.lat) / 2), 2) +
             cos(radians(p.lat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - p.lng) / 2), 2))) * 1.3 AS km,
           extract(epoch FROM s.arrived_at - p.completed_at) AS travel_s,
           extract(epoch FROM s.completed_at - s.arrived_at) / 60.0 AS service_m
      FROM public.route_stops s
      JOIN public.delivery_routes r ON r.id = s.route_id
      JOIN LATERAL (
        SELECT lat, lng, completed_at FROM public.route_stops q
         WHERE q.route_id = s.route_id AND q.sequence < s.sequence AND q.status = 'completed' AND q.lat IS NOT NULL
         ORDER BY q.sequence DESC LIMIT 1) p ON true
     WHERE s.status = 'completed' AND s.arrived_at IS NOT NULL AND s.completed_at IS NOT NULL
       AND s.lat IS NOT NULL AND s.completed_at > now() - interval '30 days'
  ), clean AS (
    SELECT hub_id, hour, km / (travel_s / 3600.0) AS kmh, service_m
      FROM legs
     WHERE travel_s > 60 AND km > 0.2
       AND km / (travel_s / 3600.0) BETWEEN 3 AND 90
       AND service_m BETWEEN 0.3 AND 30
  ), fitted AS (
    SELECT coalesce(hub_id, '00000000-0000-0000-0000-000000000000'::uuid) AS hub_key, hour,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY kmh) AS kmh,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY service_m) AS svc, count(*) AS n
      FROM clean GROUP BY 1, 2
    UNION ALL
    SELECT '00000000-0000-0000-0000-000000000000'::uuid, hour,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY kmh), percentile_cont(0.5) WITHIN GROUP (ORDER BY service_m), count(*)
      FROM clean GROUP BY 2
  )
  INSERT INTO public.logistics_eta_profiles (hub_key, hour, avg_kmh, service_mins, samples, updated_at)
  SELECT DISTINCT ON (hub_key, hour) hub_key, hour, round(kmh::numeric, 2), round(svc::numeric, 2), n, now()
    FROM fitted WHERE n >= 5
   ORDER BY hub_key, hour, n DESC
  ON CONFLICT (hub_key, hour) DO UPDATE
    SET avg_kmh = EXCLUDED.avg_kmh, service_mins = EXCLUDED.service_mins, samples = EXCLUDED.samples, updated_at = now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_train_eta() FROM PUBLIC, anon, authenticated;

-- Speed & dwell for a hub at an instant: hub profile → network profile → defaults.
CREATE OR REPLACE FUNCTION public.logistics_eta_params(p_hub UUID, p_at TIMESTAMPTZ)
RETURNS TABLE (kmh NUMERIC, service_mins NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(h.avg_kmh, g.avg_kmh, 30), coalesce(h.service_mins, g.service_mins, 5)
    FROM (SELECT extract(hour FROM p_at AT TIME ZONE 'Africa/Johannesburg')::smallint AS hr) t
    LEFT JOIN public.logistics_eta_profiles h ON h.hub_key = p_hub AND h.hour = t.hr
    LEFT JOIN public.logistics_eta_profiles g ON g.hub_key = '00000000-0000-0000-0000-000000000000' AND g.hour = t.hr
$$;

-- Live ETAs v2: learned speeds, delivery windows (wait for opening), planned_eta capture.
CREATE OR REPLACE FUNCTION public.route_refresh_etas(p_route_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_route public.delivery_routes;
  v_lat NUMERIC;
  v_lng NUMERIC;
  v_clock TIMESTAMPTZ := now();
  v_km NUMERIC;
  v_p RECORD;
  r RECORD;
BEGIN
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = p_route_id;
  IF v_route.id IS NULL OR v_route.status <> 'in_progress' THEN
    RETURN;
  END IF;

  SELECT latitude, longitude INTO v_lat, v_lng FROM public.driver_locations
   WHERE driver_id = v_route.driver_id AND last_updated > now() - interval '10 minutes';
  IF v_lat IS NULL THEN
    SELECT lat, lng INTO v_lat, v_lng FROM public.route_stops
     WHERE route_id = p_route_id AND status IN ('completed', 'failed', 'skipped') AND lat IS NOT NULL
     ORDER BY sequence DESC LIMIT 1;
  END IF;
  IF v_lat IS NULL THEN
    SELECT h.lat, h.lng INTO v_lat, v_lng FROM public.logistics_hubs h WHERE h.id = v_route.hub_id;
  END IF;

  FOR r IN SELECT id, lat, lng, status, window_start FROM public.route_stops
            WHERE route_id = p_route_id AND status IN ('pending', 'arrived') ORDER BY sequence LOOP
    SELECT * INTO v_p FROM public.logistics_eta_params(v_route.hub_id, v_clock);
    IF r.status = 'arrived' THEN
      UPDATE public.route_stops SET eta = now(), planned_eta = coalesce(planned_eta, now()) WHERE id = r.id;
      v_clock := now() + make_interval(secs => v_p.service_mins * 60);
    ELSE
      IF r.lat IS NOT NULL AND v_lat IS NOT NULL THEN
        v_km := 2 * 6371 * asin(sqrt(
          power(sin(radians(r.lat - v_lat) / 2), 2) +
          cos(radians(v_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - v_lng) / 2), 2))) * 1.3;
        v_clock := v_clock + make_interval(secs => (v_km / greatest(v_p.kmh, 3)) * 3600);
      END IF;
      -- Don't arrive before the customer's window opens.
      IF r.window_start IS NOT NULL AND v_clock < r.window_start THEN
        v_clock := r.window_start;
      END IF;
      UPDATE public.route_stops SET eta = v_clock, planned_eta = coalesce(planned_eta, v_clock) WHERE id = r.id;
      v_clock := v_clock + make_interval(secs => v_p.service_mins * 60);
    END IF;
    IF r.lat IS NOT NULL THEN
      v_lat := r.lat;
      v_lng := r.lng;
    END IF;
  END LOOP;
END;
$$;

-- ETA accuracy for reports: median absolute error of the first promised ETA.
CREATE OR REPLACE FUNCTION public.logistics_eta_accuracy(p_since TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.is_logistics_staff() THEN NULL ELSE jsonb_build_object(
    'samples', count(*),
    'median_abs_error_mins', round((percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(extract(epoch FROM arrived_at - planned_eta)) / 60))::numeric, 1),
    'within_15_mins_pct', round(100.0 * avg((abs(extract(epoch FROM arrived_at - planned_eta)) <= 900)::int), 0)
  ) END
  FROM public.route_stops
  WHERE stop_type = 'delivery' AND arrived_at IS NOT NULL AND planned_eta IS NOT NULL AND arrived_at >= p_since
$$;
GRANT EXECUTE ON FUNCTION public.logistics_eta_accuracy(TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Schedules
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('logistics-retention', 'logistics-train-eta');
    PERFORM cron.schedule('logistics-retention', '15 2 * * *', 'SELECT public.logistics_apply_retention()');
    PERFORM cron.schedule('logistics-train-eta', '45 2 * * *', 'SELECT public.logistics_train_eta()');
  ELSE
    RAISE NOTICE 'pg_cron not installed: run logistics_apply_retention() and logistics_train_eta() nightly';
  END IF;
END;
$$;

-- Owners purge queued proof files (Storage API from the console), then mark them done.
DROP POLICY IF EXISTS "Owners delete delivery proofs" ON storage.objects;
CREATE POLICY "Owners delete delivery proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'delivery-proofs' AND (SELECT public.is_logistics_staff(ARRAY['owner'])));
DROP POLICY IF EXISTS "Owners mark purge done" ON public.logistics_storage_purge;
CREATE POLICY "Owners mark purge done" ON public.logistics_storage_purge
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner']))) WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));
