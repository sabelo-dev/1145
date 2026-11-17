-- =============================================================================
-- 1145 Logistics — upgrades
--   1. drivers.current_location/status → driver_locations (feeds dispatch & maps)
--   2. Marketplace delivery jobs ⇄ shipments (tracking, routing, notifications)
--   3. Consumer parcel booking with server-side quote
--   4. Recipient notifications (pg_net → logistics-notify, idempotent)
--   5. Server-verified proof of delivery for on-demand jobs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mirror driver presence into driver_locations
-- ---------------------------------------------------------------------------
-- The driver app writes drivers.current_location ({lat,lng,heading,speed}) and
-- drivers.status. Dispatch, surge and the ops map read driver_locations, which
-- nothing populated. Keep it in sync from the source of truth.
CREATE OR REPLACE FUNCTION public.sync_driver_location()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_lat NUMERIC;
  v_lng NUMERIC;
BEGIN
  BEGIN
    v_lat := NULLIF(NEW.current_location->>'lat', '')::numeric;
    v_lng := NULLIF(NEW.current_location->>'lng', '')::numeric;
  EXCEPTION WHEN others THEN
    v_lat := NULL;
    v_lng := NULL;
  END;

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    INSERT INTO public.driver_locations (driver_id, latitude, longitude, heading, speed, is_online, is_available, last_updated)
    VALUES (
      NEW.id, v_lat, v_lng,
      NULLIF(NEW.current_location->>'heading', '')::numeric,
      NULLIF(NEW.current_location->>'speed', '')::numeric,
      NEW.status IN ('available', 'busy'), NEW.status = 'available', now()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      heading = EXCLUDED.heading,
      speed = EXCLUDED.speed,
      is_online = EXCLUDED.is_online,
      is_available = EXCLUDED.is_available,
      last_updated = now();
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.driver_locations
       SET is_online = NEW.status IN ('available', 'busy'), is_available = NEW.status = 'available', last_updated = now()
     WHERE driver_id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Never block a driver's own profile update on a presence-sync problem.
  RAISE LOG 'sync_driver_location failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_location ON public.drivers;
CREATE TRIGGER trg_sync_driver_location
  AFTER INSERT OR UPDATE OF current_location, status ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_location();

-- ---------------------------------------------------------------------------
-- 2. Marketplace delivery jobs ⇄ shipments
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'ops',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required';

ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_source_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_source_check
  CHECK (source IN ('ops', 'csv_import', 'marketplace', 'consumer', 'api'));
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_payment_status_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_payment_status_check
  CHECK (payment_status IN ('not_required', 'unpaid', 'paid', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS shipments_delivery_job_key
  ON public.shipments (delivery_job_id) WHERE delivery_job_id IS NOT NULL;

ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS proof JSONB;

-- New marketplace delivery job → shipment (tracking number, timeline, SMS).
CREATE OR REPLACE FUNCTION public.delivery_job_create_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_store TEXT;
  v_addr JSONB;
BEGIN
  IF NEW.order_id IS NULL OR EXISTS (SELECT 1 FROM public.shipments WHERE delivery_job_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.user_id, o.shipping_address, o.total INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF v_order.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.name INTO v_store
    FROM public.order_items oi JOIN public.stores s ON s.id = oi.store_id
   WHERE oi.order_id = NEW.order_id
   LIMIT 1;

  v_addr := COALESCE(v_order.shipping_address, '{}'::jsonb);

  INSERT INTO public.shipments (
    reference, order_id, delivery_job_id, customer_user_id,
    sender_name, recipient_name, recipient_phone, recipient_email,
    pickup_address, delivery_address, service_level, status, source,
    promised_by, created_by, notes
  ) VALUES (
    'ORD-' || upper(left(NEW.order_id::text, 8)), NEW.order_id, NEW.id, v_order.user_id,
    COALESCE(v_store, NEW.pickup_address->>'street', 'Merchant'),
    COALESCE(NULLIF(v_addr->>'name', ''), NULLIF(v_addr->>'full_name', ''), 'Customer'),
    COALESCE(NULLIF(v_addr->>'phone', ''), NULLIF(v_addr->>'phone_number', '')),
    NULLIF(v_addr->>'email', ''),
    NEW.pickup_address, NEW.delivery_address,
    CASE WHEN NEW.priority = 'urgent' THEN 'same_day' ELSE 'next_day' END,
    CASE NEW.status WHEN 'pending' THEN 'awaiting_pickup' WHEN 'accepted' THEN 'awaiting_pickup'
                    WHEN 'picked_up' THEN 'picked_up' WHEN 'in_transit' THEN 'out_for_delivery'
                    WHEN 'delivered' THEN 'delivered' ELSE 'awaiting_pickup' END,
    'marketplace',
    now() + CASE WHEN NEW.priority = 'urgent' THEN interval '10 hours' ELSE interval '30 hours' END,
    auth.uid(), NEW.notes
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'delivery_job_create_shipment failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_job_create_shipment ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_create_shipment
  AFTER INSERT ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.delivery_job_create_shipment();

-- On-demand job progress → shipment status. Routed jobs are excluded: the
-- route-run RPCs update both sides themselves.
CREATE OR REPLACE FUNCTION public.delivery_job_sync_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF NEW.route_id IS NOT NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_status := CASE NEW.status
    WHEN 'picked_up' THEN 'picked_up'
    WHEN 'in_transit' THEN 'out_for_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'failed' THEN 'failed_attempt'
    WHEN 'returned' THEN 'returned'
    WHEN 'cancelled' THEN 'cancelled'
    WHEN 'pending' THEN 'awaiting_pickup'
    ELSE NULL END;
  IF v_status IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('logistics.event_driver', COALESCE(NEW.driver_id::text, ''), true);
  PERFORM set_config('logistics.event_notes', COALESCE(NEW.failure_reason, ''), true);

  UPDATE public.shipments s
     SET status = CASE
           WHEN v_status = 'failed_attempt' AND s.attempt_count + 1 >= s.max_attempts THEN 'returning'
           ELSE v_status END,
         attempt_count = s.attempt_count + CASE WHEN v_status = 'failed_attempt' THEN 1 ELSE 0 END,
         last_failure_reason = CASE WHEN v_status = 'failed_attempt' THEN NEW.failure_reason ELSE s.last_failure_reason END,
         picked_up_at = CASE WHEN v_status = 'picked_up' THEN now() ELSE s.picked_up_at END,
         delivered_at = CASE WHEN v_status = 'delivered' THEN COALESCE(NEW.actual_delivery_time, now()) ELSE s.delivered_at END
   WHERE s.delivery_job_id = NEW.id
     AND s.status NOT IN ('delivered', 'returned', 'cancelled');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_job_sync_shipment ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_sync_shipment
  AFTER UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.delivery_job_sync_shipment();

-- Backfill shipments for open marketplace jobs that predate this migration.
INSERT INTO public.shipments (
  reference, order_id, delivery_job_id, customer_user_id, sender_name, recipient_name, recipient_phone,
  pickup_address, delivery_address, service_level, status, source, notes
)
SELECT 'ORD-' || upper(left(j.order_id::text, 8)), j.order_id, j.id, o.user_id,
       COALESCE(j.pickup_address->>'street', 'Merchant'),
       COALESCE(NULLIF(o.shipping_address->>'name', ''), 'Customer'),
       NULLIF(o.shipping_address->>'phone', ''),
       j.pickup_address, j.delivery_address, 'next_day',
       CASE j.status WHEN 'picked_up' THEN 'picked_up' WHEN 'in_transit' THEN 'out_for_delivery' ELSE 'awaiting_pickup' END,
       'marketplace', j.notes
  FROM public.delivery_jobs j
  JOIN public.orders o ON o.id = j.order_id
 WHERE j.status IN ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit')
   AND NOT EXISTS (SELECT 1 FROM public.shipments s WHERE s.delivery_job_id = j.id);

-- ---------------------------------------------------------------------------
-- 3. Consumer parcel booking
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.logistics_distance_km(a JSONB, b JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  lat1 NUMERIC := NULLIF(a->>'lat', '')::numeric;
  lng1 NUMERIC := NULLIF(a->>'lng', '')::numeric;
  lat2 NUMERIC := NULLIF(b->>'lat', '')::numeric;
  lng2 NUMERIC := NULLIF(b->>'lng', '')::numeric;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN round((2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )) * 1.3)::numeric, 1);  -- road factor
END;
$$;

-- Tariff: base by size + per-km, scaled by service level. Quote is advisory;
-- book_parcel recomputes it server-side so the client can't set its own price.
CREATE OR REPLACE FUNCTION public.quote_parcel(p_pickup JSONB, p_delivery JSONB, p_size TEXT, p_service_level TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_km NUMERIC := public.logistics_distance_km(p_pickup, p_delivery);
  v_base NUMERIC := CASE p_size WHEN 'small' THEN 45 WHEN 'medium' THEN 65 WHEN 'large' THEN 95 WHEN 'xl' THEN 150 ELSE NULL END;
  v_per_km NUMERIC := CASE p_size WHEN 'xl' THEN 9 WHEN 'large' THEN 7 ELSE 5.5 END;
  v_mult NUMERIC := CASE p_service_level WHEN 'express' THEN 1.8 WHEN 'same_day' THEN 1.35 WHEN 'next_day' THEN 1.0 WHEN 'standard' THEN 0.85 ELSE NULL END;
  v_fee NUMERIC;
  v_ip TEXT := public.logistics_client_ip();
BEGIN
  -- Public endpoint: 120 quotes / minute / IP (server-side callers have no IP).
  IF v_ip IS NOT NULL AND NOT public.logistics_rate_hit('quote:' || v_ip, 120, 60) THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0429';
  END IF;
  IF v_base IS NULL OR v_mult IS NULL THEN
    RAISE EXCEPTION 'invalid_size_or_service';
  END IF;
  IF v_km IS NULL THEN
    RAISE EXCEPTION 'address_not_geocoded';
  END IF;
  IF v_km > 400 THEN
    RAISE EXCEPTION 'distance_out_of_range';
  END IF;
  v_fee := round((v_base + v_km * v_per_km) * v_mult, 0);
  RETURN jsonb_build_object(
    'distance_km', v_km,
    'fee', v_fee,
    'currency', 'ZAR',
    'promised_by', now() + CASE p_service_level
      WHEN 'express' THEN interval '2 hours'
      WHEN 'same_day' THEN interval '10 hours'
      WHEN 'next_day' THEN interval '30 hours'
      ELSE interval '72 hours' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_parcel(
  p_pickup JSONB,
  p_delivery JSONB,
  p_sender_name TEXT,
  p_sender_phone TEXT,
  p_recipient_name TEXT,
  p_recipient_phone TEXT,
  p_size TEXT,
  p_service_level TEXT,
  p_notes TEXT DEFAULT NULL,
  p_require_otp BOOLEAN DEFAULT true,
  p_delivery_window TEXT DEFAULT 'any',
  p_pickup_point_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_quote JSONB;
  v_job UUID;
  v_ship public.shipments;
  v_weight NUMERIC := CASE p_size WHEN 'small' THEN 2 WHEN 'medium' THEN 5 WHEN 'large' THEN 15 ELSE 30 END;
  -- Windows apply to planned services; express/same-day go as soon as possible.
  v_window TEXT := CASE WHEN p_service_level IN ('next_day', 'standard') AND p_delivery_window IN ('morning', 'afternoon', 'evening')
                        THEN p_delivery_window ELSE 'any' END;
  v_promise TIMESTAMPTZ;
  v_point public.logistics_hubs;
  v_delivery JSONB := p_delivery;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_sender_name), '') = '' OR coalesce(trim(p_recipient_name), '') = ''
     OR coalesce(trim(p_recipient_phone), '') = '' THEN
    RAISE EXCEPTION 'missing_contact_details';
  END IF;
  IF (SELECT count(*) FROM public.shipments WHERE created_by = v_uid AND source = 'consumer'
        AND created_at > now() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION 'daily_booking_limit';
  END IF;

  -- Collect from a pickup point / locker instead of a door: the point is the
  -- delivery address and the fee is 20% lower (consolidated drop).
  IF p_pickup_point_id IS NOT NULL THEN
    SELECT * INTO v_point FROM public.logistics_hubs
     WHERE id = p_pickup_point_id AND is_active AND hub_type IN ('pickup_point', 'locker') AND lat IS NOT NULL;
    IF v_point.id IS NULL THEN
      RAISE EXCEPTION 'invalid_pickup_point';
    END IF;
    IF p_service_level = 'express' THEN
      RAISE EXCEPTION 'express_not_available_to_pickup_points';
    END IF;
    v_delivery := coalesce(v_point.address, '{}'::jsonb) || jsonb_build_object('lat', v_point.lat, 'lng', v_point.lng, 'pickup_point', v_point.name);
  END IF;

  v_quote := public.quote_parcel(p_pickup, v_delivery, p_size, p_service_level);
  IF v_point.id IS NOT NULL THEN
    v_quote := jsonb_set(v_quote, '{fee}', to_jsonb(round((v_quote->>'fee')::numeric * 0.8, 0)));
  END IF;
  v_promise := (v_quote->>'promised_by')::timestamptz;
  IF v_window <> 'any' THEN
    -- Promise the end of the chosen window on the promised day.
    SELECT window_end INTO v_promise
      FROM public.logistics_window_bounds(v_window, (v_promise AT TIME ZONE 'Africa/Johannesburg')::date);
  END IF;

  -- Fast services go straight to the on-demand dispatch queue; slower ones are
  -- consolidated onto planned routes from the ops console.
  IF p_service_level IN ('express', 'same_day') THEN
    INSERT INTO public.delivery_jobs (pickup_address, delivery_address, status, priority, distance_km, notes)
    VALUES (p_pickup, v_delivery, 'pending',
            CASE WHEN p_service_level = 'express' THEN 'urgent' ELSE 'normal' END,
            (v_quote->>'distance_km')::numeric, p_notes)
    RETURNING id INTO v_job;
  END IF;

  INSERT INTO public.shipments (
    delivery_job_id, customer_user_id, created_by,
    sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_address, delivery_address, service_level, status, source,
    weight_kg, shipping_fee, payment_status, require_otp, promised_by, notes, metadata, delivery_window, destination_hub_id
  ) VALUES (
    v_job, v_uid, v_uid,
    trim(p_sender_name), nullif(trim(p_sender_phone), ''), trim(p_recipient_name), trim(p_recipient_phone),
    p_pickup, v_delivery, p_service_level, 'awaiting_pickup', 'consumer',
    v_weight, (v_quote->>'fee')::numeric, 'unpaid', coalesce(p_require_otp, true),
    v_promise, nullif(trim(p_notes), ''),
    jsonb_build_object('size', p_size, 'distance_km', v_quote->'distance_km'), CASE WHEN v_point.id IS NULL THEN v_window ELSE 'any' END, v_point.id
  ) RETURNING * INTO v_ship;

  RETURN jsonb_build_object(
    'id', v_ship.id,
    'tracking_number', v_ship.tracking_number,
    'fee', v_ship.shipping_fee,
    'promised_by', v_ship.promised_by,
    'delivery_otp', CASE WHEN v_ship.require_otp THEN v_ship.delivery_otp END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_parcel(JSONB, JSONB, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.book_parcel(JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;

-- Senders can cancel their own booking until it's collected.
CREATE OR REPLACE FUNCTION public.cancel_my_parcel(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  SELECT * INTO v_ship FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL OR v_ship.customer_user_id IS DISTINCT FROM auth.uid() OR v_ship.source <> 'consumer' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;
  IF v_ship.status NOT IN ('created', 'awaiting_pickup') THEN
    RAISE EXCEPTION 'already_collected';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.route_stops rs JOIN public.delivery_routes r ON r.id = rs.route_id
     WHERE rs.shipment_id = v_ship.id AND r.status IN ('dispatched', 'in_progress')
  ) THEN
    RAISE EXCEPTION 'already_dispatched';
  END IF;
  PERFORM set_config('logistics.event_notes', 'Cancelled by sender', true);
  UPDATE public.shipments SET status = 'cancelled' WHERE id = v_ship.id;
  IF v_ship.delivery_job_id IS NOT NULL THEN
    UPDATE public.delivery_jobs SET status = 'cancelled' WHERE id = v_ship.delivery_job_id AND status IN ('pending', 'accepted');
  END IF;
  UPDATE public.route_stops SET status = 'skipped', failure_reason = 'Cancelled by sender'
   WHERE shipment_id = v_ship.id AND status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_my_parcel(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Recipient notifications
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipment_events ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Per-environment settings (the functions base URL differs between staging and
-- production). Override after deploying elsewhere:
--   UPDATE public.logistics_config SET value = 'https://<ref>.supabase.co/functions/v1' WHERE key = 'functions_base_url';
CREATE TABLE IF NOT EXISTS public.logistics_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_config ENABLE ROW LEVEL SECURITY; -- no policies: definer functions / SQL editor only
INSERT INTO public.logistics_config (key, value)
VALUES ('functions_base_url', 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1')
ON CONFLICT (key) DO NOTHING;

-- Full URL of a logistics edge function for this environment (NULL = calls disabled).
CREATE OR REPLACE FUNCTION public.logistics_function_url(p_name TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rtrim(value, '/') || '/' || p_name FROM public.logistics_config WHERE key = 'functions_base_url' AND value <> ''
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_function_url(TEXT) FROM PUBLIC, anon, authenticated;

-- Fire-and-forget: the function claims the event (notified_at) before sending,
-- so repeated or forged calls can never double-send or send arbitrary text.
CREATE OR REPLACE FUNCTION public.shipment_event_notify()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.event_type IN ('status_change', 'created')
     AND NEW.status IN ('awaiting_pickup', 'out_for_delivery', 'delivered', 'failed_attempt', 'returning')
     AND public.logistics_function_url('logistics-notify') IS NOT NULL THEN
    PERFORM net.http_post(
      url := public.logistics_function_url('logistics-notify'),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('event_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'shipment_event_notify failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipment_event_notify ON public.shipment_events;
CREATE TRIGGER trg_shipment_event_notify
  AFTER INSERT ON public.shipment_events
  FOR EACH ROW EXECUTE FUNCTION public.shipment_event_notify();

-- ---------------------------------------------------------------------------
-- 5. Proof of delivery for on-demand jobs (server-verified OTP)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.driver_complete_job(
  p_job_id UUID,
  p_method TEXT,
  p_otp TEXT DEFAULT NULL,
  p_proof JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job public.delivery_jobs;
  v_ship public.shipments;
BEGIN
  IF p_method NOT IN ('otp', 'photo', 'signature') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  SELECT * INTO v_job FROM public.delivery_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.id IS NULL OR v_job.driver_id IS DISTINCT FROM (SELECT id FROM public.drivers WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'job_not_assigned' USING ERRCODE = '42501';
  END IF;
  IF v_job.status NOT IN ('accepted', 'assigned', 'picked_up', 'in_transit') THEN
    RAISE EXCEPTION 'job_not_active';
  END IF;

  SELECT * INTO v_ship FROM public.shipments WHERE delivery_job_id = v_job.id FOR UPDATE;

  IF p_method = 'otp' THEN
    IF v_ship.id IS NULL OR v_ship.delivery_otp IS NULL THEN
      RAISE EXCEPTION 'otp_not_available';
    END IF;
    -- Brute-force guard (returned, not raised, so the count persists).
    IF v_ship.otp_failures >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'otp_locked');
    END IF;
    IF p_otp IS DISTINCT FROM v_ship.delivery_otp THEN
      UPDATE public.shipments SET otp_failures = otp_failures + 1 WHERE id = v_ship.id;
      RETURN jsonb_build_object('ok', false,
        'error', CASE WHEN v_ship.otp_failures + 1 >= 5 THEN 'otp_locked' ELSE 'invalid_otp' END,
        'attempts_left', GREATEST(4 - v_ship.otp_failures, 0));
    END IF;
  ELSIF v_ship.id IS NOT NULL AND v_ship.require_otp THEN
    RAISE EXCEPTION 'otp_required';
  ELSIF p_method = 'photo' AND coalesce(p_proof->>'photo_path', '') = '' THEN
    RAISE EXCEPTION 'photo_required';
  END IF;

  PERFORM set_config('logistics.pod_verified', 'on', true);
  UPDATE public.delivery_jobs
     SET status = 'delivered', actual_delivery_time = now(),
         proof = coalesce(p_proof, '{}'::jsonb) || jsonb_build_object('method', p_method, 'captured_at', now())
   WHERE id = v_job.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_complete_job(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- Does this job need an OTP? (Drivers can't read shipments directly.)
CREATE OR REPLACE FUNCTION public.driver_job_requirements(p_job_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'require_otp', coalesce(s.require_otp, false),
    'otp_available', s.delivery_otp IS NOT NULL,
    'tracking_number', s.tracking_number,
    'recipient_name', s.recipient_name,
    'recipient_phone', s.recipient_phone,
    'cod_amount', s.cod_amount
  )
  FROM public.delivery_jobs j
  LEFT JOIN public.shipments s ON s.delivery_job_id = j.id
  WHERE j.id = p_job_id
    AND j.driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.driver_job_requirements(UUID) TO authenticated;

-- Enforce OTP at the database: a driver can't mark an OTP-protected on-demand
-- job delivered with a plain UPDATE; it must go through driver_complete_job.
-- Routed jobs are verified by driver_update_stop; staff and service-role
-- (auth.uid() IS NULL) writes are exempt.
CREATE OR REPLACE FUNCTION public.delivery_job_guard_pod()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.route_id IS NULL
     AND auth.uid() IS NOT NULL
     AND COALESCE(current_setting('logistics.pod_verified', true), '') <> 'on'
     AND NOT public.is_logistics_staff()
     AND EXISTS (SELECT 1 FROM public.shipments s WHERE s.delivery_job_id = NEW.id AND s.require_otp) THEN
    RAISE EXCEPTION 'otp_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_job_guard_pod ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_guard_pod
  BEFORE UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.delivery_job_guard_pod();
