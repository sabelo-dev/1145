-- Delivery areas that are checked against the map.
--
-- Each delivery area now carries where it is (delivery_zones), and a customer's street
-- address is located on the map by the food-check-address function before an order to an
-- area-limited eatery is accepted. Results of those checks live in food_address_checks,
-- which only the server can write, so the browser cannot claim an area it is not in.

ALTER TABLE public.eateries
  -- [{ "name": text, "lat": num, "lng": num, "south": num, "north": num, "west": num, "east": num }]
  -- Same names and order as delivery_areas. An entry without coordinates is matched by name only.
  ADD COLUMN IF NOT EXISTS delivery_zones JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.eateries ADD CONSTRAINT eateries_delivery_zones_array
    CHECK (jsonb_typeof(delivery_zones) = 'array' AND jsonb_array_length(delivery_zones) <= 60);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.food_address_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eatery_id UUID NOT NULL REFERENCES public.eateries(id) ON DELETE CASCADE,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  postal_code TEXT,
  -- The delivery area the address falls in (or, when unverified, the one the customer chose).
  area TEXT,
  -- verified:   found on the map, inside a delivery area
  -- unverified: not found on the map; the customer chose a listed area themselves
  -- outside:    found on the map, outside every delivery area
  -- not_found:  not found on the map and no area chosen yet
  outcome TEXT NOT NULL CHECK (outcome IN ('verified', 'unverified', 'outside', 'not_found')),
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  matched_place TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_address_checks_user_idx ON public.food_address_checks (user_id, created_at DESC);

-- Written only by the server (service role). People can read their own checks; nothing else.
ALTER TABLE public.food_address_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "People read their own address checks" ON public.food_address_checks;
CREATE POLICY "People read their own address checks" ON public.food_address_checks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Same function as before, now requiring a server-side address check for area-limited eateries.
CREATE OR REPLACE FUNCTION public.place_food_order(
  p_eatery_id uuid,
  p_items jsonb,
  p_address jsonb,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_eatery public.eateries%ROWTYPE;
  v_subtotal numeric(10,2) := 0;
  v_lines integer := 0;
  v_order_id uuid;
  v_area text;
  v_check public.food_address_checks%ROWTYPE;
  v_check_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to place an order';
  END IF;

  SELECT * INTO v_eatery FROM public.eateries WHERE id = p_eatery_id;
  IF NOT FOUND OR v_eatery.status <> 'approved' THEN
    RAISE EXCEPTION 'This eatery is not available';
  END IF;
  IF NOT v_eatery.accepting_orders THEN
    RAISE EXCEPTION '% is not taking orders right now', v_eatery.name;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your basket is empty';
  END IF;
  IF jsonb_array_length(p_items) > 60 THEN
    RAISE EXCEPTION 'Too many different items in one order';
  END IF;
  IF coalesce(trim(p_address->>'street'), '') = '' OR coalesce(trim(p_address->>'city'), '') = ''
     OR coalesce(trim(p_address->>'phone'), '') = '' THEN
    RAISE EXCEPTION 'A delivery address and phone number are required';
  END IF;

  -- An eatery that lists delivery areas only delivers inside them. The address has to have
  -- been checked on the server first (food-check-address), and the order must be for that
  -- same address: the area and map position come from the check, never from the request.
  IF cardinality(v_eatery.delivery_areas) > 0 THEN
    BEGIN
      v_check_id := (p_address->>'check_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_check_id := NULL;
    END;
    SELECT * INTO v_check FROM public.food_address_checks
    WHERE id = v_check_id AND user_id = v_user AND eatery_id = v_eatery.id
      AND outcome IN ('verified', 'unverified') AND created_at > now() - interval '30 minutes';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'We need to check your delivery address first. Please try again.';
    END IF;
    IF lower(trim(p_address->>'street')) IS DISTINCT FROM lower(trim(v_check.street))
       OR lower(trim(p_address->>'city')) IS DISTINCT FROM lower(trim(v_check.city)) THEN
      RAISE EXCEPTION 'Your address changed after it was checked. Please try again.';
    END IF;
    SELECT a INTO v_area FROM unnest(v_eatery.delivery_areas) AS a WHERE lower(a) = lower(v_check.area) LIMIT 1;
    IF v_area IS NULL THEN
      RAISE EXCEPTION '% no longer delivers to that area', v_eatery.name;
    END IF;
  END IF;

  INSERT INTO public.food_orders (user_id, eatery_id, subtotal, delivery_fee, total, delivery_address, notes)
  VALUES (
    v_user, v_eatery.id, 0, v_eatery.delivery_fee, 0,
    jsonb_build_object(
      'name', left(coalesce(p_address->>'name', ''), 120),
      'street', left(p_address->>'street', 200),
      'area', left(coalesce(v_area, ''), 60),
      -- true: the street address was found on the map inside the area.
      -- false: it could not be found, so the customer chose the area themselves.
      'area_verified', coalesce(v_check.outcome = 'verified', false),
      'lat', v_check.latitude,
      'lng', v_check.longitude,
      'city', left(p_address->>'city', 80),
      'postal_code', left(coalesce(p_address->>'postal_code', ''), 12),
      'phone', left(p_address->>'phone', 24)
    ),
    nullif(left(trim(coalesce(p_notes, '')), 500), '')
  )
  RETURNING id INTO v_order_id;

  -- Lines are priced from the menu; the same item sent twice is merged.
  WITH wanted AS (
    SELECT (item->>'menu_item_id')::uuid AS menu_item_id, sum((item->>'quantity')::integer) AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ), inserted AS (
    INSERT INTO public.food_order_items (order_id, menu_item_id, name, unit_price, quantity)
    SELECT v_order_id, m.id, m.name, m.price, w.quantity
    FROM wanted w
    JOIN public.eatery_menu_items m ON m.id = w.menu_item_id
    WHERE m.eatery_id = v_eatery.id AND m.is_available
    RETURNING unit_price, quantity
  )
  SELECT coalesce(sum(unit_price * quantity), 0), count(*) INTO v_subtotal, v_lines FROM inserted;

  IF v_lines <> (SELECT count(DISTINCT item->>'menu_item_id') FROM jsonb_array_elements(p_items) AS item) THEN
    RAISE EXCEPTION 'Some items are no longer available. Please review your basket.';
  END IF;
  IF v_subtotal < v_eatery.min_order THEN
    RAISE EXCEPTION 'The minimum order at % is R%', v_eatery.name, v_eatery.min_order;
  END IF;

  UPDATE public.food_orders
  SET subtotal = v_subtotal, total = v_subtotal + v_eatery.delivery_fee
  WHERE id = v_order_id;

  RETURN v_order_id;
END $$;
