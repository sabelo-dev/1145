-- 1145 POS: in-store selling in the 1145 Orders app.
--
-- Adds a till to the order console: ring up products (or open items), take
-- cash, card, EFT or 1145 Pay (split tenders allowed), print or share a
-- receipt, run shifts with a cash float, pay-ins and pay-outs and a cash-up,
-- and refund or void sales with the stock put back.
--
-- The database decides everything that matters. The app sends what was
-- scanned and what was tendered; prices come from the catalogue, discounts
-- are checked against the store's limit, VAT is worked out here, and a
-- 1145 Pay tender is accepted only if that payment request is really paid.
-- Money is integer cents throughout. Every write takes a request key, so a
-- retried tap never rings a sale up twice.
--
-- Who may do what (store_role_permissions):
--   sell, open/close a shift, cash in/out, see the shift's sales   'orders'
--   price overrides, discounts above the limit, refunds and voids  'operations'
--   daily summary across tills                                     'insights'
--   POS settings (VAT number, receipt text, discount limit)        'settings'
-- and the merchant must have the 'pos' feature switched on.

-- 1. Feature flag ---------------------------------------------------------------
ALTER TABLE public.merchant_feature_flags DROP CONSTRAINT IF EXISTS merchant_feature_flags_flag_key_check;
ALTER TABLE public.merchant_feature_flags
  ADD CONSTRAINT merchant_feature_flags_flag_key_check
  CHECK (flag_key IN ('order_console', 'payment_requests', 'ai_assistant', 'pos'));

-- 2. Stock reasons: sales, refunds and voids at the till move stock too --------
ALTER TABLE public.merchant_stock_adjustments DROP CONSTRAINT IF EXISTS merchant_stock_adjustments_reason_check;
ALTER TABLE public.merchant_stock_adjustments
  ADD CONSTRAINT merchant_stock_adjustments_reason_check
  CHECK (reason IN ('received', 'count', 'damaged', 'returned', 'other', 'pos_sale', 'pos_refund', 'pos_void'));

-- 3. Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  vat_registered boolean NOT NULL DEFAULT false,
  vat_number text CHECK (vat_number IS NULL OR vat_number ~ '^4[0-9]{9}$'),
  vat_rate_bp integer NOT NULL DEFAULT 1500 CHECK (vat_rate_bp BETWEEN 0 AND 5000),
  receipt_header text CHECK (receipt_header IS NULL OR length(receipt_header) <= 300),
  receipt_footer text CHECK (receipt_footer IS NULL OR length(receipt_footer) <= 300),
  -- Largest discount (share of the sale before discounts) a cashier may give without a manager.
  cashier_max_discount_bp integer NOT NULL DEFAULT 1000 CHECK (cashier_max_discount_bp BETWEEN 0 AND 10000),
  allow_open_items boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pos_counters (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  last_sale_number bigint NOT NULL DEFAULT 0,
  last_refund_number bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  register_name text NOT NULL CHECK (length(register_name) BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_float_minor bigint NOT NULL CHECK (opening_float_minor BETWEEN 0 AND 10000000),
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  expected_cash_minor bigint,
  counted_cash_minor bigint CHECK (counted_cash_minor IS NULL OR counted_cash_minor BETWEEN 0 AND 100000000),
  close_note text CHECK (close_note IS NULL OR length(close_note) <= 300),
  closed_by uuid REFERENCES auth.users(id),
  closed_at timestamptz,
  idempotency_key text NOT NULL,
  UNIQUE (store_id, idempotency_key)
);
-- One open shift per till.
CREATE UNIQUE INDEX IF NOT EXISTS pos_shifts_one_open_per_register
  ON public.pos_shifts (store_id, lower(register_name)) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pos_shifts_store ON public.pos_shifts (store_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS public.pos_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pay_in', 'pay_out')),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 10000000),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_shift ON public.pos_cash_movements (shift_id);

CREATE TABLE IF NOT EXISTS public.pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE RESTRICT,
  sale_number bigint NOT NULL,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'partially_refunded', 'refunded', 'voided')),
  subtotal_minor bigint NOT NULL,          -- list price x quantity, before any discount
  discount_minor bigint NOT NULL,          -- line and sale discounts together
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  vat_minor bigint NOT NULL DEFAULT 0,     -- VAT included in total_minor
  vat_rate_bp integer NOT NULL DEFAULT 0,
  tendered_minor bigint NOT NULL,
  change_minor bigint NOT NULL DEFAULT 0 CHECK (change_minor >= 0),
  refunded_minor bigint NOT NULL DEFAULT 0,
  customer_name text CHECK (customer_name IS NULL OR length(customer_name) <= 80),
  customer_phone text CHECK (customer_phone IS NULL OR length(customer_phone) <= 30),
  note text CHECK (note IS NULL OR length(note) <= 300),
  cashier_user_id uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),   -- set when an override needed 'operations'
  voided_by uuid REFERENCES auth.users(id),
  voided_at timestamptz,
  void_reason text CHECK (void_reason IS NULL OR length(void_reason) <= 200),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key),
  UNIQUE (store_id, sale_number)
);
CREATE INDEX IF NOT EXISTS idx_pos_sales_store ON public.pos_sales (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_shift ON public.pos_sales (shift_id);

CREATE TABLE IF NOT EXISTS public.pos_sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  position integer NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  sku text,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 9999),
  list_price_minor bigint NOT NULL CHECK (list_price_minor >= 0),   -- catalogue price per unit
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),   -- price charged per unit before discounts
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0), -- line discount plus its share of the sale discount
  line_total_minor bigint NOT NULL CHECK (line_total_minor >= 0),
  refunded_quantity integer NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0),
  refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  stock_tracked boolean NOT NULL DEFAULT false,
  CHECK (refunded_quantity <= quantity),
  CHECK (refunded_minor <= line_total_minor)
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_lines_sale ON public.pos_sale_lines (sale_id);

CREATE TABLE IF NOT EXISTS public.pos_sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash', 'card', 'eft', 'pay_1145')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),    -- applied to the sale (cash: after change)
  tendered_minor bigint NOT NULL CHECK (tendered_minor >= 0),
  reference text CHECK (reference IS NULL OR length(reference) <= 60),
  payment_request_id uuid REFERENCES public.merchant_payment_requests(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_payments_sale ON public.pos_sale_payments (sale_id);
-- A 1145 Pay payment pays for one sale only.
CREATE UNIQUE INDEX IF NOT EXISTS pos_sale_payments_request_once
  ON public.pos_sale_payments (payment_request_id) WHERE payment_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pos_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  sale_id uuid NOT NULL REFERENCES public.pos_sales(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES public.pos_shifts(id) ON DELETE RESTRICT,
  refund_number bigint NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  method text NOT NULL CHECK (method IN ('cash', 'card', 'eft')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  restocked boolean NOT NULL,
  lines jsonb NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key),
  UNIQUE (store_id, refund_number)
);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_sale ON public.pos_refunds (sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_refunds_shift ON public.pos_refunds (shift_id);

-- Read access for staff; every write goes through the functions below.
ALTER TABLE public.pos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pos_settings, public.pos_counters, public.pos_shifts, public.pos_cash_movements,
  public.pos_sales, public.pos_sale_lines, public.pos_sale_payments, public.pos_refunds FROM anon;

DROP POLICY IF EXISTS "Store staff see POS settings" ON public.pos_settings;
CREATE POLICY "Store staff see POS settings" ON public.pos_settings FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Store staff see POS shifts" ON public.pos_shifts;
CREATE POLICY "Store staff see POS shifts" ON public.pos_shifts FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Store staff see POS cash movements" ON public.pos_cash_movements;
CREATE POLICY "Store staff see POS cash movements" ON public.pos_cash_movements FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Store staff see POS sales" ON public.pos_sales;
CREATE POLICY "Store staff see POS sales" ON public.pos_sales FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Store staff see POS sale lines" ON public.pos_sale_lines;
CREATE POLICY "Store staff see POS sale lines" ON public.pos_sale_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_sales s WHERE s.id = sale_id
                 AND (public.store_has_permission(s.store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()))));
DROP POLICY IF EXISTS "Store staff see POS sale payments" ON public.pos_sale_payments;
CREATE POLICY "Store staff see POS sale payments" ON public.pos_sale_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_sales s WHERE s.id = sale_id
                 AND (public.store_has_permission(s.store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()))));
DROP POLICY IF EXISTS "Store staff see POS refunds" ON public.pos_refunds;
CREATE POLICY "Store staff see POS refunds" ON public.pos_refunds FOR SELECT TO authenticated
  USING (public.store_has_permission(store_id, 'orders', auth.uid()) OR public.is_admin(auth.uid()));

-- 4. Settings -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_settings_get(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  SELECT jsonb_build_object(
      'store_id', s.id,
      'store_name', s.name,
      'store_address', s.pickup_address,
      'vat_registered', COALESCE(ps.vat_registered, false),
      'vat_number', ps.vat_number,
      'vat_rate_bp', COALESCE(ps.vat_rate_bp, 1500),
      'receipt_header', ps.receipt_header,
      'receipt_footer', ps.receipt_footer,
      'cashier_max_discount_bp', COALESCE(ps.cashier_max_discount_bp, 1000),
      'allow_open_items', COALESCE(ps.allow_open_items, true))
    INTO v
    FROM public.stores s LEFT JOIN public.pos_settings ps ON ps.store_id = s.id
   WHERE s.id = p_store_id;
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_settings_set(
  p_store_id uuid, p_vat_registered boolean, p_vat_number text, p_receipt_header text,
  p_receipt_footer text, p_cashier_max_discount_bp integer, p_allow_open_items boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vat text := NULLIF(regexp_replace(COALESCE(p_vat_number, ''), '\s', '', 'g'), '');
BEGIN
  PERFORM public.require_store_access(p_store_id, 'settings', 'pos');
  IF p_vat_registered AND (v_vat IS NULL OR v_vat !~ '^4[0-9]{9}$') THEN
    RAISE EXCEPTION 'A South African VAT number has 10 digits and starts with 4';
  END IF;
  IF p_cashier_max_discount_bp IS NULL OR p_cashier_max_discount_bp NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'The cashier discount limit must be from 0%% to 100%%';
  END IF;

  INSERT INTO public.pos_settings AS ps (store_id, vat_registered, vat_number, receipt_header, receipt_footer,
                                         cashier_max_discount_bp, allow_open_items, updated_by, updated_at)
  VALUES (p_store_id, COALESCE(p_vat_registered, false), CASE WHEN p_vat_registered THEN v_vat END,
          NULLIF(left(trim(COALESCE(p_receipt_header, '')), 300), ''), NULLIF(left(trim(COALESCE(p_receipt_footer, '')), 300), ''),
          p_cashier_max_discount_bp, COALESCE(p_allow_open_items, true), auth.uid(), now())
  ON CONFLICT (store_id) DO UPDATE SET
    vat_registered = EXCLUDED.vat_registered, vat_number = EXCLUDED.vat_number,
    receipt_header = EXCLUDED.receipt_header, receipt_footer = EXCLUDED.receipt_footer,
    cashier_max_discount_bp = EXCLUDED.cashier_max_discount_bp, allow_open_items = EXCLUDED.allow_open_items,
    updated_by = EXCLUDED.updated_by, updated_at = now();

  RETURN public.pos_settings_get(p_store_id);
END;
$function$;

-- 5. Catalogue for the till -----------------------------------------------------
-- Every product the store can sell in person (listed or not yet listed), with
-- its first image, price in cents, stock, and variants. Prices are the store's
-- catalogue prices, the same as on 1145.
CREATE OR REPLACE FUNCTION public.pos_catalog(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY row ->> 'name') FROM (
      SELECT jsonb_build_object(
        'product_id', p.id,
        'name', p.name,
        'sku', p.sku,
        'category', COALESCE(NULLIF(p.category, ''), 'Other'),
        'price_minor', round(p.price * 100)::bigint,
        'track_stock', p.product_type <> 'downloadable',
        'stock', p.quantity,
        'image_url', (SELECT i.image_url FROM public.product_images i WHERE i.product_id = p.id ORDER BY i.position, i.created_at LIMIT 1),
        'variations', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'variation_id', v.id, 'sku', v.sku, 'attributes', v.attributes, 'stock', v.quantity,
                   'price_minor', CASE WHEN v.price > 0 THEN round(v.price * 100)::bigint ELSE round(p.price * 100)::bigint END)
                 ORDER BY v.sku NULLS LAST, v.id)
            FROM public.product_variations v WHERE v.product_id = p.id), '[]'::jsonb)
      ) AS row
        FROM public.products p
       WHERE p.store_id = p_store_id
         AND p.status IN ('approved', 'active', 'pending', 'draft')
       ORDER BY p.name
       LIMIT 3000) rows), '[]'::jsonb);
END;
$function$;

-- 6. Shifts ---------------------------------------------------------------------
-- Totals for a shift: the numbers on the X report (while open) and Z report (closed).
CREATE OR REPLACE FUNCTION public.pos_shift_totals(p_shift_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH sh AS (SELECT * FROM public.pos_shifts WHERE id = p_shift_id),
  sales AS (SELECT * FROM public.pos_sales WHERE shift_id = p_shift_id),
  live AS (SELECT * FROM sales WHERE status <> 'voided'),
  pays AS (SELECT p.* FROM public.pos_sale_payments p JOIN live s ON s.id = p.sale_id),
  refs AS (SELECT * FROM public.pos_refunds WHERE shift_id = p_shift_id),
  moves AS (SELECT * FROM public.pos_cash_movements WHERE shift_id = p_shift_id),
  t AS (
    SELECT
      (SELECT count(*) FROM live) AS sales_count,
      (SELECT COALESCE(sum(total_minor), 0) FROM live) AS gross_minor,
      (SELECT COALESCE(sum(discount_minor), 0) FROM live) AS discount_minor,
      (SELECT COALESCE(sum(vat_minor), 0) FROM live) AS vat_minor,
      (SELECT count(*) FROM sales WHERE status = 'voided') AS voids_count,
      (SELECT COALESCE(sum(total_minor), 0) FROM sales WHERE status = 'voided') AS voids_minor,
      (SELECT count(*) FROM refs) AS refunds_count,
      (SELECT COALESCE(sum(amount_minor), 0) FROM refs) AS refunds_minor,
      (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'cash') AS cash_sales_minor,
      (SELECT COALESCE(sum(amount_minor), 0) FROM refs WHERE method = 'cash') AS cash_refunds_minor,
      (SELECT COALESCE(sum(amount_minor), 0) FROM moves WHERE kind = 'pay_in') AS pay_ins_minor,
      (SELECT COALESCE(sum(amount_minor), 0) FROM moves WHERE kind = 'pay_out') AS pay_outs_minor
  )
  SELECT jsonb_build_object(
    'shift_id', sh.id,
    'register_name', sh.register_name,
    'status', sh.status,
    'opened_at', sh.opened_at,
    'opened_by', (SELECT COALESCE(NULLIF(name, ''), email) FROM public.profiles WHERE id = sh.opened_by),
    'closed_at', sh.closed_at,
    'closed_by', (SELECT COALESCE(NULLIF(name, ''), email) FROM public.profiles WHERE id = sh.closed_by),
    'opening_float_minor', sh.opening_float_minor,
    'sales_count', t.sales_count,
    'gross_minor', t.gross_minor,
    'discount_minor', t.discount_minor,
    'vat_minor', t.vat_minor,
    'net_minor', t.gross_minor - t.refunds_minor,
    'voids_count', t.voids_count,
    'voids_minor', t.voids_minor,
    'refunds_count', t.refunds_count,
    'refunds_minor', t.refunds_minor,
    'by_method', jsonb_build_object(
      'cash', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'cash'),
      'card', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'card'),
      'eft', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'eft'),
      'pay_1145', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'pay_1145')),
    'refunds_by_method', jsonb_build_object(
      'cash', t.cash_refunds_minor,
      'card', (SELECT COALESCE(sum(amount_minor), 0) FROM refs WHERE method = 'card'),
      'eft', (SELECT COALESCE(sum(amount_minor), 0) FROM refs WHERE method = 'eft')),
    'pay_ins_minor', t.pay_ins_minor,
    'pay_outs_minor', t.pay_outs_minor,
    'expected_cash_minor', sh.opening_float_minor + t.cash_sales_minor - t.cash_refunds_minor + t.pay_ins_minor - t.pay_outs_minor,
    'counted_cash_minor', sh.counted_cash_minor,
    'variance_minor', CASE WHEN sh.counted_cash_minor IS NULL THEN NULL
                           ELSE sh.counted_cash_minor - sh.expected_cash_minor END,
    'close_note', sh.close_note,
    'cash_movements', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'amount_minor', amount_minor, 'reason', reason, 'created_at', created_at) ORDER BY created_at) FROM moves), '[]'::jsonb)
  )
  FROM sh, t;
$function$;
REVOKE EXECUTE ON FUNCTION public.pos_shift_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_shift_totals(uuid) TO service_role;

-- The open shift on a till, or null.
CREATE OR REPLACE FUNCTION public.pos_shift_current(p_store_id uuid, p_register_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  SELECT id INTO v_id FROM public.pos_shifts
   WHERE store_id = p_store_id AND status = 'open' AND lower(register_name) = lower(trim(p_register_name));
  RETURN CASE WHEN v_id IS NULL THEN NULL ELSE public.pos_shift_totals(v_id) END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_shift_open(p_store_id uuid, p_register_name text, p_opening_float_minor bigint, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := trim(COALESCE(p_register_name, ''));
  v_id uuid;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  IF COALESCE(p_idempotency_key, '') = '' THEN RAISE EXCEPTION 'A request key is required'; END IF;
  IF length(v_name) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Give the till a name of up to 40 characters'; END IF;
  IF p_opening_float_minor IS NULL OR p_opening_float_minor NOT BETWEEN 0 AND 10000000 THEN
    RAISE EXCEPTION 'Enter the cash float in the drawer (R0 to R100 000)';
  END IF;

  SELECT id INTO v_id FROM public.pos_shifts WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN public.pos_shift_totals(v_id); END IF;

  IF EXISTS (SELECT 1 FROM public.pos_shifts WHERE store_id = p_store_id AND status = 'open' AND lower(register_name) = lower(v_name)) THEN
    RAISE EXCEPTION 'A shift is already open on %. Close it first or carry on with it.', v_name;
  END IF;

  INSERT INTO public.pos_shifts (store_id, register_name, opening_float_minor, opened_by, idempotency_key)
  VALUES (p_store_id, v_name, p_opening_float_minor, auth.uid(), p_idempotency_key)
  RETURNING id INTO v_id;
  RETURN public.pos_shift_totals(v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_cash_movement(p_shift_id uuid, p_kind text, p_amount_minor bigint, p_reason text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift public.pos_shifts;
BEGIN
  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = p_shift_id;
  IF v_shift.id IS NULL THEN RAISE EXCEPTION 'Shift not found'; END IF;
  PERFORM public.require_store_access(v_shift.store_id, 'orders', 'pos');
  IF COALESCE(p_idempotency_key, '') = '' THEN RAISE EXCEPTION 'A request key is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.pos_cash_movements WHERE store_id = v_shift.store_id AND idempotency_key = p_idempotency_key) THEN
    RETURN public.pos_shift_totals(p_shift_id);
  END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'This shift is closed'; END IF;
  IF p_kind NOT IN ('pay_in', 'pay_out') THEN RAISE EXCEPTION 'Choose cash in or cash out'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 10000000 THEN RAISE EXCEPTION 'Enter an amount'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Say what the cash is for'; END IF;

  INSERT INTO public.pos_cash_movements (shift_id, store_id, kind, amount_minor, reason, actor_user_id, idempotency_key)
  VALUES (p_shift_id, v_shift.store_id, p_kind, p_amount_minor, left(trim(p_reason), 200), auth.uid(), p_idempotency_key);
  RETURN public.pos_shift_totals(p_shift_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_shift_close(p_shift_id uuid, p_counted_cash_minor bigint, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_shift public.pos_shifts;
BEGIN
  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = p_shift_id FOR UPDATE;
  IF v_shift.id IS NULL THEN RAISE EXCEPTION 'Shift not found'; END IF;
  PERFORM public.require_store_access(v_shift.store_id, 'orders', 'pos');
  IF v_shift.status = 'closed' THEN RETURN public.pos_shift_totals(p_shift_id); END IF; -- a retried close
  IF p_counted_cash_minor IS NULL OR p_counted_cash_minor NOT BETWEEN 0 AND 100000000 THEN
    RAISE EXCEPTION 'Count the cash in the drawer and enter the total';
  END IF;

  UPDATE public.pos_shifts
     SET status = 'closed', closed_at = now(), closed_by = auth.uid(),
         counted_cash_minor = p_counted_cash_minor,
         expected_cash_minor = (public.pos_shift_totals(p_shift_id) ->> 'expected_cash_minor')::bigint,
         close_note = NULLIF(left(trim(COALESCE(p_note, '')), 300), '')
   WHERE id = p_shift_id;
  RETURN public.pos_shift_totals(p_shift_id);
END;
$function$;

-- A shift's report (X while open, Z once closed).
CREATE OR REPLACE FUNCTION public.pos_shift_report(p_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.pos_shifts WHERE id = p_shift_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Shift not found'; END IF;
  PERFORM public.require_store_access(v_store, 'orders', 'pos');
  RETURN public.pos_shift_totals(p_shift_id);
END;
$function$;

-- Recent shifts for the store (newest first).
CREATE OR REPLACE FUNCTION public.pos_shift_list(p_store_id uuid, p_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  RETURN COALESCE((
    SELECT jsonb_agg(public.pos_shift_totals(id) ORDER BY opened_at DESC)
      FROM (SELECT id, opened_at FROM public.pos_shifts WHERE store_id = p_store_id
             ORDER BY opened_at DESC LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)) s), '[]'::jsonb);
END;
$function$;

-- 7. Sales ----------------------------------------------------------------------
-- Moves stock for one product or variant by p_delta (negative = out) and
-- records it. Stock never goes below zero: what's in the customer's hand
-- was on the shelf, so a count that disagrees is corrected to zero.
CREATE OR REPLACE FUNCTION public.pos_move_stock(
  p_store_id uuid, p_product_id uuid, p_variation_id uuid, p_delta integer, p_reason text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old integer;
  v_new integer;
BEGIN
  IF p_delta = 0 OR p_product_id IS NULL THEN RETURN; END IF;
  IF p_variation_id IS NULL THEN
    SELECT quantity INTO v_old FROM public.products WHERE id = p_product_id AND store_id = p_store_id FOR UPDATE;
    IF v_old IS NULL THEN RETURN; END IF;
    v_new := GREATEST(v_old + p_delta, 0);
    UPDATE public.products SET quantity = v_new, updated_at = now() WHERE id = p_product_id;
  ELSE
    SELECT v.quantity INTO v_old FROM public.product_variations v JOIN public.products p ON p.id = v.product_id
     WHERE v.id = p_variation_id AND p.id = p_product_id AND p.store_id = p_store_id FOR UPDATE OF v;
    IF v_old IS NULL THEN RETURN; END IF;
    v_new := GREATEST(v_old + p_delta, 0);
    UPDATE public.product_variations SET quantity = v_new WHERE id = p_variation_id;
  END IF;
  IF v_new <> v_old THEN
    INSERT INTO public.merchant_stock_adjustments
      (store_id, product_id, variation_id, old_quantity, new_quantity, reason, note, actor_user_id)
    VALUES (p_store_id, p_product_id, p_variation_id, v_old, v_new, p_reason, left(p_note, 200), auth.uid());
  END IF;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.pos_move_stock(uuid, uuid, uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_move_stock(uuid, uuid, uuid, integer, text, text) TO service_role;

-- A sale with its lines, tenders, refunds and the store's receipt details.
CREATE OR REPLACE FUNCTION public.pos_sale_json(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'sale_id', s.id,
    'store_id', s.store_id,
    'shift_id', s.shift_id,
    'register_name', sh.register_name,
    'sale_number', s.sale_number,
    'status', s.status,
    'created_at', s.created_at,
    'subtotal_minor', s.subtotal_minor,
    'discount_minor', s.discount_minor,
    'total_minor', s.total_minor,
    'vat_minor', s.vat_minor,
    'vat_rate_bp', s.vat_rate_bp,
    'tendered_minor', s.tendered_minor,
    'change_minor', s.change_minor,
    'refunded_minor', s.refunded_minor,
    'customer_name', s.customer_name,
    'customer_phone', s.customer_phone,
    'note', s.note,
    'cashier', (SELECT COALESCE(NULLIF(name, ''), split_part(email, '@', 1)) FROM public.profiles WHERE id = s.cashier_user_id),
    'voided_at', s.voided_at,
    'void_reason', s.void_reason,
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'line_id', l.id, 'product_id', l.product_id, 'variation_id', l.variation_id, 'name', l.name, 'sku', l.sku,
        'quantity', l.quantity, 'list_price_minor', l.list_price_minor, 'unit_price_minor', l.unit_price_minor,
        'discount_minor', l.discount_minor, 'line_total_minor', l.line_total_minor,
        'refunded_quantity', l.refunded_quantity, 'refunded_minor', l.refunded_minor) ORDER BY l.position)
      FROM public.pos_sale_lines l WHERE l.sale_id = s.id), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'method', p.method, 'amount_minor', p.amount_minor, 'tendered_minor', p.tendered_minor, 'reference', p.reference))
      FROM public.pos_sale_payments p WHERE p.sale_id = s.id), '[]'::jsonb),
    'refunds', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'refund_id', r.id, 'refund_number', r.refund_number, 'amount_minor', r.amount_minor, 'method', r.method,
        'reason', r.reason, 'restocked', r.restocked, 'lines', r.lines, 'created_at', r.created_at) ORDER BY r.created_at)
      FROM public.pos_refunds r WHERE r.sale_id = s.id), '[]'::jsonb),
    'store', jsonb_build_object(
      'name', st.name,
      'address', st.pickup_address,
      'vat_number', CASE WHEN COALESCE(ps.vat_registered, false) THEN ps.vat_number END,
      'receipt_header', ps.receipt_header,
      'receipt_footer', ps.receipt_footer)
  )
  FROM public.pos_sales s
  JOIN public.pos_shifts sh ON sh.id = s.shift_id
  JOIN public.stores st ON st.id = s.store_id
  LEFT JOIN public.pos_settings ps ON ps.store_id = s.store_id
  WHERE s.id = p_sale_id;
$function$;
REVOKE EXECUTE ON FUNCTION public.pos_sale_json(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pos_sale_json(uuid) TO service_role;

-- Rings up a sale.
--   p_lines    [{product_id, variation_id?, quantity, unit_price_minor?, discount_minor?}]
--              or an open item: [{name, quantity, unit_price_minor, discount_minor?}]
--   p_payments [{method: cash|card|eft|pay_1145, amount_minor, reference?, payment_request_id?}]
--              cash amount_minor is what the customer handed over; change comes from it.
-- Prices come from the catalogue unless someone with 'operations' changes them.
-- The sale discount is shared across the lines by value (largest remainder),
-- so a later refund of any line gives back exactly what was paid for it.
CREATE OR REPLACE FUNCTION public.pos_sale_create(
  p_store_id uuid, p_shift_id uuid, p_lines jsonb, p_sale_discount_minor bigint, p_payments jsonb,
  p_customer_name text, p_customer_phone text, p_note text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.pos_settings;
  v_vat_rate integer;
  v_max_discount_bp integer;
  v_allow_open boolean;
  v_shift public.pos_shifts;
  v_existing uuid;
  v_can_override boolean := public.store_has_permission(p_store_id, 'operations');
  v_needs_approval boolean := false;
  v_line jsonb;
  v_pay jsonb;
  v_lines jsonb := '[]'::jsonb;   -- priced lines
  v_pays jsonb := '[]'::jsonb;    -- checked tenders
  v_pos integer := 0;
  v_qty integer;
  v_list bigint;
  v_unit bigint;
  v_line_disc bigint;
  v_name text;
  v_sku text;
  v_tracked boolean;
  v_product public.products;
  v_var public.product_variations;
  v_subtotal bigint := 0;        -- list prices
  v_charged bigint := 0;         -- prices charged, before discounts
  v_line_discounts bigint := 0;
  v_after_lines bigint := 0;     -- after line discounts
  v_sale_disc bigint := COALESCE(p_sale_discount_minor, 0);
  v_total bigint;
  v_vat bigint := 0;
  v_noncash bigint := 0;
  v_cash bigint := 0;
  v_change bigint;
  v_change_left bigint;
  v_applied bigint;
  v_method text;
  v_amount bigint;
  v_request public.merchant_payment_requests;
  v_request_id uuid;
  v_number bigint;
  v_sale_id uuid;
  v_leftover bigint;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  IF COALESCE(p_idempotency_key, '') = '' THEN RAISE EXCEPTION 'A request key is required'; END IF;

  SELECT id INTO v_existing FROM public.pos_sales WHERE store_id = p_store_id AND idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN public.pos_sale_json(v_existing) || jsonb_build_object('repeated', true);
  END IF;

  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = p_shift_id AND store_id = p_store_id;
  IF v_shift.id IS NULL OR v_shift.status <> 'open' THEN
    RAISE EXCEPTION 'Open a shift on this till before selling';
  END IF;

  SELECT * INTO v_settings FROM public.pos_settings WHERE store_id = p_store_id;
  v_vat_rate := CASE WHEN COALESCE(v_settings.vat_registered, false) THEN COALESCE(v_settings.vat_rate_bp, 1500) ELSE 0 END;
  v_max_discount_bp := COALESCE(v_settings.cashier_max_discount_bp, 1000);
  v_allow_open := COALESCE(v_settings.allow_open_items, true);

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one item';
  END IF;
  IF jsonb_array_length(p_lines) > 200 THEN RAISE EXCEPTION 'A sale can have up to 200 lines'; END IF;
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) <> 'array' THEN RAISE EXCEPTION 'Payments are not valid'; END IF;
  IF jsonb_array_length(COALESCE(p_payments, '[]'::jsonb)) > 6 THEN RAISE EXCEPTION 'A sale can be paid with up to 6 tenders'; END IF;

  -- Price each line.
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_pos := v_pos + 1;
    BEGIN
      v_qty := (v_line ->> 'quantity')::integer;
      v_line_disc := COALESCE((v_line ->> 'discount_minor')::bigint, 0);
      v_unit := (v_line ->> 'unit_price_minor')::bigint;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Line % is not valid', v_pos;
    END;
    IF v_qty IS NULL OR v_qty NOT BETWEEN 1 AND 9999 THEN RAISE EXCEPTION 'Line %: quantity must be 1 to 9 999', v_pos; END IF;
    IF v_line_disc < 0 THEN RAISE EXCEPTION 'Line %: discount cannot be negative', v_pos; END IF;
    v_product := NULL;
    v_var := NULL;

    IF NULLIF(v_line ->> 'product_id', '') IS NULL THEN
      -- Open item: name and price typed at the till.
      IF NOT v_allow_open THEN RAISE EXCEPTION 'Open items are switched off for this store'; END IF;
      v_name := left(trim(COALESCE(v_line ->> 'name', '')), 200);
      IF v_name = '' THEN RAISE EXCEPTION 'Line %: give the item a name', v_pos; END IF;
      IF v_unit IS NULL OR v_unit NOT BETWEEN 1 AND 10000000 THEN RAISE EXCEPTION 'Line %: enter a price', v_pos; END IF;
      v_list := v_unit;
      v_sku := NULL;
      v_tracked := false;
    ELSE
      SELECT * INTO v_product FROM public.products
       WHERE id = (v_line ->> 'product_id')::uuid AND store_id = p_store_id
         AND status IN ('approved', 'active', 'pending', 'draft');
      IF v_product.id IS NULL THEN RAISE EXCEPTION 'Line %: that product is not in this store', v_pos; END IF;
      IF NULLIF(v_line ->> 'variation_id', '') IS NOT NULL THEN
        SELECT * INTO v_var FROM public.product_variations
         WHERE id = (v_line ->> 'variation_id')::uuid AND product_id = v_product.id;
        IF v_var.id IS NULL THEN RAISE EXCEPTION 'Line %: that option is not part of %', v_pos, v_product.name; END IF;
      ELSIF EXISTS (SELECT 1 FROM public.product_variations WHERE product_id = v_product.id) THEN
        RAISE EXCEPTION 'Line %: choose which % (size, colour…)', v_pos, v_product.name;
      END IF;
      v_list := CASE WHEN v_var.id IS NOT NULL AND v_var.price > 0 THEN round(v_var.price * 100) ELSE round(v_product.price * 100) END;
      v_name := left(v_product.name || COALESCE(' (' || (
                  SELECT string_agg(e.value #>> '{}', ' / ' ORDER BY e.key)
                    FROM jsonb_each(CASE WHEN jsonb_typeof(v_var.attributes) = 'object' THEN v_var.attributes ELSE '{}'::jsonb END) e
                   WHERE COALESCE(e.value #>> '{}', '') <> '') || ')', ''), 200);
      v_sku := COALESCE(v_var.sku, v_product.sku);
      v_tracked := v_product.product_type <> 'downloadable';
      IF v_unit IS NULL THEN
        v_unit := v_list;
      ELSIF v_unit <> v_list THEN
        IF v_unit < 0 OR v_unit > 10000000 THEN RAISE EXCEPTION 'Line %: price is not valid', v_pos; END IF;
        IF NOT v_can_override THEN RAISE EXCEPTION 'Only a manager or operator can change a price'; END IF;
        v_needs_approval := true;
      END IF;
    END IF;

    IF v_line_disc > v_unit * v_qty THEN RAISE EXCEPTION 'Line %: discount is more than the line', v_pos; END IF;
    v_subtotal := v_subtotal + v_list * v_qty;
    v_charged := v_charged + v_unit * v_qty;
    v_line_discounts := v_line_discounts + v_line_disc;
    v_after_lines := v_after_lines + v_unit * v_qty - v_line_disc;
    v_lines := v_lines || jsonb_build_object(
      'position', v_pos, 'product_id', v_product.id, 'variation_id', v_var.id, 'name', v_name, 'sku', v_sku,
      'quantity', v_qty, 'list_price', v_list, 'unit_price', v_unit, 'line_discount', v_line_disc,
      'after_line', v_unit * v_qty - v_line_disc, 'tracked', v_tracked);
  END LOOP;

  IF v_sale_disc < 0 OR v_sale_disc > v_after_lines THEN RAISE EXCEPTION 'The sale discount is more than the sale'; END IF;
  v_total := v_after_lines - v_sale_disc;

  -- Discounts (not price changes, which already needed a manager) against the cashier limit.
  IF v_line_discounts + v_sale_disc > 0
     AND (v_line_discounts + v_sale_disc) * 10000 > v_charged * v_max_discount_bp THEN
    IF NOT v_can_override THEN
      RAISE EXCEPTION '%', 'Discounts over ' || trim(to_char(v_max_discount_bp / 100.0, 'FM990.0')) || '% need a manager or operator';
    END IF;
    v_needs_approval := true;
  END IF;

  -- Share the sale discount across the lines by value, largest remainder first.
  IF v_sale_disc > 0 THEN
    SELECT v_sale_disc - COALESCE(sum((v_sale_disc * (e ->> 'after_line')::bigint) / v_after_lines), 0)
      INTO v_leftover FROM jsonb_array_elements(v_lines) e;
    SELECT jsonb_agg(x.e || jsonb_build_object('alloc', x.base + CASE WHEN x.rn <= v_leftover THEN 1 ELSE 0 END) ORDER BY x.pos)
      INTO v_lines
      FROM (SELECT e, (e ->> 'position')::int AS pos,
                   (v_sale_disc * (e ->> 'after_line')::bigint) / v_after_lines AS base,
                   row_number() OVER (ORDER BY (v_sale_disc * (e ->> 'after_line')::bigint) % v_after_lines DESC,
                                               (e ->> 'position')::int) AS rn
              FROM jsonb_array_elements(v_lines) e) x;
  END IF;

  IF v_vat_rate > 0 THEN
    v_vat := round(v_total::numeric * v_vat_rate / (10000 + v_vat_rate));
  END IF;

  -- Tenders.
  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb)) LOOP
    v_method := v_pay ->> 'method';
    v_request_id := NULL;
    BEGIN
      v_amount := (v_pay ->> 'amount_minor')::bigint;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'A payment amount is not valid';
    END;
    IF v_method IS NULL OR v_method NOT IN ('cash', 'card', 'eft', 'pay_1145') THEN RAISE EXCEPTION 'Unknown payment method %', v_method; END IF;
    IF v_amount IS NULL OR v_amount NOT BETWEEN 1 AND 100000000 THEN RAISE EXCEPTION 'A payment amount is not valid'; END IF;

    IF v_method = 'pay_1145' THEN
      BEGIN
        v_request_id := NULLIF(v_pay ->> 'payment_request_id', '')::uuid;
      EXCEPTION WHEN others THEN
        v_request_id := NULL;
      END;
      SELECT * INTO v_request FROM public.merchant_payment_requests
       WHERE id = v_request_id AND store_id = p_store_id FOR UPDATE;
      IF v_request.id IS NULL THEN RAISE EXCEPTION 'That 1145 Pay payment is not for this store'; END IF;
      IF v_request.status <> 'paid' THEN RAISE EXCEPTION 'The 1145 Pay payment has not come through yet'; END IF;
      IF v_request.amount_minor <> v_amount THEN RAISE EXCEPTION 'The 1145 Pay amount does not match'; END IF;
      IF EXISTS (SELECT 1 FROM public.pos_sale_payments WHERE payment_request_id = v_request.id)
         OR v_pays @> jsonb_build_array(jsonb_build_object('request_id', v_request.id)) THEN
        RAISE EXCEPTION 'That 1145 Pay payment has already been used for a sale';
      END IF;
    END IF;

    IF v_method = 'cash' THEN v_cash := v_cash + v_amount; ELSE v_noncash := v_noncash + v_amount; END IF;
    v_pays := v_pays || jsonb_build_object('method', v_method, 'tendered', v_amount,
                                           'reference', NULLIF(left(trim(COALESCE(v_pay ->> 'reference', '')), 60), ''),
                                           'request_id', v_request_id);
  END LOOP;

  IF v_noncash > v_total THEN
    RAISE EXCEPTION 'Card, EFT and 1145 Pay together are more than the total. Only cash can give change.';
  END IF;
  IF v_noncash + v_cash < v_total THEN
    RAISE EXCEPTION '%', 'R' || to_char((v_total - v_noncash - v_cash) / 100.0, 'FM9999999990.00') || ' is still to pay';
  END IF;
  v_change := v_noncash + v_cash - v_total;

  -- Number and write the sale.
  INSERT INTO public.pos_counters (store_id) VALUES (p_store_id) ON CONFLICT (store_id) DO NOTHING;
  UPDATE public.pos_counters SET last_sale_number = last_sale_number + 1 WHERE store_id = p_store_id
    RETURNING last_sale_number INTO v_number;

  INSERT INTO public.pos_sales (store_id, shift_id, sale_number, subtotal_minor, discount_minor, total_minor, vat_minor, vat_rate_bp,
                                tendered_minor, change_minor, customer_name, customer_phone, note, cashier_user_id, approved_by,
                                idempotency_key)
  VALUES (p_store_id, p_shift_id, v_number, v_subtotal, v_subtotal - v_total, v_total, v_vat, v_vat_rate,
          v_noncash + v_cash, v_change,
          NULLIF(left(trim(COALESCE(p_customer_name, '')), 80), ''), NULLIF(left(trim(COALESCE(p_customer_phone, '')), 30), ''),
          NULLIF(left(trim(COALESCE(p_note, '')), 300), ''), auth.uid(),
          CASE WHEN v_needs_approval THEN auth.uid() END, p_idempotency_key)
  RETURNING id INTO v_sale_id;

  INSERT INTO public.pos_sale_lines (sale_id, position, product_id, variation_id, name, sku, quantity,
                                     list_price_minor, unit_price_minor, discount_minor, line_total_minor, stock_tracked)
  SELECT v_sale_id, (e ->> 'position')::int, NULLIF(e ->> 'product_id', '')::uuid, NULLIF(e ->> 'variation_id', '')::uuid,
         e ->> 'name', e ->> 'sku', (e ->> 'quantity')::int, (e ->> 'list_price')::bigint, (e ->> 'unit_price')::bigint,
         (e ->> 'line_discount')::bigint + COALESCE((e ->> 'alloc')::bigint, 0),
         (e ->> 'after_line')::bigint - COALESCE((e ->> 'alloc')::bigint, 0),
         (e ->> 'tracked')::boolean
    FROM jsonb_array_elements(v_lines) e;

  -- Change comes out of the cash tenders; the drawer keeps the rest.
  v_change_left := v_change;
  FOR v_pay IN SELECT * FROM jsonb_array_elements(v_pays) LOOP
    v_amount := (v_pay ->> 'tendered')::bigint;
    v_applied := v_amount;
    IF v_pay ->> 'method' = 'cash' AND v_change_left > 0 THEN
      v_applied := v_amount - LEAST(v_amount, v_change_left);
      v_change_left := v_change_left - (v_amount - v_applied);
    END IF;
    INSERT INTO public.pos_sale_payments (sale_id, method, amount_minor, tendered_minor, reference, payment_request_id)
    VALUES (v_sale_id, v_pay ->> 'method', v_applied, v_amount, v_pay ->> 'reference', NULLIF(v_pay ->> 'request_id', '')::uuid);
  END LOOP;

  -- Stock out.
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) e WHERE (e ->> 'tracked')::boolean LOOP
    PERFORM public.pos_move_stock(p_store_id, (v_line ->> 'product_id')::uuid, NULLIF(v_line ->> 'variation_id', '')::uuid,
                                  -((v_line ->> 'quantity')::integer), 'pos_sale', 'Sale #' || v_number);
  END LOOP;

  RETURN public.pos_sale_json(v_sale_id) || jsonb_build_object('repeated', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.pos_sale_get(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
BEGIN
  SELECT store_id INTO v_store FROM public.pos_sales WHERE id = p_sale_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  PERFORM public.require_store_access(v_store, 'orders', 'pos');
  RETURN public.pos_sale_json(p_sale_id);
END;
$function$;

-- Sales on a day (Africa/Johannesburg), newest first; p_query matches the sale
-- number, customer name or phone.
CREATE OR REPLACE FUNCTION public.pos_sales_list(p_store_id uuid, p_day date DEFAULT NULL, p_query text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_q text := NULLIF(trim(replace(replace(left(COALESCE(p_query, ''), 60), '%', ''), '_', '')), '');
  v_num bigint := CASE WHEN v_q ~ '^#?[0-9]{1,15}$' THEN ltrim(v_q, '#')::bigint END;
BEGIN
  PERFORM public.require_store_access(p_store_id, 'orders', 'pos');
  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY (row ->> 'created_at') DESC) FROM (
      SELECT jsonb_build_object(
        'sale_id', s.id, 'sale_number', s.sale_number, 'status', s.status, 'created_at', s.created_at,
        'total_minor', s.total_minor, 'refunded_minor', s.refunded_minor, 'customer_name', s.customer_name,
        'register_name', sh.register_name,
        'items', (SELECT COALESCE(sum(quantity), 0) FROM public.pos_sale_lines l WHERE l.sale_id = s.id),
        'methods', (SELECT jsonb_agg(DISTINCT p.method) FROM public.pos_sale_payments p WHERE p.sale_id = s.id),
        'cashier', (SELECT COALESCE(NULLIF(name, ''), split_part(email, '@', 1)) FROM public.profiles WHERE id = s.cashier_user_id)
      ) AS row
        FROM public.pos_sales s JOIN public.pos_shifts sh ON sh.id = s.shift_id
       WHERE s.store_id = p_store_id
         AND (v_q IS NOT NULL OR (s.created_at AT TIME ZONE 'Africa/Johannesburg')::date
                                   = COALESCE(p_day, (now() AT TIME ZONE 'Africa/Johannesburg')::date))
         AND (v_q IS NULL OR s.sale_number = v_num OR s.customer_name ILIKE '%' || v_q || '%' OR s.customer_phone ILIKE '%' || v_q || '%')
       ORDER BY s.created_at DESC
       LIMIT 300) rows), '[]'::jsonb);
END;
$function$;

-- Voids a sale rung up by mistake: everything is reversed and the stock goes
-- back. Only on the shift it was rung up on, before any refund, and not when
-- it was paid by 1145 Pay (refund those instead, so the money is accounted for).
CREATE OR REPLACE FUNCTION public.pos_sale_void(p_sale_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.pos_sales;
  v_line public.pos_sale_lines;
BEGIN
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  PERFORM public.require_store_access(v_sale.store_id, 'operations', 'pos');
  IF v_sale.status = 'voided' THEN RETURN public.pos_sale_json(p_sale_id); END IF;
  IF v_sale.status <> 'completed' THEN RAISE EXCEPTION 'This sale has refunds, so it cannot be voided. Refund the rest instead.'; END IF;
  IF (SELECT status FROM public.pos_shifts WHERE id = v_sale.shift_id) <> 'open' THEN
    RAISE EXCEPTION 'The shift this sale was on is closed. Refund it instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pos_sale_payments WHERE sale_id = p_sale_id AND method = 'pay_1145') THEN
    RAISE EXCEPTION 'Sales paid with 1145 Pay cannot be voided. Refund it instead.';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Say why the sale is being voided'; END IF;

  FOR v_line IN SELECT * FROM public.pos_sale_lines WHERE sale_id = p_sale_id AND stock_tracked LOOP
    PERFORM public.pos_move_stock(v_sale.store_id, v_line.product_id, v_line.variation_id, v_line.quantity,
                                  'pos_void', 'Void of sale #' || v_sale.sale_number);
  END LOOP;

  UPDATE public.pos_sales SET status = 'voided', voided_at = now(), voided_by = auth.uid(), void_reason = left(trim(p_reason), 200)
   WHERE id = p_sale_id;
  RETURN public.pos_sale_json(p_sale_id);
END;
$function$;

-- Refunds some or all of a sale.
--   p_lines  [{line_id, quantity}]  units to give back per line
-- The amount is what was paid for those units (after discounts); the last unit
-- of a line takes whatever cents are left, so a full refund is always exact.
CREATE OR REPLACE FUNCTION public.pos_sale_refund(
  p_sale_id uuid, p_shift_id uuid, p_lines jsonb, p_method text, p_reason text, p_restock boolean, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale public.pos_sales;
  v_shift public.pos_shifts;
  v_item jsonb;
  v_line public.pos_sale_lines;
  v_qty integer;
  v_amount bigint;
  v_total bigint := 0;
  v_done jsonb := '[]'::jsonb;
  v_number bigint;
  v_left integer;
BEGIN
  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  PERFORM public.require_store_access(v_sale.store_id, 'operations', 'pos');
  IF COALESCE(p_idempotency_key, '') = '' THEN RAISE EXCEPTION 'A request key is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.pos_refunds WHERE store_id = v_sale.store_id AND idempotency_key = p_idempotency_key) THEN
    RETURN public.pos_sale_json(p_sale_id);
  END IF;
  IF v_sale.status IN ('voided', 'refunded') THEN RAISE EXCEPTION 'Nothing is left to refund on this sale'; END IF;

  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = p_shift_id AND store_id = v_sale.store_id;
  IF v_shift.id IS NULL OR v_shift.status <> 'open' THEN RAISE EXCEPTION 'Open a shift on this till to give a refund'; END IF;
  IF p_method NOT IN ('cash', 'card', 'eft') THEN RAISE EXCEPTION 'Choose how the money goes back: cash, card or EFT'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) = 0 THEN RAISE EXCEPTION 'Say why the sale is being refunded'; END IF;
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Choose what is being returned';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := COALESCE((v_item ->> 'quantity')::integer, 0);
    IF v_qty = 0 THEN CONTINUE; END IF;
    SELECT * INTO v_line FROM public.pos_sale_lines
     WHERE id = (v_item ->> 'line_id')::uuid AND sale_id = p_sale_id FOR UPDATE;
    IF v_line.id IS NULL THEN RAISE EXCEPTION 'That item is not on this sale'; END IF;
    v_left := v_line.quantity - v_line.refunded_quantity;
    IF v_qty < 0 OR v_qty > v_left THEN
      RAISE EXCEPTION 'Only % of % can still be refunded', v_left, v_line.name;
    END IF;
    v_amount := CASE WHEN v_qty = v_left THEN v_line.line_total_minor - v_line.refunded_minor
                     ELSE (v_line.line_total_minor * v_qty) / v_line.quantity END;
    UPDATE public.pos_sale_lines SET refunded_quantity = refunded_quantity + v_qty, refunded_minor = refunded_minor + v_amount
     WHERE id = v_line.id;
    IF COALESCE(p_restock, false) AND v_line.stock_tracked THEN
      PERFORM public.pos_move_stock(v_sale.store_id, v_line.product_id, v_line.variation_id, v_qty,
                                    'pos_refund', 'Refund on sale #' || v_sale.sale_number);
    END IF;
    v_total := v_total + v_amount;
    v_done := v_done || jsonb_build_object('line_id', v_line.id, 'name', v_line.name, 'quantity', v_qty, 'amount_minor', v_amount);
  END LOOP;

  IF jsonb_array_length(v_done) = 0 THEN RAISE EXCEPTION 'Choose what is being returned'; END IF;

  INSERT INTO public.pos_counters (store_id) VALUES (v_sale.store_id) ON CONFLICT (store_id) DO NOTHING;
  UPDATE public.pos_counters SET last_refund_number = last_refund_number + 1 WHERE store_id = v_sale.store_id
    RETURNING last_refund_number INTO v_number;

  INSERT INTO public.pos_refunds (store_id, sale_id, shift_id, refund_number, amount_minor, method, reason, restocked, lines,
                                  actor_user_id, idempotency_key)
  VALUES (v_sale.store_id, p_sale_id, p_shift_id, v_number, v_total, p_method, left(trim(p_reason), 200),
          COALESCE(p_restock, false), v_done, auth.uid(), p_idempotency_key);

  UPDATE public.pos_sales
     SET refunded_minor = refunded_minor + v_total,
         status = CASE WHEN NOT EXISTS (SELECT 1 FROM public.pos_sale_lines WHERE sale_id = p_sale_id AND refunded_quantity < quantity)
                       THEN 'refunded' ELSE 'partially_refunded' END
   WHERE id = p_sale_id;

  RETURN public.pos_sale_json(p_sale_id);
END;
$function$;

-- 8. Daily summary across every till -------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_day_summary(p_store_id uuid, p_day date DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day date := COALESCE(p_day, (now() AT TIME ZONE 'Africa/Johannesburg')::date);
BEGIN
  PERFORM public.require_store_access(p_store_id, 'insights', 'pos');
  RETURN (
    WITH sales AS (
      SELECT * FROM public.pos_sales
       WHERE store_id = p_store_id AND (created_at AT TIME ZONE 'Africa/Johannesburg')::date = v_day),
    live AS (SELECT * FROM sales WHERE status <> 'voided'),
    pays AS (SELECT p.* FROM public.pos_sale_payments p JOIN live s ON s.id = p.sale_id),
    refs AS (SELECT * FROM public.pos_refunds
              WHERE store_id = p_store_id AND (created_at AT TIME ZONE 'Africa/Johannesburg')::date = v_day),
    lines AS (SELECT l.* FROM public.pos_sale_lines l JOIN live s ON s.id = l.sale_id)
    SELECT jsonb_build_object(
      'day', v_day,
      'timezone', 'Africa/Johannesburg',
      'sales_count', (SELECT count(*) FROM live),
      'gross_minor', (SELECT COALESCE(sum(total_minor), 0) FROM live),
      'discount_minor', (SELECT COALESCE(sum(discount_minor), 0) FROM live),
      'vat_minor', (SELECT COALESCE(sum(vat_minor), 0) FROM live),
      'refunds_minor', (SELECT COALESCE(sum(amount_minor), 0) FROM refs),
      'refunds_count', (SELECT count(*) FROM refs),
      'net_minor', (SELECT COALESCE(sum(total_minor), 0) FROM live) - (SELECT COALESCE(sum(amount_minor), 0) FROM refs),
      'voids_count', (SELECT count(*) FROM sales WHERE status = 'voided'),
      'average_sale_minor', (SELECT COALESCE(round(avg(total_minor)), 0) FROM live),
      'items_sold', (SELECT COALESCE(sum(quantity), 0) FROM lines),
      'by_method', jsonb_build_object(
        'cash', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'cash'),
        'card', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'card'),
        'eft', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'eft'),
        'pay_1145', (SELECT COALESCE(sum(amount_minor), 0) FROM pays WHERE method = 'pay_1145')),
      'by_hour', COALESCE((SELECT jsonb_agg(jsonb_build_object('hour', h, 'total_minor', t, 'sales', n) ORDER BY h) FROM (
          SELECT extract(hour FROM created_at AT TIME ZONE 'Africa/Johannesburg')::int AS h, sum(total_minor) AS t, count(*) AS n
            FROM live GROUP BY 1) x), '[]'::jsonb),
      'top_items', COALESCE((SELECT jsonb_agg(t ORDER BY t.total_minor DESC) FROM (
          SELECT name, sum(quantity)::bigint AS quantity, sum(line_total_minor)::bigint AS total_minor
            FROM lines GROUP BY name ORDER BY total_minor DESC LIMIT 10) t), '[]'::jsonb),
      'shifts', COALESCE((SELECT jsonb_agg(public.pos_shift_totals(id) ORDER BY opened_at) FROM public.pos_shifts
                           WHERE store_id = p_store_id
                             AND (opened_at AT TIME ZONE 'Africa/Johannesburg')::date <= v_day
                             AND (closed_at IS NULL OR (closed_at AT TIME ZONE 'Africa/Johannesburg')::date >= v_day)), '[]'::jsonb)
    ));
END;
$function$;

-- 9. Grants ---------------------------------------------------------------------
DO $grants$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.pos_settings_get(uuid)',
    'public.pos_settings_set(uuid, boolean, text, text, text, integer, boolean)',
    'public.pos_catalog(uuid)',
    'public.pos_shift_current(uuid, text)',
    'public.pos_shift_open(uuid, text, bigint, text)',
    'public.pos_cash_movement(uuid, text, bigint, text, text)',
    'public.pos_shift_close(uuid, bigint, text)',
    'public.pos_shift_report(uuid)',
    'public.pos_shift_list(uuid, integer)',
    'public.pos_sale_create(uuid, uuid, jsonb, bigint, jsonb, text, text, text, text)',
    'public.pos_sale_get(uuid)',
    'public.pos_sales_list(uuid, date, text)',
    'public.pos_sale_void(uuid, text)',
    'public.pos_sale_refund(uuid, uuid, jsonb, text, text, boolean, text)',
    'public.pos_day_summary(uuid, date)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END;
$grants$;

NOTIFY pgrst, 'reload schema';
