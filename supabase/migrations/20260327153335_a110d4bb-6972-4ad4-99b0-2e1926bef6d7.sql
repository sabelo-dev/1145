
-- Dispatch Zones for zone-based pricing and driver balancing
CREATE TABLE IF NOT EXISTS public.dispatch_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  radius_km NUMERIC NOT NULL DEFAULT 5,
  base_surge_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  demand_weight NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispatch events for event-driven architecture
CREATE TABLE IF NOT EXISTS public.dispatch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- order_created, driver_accepted, driver_rejected, driver_location_updated, order_completed, order_cancelled, reassignment_triggered
  entity_type TEXT NOT NULL, -- ride, delivery_job, order
  entity_id UUID NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispatch assignments for tracking the full assignment lifecycle
CREATE TABLE IF NOT EXISTS public.dispatch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- ride, delivery_job
  entity_id UUID NOT NULL,
  driver_id UUID NOT NULL REFERENCES public.drivers(id),
  status TEXT NOT NULL DEFAULT 'offered', -- offered, accepted, rejected, expired, cancelled, completed
  match_score NUMERIC,
  distance_to_pickup_km NUMERIC,
  estimated_arrival_mins INTEGER,
  surge_multiplier NUMERIC DEFAULT 1.0,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  attempt_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispatch batches for multi-stop optimization
CREATE TABLE IF NOT EXISTS public.dispatch_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled
  total_distance_km NUMERIC,
  total_estimated_mins INTEGER,
  total_earnings NUMERIC,
  job_ids UUID[] NOT NULL DEFAULT '{}',
  route_order INTEGER[] DEFAULT '{}',
  optimization_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Demand heatmap snapshots for predictive positioning
CREATE TABLE IF NOT EXISTS public.demand_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES public.dispatch_zones(id),
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  pending_orders INTEGER NOT NULL DEFAULT 0,
  available_drivers INTEGER NOT NULL DEFAULT 0,
  demand_ratio NUMERIC,
  surge_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  avg_wait_time_mins NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dispatch_events_type ON public.dispatch_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dispatch_events_entity ON public.dispatch_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_events_unprocessed ON public.dispatch_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_dispatch_assignments_entity ON public.dispatch_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_assignments_driver ON public.dispatch_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_dispatch_batches_driver ON public.dispatch_batches(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_demand_snapshots_zone ON public.demand_snapshots(zone_id, snapshot_time);

-- RLS Policies
ALTER TABLE public.dispatch_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_snapshots ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins manage dispatch zones" ON public.dispatch_zones FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage dispatch events" ON public.dispatch_events FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage dispatch assignments" ON public.dispatch_assignments FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage dispatch batches" ON public.dispatch_batches FOR ALL TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins view demand snapshots" ON public.demand_snapshots FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Drivers can see their own assignments
CREATE POLICY "Drivers view own assignments" ON public.dispatch_assignments FOR SELECT TO authenticated USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Drivers can update their own assignments (accept/reject)
CREATE POLICY "Drivers update own assignments" ON public.dispatch_assignments FOR UPDATE TO authenticated USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Drivers can see their own batches
CREATE POLICY "Drivers view own batches" ON public.dispatch_batches FOR SELECT TO authenticated USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- Authenticated users can insert dispatch events (system creates them)
CREATE POLICY "Authenticated insert dispatch events" ON public.dispatch_events FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can read dispatch zones
CREATE POLICY "Anyone can read active zones" ON public.dispatch_zones FOR SELECT TO authenticated USING (is_active = true);

-- DB function: optimal driver assignment using scoring
CREATE OR REPLACE FUNCTION public.score_driver_for_dispatch(
  p_driver_id UUID,
  p_pickup_lat NUMERIC,
  p_pickup_lng NUMERIC,
  p_entity_type TEXT DEFAULT 'delivery_job'
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_driver RECORD;
  v_loc RECORD;
  v_distance NUMERIC;
  v_score NUMERIC := 100;
  v_dlat NUMERIC;
  v_dlng NUMERIC;
  v_a NUMERIC;
  v_recent_rejections INTEGER;
BEGIN
  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_loc FROM driver_locations WHERE driver_id = p_driver_id;
  IF NOT FOUND OR NOT v_loc.is_online OR NOT v_loc.is_available THEN RETURN 0; END IF;

  -- Haversine distance
  v_dlat := radians(v_loc.latitude - p_pickup_lat);
  v_dlng := radians(v_loc.longitude - p_pickup_lng);
  v_a := sin(v_dlat/2)^2 + cos(radians(p_pickup_lat)) * cos(radians(v_loc.latitude)) * sin(v_dlng/2)^2;
  v_distance := 6371 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));

  -- Distance penalty (closer = better)
  v_score := v_score - (v_distance * 5);

  -- Rating bonus
  v_score := v_score + (COALESCE(v_driver.rating, 4.5) - 4.0) * 15;

  -- Experience bonus (capped at 25)
  v_score := v_score + LEAST(COALESCE(v_driver.total_deliveries, 0) / 10.0, 25);

  -- Acceptance rate bonus
  v_score := v_score + COALESCE(v_driver.acceptance_rate, 80) * 0.15;

  -- On-time rate bonus
  v_score := v_score + COALESCE(v_driver.ontime_rate, 80) * 0.1;

  -- Recent rejection penalty
  SELECT COUNT(*) INTO v_recent_rejections
  FROM dispatch_assignments
  WHERE driver_id = p_driver_id
    AND status = 'rejected'
    AND created_at > now() - interval '1 hour';
  v_score := v_score - (v_recent_rejections * 10);

  RETURN GREATEST(0, v_score);
END;
$$;

-- DB function: calculate zone surge from live data
CREATE OR REPLACE FUNCTION public.calculate_zone_surge(p_zone_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_zone RECORD;
  v_pending INTEGER;
  v_available INTEGER;
  v_ratio NUMERIC;
  v_surge NUMERIC;
BEGIN
  SELECT * INTO v_zone FROM dispatch_zones WHERE id = p_zone_id AND is_active = true;
  IF NOT FOUND THEN RETURN 1.0; END IF;

  -- Count pending jobs in zone radius
  SELECT COUNT(*) INTO v_pending
  FROM delivery_jobs dj
  WHERE dj.status = 'pending' AND dj.driver_id IS NULL
    AND (dj.pickup_address->>'lat')::NUMERIC IS NOT NULL
    AND 6371 * 2 * atan2(
      sqrt(sin(radians(((dj.pickup_address->>'lat')::NUMERIC - v_zone.center_lat)/2))^2 +
           cos(radians(v_zone.center_lat)) * cos(radians((dj.pickup_address->>'lat')::NUMERIC)) *
           sin(radians(((dj.pickup_address->>'lng')::NUMERIC - v_zone.center_lng)/2))^2),
      sqrt(1 - sin(radians(((dj.pickup_address->>'lat')::NUMERIC - v_zone.center_lat)/2))^2 -
           cos(radians(v_zone.center_lat)) * cos(radians((dj.pickup_address->>'lat')::NUMERIC)) *
           sin(radians(((dj.pickup_address->>'lng')::NUMERIC - v_zone.center_lng)/2))^2)
    ) <= v_zone.radius_km;

  -- Count available drivers in zone
  SELECT COUNT(*) INTO v_available
  FROM driver_locations dl
  WHERE dl.is_online = true AND dl.is_available = true
    AND 6371 * 2 * atan2(
      sqrt(sin(radians((dl.latitude - v_zone.center_lat)/2))^2 +
           cos(radians(v_zone.center_lat)) * cos(radians(dl.latitude)) *
           sin(radians((dl.longitude - v_zone.center_lng)/2))^2),
      sqrt(1 - sin(radians((dl.latitude - v_zone.center_lat)/2))^2 -
           cos(radians(v_zone.center_lat)) * cos(radians(dl.latitude)) *
           sin(radians((dl.longitude - v_zone.center_lng)/2))^2)
    ) <= v_zone.radius_km;

  IF v_available = 0 THEN
    v_ratio := GREATEST(v_pending, 1)::NUMERIC;
  ELSE
    v_ratio := v_pending::NUMERIC / v_available;
  END IF;

  -- Surge tiers
  IF v_ratio >= 5 THEN v_surge := 2.5;
  ELSIF v_ratio >= 3 THEN v_surge := 2.0;
  ELSIF v_ratio >= 2 THEN v_surge := 1.5;
  ELSIF v_ratio >= 1.5 THEN v_surge := 1.25;
  ELSE v_surge := 1.0;
  END IF;

  RETURN v_surge * v_zone.base_surge_multiplier;
END;
$$;

-- Trigger to auto-record dispatch events on ride/delivery changes
CREATE OR REPLACE FUNCTION public.auto_dispatch_event_on_delivery_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
    VALUES ('order_created', 'delivery_job', NEW.id, NEW.driver_id, 
      jsonb_build_object('status', NEW.status, 'pickup', NEW.pickup_address, 'delivery', NEW.delivery_address));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND NEW.driver_id IS NOT NULL THEN
      INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
      VALUES ('driver_accepted', 'delivery_job', NEW.id, NEW.driver_id,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'cancelled' THEN
        INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
        VALUES ('order_cancelled', 'delivery_job', NEW.id, NEW.driver_id,
          jsonb_build_object('old_status', OLD.status));
      ELSIF NEW.status = 'delivered' THEN
        INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
        VALUES ('order_completed', 'delivery_job', NEW.id, NEW.driver_id,
          jsonb_build_object('old_status', OLD.status));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_delivery_dispatch_events
  AFTER INSERT OR UPDATE ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_dispatch_event_on_delivery_change();

-- Same for rides
CREATE OR REPLACE FUNCTION public.auto_dispatch_event_on_ride_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO dispatch_events (event_type, entity_type, entity_id, payload)
    VALUES ('order_created', 'ride', NEW.id,
      jsonb_build_object('status', NEW.status, 'pickup', NEW.pickup_address, 'dropoff', NEW.dropoff_address));
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND NEW.driver_id IS NOT NULL THEN
      INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
      VALUES ('driver_accepted', 'ride', NEW.id, NEW.driver_id,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
      INSERT INTO dispatch_events (event_type, entity_type, entity_id, driver_id, payload)
      VALUES ('order_cancelled', 'ride', NEW.id, NEW.driver_id,
        jsonb_build_object('old_status', OLD.status));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ride_dispatch_events
  AFTER INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.auto_dispatch_event_on_ride_change();
