-- Live driver supply for the home page, without exposing driver locations.
--
-- driver_locations is (correctly) readable only by the driver, admins and the
-- passenger/customer of an active trip. The public home page instead calls
-- get_nearby_supply(), which returns only aggregate, anonymised data:
--   * how many available drivers are nearby and how far the nearest is
--   * up to 12 car positions snapped to a ~500 m grid, with no ids
-- Positions older than 3 minutes are treated as offline.

CREATE OR REPLACE FUNCTION public.get_nearby_supply(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_radius double precision := LEAST(GREATEST(COALESCE(p_radius_km, 8), 1), 15);
  v_dlat double precision;
  v_dlng double precision;
  v_grid constant double precision := 0.005; -- ~500 m
  v_result jsonb;
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'invalid coordinates' USING ERRCODE = '22023';
  END IF;

  -- Bounding box first (cheap), then exact great-circle distance.
  v_dlat := v_radius / 111.0;
  v_dlng := v_radius / (111.0 * GREATEST(cos(radians(p_lat)), 0.01));

  WITH box AS (
    SELECT dl.latitude::double precision AS lat, dl.longitude::double precision AS lng
    FROM public.driver_locations dl
    WHERE dl.is_online
      AND dl.is_available
      AND dl.last_updated > now() - interval '3 minutes'
      AND dl.latitude BETWEEN p_lat - v_dlat AND p_lat + v_dlat
      AND dl.longitude BETWEEN p_lng - v_dlng AND p_lng + v_dlng
  ),
  nearby AS (
    SELECT lat, lng,
      6371 * 2 * asin(sqrt(
        power(sin(radians(lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(lat)) * power(sin(radians(lng - p_lng) / 2), 2)
      )) AS km
    FROM box
  ),
  inside AS (SELECT * FROM nearby WHERE km <= v_radius),
  cars AS (
    SELECT round(lat / v_grid) * v_grid AS lat, round(lng / v_grid) * v_grid AS lng, min(km) AS km
    FROM inside
    GROUP BY 1, 2
    ORDER BY min(km)
    LIMIT 12
  )
  SELECT jsonb_build_object(
    'available', (SELECT count(*) FROM inside),
    'nearest_km', (SELECT round(min(km)::numeric, 1) FROM inside),
    'cars', COALESCE((SELECT jsonb_agg(jsonb_build_object('lat', round(lat::numeric, 4), 'lng', round(lng::numeric, 4))) FROM cars), '[]'::jsonb),
    'radius_km', v_radius,
    'as_of', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_nearby_supply(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_nearby_supply(double precision, double precision, double precision) TO anon, authenticated, service_role;

-- Passengers could not see their driver while "driver_assigned"/"driver_arriving"
-- because the policy listed different status names than the rides table uses.
-- Accept every in-progress spelling used by the table and the app.
DROP POLICY IF EXISTS "Driver can view own location" ON public.driver_locations;
CREATE POLICY "Driver can view own location"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.driver_id = driver_locations.driver_id
      AND r.passenger_id = auth.uid()
      AND r.status IN ('accepted', 'driver_assigned', 'driver_arriving', 'arriving', 'arrived', 'started', 'in_progress')
  )
  OR EXISTS (
    SELECT 1 FROM public.delivery_jobs dj
    JOIN public.orders o ON o.id = dj.order_id
    WHERE dj.driver_id = driver_locations.driver_id
      AND o.user_id = auth.uid()
      AND dj.status IN ('accepted', 'picked_up', 'in_transit', 'arrived')
  )
);
