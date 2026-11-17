-- =============================================================================
-- 1145 Logistics: next-generation capabilities
--   1. Driver earnings: on-demand jobs + routed stops credit delivery_earnings
--   2. Recipient self-service: instructions / safe place, reschedule, rating
--   3. Live tracking: stops-away, stop ETA, approximate driver position
--   4. Business API keys + signed webhooks (data model)
--   5. Wallet payment & refund for consumer parcels
--   6. CO₂ estimate per route
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Driver earnings
-- ---------------------------------------------------------------------------
ALTER TABLE public.delivery_earnings ALTER COLUMN delivery_job_id DROP NOT NULL;
ALTER TABLE public.delivery_earnings
  ADD COLUMN IF NOT EXISTS route_stop_id UUID REFERENCES public.route_stops(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_earnings_route_stop_key
  ON public.delivery_earnings (route_stop_id) WHERE route_stop_id IS NOT NULL;

-- On-demand jobs: use the existing calculator (it was never wired up).
CREATE OR REPLACE FUNCTION public.delivery_job_credit_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.driver_id IS NOT NULL AND NEW.route_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.delivery_earnings WHERE delivery_job_id = NEW.id) THEN
    PERFORM public.calculate_delivery_earnings(NEW.id, COALESCE(NEW.distance_km, 0), NEW.priority = 'urgent', 1.0);
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'delivery_job_credit_earnings failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_job_credit_earnings ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_credit_earnings
  AFTER UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.delivery_job_credit_earnings();

-- Routed stops: base per stop + distance from the previous stop (or hub).
CREATE OR REPLACE FUNCTION public.route_stop_credit_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID;
  v_prev_lat NUMERIC;
  v_prev_lng NUMERIC;
  v_km NUMERIC := 0;
  v_base NUMERIC;
  v_distance_pay NUMERIC;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.stop_type NOT IN ('pickup', 'delivery') THEN
    RETURN NEW;
  END IF;
  SELECT driver_id INTO v_driver FROM public.delivery_routes WHERE id = NEW.route_id;
  IF v_driver IS NULL OR EXISTS (SELECT 1 FROM public.delivery_earnings WHERE route_stop_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT lat, lng INTO v_prev_lat, v_prev_lng
    FROM public.route_stops
   WHERE route_id = NEW.route_id AND sequence < NEW.sequence AND status = 'completed' AND lat IS NOT NULL
   ORDER BY sequence DESC LIMIT 1;
  IF v_prev_lat IS NULL THEN
    SELECT h.lat, h.lng INTO v_prev_lat, v_prev_lng
      FROM public.delivery_routes r JOIN public.logistics_hubs h ON h.id = r.hub_id
     WHERE r.id = NEW.route_id;
  END IF;
  IF v_prev_lat IS NOT NULL AND NEW.lat IS NOT NULL THEN
    v_km := COALESCE(public.logistics_distance_km(
      jsonb_build_object('lat', v_prev_lat, 'lng', v_prev_lng),
      jsonb_build_object('lat', NEW.lat, 'lng', NEW.lng)), 0);
  END IF;

  -- Tariff: R12 per delivery, R5 per pickup, R4/km (route pay is denser than on-demand).
  v_base := CASE WHEN NEW.stop_type = 'delivery' THEN 12 ELSE 5 END;
  v_distance_pay := round(LEAST(v_km, 60) * 4, 2);

  INSERT INTO public.delivery_earnings (
    route_stop_id, delivery_job_id, driver_id, base_pay, distance_pay, total_earnings, distance_km
  ) VALUES (
    NEW.id, NEW.delivery_job_id, v_driver, v_base, v_distance_pay, v_base + v_distance_pay, v_km
  );
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE LOG 'route_stop_credit_earnings failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_stop_credit_earnings ON public.route_stops;
CREATE TRIGGER trg_route_stop_credit_earnings
  AFTER UPDATE OF status ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.route_stop_credit_earnings();

-- ---------------------------------------------------------------------------
-- 2. Recipient self-service
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS delivery_preferences JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT,
  ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS selfservice_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_key_id UUID;

-- Identity check for anonymous recipients: last 4 digits of the recipient
-- phone. Five wrong guesses lock self-service for that shipment.
CREATE OR REPLACE FUNCTION public.recipient_update_delivery(
  p_tracking_number TEXT,
  p_phone_last4 TEXT,
  p_action TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
  v_date DATE;
  v_rating INTEGER;
  v_text TEXT;
  v_note TEXT;
BEGIN
  IF p_action NOT IN ('verify', 'instructions', 'reschedule', 'rate') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;
  -- 10 attempts / minute / client IP across all shipments.
  IF NOT public.logistics_rate_hit('selfserve:' || coalesce(public.logistics_client_ip(), 'unknown'), 10, 60) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = upper(trim(p_tracking_number)) FOR UPDATE;
  IF v_ship.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_ship.selfservice_failures >= 5 THEN
    RAISE EXCEPTION 'locked';
  END IF;
  IF v_ship.recipient_phone IS NULL
     OR right(regexp_replace(v_ship.recipient_phone, '\D', '', 'g'), 4) IS DISTINCT FROM p_phone_last4 THEN
    UPDATE public.shipments SET selfservice_failures = selfservice_failures + 1 WHERE id = v_ship.id;
    -- Commit the failure count even though we signal an error to the caller.
    RETURN jsonb_build_object('ok', false, 'error', 'verification_failed', 'attempts_left', GREATEST(4 - v_ship.selfservice_failures, 0));
  END IF;

  IF p_action = 'verify' THEN
    RETURN jsonb_build_object('ok', true, 'preferences', v_ship.delivery_preferences, 'preferred_date', v_ship.preferred_date, 'rating', v_ship.rating);
  END IF;

  IF p_action = 'instructions' THEN
    IF v_ship.status IN ('delivered', 'returned', 'cancelled', 'returning') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'closed');
    END IF;
    v_text := left(trim(coalesce(p_payload->>'instructions', '')), 300);
    UPDATE public.shipments
       SET delivery_preferences = jsonb_strip_nulls(jsonb_build_object(
             'safe_place', nullif(left(trim(coalesce(p_payload->>'safe_place', '')), 60), ''),
             'instructions', nullif(v_text, ''),
             'updated_at', now()))
     WHERE id = v_ship.id;
    v_note := 'Recipient: ' || concat_ws(' · ',
      nullif('Safe place: ' || nullif(trim(coalesce(p_payload->>'safe_place', '')), ''), 'Safe place: '),
      nullif(v_text, ''));
    -- Drivers see stop notes, never the shipment itself.
    -- Replace (not append) any earlier recipient line.
    UPDATE public.route_stops
       SET notes = concat_ws(E'\n', nullif(trim(regexp_replace(coalesce(notes, ''), E'(^|\n)Recipient: [^\n]*', '', 'g')), ''), v_note)
     WHERE shipment_id = v_ship.id AND stop_type = 'delivery' AND status IN ('pending', 'arrived');
    IF v_ship.delivery_job_id IS NOT NULL THEN
      UPDATE public.delivery_jobs
         SET notes = concat_ws(E'\n', nullif(trim(regexp_replace(coalesce(notes, ''), E'(^|\n)Recipient: [^\n]*', '', 'g')), ''), v_note)
       WHERE id = v_ship.delivery_job_id;
    END IF;
    INSERT INTO public.shipment_events (shipment_id, status, event_type, notes)
    VALUES (v_ship.id, v_ship.status, 'note', 'Recipient updated delivery instructions');
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'reschedule' THEN
    v_date := (p_payload->>'date')::date;
    IF v_date IS NULL OR v_date <= current_date OR v_date > current_date + 7 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_date');
    END IF;
    IF v_ship.status NOT IN ('created', 'awaiting_pickup', 'picked_up', 'at_hub', 'failed_attempt') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too_late');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.route_stops rs JOIN public.delivery_routes r ON r.id = rs.route_id
       WHERE rs.shipment_id = v_ship.id AND rs.stop_type = 'delivery' AND rs.status = 'pending'
         AND r.status IN ('dispatched', 'in_progress')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too_late');
    END IF;
    -- Pull it off any not-yet-dispatched route so the planner re-slots it.
    DELETE FROM public.route_stops rs USING public.delivery_routes r
     WHERE r.id = rs.route_id AND rs.shipment_id = v_ship.id AND rs.status = 'pending'
       AND r.status IN ('draft', 'planned');
    UPDATE public.shipments
       SET preferred_date = v_date,
           delivery_window = CASE WHEN p_payload->>'window' IN ('any', 'morning', 'afternoon', 'evening') THEN p_payload->>'window' ELSE delivery_window END
     WHERE id = v_ship.id;
    INSERT INTO public.shipment_events (shipment_id, status, event_type, notes)
    VALUES (v_ship.id, v_ship.status, 'note', 'Recipient rescheduled delivery to ' || to_char(v_date, 'Dy DD Mon')
            || coalesce(' (' || nullif(p_payload->>'window', 'any') || ')', ''));
    RETURN jsonb_build_object('ok', true, 'preferred_date', v_date);
  END IF;

  -- rate
  IF v_ship.status <> 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_delivered');
  END IF;
  v_rating := (p_payload->>'rating')::int;
  IF v_rating IS NULL OR v_rating NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;
  UPDATE public.shipments
     SET rating = v_rating, rating_comment = nullif(left(trim(coalesce(p_payload->>'comment', '')), 500), ''), rated_at = now()
   WHERE id = v_ship.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.recipient_update_delivery(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Live public tracking (replaces the v1 function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_shipment(p_tracking_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
  v_stop public.route_stops;
  v_route public.delivery_routes;
  v_before INTEGER;
  v_live JSONB := NULL;
  v_loc RECORD;
BEGIN
  -- Anti-enumeration: 60 lookups / minute / client IP (logistics_rate_hit is in the security migration).
  IF NOT public.logistics_rate_hit('track:' || coalesce(public.logistics_client_ip(), 'unknown'), 60, 60) THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0429';
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = upper(trim(p_tracking_number));
  IF v_ship.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_ship.status = 'out_for_delivery' THEN
    SELECT rs.* INTO v_stop
      FROM public.route_stops rs JOIN public.delivery_routes r ON r.id = rs.route_id
     WHERE rs.shipment_id = v_ship.id AND rs.stop_type = 'delivery'
       AND rs.status IN ('pending', 'arrived') AND r.status = 'in_progress'
     LIMIT 1;
    IF v_stop.id IS NOT NULL THEN
      SELECT * INTO v_route FROM public.delivery_routes WHERE id = v_stop.route_id;
      SELECT count(*) INTO v_before FROM public.route_stops
       WHERE route_id = v_stop.route_id AND sequence < v_stop.sequence AND status IN ('pending', 'arrived');
      -- Driver position only when they're close (≤ 3 stops away), rounded
      -- to ~100 m and only if fresh.
      IF v_before <= 3 THEN
        SELECT round(latitude, 3) AS lat, round(longitude, 3) AS lng, last_updated INTO v_loc
          FROM public.driver_locations
         WHERE driver_id = v_route.driver_id AND last_updated > now() - interval '10 minutes';
      END IF;
      v_live := jsonb_build_object(
        'stops_before', v_before,
        'eta', v_stop.eta,
        'arrived', v_stop.status = 'arrived',
        'driver_lat', v_loc.lat,
        'driver_lng', v_loc.lng,
        'driver_seen_at', v_loc.last_updated,
        'destination_lat', round(v_stop.lat, 3),
        'destination_lng', round(v_stop.lng, 3)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tracking_number', v_ship.tracking_number,
    'status', v_ship.status,
    'service_level', v_ship.service_level,
    'parcel_count', v_ship.parcel_count,
    'recipient', split_part(v_ship.recipient_name, ' ', 1),
    'destination_city', COALESCE(v_ship.delivery_address->>'city', v_ship.delivery_address->>'suburb'),
    'promised_by', v_ship.promised_by,
    'preferred_date', v_ship.preferred_date,
    'delivery_window', v_ship.delivery_window,
    'delivered_at', v_ship.delivered_at,
    'attempt_count', v_ship.attempt_count,
    'created_at', v_ship.created_at,
    'rated', v_ship.rating IS NOT NULL,
    'can_self_serve', v_ship.recipient_phone IS NOT NULL AND v_ship.selfservice_failures < 5,
    'live', v_live,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at, 'location', h.name) ORDER BY e.created_at DESC)
        FROM public.shipment_events e
        LEFT JOIN public.logistics_hubs h ON h.id = e.hub_id
       WHERE e.shipment_id = v_ship.id AND e.event_type <> 'note'
    ), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_shipment(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Business API keys + webhooks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,          -- first 12 chars, for display
  key_hash TEXT NOT NULL UNIQUE,     -- sha256 hex of the full key; plaintext is never stored
  default_hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_phone TEXT,
  pickup_address JSONB,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_api_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_api_key_id_fkey;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_api_key_id_fkey
  FOREIGN KEY (api_key_id) REFERENCES public.logistics_api_keys(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shipments_api_key_idx ON public.shipments (api_key_id);

DROP POLICY IF EXISTS "Owners manage api keys" ON public.logistics_api_keys;
CREATE POLICY "Owners manage api keys" ON public.logistics_api_keys
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));

CREATE TABLE IF NOT EXISTS public.logistics_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['*'],
  api_key_id UUID REFERENCES public.logistics_api_keys(id) ON DELETE CASCADE,  -- NULL = all shipments
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage webhooks" ON public.logistics_webhooks;
CREATE POLICY "Owners manage webhooks" ON public.logistics_webhooks
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));

CREATE TABLE IF NOT EXISTS public.logistics_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES public.logistics_webhooks(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.shipment_events(id) ON DELETE CASCADE,
  status_code INTEGER,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, event_id)
);
ALTER TABLE public.logistics_webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view webhook deliveries" ON public.logistics_webhook_deliveries;
CREATE POLICY "Owners view webhook deliveries" ON public.logistics_webhook_deliveries
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));

-- Every status event now reaches logistics-notify (webhooks want them all;
-- the function decides which ones also become SMS/email).
CREATE OR REPLACE FUNCTION public.shipment_event_notify()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.event_type IN ('status_change', 'created', 'hub_scan')
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

ALTER TABLE public.shipment_events ADD COLUMN IF NOT EXISTS webhooks_processed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 5. Wallet payment & refund (consumer parcels)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_parcel_from_wallet(p_shipment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  SELECT * INTO v_ship FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL OR v_ship.customer_user_id IS DISTINCT FROM auth.uid() OR v_ship.source <> 'consumer' THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = '42501';
  END IF;
  IF v_ship.payment_status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true);
  END IF;
  IF v_ship.payment_status <> 'unpaid' OR v_ship.status = 'cancelled' OR coalesce(v_ship.shipping_fee, 0) <= 0 THEN
    RAISE EXCEPTION 'not_payable';
  END IF;

  PERFORM public.debit_wallet(
    v_ship.customer_user_id, 'available'::public.wallet_bucket, v_ship.shipping_fee, 'purchase'::public.ledger_type,
    'internal', NULL, 'shipment', v_ship.id::text,
    jsonb_build_object('tracking_number', v_ship.tracking_number, 'service', 'logistics')
  );
  UPDATE public.shipments SET payment_status = 'paid' WHERE id = v_ship.id;
  INSERT INTO public.shipment_events (shipment_id, status, event_type, notes)
  VALUES (v_ship.id, v_ship.status, 'note', 'Paid R' || v_ship.shipping_fee || ' from 1145 Wallet');
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_parcel_from_wallet(UUID) TO authenticated;

-- Cancel now refunds wallet payments automatically.
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
  UPDATE public.shipments
     SET status = 'cancelled',
         payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
   WHERE id = v_ship.id;
  IF v_ship.payment_status = 'paid' AND coalesce(v_ship.shipping_fee, 0) > 0 THEN
    PERFORM public.credit_wallet(
      v_ship.customer_user_id, 'available'::public.wallet_bucket, v_ship.shipping_fee, 'refund'::public.ledger_type,
      'internal', NULL, 'shipment', v_ship.id::text,
      jsonb_build_object('tracking_number', v_ship.tracking_number, 'reason', 'cancelled_by_sender')
    );
  END IF;
  IF v_ship.delivery_job_id IS NOT NULL THEN
    UPDATE public.delivery_jobs SET status = 'cancelled' WHERE id = v_ship.delivery_job_id AND status IN ('pending', 'accepted');
  END IF;
  UPDATE public.route_stops SET status = 'skipped', failure_reason = 'Cancelled by sender'
   WHERE shipment_id = v_ship.id AND status = 'pending';
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_my_parcel(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. CO₂ estimate per route
-- ---------------------------------------------------------------------------
ALTER TABLE public.delivery_routes ADD COLUMN IF NOT EXISTS co2_kg NUMERIC(10,2);
