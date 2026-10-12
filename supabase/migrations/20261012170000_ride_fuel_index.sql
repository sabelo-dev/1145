-- 1145 Ride: a fuel-cost index in ride pricing, with limits that protect riders.
--
-- 1. Fares are worked out here, in the database, when a ride is requested. The
--    app used to send its own figure.
-- 2. A fuel adjustment is added to (or taken off) the fare: the extra fuel the
--    trip burns at the fuel price approved for pricing, compared with the price
--    the per-km rates were set against. It goes to the driver in full.
-- 3. Riders are protected three ways: the adjustment is capped as a share of
--    the normal fare; surge and fuel together cannot pass one ceiling; and the
--    fuel price used for fares only changes when an admin approves a review.
-- 4. A review is opened when a province's fuel price moves by more than a set
--    percentage from the price fares are using. Smaller moves change nothing.
-- 5. Drivers see what a trip should leave them after fuel, before accepting:
--    trip distance, distance to the pickup, expected idling and the province's
--    current fuel price.
--
-- Nothing changes for riders until an admin sets the reference price, records
-- provincial prices, approves them and switches the index on.

-- ------------------------------------------------------------- settings
CREATE TABLE IF NOT EXISTS public.ride_pricing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  fuel_index_enabled boolean NOT NULL DEFAULT false,
  -- Rand per litre that the current per-km rates already cover.
  fuel_reference_price numeric(6,2) CHECK (fuel_reference_price > 0),
  -- The fuel adjustment can move a fare by at most this share of the normal fare, up or down.
  fuel_surcharge_cap_pct numeric(5,2) NOT NULL DEFAULT 10 CHECK (fuel_surcharge_cap_pct BETWEEN 0 AND 50),
  -- Surge and fuel together can never take a fare above this multiple of the normal fare.
  max_fare_multiplier numeric(4,2) NOT NULL DEFAULT 3.0 CHECK (max_fare_multiplier BETWEEN 1 AND 5),
  platform_commission_pct numeric(5,2) NOT NULL DEFAULT 15 CHECK (platform_commission_pct BETWEEN 0 AND 50),
  -- A provincial price this far from the one fares use opens a review.
  fuel_review_threshold_pct numeric(5,2) NOT NULL DEFAULT 5 CHECK (fuel_review_threshold_pct > 0),
  -- Used to estimate what a trip costs the driver.
  pickup_wait_minutes numeric(4,1) NOT NULL DEFAULT 4 CHECK (pickup_wait_minutes >= 0),
  free_flow_speed_kmh numeric(5,1) NOT NULL DEFAULT 45 CHECK (free_flow_speed_kmh > 0),
  idle_fuel_l_per_hour numeric(4,2) NOT NULL DEFAULT 0.8 CHECK (idle_fuel_l_per_hour >= 0),
  -- Straight-line distance to the pickup is multiplied by this to allow for roads.
  pickup_road_factor numeric(3,2) NOT NULL DEFAULT 1.3 CHECK (pickup_road_factor >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.ride_pricing_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.vehicle_types
  ADD COLUMN IF NOT EXISTS fuel_l_per_100km numeric(4,1) NOT NULL DEFAULT 7.5 CHECK (fuel_l_per_100km > 0);

-- The price of the reference grade (95 unleaded) in each province, over time.
CREATE TABLE IF NOT EXISTS public.fuel_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text NOT NULL CHECK (province IN ('GP', 'WC', 'KZN', 'EC', 'FS', 'MP', 'LP', 'NW', 'NC')),
  price_per_litre numeric(6,2) NOT NULL CHECK (price_per_litre > 0),
  effective_from date NOT NULL,
  source text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province, effective_from)
);

-- The fuel price fares are using in each province. Changed only by a review.
CREATE TABLE IF NOT EXISTS public.ride_fuel_index (
  province text PRIMARY KEY CHECK (province IN ('GP', 'WC', 'KZN', 'EC', 'FS', 'MP', 'LP', 'NW', 'NC')),
  applied_price numeric(6,2) NOT NULL CHECK (applied_price > 0),
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid
);

CREATE TABLE IF NOT EXISTS public.ride_price_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text NOT NULL,
  -- NULL the first time a province gets a price.
  applied_price numeric(6,2),
  new_price numeric(6,2) NOT NULL,
  change_pct numeric(6,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'dismissed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid,
  decided_at timestamptz,
  notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS ride_price_reviews_one_open ON public.ride_price_reviews (province) WHERE status = 'open';

-- Towns used to tell which province a pickup is in: the nearest one wins. Good
-- in and around the cities; approximate close to a provincial border.
CREATE TABLE IF NOT EXISTS public.province_anchor_points (
  name text PRIMARY KEY,
  province text NOT NULL CHECK (province IN ('GP', 'WC', 'KZN', 'EC', 'FS', 'MP', 'LP', 'NW', 'NC')),
  latitude numeric(9,6) NOT NULL,
  longitude numeric(9,6) NOT NULL
);
INSERT INTO public.province_anchor_points (name, province, latitude, longitude) VALUES
  ('Johannesburg', 'GP', -26.2041, 28.0473), ('Pretoria', 'GP', -25.7479, 28.2293), ('Vereeniging', 'GP', -26.6731, 27.9261),
  ('Cape Town', 'WC', -33.9249, 18.4241), ('George', 'WC', -33.9630, 22.4617), ('Stellenbosch', 'WC', -33.9321, 18.8602),
  ('Durban', 'KZN', -29.8587, 31.0218), ('Pietermaritzburg', 'KZN', -29.6006, 30.3794),
  ('Richards Bay', 'KZN', -28.7807, 32.0383), ('Newcastle', 'KZN', -27.7580, 29.9318),
  ('Gqeberha', 'EC', -33.9608, 25.6022), ('East London', 'EC', -33.0153, 27.9116), ('Mthatha', 'EC', -31.5889, 28.7844),
  ('Bloemfontein', 'FS', -29.0852, 26.1596), ('Welkom', 'FS', -27.9774, 26.7351),
  ('Mbombela', 'MP', -25.4753, 30.9694), ('eMalahleni', 'MP', -25.8713, 29.2332), ('Secunda', 'MP', -26.5167, 29.2000),
  ('Polokwane', 'LP', -23.9045, 29.4689), ('Thohoyandou', 'LP', -22.9456, 30.4850), ('Tzaneen', 'LP', -23.8332, 30.1635),
  ('Rustenburg', 'NW', -25.6676, 27.2421), ('Mahikeng', 'NW', -25.8650, 25.6442),
  ('Klerksdorp', 'NW', -26.8521, 26.6667), ('Potchefstroom', 'NW', -26.7145, 27.0970),
  ('Kimberley', 'NC', -28.7282, 24.7499), ('Upington', 'NC', -28.4478, 21.2561)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS fuel_surcharge numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS fare_breakdown jsonb;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ride_pricing_settings', 'fuel_prices', 'ride_fuel_index', 'ride_price_reviews', 'province_anchor_points']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins read" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
  END LOOP;
END $$;

GRANT UPDATE ON public.ride_pricing_settings TO authenticated;
DROP POLICY IF EXISTS "Admins update settings" ON public.ride_pricing_settings;
CREATE POLICY "Admins update settings" ON public.ride_pricing_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.haversine_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT (6371 * 2 * asin(sqrt(
    power(sin(radians((p_lat2 - p_lat1)::float8) / 2), 2)
    + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8)) * power(sin(radians((p_lng2 - p_lng1)::float8) / 2), 2)
  )))::numeric;
$$;

CREATE OR REPLACE FUNCTION public.province_for_point(p_lat numeric, p_lng numeric)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.province FROM public.province_anchor_points a
  WHERE p_lat IS NOT NULL AND p_lng IS NOT NULL
  ORDER BY public.haversine_km(p_lat, p_lng, a.latitude, a.longitude) LIMIT 1;
$$;

-- What fuel costs in a province today.
CREATE OR REPLACE FUNCTION public.current_fuel_price(p_province text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.price_per_litre FROM public.fuel_prices f
  WHERE f.province = p_province AND f.effective_from <= (now() AT TIME ZONE 'Africa/Johannesburg')::date
  ORDER BY f.effective_from DESC LIMIT 1;
$$;

-- ------------------------------------------------------------- the fare
-- The one place a ride's fare is calculated.
--   normal fare = base + distance + time, or the minimum fare if that is more
--   surge       = normal fare x the surge multiplier (itself limited to the ceiling)
--   fuel        = trip km x litres per km x (approved fuel price - reference price),
--                 limited to the cap either way
--   total       = never above the ceiling, never below the minimum fare
CREATE OR REPLACE FUNCTION public.ride_fare_quote(
  p_vehicle_type_id uuid, p_pickup_lat numeric, p_pickup_lng numeric,
  p_distance_km numeric, p_duration_minutes numeric, p_surge_multiplier numeric DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type public.vehicle_types;
  v_cfg public.ride_pricing_settings;
  v_km numeric := GREATEST(COALESCE(p_distance_km, 0), 0);
  v_minutes numeric := GREATEST(COALESCE(p_duration_minutes, 0), 0);
  v_base numeric;
  v_normal numeric;
  v_surge numeric;
  v_surged numeric;
  v_province text;
  v_applied numeric;
  v_raw numeric := 0;
  v_cap numeric;
  v_total numeric;
BEGIN
  SELECT * INTO v_type FROM public.vehicle_types WHERE id = p_vehicle_type_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_cfg FROM public.ride_pricing_settings;

  v_base := v_type.base_fare + v_km * v_type.per_km_rate + v_minutes * v_type.per_minute_rate;
  v_normal := GREATEST(v_base, v_type.minimum_fare);
  v_surge := LEAST(GREATEST(COALESCE(p_surge_multiplier, 1), 1), v_cfg.max_fare_multiplier);
  v_surged := GREATEST(v_base * v_surge, v_type.minimum_fare);

  v_province := public.province_for_point(p_pickup_lat, p_pickup_lng);
  SELECT applied_price INTO v_applied FROM public.ride_fuel_index WHERE province = v_province;
  v_cap := v_normal * v_cfg.fuel_surcharge_cap_pct / 100;
  IF v_cfg.fuel_index_enabled AND v_cfg.fuel_reference_price IS NOT NULL AND v_applied IS NOT NULL THEN
    v_raw := v_km * v_type.fuel_l_per_100km / 100 * (v_applied - v_cfg.fuel_reference_price);
  END IF;

  v_total := v_surged + GREATEST(LEAST(v_raw, v_cap), -v_cap);
  v_total := LEAST(v_total, v_normal * v_cfg.max_fare_multiplier);
  v_total := round(GREATEST(v_total, v_type.minimum_fare), 2);
  v_surged := round(v_surged, 2);

  RETURN jsonb_build_object(
    'vehicle_type_id', v_type.id,
    'base_fare', v_type.base_fare,
    'distance_fare', round(v_km * v_type.per_km_rate, 2),
    'time_fare', round(v_minutes * v_type.per_minute_rate, 2),
    'normal_fare', round(v_normal, 2),
    'surge_multiplier', v_surge,
    'surge_amount', round(v_surged - v_normal, 2),
    -- What is left once every limit has been applied, so the parts add up to the total.
    'fuel_surcharge', v_total - v_surged,
    'fuel_capped', abs(v_raw) > v_cap,
    'total', v_total,
    'province', v_province,
    'fuel_price_applied', CASE WHEN v_cfg.fuel_index_enabled THEN v_applied END,
    'fuel_reference_price', CASE WHEN v_cfg.fuel_index_enabled THEN v_cfg.fuel_reference_price END);
END; $$;

-- Read by the pricing trigger, which runs as the rider and cannot see the settings table.
CREATE OR REPLACE FUNCTION public.ride_platform_commission_pct()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT platform_commission_pct FROM public.ride_pricing_settings;
$$;

-- A quote for every active vehicle type, for the rider's "choose a ride" list.
CREATE OR REPLACE FUNCTION public.ride_quotes(
  p_pickup_lat numeric, p_pickup_lng numeric, p_distance_km numeric, p_duration_minutes numeric, p_surge_multiplier numeric DEFAULT 1)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(public.ride_fare_quote(t.id, p_pickup_lat, p_pickup_lng, p_distance_km, p_duration_minutes, p_surge_multiplier)), '[]'::jsonb)
  FROM public.vehicle_types t WHERE t.is_active;
$$;

-- A ride requested from the app is priced here; the app's own figure is ignored.
-- After that the price fields cannot be edited from the app.
CREATE OR REPLACE FUNCTION public.price_ride_on_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_client boolean := current_user IN ('authenticated', 'anon') AND NOT public.is_admin();
  v_quote jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_client THEN
      NEW.estimated_fare := OLD.estimated_fare;
      NEW.surge_multiplier := OLD.surge_multiplier;
      NEW.fuel_surcharge := OLD.fuel_surcharge;
      NEW.platform_commission_pct := OLD.platform_commission_pct;
      NEW.fare_breakdown := OLD.fare_breakdown;
    END IF;
    RETURN NEW;
  END IF;

  IF v_client THEN
    NEW.fare_breakdown := NULL;
    NEW.fuel_surcharge := 0;
    NEW.platform_commission_pct := NULL;
  END IF;
  IF NEW.platform_commission_pct IS NULL THEN
    NEW.platform_commission_pct := public.ride_platform_commission_pct();
  END IF;

  IF (v_client OR NEW.estimated_fare IS NULL)
     AND NEW.vehicle_type_id IS NOT NULL AND NEW.estimated_distance_km IS NOT NULL AND NEW.estimated_duration_minutes IS NOT NULL THEN
    v_quote := public.ride_fare_quote(
      NEW.vehicle_type_id, COALESCE(NEW.pickup_lat, NEW.pickup_latitude), COALESCE(NEW.pickup_lng, NEW.pickup_longitude),
      NEW.estimated_distance_km, NEW.estimated_duration_minutes, NEW.surge_multiplier);
    IF v_quote IS NOT NULL THEN
      NEW.estimated_fare := (v_quote ->> 'total')::numeric;
      NEW.surge_multiplier := (v_quote ->> 'surge_multiplier')::numeric;
      NEW.fuel_surcharge := (v_quote ->> 'fuel_surcharge')::numeric;
      NEW.fare_breakdown := v_quote;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_price_ride_on_request ON public.rides;
CREATE TRIGGER trg_price_ride_on_request
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.price_ride_on_request();

-- ------------------------------------------------------------- driver earnings
-- What each ride should leave the driver after fuel, shown before they accept.
--   payout  = the fare less commission, plus the whole fuel adjustment
--   fuel    = (trip km + km to the pickup) x litres per km, plus idling,
--             at today's fuel price in the pickup's province
--   idling  = waiting at the pickup, plus the part of the trip slower than free-flowing traffic
-- Pass the driver's position for the distance to the pickup; without it that leg is left out.
CREATE OR REPLACE FUNCTION public.driver_ride_earnings_estimates(p_ride_ids uuid[], p_driver_lat numeric DEFAULT NULL, p_driver_lng numeric DEFAULT NULL)
RETURNS TABLE (
  ride_id uuid, fare numeric, driver_payout numeric, pickup_km numeric, idle_minutes numeric,
  fuel_litres numeric, fuel_price numeric, fuel_cost numeric, net_earnings numeric, province text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver uuid;
  v_cfg public.ride_pricing_settings;
BEGIN
  SELECT d.id INTO v_driver FROM public.drivers d WHERE d.user_id = auth.uid();
  IF v_driver IS NULL THEN RETURN; END IF;
  SELECT * INTO v_cfg FROM public.ride_pricing_settings;

  RETURN QUERY
  WITH trip AS (
    SELECT r.id, r.estimated_fare AS fare, COALESCE(r.fuel_surcharge, 0) AS fuel_part,
           COALESCE(r.platform_commission_pct, v_cfg.platform_commission_pct) AS commission,
           COALESCE(r.estimated_distance_km, 0) AS km, COALESCE(r.estimated_duration_minutes, 0) AS minutes,
           COALESCE(t.fuel_l_per_100km, 7.5) / 100 AS l_per_km,
           COALESCE(r.pickup_lat, r.pickup_latitude) AS lat, COALESCE(r.pickup_lng, r.pickup_longitude) AS lng
    FROM public.rides r
    LEFT JOIN public.vehicle_types t ON t.id = r.vehicle_type_id
    WHERE r.id = ANY (p_ride_ids) AND r.estimated_fare IS NOT NULL
      AND (r.driver_id = v_driver OR (r.driver_id IS NULL AND r.status IN ('requested', 'searching')))
  ), costed AS (
    SELECT x.*,
           round((x.fare - x.fuel_part) * (1 - x.commission / 100) + x.fuel_part, 2) AS payout,
           CASE WHEN p_driver_lat IS NOT NULL AND p_driver_lng IS NOT NULL AND x.lat IS NOT NULL AND x.lng IS NOT NULL
                THEN round(public.haversine_km(p_driver_lat, p_driver_lng, x.lat, x.lng) * v_cfg.pickup_road_factor, 1) END AS to_pickup,
           round(v_cfg.pickup_wait_minutes + GREATEST(0, x.minutes - x.km / v_cfg.free_flow_speed_kmh * 60), 0) AS idle,
           public.province_for_point(x.lat, x.lng) AS prov
    FROM trip x
  ), fuelled AS (
    SELECT c.*,
           round((c.km + COALESCE(c.to_pickup, 0)) * c.l_per_km + c.idle / 60 * v_cfg.idle_fuel_l_per_hour, 2) AS litres,
           public.current_fuel_price(c.prov) AS price
    FROM costed c
  )
  SELECT f.id, f.fare, f.payout, f.to_pickup, f.idle, f.litres, f.price,
         round(f.litres * f.price, 2), round(f.payout - f.litres * f.price, 2), f.prov
  FROM fuelled f;
END; $$;

-- ------------------------------------------------------------- price reviews
-- Compares each province's current fuel price with the one fares are using and
-- opens a review where the gap has reached the threshold.
CREATE OR REPLACE FUNCTION public.open_fuel_price_reviews()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_threshold numeric;
  v_row record;
  v_change numeric;
  v_count integer := 0;
BEGIN
  SELECT fuel_review_threshold_pct INTO v_threshold FROM public.ride_pricing_settings;

  FOR v_row IN
    SELECT p.province, public.current_fuel_price(p.province) AS price, i.applied_price,
           (SELECT r.id FROM public.ride_price_reviews r WHERE r.province = p.province AND r.status = 'open') AS open_review
    FROM (SELECT DISTINCT province FROM public.fuel_prices) p
    LEFT JOIN public.ride_fuel_index i ON i.province = p.province
  LOOP
    CONTINUE WHEN v_row.price IS NULL;
    v_change := round((v_row.price - v_row.applied_price) / v_row.applied_price * 100, 2);

    IF v_row.applied_price IS NOT NULL AND abs(v_change) < v_threshold THEN
      -- The price has come back within range: nothing left to decide.
      UPDATE public.ride_price_reviews
      SET status = 'dismissed', decided_at = now(), notes = 'Closed automatically: the fuel price moved back within the threshold.'
      WHERE id = v_row.open_review;
    ELSIF v_row.open_review IS NOT NULL THEN
      UPDATE public.ride_price_reviews SET new_price = v_row.price, change_pct = v_change WHERE id = v_row.open_review;
    ELSIF EXISTS (SELECT 1 FROM public.ride_price_reviews r
                  WHERE r.province = v_row.province AND r.status = 'dismissed' AND r.decided_by IS NOT NULL
                    AND r.new_price = v_row.price AND r.applied_price IS NOT DISTINCT FROM v_row.applied_price) THEN
      -- An admin already decided to leave fares alone at this price. Ask again only when it moves.
      NULL;
    ELSE
      INSERT INTO public.ride_price_reviews (province, applied_price, new_price, change_pct)
      VALUES (v_row.province, v_row.applied_price, v_row.price, v_change);
      INSERT INTO public.user_notifications (user_id, type, title, message, data)
      SELECT ur.user_id, 'price_review', 'Ride prices need a review',
             CASE WHEN v_row.applied_price IS NULL
                  THEN 'A fuel price of R' || v_row.price || ' per litre has been recorded for ' || v_row.province || ' and is not used in fares yet.'
                  ELSE 'Fuel in ' || v_row.province || ' is now R' || v_row.price || ' per litre, ' || abs(v_change) || '% '
                       || CASE WHEN v_change > 0 THEN 'above' ELSE 'below' END || ' the R' || v_row.applied_price || ' that fares use.' END,
             jsonb_build_object('url', '/admin/dashboard?tab=ride-pricing')
      FROM public.user_roles ur WHERE ur.role::text = 'admin';
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.record_fuel_price(p_province text, p_price numeric, p_effective_from date, p_source text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_price IS NULL OR p_price <= 0 OR p_price > 100 THEN RAISE EXCEPTION 'Enter the price in rand per litre.'; END IF;
  IF p_effective_from IS NULL THEN RAISE EXCEPTION 'Enter the date the price takes effect.'; END IF;

  INSERT INTO public.fuel_prices (province, price_per_litre, effective_from, source, recorded_by)
  VALUES (p_province, p_price, p_effective_from, NULLIF(btrim(COALESCE(p_source, '')), ''), auth.uid())
  ON CONFLICT (province, effective_from)
  DO UPDATE SET price_per_litre = EXCLUDED.price_per_litre, source = EXCLUDED.source, recorded_by = EXCLUDED.recorded_by, created_at = now();

  PERFORM public.open_fuel_price_reviews();
END; $$;

-- Applying a review makes its fuel price the one fares use. Dismissing leaves fares as they are.
CREATE OR REPLACE FUNCTION public.decide_fuel_price_review(p_review_id uuid, p_apply boolean, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_review public.ride_price_reviews;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_review FROM public.ride_price_reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND OR v_review.status <> 'open' THEN RAISE EXCEPTION 'This review is not open.'; END IF;
  IF NOT p_apply AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'Say why fares are being left as they are.';
  END IF;

  IF p_apply THEN
    INSERT INTO public.ride_fuel_index (province, applied_price, applied_by)
    VALUES (v_review.province, v_review.new_price, auth.uid())
    ON CONFLICT (province) DO UPDATE SET applied_price = EXCLUDED.applied_price, applied_at = now(), applied_by = EXCLUDED.applied_by;
  END IF;

  UPDATE public.ride_price_reviews
  SET status = CASE WHEN p_apply THEN 'applied' ELSE 'dismissed' END,
      decided_by = auth.uid(), decided_at = now(), notes = NULLIF(btrim(COALESCE(p_notes, '')), '')
  WHERE id = v_review.id;
END; $$;

-- ------------------------------------------------------------- permissions
REVOKE EXECUTE ON FUNCTION public.open_fuel_price_reviews() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_fuel_price_reviews() TO service_role;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'province_for_point(numeric, numeric)', 'current_fuel_price(text)', 'ride_platform_commission_pct()',
    'ride_fare_quote(uuid, numeric, numeric, numeric, numeric, numeric)',
    'ride_quotes(numeric, numeric, numeric, numeric, numeric)',
    'driver_ride_earnings_estimates(uuid[], numeric, numeric)',
    'record_fuel_price(text, numeric, date, text)', 'decide_fuel_price_review(uuid, boolean, text)']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- A price recorded ahead of time opens its review on the day it takes effect.
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ride-fuel-price-reviews';
    -- 22:10 UTC is ten past midnight in South Africa.
    PERFORM cron.schedule('ride-fuel-price-reviews', '10 22 * * *', 'SELECT public.open_fuel_price_reviews();');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; fuel price reviews will only open when a price is recorded.';
  END IF;
END $$;
