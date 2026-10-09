-- Delivery areas for eateries.
--
-- An eatery lists the areas (suburbs, towns) it delivers food and drinks to. Customers
-- pick one of them at checkout, and the order is refused for anywhere else.
-- An eatery with no areas listed delivers anywhere, as before.

ALTER TABLE public.eateries
  ADD COLUMN IF NOT EXISTS delivery_areas TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  ALTER TABLE public.eateries ADD CONSTRAINT eateries_delivery_areas_limit
    CHECK (cardinality(delivery_areas) <= 60 AND array_position(delivery_areas, NULL) IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS eateries_delivery_areas_idx ON public.eateries USING gin (delivery_areas);

-- Same function as before, now checking the delivery area and saving it on the order.
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
  v_area text := nullif(trim(coalesce(p_address->>'area', '')), '');
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

  -- An eatery that lists delivery areas only delivers to those. The stored name is the
  -- eatery's own spelling, whatever case the customer's choice arrived in.
  IF cardinality(v_eatery.delivery_areas) > 0 THEN
    IF v_area IS NULL THEN
      RAISE EXCEPTION 'Choose the area you want this delivered to';
    END IF;
    SELECT a INTO v_area FROM unnest(v_eatery.delivery_areas) AS a WHERE lower(a) = lower(v_area) LIMIT 1;
    IF v_area IS NULL THEN
      RAISE EXCEPTION '% does not deliver to that area', v_eatery.name;
    END IF;
  END IF;

  INSERT INTO public.food_orders (user_id, eatery_id, subtotal, delivery_fee, total, delivery_address, notes)
  VALUES (
    v_user, v_eatery.id, 0, v_eatery.delivery_fee, 0,
    jsonb_build_object(
      'name', left(coalesce(p_address->>'name', ''), 120),
      'street', left(p_address->>'street', 200),
      'area', left(coalesce(v_area, ''), 60),
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
