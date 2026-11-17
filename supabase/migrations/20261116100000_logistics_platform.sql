-- =============================================================================
-- 1145 Logistics platform
--   * logistics staff roles (owner / dispatcher / fleet_manager / hub_operator / viewer)
--   * hubs, shipments (parcels) + event timeline
--   * multi-stop delivery routes + stops
--   * driver-side RPCs for route execution (atomic, server-validated)
--   * public shipment tracking RPC
--   * extended delivery_jobs lifecycle (failed / returned)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Staff membership + role helpers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'dispatcher', 'fleet_manager', 'hub_operator', 'viewer')),
  hub_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_members ENABLE ROW LEVEL SECURITY;

-- Platform admins are implicitly logistics owners.
CREATE OR REPLACE FUNCTION public.logistics_role(_user UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _user IS NULL THEN NULL
    WHEN public.is_admin(_user) THEN 'owner'
    ELSE (SELECT role FROM public.logistics_members WHERE user_id = _user AND is_active LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.is_logistics_staff(_roles TEXT[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.logistics_role(auth.uid()) IS NOT NULL
     AND (_roles IS NULL OR public.logistics_role(auth.uid()) = ANY(_roles))
$$;

GRANT EXECUTE ON FUNCTION public.logistics_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_logistics_staff(TEXT[]) TO authenticated;

DROP POLICY IF EXISTS "Members view own membership" ON public.logistics_members;
CREATE POLICY "Members view own membership" ON public.logistics_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_logistics_staff(ARRAY['owner'])));

DROP POLICY IF EXISTS "Owners manage members" ON public.logistics_members;
CREATE POLICY "Owners manage members" ON public.logistics_members
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));

-- ---------------------------------------------------------------------------
-- 2. Hubs / warehouses / depots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hub_type TEXT NOT NULL DEFAULT 'hub' CHECK (hub_type IN ('hub', 'warehouse', 'depot', 'pickup_point', 'locker')),
  address JSONB NOT NULL DEFAULT '{}',
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  contact_name TEXT,
  contact_phone TEXT,
  capacity_parcels INTEGER,
  operating_hours JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_hubs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.logistics_members
  DROP CONSTRAINT IF EXISTS logistics_members_hub_id_fkey;
ALTER TABLE public.logistics_members
  ADD CONSTRAINT logistics_members_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.logistics_hubs(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Authenticated view active hubs" ON public.logistics_hubs;
CREATE POLICY "Authenticated view active hubs" ON public.logistics_hubs
  FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Owners manage hubs" ON public.logistics_hubs;
CREATE POLICY "Owners manage hubs" ON public.logistics_hubs
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])));

-- ---------------------------------------------------------------------------
-- 3. Extend delivery_jobs lifecycle
-- ---------------------------------------------------------------------------
-- NOT VALID: enforce for new writes without failing on any legacy rows
-- ('assigned' is still written by the legacy client dispatch engine).
ALTER TABLE public.delivery_jobs DROP CONSTRAINT IF EXISTS delivery_jobs_status_check;
ALTER TABLE public.delivery_jobs ADD CONSTRAINT delivery_jobs_status_check
  CHECK (status IN ('pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled'))
  NOT VALID;

ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE public.delivery_jobs DROP CONSTRAINT IF EXISTS delivery_jobs_priority_check;
ALTER TABLE public.delivery_jobs ADD CONSTRAINT delivery_jobs_priority_check
  CHECK (priority IN ('normal', 'urgent', 'scheduled'));

DROP POLICY IF EXISTS "Logistics staff view delivery jobs" ON public.delivery_jobs;
CREATE POLICY "Logistics staff view delivery jobs" ON public.delivery_jobs
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Logistics staff create delivery jobs" ON public.delivery_jobs;
CREATE POLICY "Logistics staff create delivery jobs" ON public.delivery_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])));

DROP POLICY IF EXISTS "Logistics staff update delivery jobs" ON public.delivery_jobs;
CREATE POLICY "Logistics staff update delivery jobs" ON public.delivery_jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])));

-- Staff visibility into the driver pool, live locations and fleet.
DROP POLICY IF EXISTS "Logistics staff view drivers" ON public.drivers;
CREATE POLICY "Logistics staff view drivers" ON public.drivers
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Logistics staff view driver locations" ON public.driver_locations;
CREATE POLICY "Logistics staff view driver locations" ON public.driver_locations
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Logistics staff view fleets" ON public.fleets;
CREATE POLICY "Logistics staff view fleets" ON public.fleets
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Logistics fleet managers manage fleets" ON public.fleets;
CREATE POLICY "Logistics fleet managers manage fleets" ON public.fleets
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])));

DROP POLICY IF EXISTS "Logistics staff view vehicles" ON public.vehicles;
CREATE POLICY "Logistics staff view vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));

DROP POLICY IF EXISTS "Logistics fleet managers manage vehicles" ON public.vehicles;
CREATE POLICY "Logistics fleet managers manage vehicles" ON public.vehicles
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'fleet_manager'])));

-- ---------------------------------------------------------------------------
-- 4. Shipments + timeline
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_tracking_number()
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
DECLARE
  candidate TEXT;
BEGIN
  LOOP
    candidate := 'LX' || to_char(now(), 'YYMMDD')
      || upper(substr(md5(random()::text || clock_timestamp()::text || txid_current()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shipments WHERE tracking_number = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  reference TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  delivery_job_id UUID REFERENCES public.delivery_jobs(id) ON DELETE SET NULL,
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  sender_phone TEXT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  pickup_address JSONB NOT NULL,
  delivery_address JSONB NOT NULL,
  origin_hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  destination_hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  current_hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  service_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (service_level IN ('express', 'same_day', 'next_day', 'standard')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'awaiting_pickup', 'picked_up', 'at_hub', 'out_for_delivery',
    'delivered', 'failed_attempt', 'returning', 'returned', 'cancelled', 'exception', 'ready_for_collection')),
  parcel_count INTEGER NOT NULL DEFAULT 1 CHECK (parcel_count > 0),
  weight_kg NUMERIC(10,2),
  length_cm NUMERIC(10,1),
  width_cm NUMERIC(10,1),
  height_cm NUMERIC(10,1),
  declared_value NUMERIC(12,2),
  cod_amount NUMERIC(12,2),
  shipping_fee NUMERIC(12,2),
  require_otp BOOLEAN NOT NULL DEFAULT false,
  delivery_otp TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  otp_failures INTEGER NOT NULL DEFAULT 0,
  last_failure_reason TEXT,
  promised_by TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS shipments_status_idx ON public.shipments (status);
CREATE INDEX IF NOT EXISTS shipments_created_at_idx ON public.shipments (created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_current_hub_idx ON public.shipments (current_hub_id);
CREATE INDEX IF NOT EXISTS shipments_customer_idx ON public.shipments (customer_user_id);

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  notes TEXT,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS shipment_events_shipment_idx ON public.shipment_events (shipment_id, created_at);

-- Defaults: tracking number + OTP generated server-side.
CREATE OR REPLACE FUNCTION public.shipments_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_number IS NULL OR NEW.tracking_number = '' THEN
    NEW.tracking_number := public.generate_tracking_number();
  END IF;
  IF NEW.delivery_otp IS NULL THEN
    NEW.delivery_otp := lpad((floor(random() * 10000))::int::text, 4, '0');
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_before_insert ON public.shipments;
CREATE TRIGGER trg_shipments_before_insert
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_before_insert();

-- Timeline: every status / hub change becomes an event. Callers can attach
-- context for the current transaction via set_config('logistics.event_*').
CREATE OR REPLACE FUNCTION public.shipments_record_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_notes TEXT := NULLIF(current_setting('logistics.event_notes', true), '');
  v_driver UUID := NULLIF(current_setting('logistics.event_driver', true), '')::uuid;
  v_lat NUMERIC := NULLIF(current_setting('logistics.event_lat', true), '')::numeric;
  v_lng NUMERIC := NULLIF(current_setting('logistics.event_lng', true), '')::numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.shipment_events (shipment_id, status, event_type, hub_id, notes, actor_id)
    VALUES (NEW.id, NEW.status, 'created', NEW.current_hub_id, 'Shipment created', auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.current_hub_id IS DISTINCT FROM OLD.current_hub_id THEN
    INSERT INTO public.shipment_events (shipment_id, status, event_type, hub_id, driver_id, lat, lng, notes, actor_id)
    VALUES (
      NEW.id, NEW.status,
      CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_change' ELSE 'hub_scan' END,
      NEW.current_hub_id, v_driver, v_lat, v_lng,
      COALESCE(v_notes, CASE WHEN NEW.status = 'failed_attempt' THEN NEW.last_failure_reason END),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_record_event ON public.shipments;
CREATE TRIGGER trg_shipments_record_event
  AFTER INSERT OR UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_record_event();

DROP POLICY IF EXISTS "Staff view shipments" ON public.shipments;
CREATE POLICY "Staff view shipments" ON public.shipments
  FOR SELECT TO authenticated
  USING ((SELECT public.is_logistics_staff()) OR customer_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Staff create shipments" ON public.shipments;
CREATE POLICY "Staff create shipments" ON public.shipments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator'])));

DROP POLICY IF EXISTS "Staff update shipments" ON public.shipments;
CREATE POLICY "Staff update shipments" ON public.shipments
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator'])));

DROP POLICY IF EXISTS "Owners delete shipments" ON public.shipments;
CREATE POLICY "Owners delete shipments" ON public.shipments
  FOR DELETE TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));

DROP POLICY IF EXISTS "View events of visible shipments" ON public.shipment_events;
CREATE POLICY "View events of visible shipments" ON public.shipment_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_events.shipment_id));

DROP POLICY IF EXISTS "Staff add events" ON public.shipment_events;
CREATE POLICY "Staff add events" ON public.shipment_events
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator'])));

-- ---------------------------------------------------------------------------
-- 5. Multi-stop routes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route_date DATE NOT NULL DEFAULT current_date,
  planned_start TIMESTAMPTZ,
  hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled')),
  total_stops INTEGER NOT NULL DEFAULT 0,
  total_distance_km NUMERIC(10,2),
  total_duration_mins INTEGER,
  optimized_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS delivery_routes_driver_idx ON public.delivery_routes (driver_id, status);
CREATE INDEX IF NOT EXISTS delivery_routes_date_idx ON public.delivery_routes (route_date DESC);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 0,
  stop_type TEXT NOT NULL CHECK (stop_type IN ('pickup', 'delivery', 'hub')),
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
  delivery_job_id UUID REFERENCES public.delivery_jobs(id) ON DELETE SET NULL,
  hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_phone TEXT,
  address JSONB NOT NULL DEFAULT '{}',
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'arrived', 'completed', 'failed', 'skipped')),
  eta TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  proof JSONB,
  notes TEXT,
  -- Copied from the shipment so drivers never need read access to shipments
  -- (which hold the delivery OTP).
  require_otp BOOLEAN NOT NULL DEFAULT false,
  cod_amount NUMERIC(12,2),
  parcel_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS route_stops_route_idx ON public.route_stops (route_id, sequence);
CREATE INDEX IF NOT EXISTS route_stops_shipment_idx ON public.route_stops (shipment_id);

ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.delivery_routes(id) ON DELETE SET NULL;

-- Keep total_stops in sync.
CREATE OR REPLACE FUNCTION public.route_stops_sync_total()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_route UUID := COALESCE(NEW.route_id, OLD.route_id);
BEGIN
  UPDATE public.delivery_routes
     SET total_stops = (SELECT count(*) FROM public.route_stops WHERE route_id = v_route)
   WHERE id = v_route;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_stops_sync_total ON public.route_stops;
CREATE TRIGGER trg_route_stops_sync_total
  AFTER INSERT OR DELETE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.route_stops_sync_total();

DROP POLICY IF EXISTS "Staff and assigned driver view routes" ON public.delivery_routes;
CREATE POLICY "Staff and assigned driver view routes" ON public.delivery_routes
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_logistics_staff())
    OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Dispatchers manage routes" ON public.delivery_routes;
CREATE POLICY "Dispatchers manage routes" ON public.delivery_routes
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])));

DROP POLICY IF EXISTS "Staff and assigned driver view stops" ON public.route_stops;
CREATE POLICY "Staff and assigned driver view stops" ON public.route_stops
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_logistics_staff())
    OR EXISTS (
      SELECT 1 FROM public.delivery_routes r
      JOIN public.drivers d ON d.id = r.driver_id
      WHERE r.id = route_stops.route_id AND d.user_id = (SELECT auth.uid())
        AND r.status IN ('dispatched', 'in_progress', 'completed')
    )
  );

DROP POLICY IF EXISTS "Dispatchers manage stops" ON public.route_stops;
CREATE POLICY "Dispatchers manage stops" ON public.route_stops
  FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])))
  WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner', 'dispatcher'])));

-- updated_at triggers
DROP TRIGGER IF EXISTS update_logistics_members_updated_at ON public.logistics_members;
CREATE TRIGGER update_logistics_members_updated_at BEFORE UPDATE ON public.logistics_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_logistics_hubs_updated_at ON public.logistics_hubs;
CREATE TRIGGER update_logistics_hubs_updated_at BEFORE UPDATE ON public.logistics_hubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_shipments_updated_at ON public.shipments;
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_delivery_routes_updated_at ON public.delivery_routes;
CREATE TRIGGER update_delivery_routes_updated_at BEFORE UPDATE ON public.delivery_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_route_stops_updated_at ON public.route_stops;
CREATE TRIGGER update_route_stops_updated_at BEFORE UPDATE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. Driver route execution RPCs
-- ---------------------------------------------------------------------------
-- Live ETAs: re-time every open stop from where the driver is now (fresh GPS),
-- else the last closed stop, else the hub. 30 km/h urban average, ×1.3 road
-- factor, 5 min service per stop. Called after each stop update, on route
-- start, and by the dispatch sweep for routes on the road.
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

  FOR r IN
    SELECT id, lat, lng, status FROM public.route_stops
     WHERE route_id = p_route_id AND status IN ('pending', 'arrived')
     ORDER BY sequence
  LOOP
    IF r.status = 'arrived' THEN
      UPDATE public.route_stops SET eta = now() WHERE id = r.id;
      v_clock := now() + interval '5 minutes';
    ELSE
      IF r.lat IS NOT NULL AND v_lat IS NOT NULL THEN
        v_km := 2 * 6371 * asin(sqrt(
          power(sin(radians(r.lat - v_lat) / 2), 2) +
          cos(radians(v_lat)) * cos(radians(r.lat)) * power(sin(radians(r.lng - v_lng) / 2), 2))) * 1.3;
        v_clock := v_clock + make_interval(secs => (v_km / 30.0) * 3600);
      END IF;
      UPDATE public.route_stops SET eta = v_clock WHERE id = r.id;
      v_clock := v_clock + interval '5 minutes';
    END IF;
    IF r.lat IS NOT NULL THEN
      v_lat := r.lat;
      v_lng := r.lng;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_start_route(p_route_id UUID)
RETURNS public.delivery_routes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_route public.delivery_routes;
  v_driver UUID;
BEGIN
  SELECT id INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = p_route_id FOR UPDATE;

  IF v_route.id IS NULL OR v_driver IS NULL OR v_route.driver_id IS DISTINCT FROM v_driver THEN
    RAISE EXCEPTION 'route_not_assigned' USING ERRCODE = '42501';
  END IF;
  IF v_route.status = 'in_progress' THEN
    RETURN v_route;
  END IF;
  IF v_route.status <> 'dispatched' THEN
    RAISE EXCEPTION 'route_not_dispatched';
  END IF;

  PERFORM set_config('logistics.event_driver', v_driver::text, true);
  PERFORM set_config('logistics.event_notes', 'Out for delivery on route ' || v_route.name, true);

  -- Parcels already in the driver's hands go out for delivery.
  UPDATE public.shipments s
     SET status = 'out_for_delivery', current_hub_id = NULL
    FROM public.route_stops rs
   WHERE rs.route_id = p_route_id AND rs.stop_type = 'delivery'
     AND rs.shipment_id = s.id AND s.status IN ('at_hub', 'picked_up', 'failed_attempt');

  UPDATE public.delivery_routes
     SET status = 'in_progress', started_at = now()
   WHERE id = p_route_id
   RETURNING * INTO v_route;

  UPDATE public.drivers SET status = 'busy' WHERE id = v_driver;
  PERFORM public.route_refresh_etas(p_route_id);
  RETURN v_route;
END;
$$;

CREATE OR REPLACE FUNCTION public.driver_update_stop(
  p_stop_id UUID,
  p_action TEXT,
  p_failure_reason TEXT DEFAULT NULL,
  p_otp TEXT DEFAULT NULL,
  p_proof JSONB DEFAULT NULL,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  -- When the action really happened (offline sync). Clamped to the last 24 h.
  p_occurred_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stop public.route_stops;
  v_route public.delivery_routes;
  v_ship public.shipments;
  v_driver UUID;
  v_new_attempts INTEGER;
  v_at TIMESTAMPTZ := GREATEST(LEAST(COALESCE(p_occurred_at, now()), now()), now() - interval '24 hours');
BEGIN
  IF p_action NOT IN ('arrive', 'complete', 'fail', 'skip') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT id INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = v_stop.route_id FOR UPDATE;

  IF v_stop.id IS NULL OR v_driver IS NULL OR v_route.driver_id IS DISTINCT FROM v_driver THEN
    RAISE EXCEPTION 'stop_not_assigned' USING ERRCODE = '42501';
  END IF;
  IF v_route.status <> 'in_progress' THEN
    RAISE EXCEPTION 'route_not_started';
  END IF;
  IF v_stop.status IN ('completed', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'stop_already_closed';
  END IF;

  IF v_stop.shipment_id IS NOT NULL THEN
    SELECT * INTO v_ship FROM public.shipments WHERE id = v_stop.shipment_id FOR UPDATE;
  END IF;

  PERFORM set_config('logistics.event_driver', v_driver::text, true);
  PERFORM set_config('logistics.event_lat', COALESCE(p_lat::text, ''), true);
  PERFORM set_config('logistics.event_lng', COALESCE(p_lng::text, ''), true);

  IF p_action = 'arrive' THEN
    UPDATE public.route_stops SET status = 'arrived', arrived_at = v_at
     WHERE id = p_stop_id RETURNING * INTO v_stop;
    RETURN jsonb_build_object('ok', true, 'stop', to_jsonb(v_stop));
  END IF;

  IF p_action = 'complete' THEN
    IF v_stop.stop_type = 'delivery' AND v_ship.id IS NOT NULL AND v_ship.require_otp THEN
      -- Brute-force guard: 5 wrong codes lock the parcel until dispatch resets it.
      -- Returned (not raised) so the failure count is committed.
      IF v_ship.otp_failures >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'otp_locked');
      END IF;
      IF p_otp IS NULL OR p_otp <> v_ship.delivery_otp THEN
        UPDATE public.shipments SET otp_failures = otp_failures + 1 WHERE id = v_ship.id;
        RETURN jsonb_build_object('ok', false, 'error',
          CASE WHEN v_ship.otp_failures + 1 >= 5 THEN 'otp_locked' ELSE 'invalid_otp' END,
          'attempts_left', GREATEST(4 - v_ship.otp_failures, 0));
      END IF;
    END IF;

    UPDATE public.route_stops
       SET status = 'completed', completed_at = v_at,
           arrived_at = COALESCE(arrived_at, v_at), proof = p_proof
     WHERE id = p_stop_id RETURNING * INTO v_stop;

    IF v_ship.id IS NOT NULL THEN
      IF v_stop.stop_type = 'pickup' THEN
        PERFORM set_config('logistics.event_notes', 'Collected by driver', true);
        -- Same-route delivery => straight out for delivery; otherwise it is
        -- in the driver's hands awaiting a hub drop or a later route.
        UPDATE public.shipments
           SET picked_up_at = v_at,
               status = CASE WHEN EXISTS (
                 SELECT 1 FROM public.route_stops
                  WHERE route_id = v_route.id AND shipment_id = v_ship.id AND stop_type = 'delivery'
               ) THEN 'out_for_delivery' ELSE 'picked_up' END
         WHERE id = v_ship.id;
      ELSIF v_stop.stop_type = 'delivery' THEN
        PERFORM set_config('logistics.event_notes',
          'Delivered' || COALESCE(' — received by ' || (p_proof->>'received_by'), ''), true);
        UPDATE public.shipments SET status = 'delivered', delivered_at = v_at
         WHERE id = v_ship.id;
      ELSIF v_stop.stop_type = 'hub' THEN
        -- Final hop to the customer's pickup point / locker → ready for collection.
        IF v_ship.destination_hub_id = v_stop.hub_id AND EXISTS (
             SELECT 1 FROM public.logistics_hubs h WHERE h.id = v_stop.hub_id AND h.hub_type IN ('pickup_point', 'locker')) THEN
          PERFORM set_config('logistics.event_notes', 'Ready for collection', true);
          UPDATE public.shipments
             SET status = 'ready_for_collection', current_hub_id = v_stop.hub_id, collect_by = v_at + interval '7 days'
           WHERE id = v_ship.id;
        ELSE
          PERFORM set_config('logistics.event_notes', 'Dropped at hub', true);
          UPDATE public.shipments SET status = 'at_hub', current_hub_id = v_stop.hub_id
           WHERE id = v_ship.id;
        END IF;
      END IF;
    END IF;

    IF v_stop.delivery_job_id IS NOT NULL THEN
      UPDATE public.delivery_jobs
         SET status = CASE WHEN v_stop.stop_type = 'pickup' THEN 'picked_up' ELSE 'delivered' END,
             pickup_time = CASE WHEN v_stop.stop_type = 'pickup' THEN v_at ELSE pickup_time END,
             actual_delivery_time = CASE WHEN v_stop.stop_type = 'delivery' THEN v_at ELSE actual_delivery_time END
       WHERE id = v_stop.delivery_job_id;
    END IF;
  END IF;

  IF p_action IN ('fail', 'skip') THEN
    IF p_action = 'fail' AND COALESCE(trim(p_failure_reason), '') = '' THEN
      RAISE EXCEPTION 'failure_reason_required';
    END IF;

    UPDATE public.route_stops
       SET status = CASE WHEN p_action = 'fail' THEN 'failed' ELSE 'skipped' END,
           completed_at = v_at, failure_reason = p_failure_reason, proof = p_proof
     WHERE id = p_stop_id RETURNING * INTO v_stop;

    IF p_action = 'fail' AND v_ship.id IS NOT NULL THEN
      v_new_attempts := v_ship.attempt_count + 1;
      PERFORM set_config('logistics.event_notes', p_failure_reason, true);
      UPDATE public.shipments
         SET attempt_count = CASE WHEN v_stop.stop_type = 'delivery' THEN v_new_attempts ELSE attempt_count END,
             last_failure_reason = p_failure_reason,
             status = CASE
               WHEN v_stop.stop_type = 'pickup' THEN 'exception'
               WHEN v_new_attempts >= v_ship.max_attempts THEN 'returning'
               ELSE 'failed_attempt'
             END
       WHERE id = v_ship.id;
    END IF;

    IF p_action = 'fail' AND v_stop.delivery_job_id IS NOT NULL THEN
      UPDATE public.delivery_jobs
         SET status = 'failed', failure_reason = p_failure_reason, attempt_count = attempt_count + 1
       WHERE id = v_stop.delivery_job_id;
    END IF;
  END IF;

  -- Close the route once every stop is resolved.
  IF NOT EXISTS (
    SELECT 1 FROM public.route_stops
     WHERE route_id = v_route.id AND status IN ('pending', 'arrived')
  ) THEN
    UPDATE public.delivery_routes SET status = 'completed', completed_at = v_at WHERE id = v_route.id;
    UPDATE public.drivers SET status = 'available', total_deliveries = COALESCE(total_deliveries, 0) + (
      SELECT count(*) FROM public.route_stops
       WHERE route_id = v_route.id AND stop_type = 'delivery' AND status = 'completed'
    ) WHERE id = v_driver;
  END IF;

  PERFORM public.route_refresh_etas(v_route.id);
  RETURN jsonb_build_object('ok', true, 'stop', to_jsonb(v_stop));
END;
$$;

GRANT EXECUTE ON FUNCTION public.driver_start_route(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_update_stop(UUID, TEXT, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, TIMESTAMPTZ) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Team management RPCs (owner only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.logistics_list_members()
RETURNS TABLE (id UUID, user_id UUID, email TEXT, role TEXT, hub_id UUID, is_active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.id, m.user_id, u.email::text, m.role, m.hub_id, m.is_active, m.created_at
      FROM public.logistics_members m
      JOIN auth.users u ON u.id = m.user_id
     ORDER BY m.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.logistics_upsert_member(p_email TEXT, p_role TEXT, p_hub_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_id UUID;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT u.id INTO v_user FROM auth.users u WHERE lower(u.email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  INSERT INTO public.logistics_members (user_id, role, hub_id, invited_by)
  VALUES (v_user, p_role, p_hub_id, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, hub_id = EXCLUDED.hub_id, is_active = true
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.logistics_list_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.logistics_upsert_member(TEXT, TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Public tracking (no PII beyond first name + city)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_shipment(p_tracking_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  SELECT * INTO v_ship FROM public.shipments
   WHERE tracking_number = upper(trim(p_tracking_number));
  IF v_ship.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'tracking_number', v_ship.tracking_number,
    'status', v_ship.status,
    'service_level', v_ship.service_level,
    'parcel_count', v_ship.parcel_count,
    'recipient', split_part(v_ship.recipient_name, ' ', 1),
    'destination_city', COALESCE(v_ship.delivery_address->>'city', v_ship.delivery_address->>'suburb'),
    'promised_by', v_ship.promised_by,
    'delivered_at', v_ship.delivered_at,
    'attempt_count', v_ship.attempt_count,
    'created_at', v_ship.created_at,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'status', e.status,
               'at', e.created_at,
               'location', h.name
             ) ORDER BY e.created_at DESC)
        FROM public.shipment_events e
        LEFT JOIN public.logistics_hubs h ON h.id = e.hub_id
       WHERE e.shipment_id = v_ship.id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_shipment(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Proof-of-delivery photos (private bucket; drivers write under their uid)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-proofs', 'delivery-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Drivers upload delivery proofs" ON storage.objects;
CREATE POLICY "Drivers upload delivery proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.drivers WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Drivers and staff read delivery proofs" ON storage.objects;
CREATE POLICY "Drivers and staff read delivery proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT public.is_logistics_staff()))
  );

-- ---------------------------------------------------------------------------
-- 10. Realtime
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shipments', 'shipment_events', 'delivery_routes', 'route_stops'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END;
$$;
