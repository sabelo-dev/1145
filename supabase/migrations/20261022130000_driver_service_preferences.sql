-- Service preferences are independent of online status and vehicle verification.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS transport_mode text
 CHECK (transport_mode IN ('car','van','scooter','motorcycle','bicycle','truck'));
-- Snapshot the existing recorded physical type once. Later profile edits cannot
-- reclassify the verified vehicle. Unknown types require an admin to classify.
UPDATE public.vehicles v SET transport_mode=lower(trim(d.vehicle_type))
 FROM public.drivers d WHERE d.id=v.driver_id AND v.transport_mode IS NULL
 AND lower(trim(d.vehicle_type)) IN ('car','van','scooter','motorcycle','bicycle','truck');

CREATE TABLE public.driver_service_preferences (
 driver_id uuid PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
 passengers boolean NOT NULL DEFAULT true,
 food boolean NOT NULL DEFAULT true,
 parcels boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_service_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_service_preferences FROM anon;
GRANT SELECT ON public.driver_service_preferences TO authenticated;
CREATE POLICY "Driver reads own service preferences" ON public.driver_service_preferences
 FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.drivers d WHERE d.id=driver_id AND d.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_vehicle_transport_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_user IN ('authenticated','anon') AND NOT public.is_admin() THEN
   IF TG_OP='INSERT' THEN NEW.transport_mode:=NULL; ELSE NEW.transport_mode:=OLD.transport_mode; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_vehicle_transport_mode BEFORE INSERT OR UPDATE ON public.vehicles
 FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_transport_mode();

CREATE OR REPLACE FUNCTION public.driver_transport_mode(p_driver uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE mode text;
BEGIN
 -- An active shift must use the vehicle bound to that shift, including when
 -- its mode is unknown. Never fall back to an older car when riding a scooter.
 SELECT v.transport_mode INTO mode FROM public.driver_sessions s LEFT JOIN public.vehicles v ON v.id=s.vehicle_id
 WHERE s.driver_id=p_driver AND s.ended_at IS NULL LIMIT 1;
 IF FOUND THEN RETURN mode; END IF;
 SELECT v.transport_mode INTO mode FROM public.vehicle_driver_assignments a JOIN public.vehicles v ON v.id=a.vehicle_id
 WHERE a.driver_id=p_driver AND a.status='approved' ORDER BY a.reviewed_at DESC NULLS LAST LIMIT 1;
 RETURN mode;
END $$;
REVOKE ALL ON FUNCTION public.driver_transport_mode(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_service_kind(p_kind text,p_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p_kind='ride' THEN 'passengers'
 WHEN p_kind='delivery_job' THEN (SELECT CASE WHEN food_order_id IS NOT NULL THEN 'food' ELSE 'parcels' END FROM public.delivery_jobs WHERE id=p_id)
 END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_service_kind(text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.driver_accepts_service(p_driver uuid,p_service text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(CASE p_service
 WHEN 'passengers' THEN COALESCE(p.passengers,true) AND COALESCE(public.driver_transport_mode(p_driver) IN ('car','van'),false)
 WHEN 'food' THEN COALESCE(p.food,true)
 WHEN 'parcels' THEN COALESCE(p.parcels,true)
 ELSE false END,false)
 FROM (SELECT 1) seed LEFT JOIN public.driver_service_preferences p ON p.driver_id=p_driver;
$$;
REVOKE ALL ON FUNCTION public.driver_accepts_service(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.driver_my_services()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('passengers',public.driver_accepts_service(d.id,'passengers'),
 'food',COALESCE(p.food,true),'parcels',COALESCE(p.parcels,true),
 'passenger_eligible',COALESCE(public.driver_transport_mode(d.id) IN ('car','van'),false),
 'vehicle_mode',public.driver_transport_mode(d.id))
 FROM public.drivers d LEFT JOIN public.driver_service_preferences p ON p.driver_id=d.id WHERE d.user_id=auth.uid();
$$;
REVOKE ALL ON FUNCTION public.driver_my_services() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_my_services() TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_set_services(p_passengers boolean,p_food boolean,p_parcels boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.drivers;
BEGIN
 SELECT * INTO d FROM public.drivers WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Driver account required'; END IF;
 IF p_passengers IS NULL OR p_food IS NULL OR p_parcels IS NULL THEN RAISE EXCEPTION 'Choose your services'; END IF;
 IF p_passengers AND NOT COALESCE(public.driver_transport_mode(d.id) IN ('car','van'),false) THEN
   RAISE EXCEPTION 'Passenger trips require a verified car or passenger van. Scooters are for deliveries only';
 END IF;
 INSERT INTO public.driver_service_preferences(driver_id,passengers,food,parcels)
 VALUES(d.id,p_passengers,p_food,p_parcels) ON CONFLICT(driver_id) DO UPDATE
 SET passengers=EXCLUDED.passengers,food=EXCLUDED.food,parcels=EXCLUDED.parcels,updated_at=now();
 -- Remove outstanding offers immediately; active trips are left to finish.
 UPDATE public.dispatch_assignments a SET status='expired',responded_at=now()
 WHERE a.driver_id=d.id AND a.status='offered'
 AND NOT public.driver_accepts_service(d.id,public.dispatch_service_kind(a.entity_type,a.entity_id));
 RETURN public.driver_my_services();
END $$;
REVOKE ALL ON FUNCTION public.driver_set_services(boolean,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_set_services(boolean,boolean,boolean) TO authenticated;

-- Admin confirms the physical vehicle type while checking registration papers.
CREATE OR REPLACE FUNCTION public.review_vehicle_assignment_services(p_assignment_id uuid,p_approve boolean,p_mode text,p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE vehicle uuid; driver uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT vehicle_id,driver_id INTO vehicle,driver FROM public.vehicle_driver_assignments WHERE id=p_assignment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
 IF p_approve THEN
   IF p_mode IS NULL OR p_mode NOT IN ('car','van','scooter','motorcycle','bicycle','truck') THEN RAISE EXCEPTION 'Confirm the vehicle type'; END IF;
   PERFORM 1 FROM public.drivers WHERE id=driver FOR UPDATE;
   IF EXISTS(SELECT 1 FROM public.driver_sessions s WHERE s.vehicle_id=vehicle AND s.ended_at IS NULL) THEN
     RAISE EXCEPTION 'Take this vehicle offline before changing its classification';
   END IF;
   UPDATE public.vehicles SET transport_mode=p_mode WHERE id=vehicle;
 END IF;
 PERFORM public.review_vehicle_assignment(p_assignment_id,p_approve,p_notes);
END $$;
REVOKE ALL ON FUNCTION public.review_vehicle_assignment_services(uuid,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_vehicle_assignment_services(uuid,boolean,text,text) TO authenticated;

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
       AND public.driver_accepts_service(d.id,public.dispatch_service_kind(p_kind,p_id))
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
         CASE public.dispatch_service_kind(p_kind,p_id) WHEN 'passengers' THEN 'Passenger trip request' WHEN 'food' THEN 'Food delivery request' ELSE 'Parcel delivery request' END,
         r.pickup_address || ' ? ' || round(c.distance::numeric,1)::text || ' km to pickup',
         jsonb_build_object('url','/driver/dashboard?tab=nearby','assignment_id',aid,'service_kind',public.dispatch_service_kind(p_kind,p_id),'entity_type',p_kind,'entity_id',p_id,'expires_at',now()+interval '45 seconds'));
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

CREATE OR REPLACE FUNCTION public.driver_nearby_offers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'entity_type',a.entity_type,'entity_id',a.entity_id,'service_kind',public.dispatch_service_kind(a.entity_type,a.entity_id),
 'pickup_address',r.pickup_address,'dropoff_address',r.dropoff_address,'distance_km',a.distance_to_pickup_km,
 'expires_at',a.expires_at,'radius_km',a.search_radius_km,'amount',r.offered_amount) ORDER BY a.offered_at),'[]'::jsonb)
 FROM public.dispatch_assignments a JOIN public.driver_dispatch_requests r ON r.entity_type=a.entity_type AND r.entity_id=a.entity_id
 JOIN public.drivers d ON d.id=a.driver_id
 WHERE d.user_id=auth.uid() AND d.status='available' AND a.status='offered' AND a.expires_at>now() AND r.state='searching' AND public.driver_accepts_service(d.id,public.dispatch_service_kind(a.entity_type,a.entity_id));
$$;

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
 IF NOT public.driver_accepts_service(d.id,public.dispatch_service_kind(a.entity_type,a.entity_id)) THEN RAISE EXCEPTION 'This service is disabled or your vehicle is not eligible'; END IF;
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

-- Drop incompatible offers created before this migration.
UPDATE public.dispatch_assignments a SET status='expired',responded_at=now()
WHERE status='offered' AND NOT public.driver_accepts_service(a.driver_id,public.dispatch_service_kind(a.entity_type,a.entity_id));
NOTIFY pgrst,'reload schema';
