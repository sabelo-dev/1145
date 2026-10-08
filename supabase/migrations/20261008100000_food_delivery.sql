-- Food delivery: eateries, menus and food orders.
-- A standalone vertical (like stays): its own tables, its own order flow.
-- One order = one eatery. Delivery is a flat fee set per eatery.
-- Prices are always taken from the menu on the server (place_food_order);
-- the client never supplies an amount.

-- ── Eateries ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.eateries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cuisines TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  cover_url TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  -- Shown to customers as written, e.g. "Mon–Sat 10:00–21:00".
  opening_hours TEXT,
  prep_time_min INTEGER NOT NULL DEFAULT 20 CHECK (prep_time_min BETWEEN 5 AND 180),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  -- Set by an admin. Only approved eateries are listed.
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  -- The owner's own open/closed switch.
  accepting_orders BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eateries_owner_idx ON public.eateries (owner_id);
CREATE INDEX IF NOT EXISTS eateries_listed_idx ON public.eateries (status, city);

CREATE TABLE IF NOT EXISTS public.eatery_menu_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eatery_id UUID NOT NULL REFERENCES public.eateries(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eatery_menu_sections_eatery_idx ON public.eatery_menu_sections (eatery_id, sort_order);

CREATE TABLE IF NOT EXISTS public.eatery_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eatery_id UUID NOT NULL REFERENCES public.eateries(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.eatery_menu_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS eatery_menu_items_eatery_idx ON public.eatery_menu_items (eatery_id, sort_order);

-- ── Orders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eatery_id UUID NOT NULL REFERENCES public.eateries(id) ON DELETE RESTRICT,
  -- pending_payment → placed → preparing → ready → out_for_delivery → delivered
  -- (or rejected by the eatery / cancelled by the customer before it is accepted)
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN
    ('pending_payment', 'placed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'rejected', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refund_due', 'refunded')),
  payment_reference TEXT,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  -- { name, street, city, postal_code, phone }
  delivery_address JSONB NOT NULL,
  notes TEXT,
  reject_reason TEXT,
  placed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_orders_user_idx ON public.food_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS food_orders_eatery_idx ON public.food_orders (eatery_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.food_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.food_orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.eatery_menu_items(id) ON DELETE SET NULL,
  -- Name and price are copied at order time so later menu edits never change a past order.
  name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 50)
);
CREATE INDEX IF NOT EXISTS food_order_items_order_idx ON public.food_order_items (order_id);

-- Driver jobs: a job belongs to a shop order or to a food order.
ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS food_order_id UUID REFERENCES public.food_orders(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS delivery_jobs_food_order_idx
  ON public.delivery_jobs (food_order_id) WHERE food_order_id IS NOT NULL;

-- ── Helpers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owns_eatery(_eatery_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.eateries WHERE id = _eatery_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.food_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eateries_touch ON public.eateries;
CREATE TRIGGER eateries_touch BEFORE UPDATE ON public.eateries
  FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at();
DROP TRIGGER IF EXISTS eatery_menu_items_touch ON public.eatery_menu_items;
CREATE TRIGGER eatery_menu_items_touch BEFORE UPDATE ON public.eatery_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at();
DROP TRIGGER IF EXISTS food_orders_touch ON public.food_orders;
CREATE TRIGGER food_orders_touch BEFORE UPDATE ON public.food_orders
  FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at();

-- Owners edit their own listing but can never approve themselves or hand it to someone else.
CREATE OR REPLACE FUNCTION public.eateries_guard_owner_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW; -- service role and admins
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.accepting_orders := false;
    NEW.owner_id := auth.uid();
  ELSE
    NEW.status := OLD.status;
    NEW.owner_id := OLD.owner_id;
    IF OLD.status <> 'approved' THEN
      NEW.accepting_orders := false;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eateries_guard ON public.eateries;
CREATE TRIGGER eateries_guard BEFORE INSERT OR UPDATE ON public.eateries
  FOR EACH ROW EXECUTE FUNCTION public.eateries_guard_owner_edit();

-- ── Row level security ──────────────────────────────────────────
ALTER TABLE public.eateries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eatery_menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eatery_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved eateries are public" ON public.eateries;
CREATE POLICY "Approved eateries are public" ON public.eateries FOR SELECT
  USING (status = 'approved' OR owner_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users can register an eatery" ON public.eateries;
CREATE POLICY "Users can register an eatery" ON public.eateries FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "Owners and admins can update eateries" ON public.eateries;
CREATE POLICY "Owners and admins can update eateries" ON public.eateries FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Admins can delete eateries" ON public.eateries;
CREATE POLICY "Admins can delete eateries" ON public.eateries FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Menu sections follow the eatery" ON public.eatery_menu_sections;
CREATE POLICY "Menu sections follow the eatery" ON public.eatery_menu_sections FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.eateries e WHERE e.id = eatery_id));
DROP POLICY IF EXISTS "Owners manage menu sections" ON public.eatery_menu_sections;
CREATE POLICY "Owners manage menu sections" ON public.eatery_menu_sections FOR ALL TO authenticated
  USING (public.owns_eatery(eatery_id) OR public.is_admin())
  WITH CHECK (public.owns_eatery(eatery_id) OR public.is_admin());

DROP POLICY IF EXISTS "Menu items follow the eatery" ON public.eatery_menu_items;
CREATE POLICY "Menu items follow the eatery" ON public.eatery_menu_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.eateries e WHERE e.id = eatery_id));
DROP POLICY IF EXISTS "Owners manage menu items" ON public.eatery_menu_items;
CREATE POLICY "Owners manage menu items" ON public.eatery_menu_items FOR ALL TO authenticated
  USING (public.owns_eatery(eatery_id) OR public.is_admin())
  WITH CHECK (public.owns_eatery(eatery_id) OR public.is_admin());

-- Orders are read-only to clients; every change goes through the functions below.
-- Eateries only see orders that have been paid for.
DROP POLICY IF EXISTS "Customers, eateries and admins read food orders" ON public.food_orders;
CREATE POLICY "Customers, eateries and admins read food orders" ON public.food_orders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR (status <> 'pending_payment' AND public.owns_eatery(eatery_id))
  );

DROP POLICY IF EXISTS "Order lines follow the order" ON public.food_order_items;
CREATE POLICY "Order lines follow the order" ON public.food_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = order_id));

-- ── Placing an order (customer) ─────────────────────────────────
-- p_items: [{ "menu_item_id": uuid, "quantity": int }, …]
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

  INSERT INTO public.food_orders (user_id, eatery_id, subtotal, delivery_fee, total, delivery_address, notes)
  VALUES (
    v_user, v_eatery.id, 0, v_eatery.delivery_fee, 0,
    jsonb_build_object(
      'name', left(coalesce(p_address->>'name', ''), 120),
      'street', left(p_address->>'street', 200),
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

-- ── Customer cancels (only before the eatery starts cooking) ────
CREATE OR REPLACE FUNCTION public.cancel_food_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order public.food_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.food_orders WHERE id = p_order_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status NOT IN ('pending_payment', 'placed') THEN
    RAISE EXCEPTION 'This order is already being prepared and can no longer be cancelled';
  END IF;
  UPDATE public.food_orders
  SET status = 'cancelled',
      payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_due' ELSE payment_status END
  WHERE id = p_order_id;
END $$;

-- ── Eatery moves an order along ─────────────────────────────────
-- placed → preparing (accept) | rejected;  preparing → ready.
-- Accepting an order also posts the delivery job, so a driver can head over while it cooks.
CREATE OR REPLACE FUNCTION public.eatery_update_food_order(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order public.food_orders%ROWTYPE;
  v_eatery public.eateries%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.food_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  SELECT * INTO v_eatery FROM public.eateries WHERE id = v_order.eatery_id;
  IF NOT (v_eatery.owner_id = auth.uid() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF p_status = 'preparing' AND v_order.status = 'placed' THEN
    UPDATE public.food_orders SET status = 'preparing' WHERE id = p_order_id;
    INSERT INTO public.delivery_jobs (food_order_id, status, pickup_address, delivery_address, pickup_time, earnings, notes)
    VALUES (
      p_order_id, 'pending',
      jsonb_build_object(
        'name', v_eatery.name, 'street', v_eatery.address, 'city', v_eatery.city,
        'province', coalesce(v_eatery.province, ''), 'phone', coalesce(v_eatery.phone, ''),
        'lat', v_eatery.latitude, 'lng', v_eatery.longitude
      ),
      v_order.delivery_address || jsonb_build_object('province', ''),
      now() + make_interval(mins => v_eatery.prep_time_min),
      v_order.delivery_fee,
      'Food order from ' || v_eatery.name
    )
    ON CONFLICT DO NOTHING;
  ELSIF p_status = 'rejected' AND v_order.status = 'placed' THEN
    UPDATE public.food_orders
    SET status = 'rejected',
        reject_reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''),
        payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_due' ELSE payment_status END
    WHERE id = p_order_id;
  ELSIF p_status = 'ready' AND v_order.status = 'preparing' THEN
    UPDATE public.food_orders SET status = 'ready' WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'An order that is % cannot be marked %', replace(v_order.status, '_', ' '), replace(p_status, '_', ' ');
  END IF;
END $$;

-- ── Driver progress flows back onto the food order ──────────────
CREATE OR REPLACE FUNCTION public.food_order_follow_delivery_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.food_order_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('picked_up', 'in_transit') THEN
    UPDATE public.food_orders SET status = 'out_for_delivery'
    WHERE id = NEW.food_order_id AND status IN ('preparing', 'ready');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE public.food_orders SET status = 'delivered', delivered_at = now()
    WHERE id = NEW.food_order_id AND status IN ('preparing', 'ready', 'out_for_delivery');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS delivery_jobs_food_order_sync ON public.delivery_jobs;
CREATE TRIGGER delivery_jobs_food_order_sync AFTER UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.food_order_follow_delivery_job();

REVOKE ALL ON FUNCTION public.place_food_order(uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_food_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.eatery_update_food_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_food_order(uuid, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_food_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eatery_update_food_order(uuid, text, text) TO authenticated;

-- Live order status for customers and eateries.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.food_orders;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
