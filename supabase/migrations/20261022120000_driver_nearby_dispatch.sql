-- Keep legacy ride states readable while supporting the driver's current lifecycle.
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE public.rides ADD CONSTRAINT rides_status_check CHECK (status IN
 ('requested','searching','accepted','driver_assigned','arriving','driver_arriving','arrived','started','in_progress','completed','cancelled','no_drivers'));

-- Authoritative nearby dispatch. No GPS coordinates leave the server during matching.
CREATE TABLE public.driver_dispatch_requests (
  entity_type text NOT NULL CHECK (entity_type IN ('ride','delivery_job')),
  entity_id uuid NOT NULL,
  pickup_lat double precision NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng double precision NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  pickup_address text NOT NULL,
  dropoff_address text NOT NULL,
  offered_amount numeric,
  radius_km integer NOT NULL DEFAULT 5 CHECK (radius_km IN (5,10,15)),
  state text NOT NULL DEFAULT 'searching' CHECK (state IN ('searching','accepted','closed','no_drivers')),
  next_check_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type,entity_id)
);
ALTER TABLE public.driver_dispatch_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX driver_dispatch_due ON public.driver_dispatch_requests(next_check_at) WHERE state = 'searching';
CREATE INDEX driver_location_fresh_supply ON public.driver_locations(last_updated) WHERE is_online AND is_available;
ALTER TABLE public.dispatch_assignments ADD COLUMN IF NOT EXISTS search_radius_km integer;

CREATE OR REPLACE FUNCTION public.dispatch_distance_km(a double precision,b double precision,c double precision,d double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT SET search_path = public AS $$
 SELECT 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
   power(sin(radians(c-a)/2),2) + cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2)))));
$$;

CREATE OR REPLACE FUNCTION public.dispatch_nearby(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.driver_dispatch_requests; c record; n integer := 0; aid uuid; radius integer; v_vehicle uuid;
BEGIN
 SELECT * INTO r FROM public.driver_dispatch_requests WHERE entity_type=p_kind AND entity_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','error','driversFound',0,'driversNotified',0); END IF;
 IF r.state <> 'searching' OR r.next_check_at > now() THEN
   SELECT count(*) INTO n FROM public.dispatch_assignments WHERE entity_type=p_kind AND entity_id=p_id AND status='offered' AND expires_at>now();
   RETURN jsonb_build_object('status',CASE WHEN n>0 THEN 'dispatched' ELSE r.state END,'driversFound',n,'driversNotified',n,'radiusKm',r.radius_km);
 END IF;
 IF p_kind='ride' THEN
   IF NOT EXISTS (SELECT 1 FROM public.rides WHERE id=p_id AND driver_id IS NULL AND status IN ('requested','searching')) THEN
     UPDATE public.driver_dispatch_requests SET state='closed' WHERE entity_type=p_kind AND entity_id=p_id;
     RETURN jsonb_build_object('status','closed','driversFound',0,'driversNotified',0);
   END IF;
   SELECT vehicle_type_id INTO v_vehicle FROM public.rides WHERE id=p_id;
 ELSE
   IF NOT EXISTS (SELECT 1 FROM public.delivery_jobs WHERE id=p_id AND driver_id IS NULL AND status='pending') THEN
     UPDATE public.driver_dispatch_requests SET state='closed' WHERE entity_type=p_kind AND entity_id=p_id;
     RETURN jsonb_build_object('status','closed','driversFound',0,'driversNotified',0);
   END IF;
 END IF;
 UPDATE public.dispatch_assignments SET status='expired' WHERE entity_type=p_kind AND entity_id=p_id AND status='offered' AND expires_at<=now();
 FOR radius IN SELECT x FROM unnest(ARRAY[5,10,15]) x WHERE x>=r.radius_km LOOP
   FOR c IN
     SELECT d.id,d.user_id,public.dispatch_distance_km(r.pickup_lat,r.pickup_lng,l.latitude::float8,l.longitude::float8) AS distance
     FROM public.drivers d JOIN public.driver_locations l ON l.driver_id=d.id
     JOIN public.driver_sessions s ON s.driver_id=d.id AND s.ended_at IS NULL
     JOIN public.driver_devices dev ON dev.id=s.device_id AND dev.status='active'
     WHERE d.status='available' AND l.is_online AND l.is_available AND l.last_updated>now()-interval '90 seconds'
       AND s.last_seen_at>now()-interval '3 minutes'
       AND (v_vehicle IS NULL OR EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id=s.vehicle_id AND v.vehicle_type_id=v_vehicle))
       AND public.dispatch_distance_km(r.pickup_lat,r.pickup_lng,l.latitude::float8,l.longitude::float8)<=radius
       AND NOT EXISTS (SELECT 1 FROM public.dispatch_assignments a WHERE a.entity_type=p_kind AND a.entity_id=p_id AND a.driver_id=d.id)
       AND NOT public.driver_trip_in_flight(d.id)
     ORDER BY distance LIMIT 10
   LOOP
     INSERT INTO public.dispatch_assignments(entity_type,entity_id,driver_id,status,distance_to_pickup_km,expires_at,search_radius_km)
       VALUES(p_kind,p_id,c.id,'offered',c.distance,now()+interval '45 seconds',radius) RETURNING id INTO aid;
     INSERT INTO public.user_notifications(user_id,type,title,message,data)
       VALUES(c.user_id,CASE WHEN p_kind='ride' THEN 'ride_request' ELSE 'delivery_request' END,
         CASE WHEN p_kind='ride' THEN 'Nearby trip request' ELSE 'Nearby delivery request' END,
         r.pickup_address || ' ? ' || round(c.distance::numeric,1)::text || ' km to pickup',
         jsonb_build_object('url','/driver/dashboard?tab=nearby','assignment_id',aid,'entity_type',p_kind,'entity_id',p_id,'expires_at',now()+interval '45 seconds'));
     n:=n+1;
   END LOOP;
   EXIT WHEN n>0;
 END LOOP;
 UPDATE public.driver_dispatch_requests SET radius_km=least(radius,15),
   state=CASE WHEN n=0 THEN 'no_drivers' ELSE 'searching' END,next_check_at=now()+interval '45 seconds'
   WHERE entity_type=p_kind AND entity_id=p_id;
 IF n=0 AND p_kind='ride' THEN
   UPDATE public.rides SET status='no_drivers' WHERE id=p_id AND driver_id IS NULL AND status IN ('requested','searching');
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN n>0 THEN 'dispatched' ELSE 'no_drivers' END,'driversFound',n,'driversNotified',n,'radiusKm',least(radius,15));
END $$;
REVOKE ALL ON FUNCTION public.dispatch_nearby(text,uuid) FROM PUBLIC,anon,authenticated;

-- Requests start when the work exists, even if the customer closes the app.
CREATE OR REPLACE FUNCTION public.enqueue_nearby_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lat double precision; lng double precision; kind text; pickup text; dropoff text; j jsonb; amount numeric;
BEGIN
 IF NEW.driver_id IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='rides' THEN
   IF NEW.status NOT IN ('requested','searching') THEN RETURN NEW; END IF;
   lat:=COALESCE(NEW.pickup_lat,NEW.pickup_latitude); lng:=COALESCE(NEW.pickup_lng,NEW.pickup_longitude);
   pickup:=NEW.pickup_address; dropoff:=NEW.dropoff_address; kind:='ride'; amount:=NEW.estimated_fare;
 ELSE
   IF NEW.status<>'pending' THEN RETURN NEW; END IF;
   j:=NEW.pickup_address;
   BEGIN lat:=COALESCE(j->>'lat',j->>'latitude')::float8; lng:=COALESCE(j->>'lng',j->>'longitude')::float8;
   EXCEPTION WHEN invalid_text_representation THEN RETURN NEW; END;
   pickup:=COALESCE(j->>'street',j->>'address',j::text); dropoff:=COALESCE(NEW.delivery_address->>'street',NEW.delivery_address::text); kind:='delivery_job'; amount:=NEW.earnings;
 END IF;
 IF lat IS NULL OR lng IS NULL OR lat NOT BETWEEN -90 AND 90 OR lng NOT BETWEEN -180 AND 180 THEN RETURN NEW; END IF;
 INSERT INTO public.driver_dispatch_requests(entity_type,entity_id,pickup_lat,pickup_lng,pickup_address,dropoff_address,offered_amount)
 VALUES(kind,NEW.id,lat,lng,COALESCE(pickup,''),COALESCE(dropoff,''),amount) ON CONFLICT DO NOTHING;
 IF TG_OP='UPDATE' THEN
   IF OLD.status='no_drivers' AND NEW.status IN ('requested','searching') THEN
     UPDATE public.driver_dispatch_requests SET state='searching',radius_km=5,next_check_at=now() WHERE entity_type=kind AND entity_id=NEW.id;
     DELETE FROM public.dispatch_assignments WHERE entity_type=kind AND entity_id=NEW.id AND status IN ('expired','rejected');
   END IF;
 END IF;
 PERFORM public.dispatch_nearby(kind,NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER nearby_ride_dispatch AFTER INSERT OR UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.enqueue_nearby_dispatch();
CREATE TRIGGER nearby_delivery_dispatch AFTER INSERT OR UPDATE OF status ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.enqueue_nearby_dispatch();
REVOKE ALL ON FUNCTION public.enqueue_nearby_dispatch() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.run_nearby_dispatch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 FOR r IN SELECT entity_type,entity_id FROM public.driver_dispatch_requests WHERE state='searching' AND next_check_at<=now() ORDER BY next_check_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
   PERFORM public.dispatch_nearby(r.entity_type,r.entity_id);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.run_nearby_dispatch() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_nearby_dispatch() TO service_role;
DO $$ BEGIN
 PERFORM cron.schedule('nearby-driver-dispatch','15 seconds','SELECT public.run_nearby_dispatch();');
EXCEPTION WHEN invalid_schema_name OR undefined_function THEN
 RAISE NOTICE 'Schedule run_nearby_dispatch every 15 seconds before enabling dispatch.';
END $$;

CREATE OR REPLACE FUNCTION public.request_nearby_dispatch(p_kind text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in'; END IF;
 IF p_kind='ride' THEN
   IF NOT EXISTS(SELECT 1 FROM public.rides WHERE id=p_id AND passenger_id=auth.uid()) THEN RAISE EXCEPTION 'Not your ride'; END IF;
 ELSIF p_kind='delivery_job' THEN
   IF NOT public.is_admin() AND NOT EXISTS(
     SELECT 1 FROM public.delivery_jobs j LEFT JOIN public.orders o ON o.id=j.order_id
       LEFT JOIN public.food_orders f ON f.id=j.food_order_id
     WHERE j.id=p_id AND (o.user_id=auth.uid() OR f.user_id=auth.uid()
       OR EXISTS(SELECT 1 FROM public.order_items i JOIN public.stores st ON st.id=i.store_id JOIN public.merchants m ON m.id=st.merchant_id WHERE i.order_id=o.id AND m.user_id=auth.uid()))
   ) THEN RAISE EXCEPTION 'Not your delivery'; END IF;
 ELSE RAISE EXCEPTION 'Invalid request type'; END IF;
 RETURN public.dispatch_nearby(p_kind,p_id);
END $$;
REVOKE ALL ON FUNCTION public.request_nearby_dispatch(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_nearby_dispatch(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_publish_position(p_device_id text,p_lat float8,p_lng float8,p_accuracy float8 DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.drivers;
BEGIN
 IF p_lat IS NULL OR p_lng IS NULL OR NOT (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 SELECT * INTO d FROM public.drivers WHERE user_id=auth.uid();
 IF d.id IS NULL OR d.status NOT IN ('available','busy') OR NOT EXISTS(
   SELECT 1 FROM public.driver_sessions s JOIN public.driver_devices dev ON dev.id=s.device_id
   WHERE s.driver_id=d.id AND s.ended_at IS NULL AND dev.device_id=p_device_id AND dev.status='active') THEN
   RAISE EXCEPTION 'Go online on your verified device first';
 END IF;
 IF p_accuracy IS NULL OR p_accuracy<0 OR p_accuracy>200 THEN RAISE EXCEPTION 'Waiting for an accurate GPS position'; END IF;
 INSERT INTO public.driver_locations(driver_id,latitude,longitude,is_online,is_available,last_updated)
 VALUES(d.id,p_lat,p_lng,true,d.status='available',now()) ON CONFLICT(driver_id) DO UPDATE
 SET latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,is_online=true,is_available=EXCLUDED.is_available,last_updated=now();
 UPDATE public.drivers SET current_location=jsonb_build_object('lat',p_lat,'lng',p_lng,'accuracy',p_accuracy,'timestamp',now()) WHERE id=d.id;
END $$;
REVOKE ALL ON FUNCTION public.driver_publish_position(text,float8,float8,float8) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_publish_position(text,float8,float8,float8) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_nearby_offers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'entity_type',a.entity_type,'entity_id',a.entity_id,
 'pickup_address',r.pickup_address,'dropoff_address',r.dropoff_address,'distance_km',a.distance_to_pickup_km,
 'expires_at',a.expires_at,'radius_km',a.search_radius_km,'amount',r.offered_amount) ORDER BY a.offered_at),'[]'::jsonb)
 FROM public.dispatch_assignments a JOIN public.driver_dispatch_requests r ON r.entity_type=a.entity_type AND r.entity_id=a.entity_id
 JOIN public.drivers d ON d.id=a.driver_id
 WHERE d.user_id=auth.uid() AND d.status='available' AND a.status='offered' AND a.expires_at>now() AND r.state='searching';
$$;
REVOKE ALL ON FUNCTION public.driver_nearby_offers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_nearby_offers() TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_respond_offer(p_assignment uuid,p_device_id text,p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.dispatch_assignments; d public.drivers; r public.driver_dispatch_requests; changed integer;
BEGIN
 SELECT * INTO a FROM public.dispatch_assignments WHERE id=p_assignment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found'; END IF;
 SELECT * INTO r FROM public.driver_dispatch_requests WHERE entity_type=a.entity_type AND entity_id=a.entity_id FOR UPDATE;
 SELECT * INTO d FROM public.drivers WHERE id=a.driver_id AND user_id=auth.uid() FOR UPDATE;
 IF d.id IS NULL OR d.status<>'available' OR NOT EXISTS(SELECT 1 FROM public.driver_sessions s JOIN public.driver_devices dev ON dev.id=s.device_id WHERE s.driver_id=d.id AND s.ended_at IS NULL AND dev.device_id=p_device_id AND dev.status='active') THEN RAISE EXCEPTION 'Driver not available on this device'; END IF;
 SELECT * INTO a FROM public.dispatch_assignments WHERE id=p_assignment FOR UPDATE;
 IF a.status<>'offered' OR a.expires_at<=now() OR r.state<>'searching' THEN RAISE EXCEPTION 'Offer expired or already taken'; END IF;
 IF NOT p_accept THEN
   UPDATE public.dispatch_assignments SET status='rejected',responded_at=now() WHERE id=a.id;
   RETURN;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.driver_locations l WHERE l.driver_id=d.id AND l.last_updated>now()-interval '90 seconds' AND l.is_available AND public.dispatch_distance_km(r.pickup_lat,r.pickup_lng,l.latitude::float8,l.longitude::float8)<=a.search_radius_km) THEN RAISE EXCEPTION 'Refresh your location before accepting'; END IF;
 IF public.driver_trip_in_flight(d.id) THEN RAISE EXCEPTION 'Finish your active trip first'; END IF;
 IF a.entity_type='ride' THEN
   UPDATE public.rides SET driver_id=d.id,status='accepted',accepted_at=now() WHERE id=a.entity_id AND driver_id IS NULL AND status IN ('requested','searching');
 ELSE
   UPDATE public.delivery_jobs SET driver_id=d.id,status='accepted' WHERE id=a.entity_id AND driver_id IS NULL AND status='pending';
 END IF;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'This trip was already taken'; END IF;
 UPDATE public.dispatch_assignments SET status=CASE WHEN id=a.id THEN 'accepted' ELSE 'expired' END,responded_at=now() WHERE entity_type=a.entity_type AND entity_id=a.entity_id AND status='offered';
 UPDATE public.driver_dispatch_requests SET state='accepted' WHERE entity_type=a.entity_type AND entity_id=a.entity_id;
 UPDATE public.drivers SET status='busy' WHERE id=d.id;
 UPDATE public.driver_locations SET is_available=false WHERE driver_id=d.id;
END $$;
REVOKE ALL ON FUNCTION public.driver_respond_offer(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_respond_offer(uuid,text,boolean) TO authenticated;

-- Clients must not bypass the expiry/radius/one-driver claim with a direct UPDATE.
CREATE OR REPLACE FUNCTION public.guard_nearby_trip_claim()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND NOT public.is_admin() AND NEW.driver_id IS NOT NULL THEN
   IF TG_OP='INSERT' OR NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
     RAISE EXCEPTION 'Accept a current nearby offer to take a trip';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nearby_claim_guard BEFORE INSERT OR UPDATE OF driver_id ON public.rides FOR EACH ROW EXECUTE FUNCTION public.guard_nearby_trip_claim();
CREATE TRIGGER nearby_claim_guard BEFORE INSERT OR UPDATE OF driver_id ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.guard_nearby_trip_claim();
DROP POLICY IF EXISTS "Drivers update own assignments" ON public.dispatch_assignments;
NOTIFY pgrst,'reload schema';

CREATE TABLE public.ride_arrival_estimates (
 ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
 driver_id uuid NOT NULL REFERENCES public.drivers(id),
 destination_kind text NOT NULL CHECK(destination_kind IN ('pickup','dropoff')),
 duration_seconds integer NOT NULL CHECK(duration_seconds>=0),
 static_duration_seconds integer NOT NULL CHECK(static_duration_seconds>=0),
 distance_meters integer NOT NULL CHECK(distance_meters>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ride_arrival_estimates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ride_arrival_estimates FROM anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='dispatch_assignments') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_assignments;
 END IF;
END $$;

-- Return the driver to available after a completed/cancelled trip, only if
-- their verified session is still active and no other trip is in flight.
CREATE OR REPLACE FUNCTION public.release_nearby_driver()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.driver_id IS NOT NULL AND NEW.status IN ('completed','delivered','cancelled','rejected')
   AND OLD.status IS DISTINCT FROM NEW.status AND NOT public.driver_trip_in_flight(NEW.driver_id)
   AND public.driver_active_session_id(NEW.driver_id) IS NOT NULL THEN
   UPDATE public.drivers SET status='available' WHERE id=NEW.driver_id AND status='busy';
   UPDATE public.driver_locations SET is_available=true WHERE driver_id=NEW.driver_id AND is_online;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.release_nearby_driver() FROM PUBLIC;
CREATE TRIGGER release_nearby_driver AFTER UPDATE OF status ON public.rides FOR EACH ROW EXECUTE FUNCTION public.release_nearby_driver();
CREATE TRIGGER release_nearby_driver AFTER UPDATE OF status ON public.delivery_jobs FOR EACH ROW EXECUTE FUNCTION public.release_nearby_driver();
