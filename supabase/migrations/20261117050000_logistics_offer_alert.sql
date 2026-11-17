-- =============================================================================
-- Driver incoming-offer alert (orders + rides)
--   driver_live_offers()     clock-safe live offers (serverNow / expiresAt)
--   driver_accept_offer()    idempotent, 1 s grace, atomic for rides too
--   driver_offer_missed()    fire-and-forget timeout → immediate re-offer
--   driver_log_offer_event() alert analytics
--   consecutive-miss auto-offline (business rule, configurable)
-- =============================================================================

ALTER TABLE public.logistics_settings
  ADD COLUMN IF NOT EXISTS max_consecutive_misses INTEGER NOT NULL DEFAULT 3 CHECK (max_consecutive_misses BETWEEN 0 AND 20);
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS consecutive_offer_misses INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS dispatch_assignments_live_offer_idx ON public.dispatch_assignments (driver_id, expires_at) WHERE status = 'offered';

-- Live offers for the calling driver (at most one order and one ride).
CREATE OR REPLACE FUNCTION public.driver_live_offers()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID := (SELECT id FROM public.drivers WHERE user_id = auth.uid());
  v_ring INTEGER := (SELECT offer_seconds FROM public.logistics_settings WHERE id);
  j public.delivery_jobs;
  a RECORD;
  v_list JSONB := '[]'::jsonb;
BEGIN
  IF v_driver IS NULL THEN
    RETURN v_list;
  END IF;

  SELECT * INTO j FROM public.delivery_jobs
   WHERE offered_driver_id = v_driver AND status = 'pending' AND driver_id IS NULL AND offer_expires_at > now()
   ORDER BY offer_expires_at LIMIT 1;
  IF j.id IS NOT NULL THEN
    v_list := v_list || jsonb_build_object(
      'id', j.id, 'kind', 'order',
      'createdAt', j.offer_expires_at - make_interval(secs => v_ring),
      'expiresAt', j.offer_expires_at,
      'serverNow', now(),
      'ringMs', v_ring * 1000,
      'priority', j.priority,
      'pickup', jsonb_build_object(
        'label', coalesce(j.pickup_address->>'pickup_point', j.pickup_address->>'street', 'Pickup'),
        'lat', (j.pickup_address->>'lat')::numeric, 'lng', (j.pickup_address->>'lng')::numeric),
      'dropoff', jsonb_build_object(
        'label', coalesce(j.delivery_address->>'pickup_point', j.delivery_address->>'suburb', j.delivery_address->>'city', j.delivery_address->>'street', 'Drop-off'),
        'lat', (j.delivery_address->>'lat')::numeric, 'lng', (j.delivery_address->>'lng')::numeric),
      'fare', CASE WHEN j.earnings IS NULL THEN NULL ELSE jsonb_build_object('amount', j.earnings, 'currency', 'ZAR') END,
      'distanceKm', j.distance_km
    );
  END IF;

  BEGIN

  SELECT da.id, da.offered_at, da.expires_at, da.distance_to_pickup_km, da.estimated_arrival_mins,
         r.pickup_address, r.dropoff_address, r.estimated_fare, r.estimated_distance_km,
         coalesce(r.pickup_lat, r.pickup_latitude) AS plat, coalesce(r.pickup_lng, r.pickup_longitude) AS plng
    INTO a
    FROM public.dispatch_assignments da JOIN public.rides r ON r.id = da.entity_id
   WHERE da.driver_id = v_driver AND da.status = 'offered' AND da.entity_type = 'ride'
     AND da.expires_at > now() AND r.driver_id IS NULL
   ORDER BY da.expires_at LIMIT 1;
  IF a.id IS NOT NULL THEN
    v_list := v_list || jsonb_build_object(
      'id', a.id, 'kind', 'ride',
      'createdAt', a.offered_at,
      -- Rides keep their own expiry but the ring is capped at the alert window.
      'expiresAt', least(a.expires_at, a.offered_at + make_interval(secs => v_ring)),
      'serverNow', now(),
      'ringMs', v_ring * 1000,
      'pickup', jsonb_build_object('label', a.pickup_address, 'lat', a.plat, 'lng', a.plng),
      'dropoff', jsonb_build_object('label', a.dropoff_address),
      'fare', CASE WHEN a.estimated_fare IS NULL THEN NULL ELSE jsonb_build_object('amount', a.estimated_fare, 'currency', 'ZAR') END,
      'distanceKm', a.estimated_distance_km,
      'etaMinutes', a.estimated_arrival_mins
    );
  END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- older rides schema without coordinate columns: orders only
  END;
  RETURN v_list;
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_live_offers() TO authenticated;

-- Accept (idempotent per offer id; 1 s grace past expiry).
CREATE OR REPLACE FUNCTION public.driver_accept_offer(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID := (SELECT id FROM public.drivers WHERE user_id = auth.uid());
  a public.dispatch_assignments;
  v_ride UUID;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'not_a_driver' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'order' THEN
    RETURN public.driver_respond_offer(p_id, true);
  END IF;
  IF p_kind <> 'ride' THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  SELECT * INTO a FROM public.dispatch_assignments WHERE id = p_id AND driver_id = v_driver FOR UPDATE;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_not_found');
  END IF;
  IF a.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'accepted', true); -- retried accept
  END IF;
  IF a.status <> 'offered' OR a.expires_at < now() - interval '1 second' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'offer_expired');
  END IF;

  -- Atomic claim: only one driver can win the ride.
  UPDATE public.rides SET driver_id = v_driver, status = 'accepted', updated_at = now()
   WHERE id = a.entity_id AND driver_id IS NULL
  RETURNING id INTO v_ride;
  IF v_ride IS NULL THEN
    UPDATE public.dispatch_assignments SET status = 'expired', responded_at = now() WHERE id = a.id;
    RETURN jsonb_build_object('ok', false, 'error', 'offer_taken');
  END IF;

  UPDATE public.dispatch_assignments SET status = 'accepted', responded_at = now() WHERE id = a.id;
  UPDATE public.dispatch_assignments SET status = 'expired', responded_at = now()
   WHERE entity_type = 'ride' AND entity_id = a.entity_id AND id <> a.id AND status = 'offered';
  UPDATE public.drivers SET status = 'busy', consecutive_offer_misses = 0 WHERE id = v_driver;
  RETURN jsonb_build_object('ok', true, 'accepted', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_accept_offer(TEXT, UUID) TO authenticated;

-- Timeout reported by the device: hand the offer on immediately and apply the
-- consecutive-miss rule. Safe to call more than once.
CREATE OR REPLACE FUNCTION public.driver_offer_missed(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID := (SELECT id FROM public.drivers WHERE user_id = auth.uid());
  v_limit INTEGER := (SELECT max_consecutive_misses FROM public.logistics_settings WHERE id);
  v_misses INTEGER;
  v_counted BOOLEAN := false;
BEGIN
  IF v_driver IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF p_kind = 'order' THEN
    UPDATE public.delivery_jobs
       SET declined_driver_ids = array_append(declined_driver_ids, v_driver), offered_driver_id = NULL, offer_expires_at = NULL
     WHERE id = p_id AND offered_driver_id = v_driver AND status = 'pending' AND driver_id IS NULL;
    IF FOUND THEN
      v_counted := true;
      PERFORM public.logistics_offer_job(p_id);
    END IF;
  ELSIF p_kind = 'ride' THEN
    UPDATE public.dispatch_assignments SET status = 'expired', responded_at = now(), rejection_reason = 'timeout'
     WHERE id = p_id AND driver_id = v_driver AND status = 'offered';
    v_counted := FOUND;
  END IF;

  IF NOT v_counted THEN
    RETURN jsonb_build_object('ok', true, 'went_offline', false);
  END IF;

  UPDATE public.drivers SET consecutive_offer_misses = consecutive_offer_misses + 1 WHERE id = v_driver
  RETURNING consecutive_offer_misses INTO v_misses;
  IF v_limit > 0 AND v_misses >= v_limit THEN
    UPDATE public.drivers SET status = 'offline', consecutive_offer_misses = 0 WHERE id = v_driver;
    RETURN jsonb_build_object('ok', true, 'went_offline', true, 'misses', v_misses);
  END IF;
  RETURN jsonb_build_object('ok', true, 'went_offline', false, 'misses', v_misses);
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_offer_missed(TEXT, UUID) TO authenticated;

-- Alert analytics (one row per transition).
CREATE OR REPLACE FUNCTION public.driver_log_offer_event(p_kind TEXT, p_id UUID, p_event TEXT, p_payload JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_driver UUID := (SELECT id FROM public.drivers WHERE user_id = auth.uid());
BEGIN
  IF v_driver IS NULL OR p_event NOT IN ('offer_shown', 'offer_accepted', 'offer_missed', 'offer_accept_failed', 'offer_cancelled_by_server', 'tone_blocked') THEN
    RETURN;
  END IF;
  INSERT INTO public.dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
  VALUES (p_event, CASE WHEN p_kind = 'ride' THEN 'ride_assignment' ELSE 'delivery_job' END, p_id, v_driver,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('kind', p_kind));
EXCEPTION WHEN others THEN
  RETURN; -- analytics must never break the alert
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_log_offer_event(TEXT, UUID, TEXT, JSONB) TO authenticated;

-- Realtime: ride offers reach the alert as soon as they're created.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispatch_assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_assignments;
  END IF;
END;
$$;
