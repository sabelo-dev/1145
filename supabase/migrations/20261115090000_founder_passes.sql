-- Founders Pass.
--
-- A limited, numbered, once-off membership ("Founder No. 214 of 1,000").
-- The founder-pass function starts a PayFast payment; payfast-itn confirms it
-- and calls founder_pass_complete, which hands out the next number. Numbers
-- are only assigned on a confirmed payment and are never reused.

-- One row of settings, so the price, the cap and the on/off switch can be
-- changed without a deploy. next_number only ever goes up.
CREATE TABLE IF NOT EXISTS public.founder_pass_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  price numeric(10, 2) NOT NULL DEFAULT 99 CHECK (price >= 5), -- PayFast's minimum payment
  total integer NOT NULL DEFAULT 1000 CHECK (total > 0),
  next_number integer NOT NULL DEFAULT 1 CHECK (next_number >= 1),
  valid_months integer NOT NULL DEFAULT 12 CHECK (valid_months > 0),
  is_open boolean NOT NULL DEFAULT false, -- closed until you are ready to sell
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.founder_pass_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.founder_pass_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refund_due', 'refunded')),
  source text, -- which poster or link the buyer came from
  payfast_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_pass_orders_user ON public.founder_pass_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_founder_pass_orders_pending ON public.founder_pass_orders (created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.founder_passes (
  pass_number integer PRIMARY KEY CHECK (pass_number >= 1),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.founder_pass_orders(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.founder_pass_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_pass_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_passes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage founder pass settings" ON public.founder_pass_settings;
CREATE POLICY "Admins manage founder pass settings"
  ON public.founder_pass_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Orders and passes are written by the payment functions only.
DROP POLICY IF EXISTS "Users see own founder pass orders" ON public.founder_pass_orders;
CREATE POLICY "Users see own founder pass orders"
  ON public.founder_pass_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users see own founder pass" ON public.founder_passes;
CREATE POLICY "Users see own founder pass"
  ON public.founder_passes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- The public "X of 1,000 left" counter. Exposes counts and the price only.
CREATE OR REPLACE FUNCTION public.founder_pass_availability()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'price', s.price,
    'total', s.total,
    'claimed', s.next_number - 1,
    'remaining', greatest(s.total - (s.next_number - 1), 0),
    'is_open', s.is_open,
    'valid_months', s.valid_months)
  FROM public.founder_pass_settings s;
$function$;

GRANT EXECUTE ON FUNCTION public.founder_pass_availability() TO anon, authenticated;

-- Starts (or resumes) a purchase for a user. The price comes from settings,
-- never from the request. Passes that someone is busy paying for (pending
-- orders from the last 15 minutes) are held back, so the last few numbers are
-- not oversold.
CREATE OR REPLACE FUNCTION public.founder_pass_start(p_user_id uuid, p_source text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings public.founder_pass_settings;
  v_order public.founder_pass_orders;
  v_held integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.founder_passes WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object('outcome', 'already_member');
  END IF;

  SELECT * INTO v_settings FROM public.founder_pass_settings FOR UPDATE;
  IF NOT v_settings.is_open THEN
    RETURN jsonb_build_object('outcome', 'closed');
  END IF;

  -- Paying again within 15 minutes continues the same order.
  SELECT * INTO v_order FROM public.founder_pass_orders
   WHERE user_id = p_user_id AND status = 'pending'
     AND amount = v_settings.price
     AND created_at > now() - interval '15 minutes'
   ORDER BY created_at DESC LIMIT 1;
  IF v_order.id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'ok', 'order_id', v_order.id, 'amount', v_order.amount);
  END IF;

  SELECT count(*) INTO v_held FROM public.founder_pass_orders
   WHERE status = 'pending' AND created_at > now() - interval '15 minutes';
  IF (v_settings.next_number - 1) + v_held >= v_settings.total THEN
    RETURN jsonb_build_object('outcome', 'sold_out');
  END IF;

  INSERT INTO public.founder_pass_orders (user_id, amount, source)
  VALUES (p_user_id, v_settings.price, nullif(left(coalesce(p_source, ''), 100), ''))
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('outcome', 'ok', 'order_id', v_order.id, 'amount', v_order.amount);
END;
$function$;

-- Confirms a paid order and assigns the next founder number. Safe to call
-- again for a repeated payment notification. Returns what happened.
-- 'refund_due' means the money arrived but no pass could be issued (sold out,
-- or the user already has one): refund it from the PayFast dashboard, then set
-- the order's status to 'refunded'.
CREATE OR REPLACE FUNCTION public.founder_pass_complete(
  p_order_id uuid, p_payfast_payment_id text, p_amount numeric)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.founder_pass_orders;
  v_settings public.founder_pass_settings;
  v_number integer;
BEGIN
  SELECT * INTO v_order FROM public.founder_pass_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RETURN 'not_found'; END IF;
  IF v_order.status IN ('completed', 'refund_due', 'refunded') THEN RETURN 'already_' || v_order.status; END IF;
  IF round(p_amount * 100) <> round(v_order.amount * 100) THEN RETURN 'amount_mismatch'; END IF;

  -- One number at a time: everyone confirming a payment waits on this row.
  SELECT * INTO v_settings FROM public.founder_pass_settings FOR UPDATE;

  IF v_settings.next_number > v_settings.total
     OR EXISTS (SELECT 1 FROM public.founder_passes WHERE user_id = v_order.user_id) THEN
    UPDATE public.founder_pass_orders
      SET status = 'refund_due', payfast_payment_id = p_payfast_payment_id, paid_at = now()
    WHERE id = p_order_id;
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_order.user_id, 'founder_pass_refund', 'Founders Pass refund',
            'Your payment arrived, but no Founders Pass could be issued. We will refund you in full.',
            jsonb_build_object('url', '/founders'));
    RETURN 'refund_due';
  END IF;

  v_number := v_settings.next_number;

  INSERT INTO public.founder_passes (pass_number, user_id, order_id, expires_at)
  VALUES (v_number, v_order.user_id, v_order.id, now() + make_interval(months => v_settings.valid_months));

  UPDATE public.founder_pass_settings SET next_number = v_number + 1, updated_at = now();

  UPDATE public.founder_pass_orders
    SET status = 'completed', payfast_payment_id = p_payfast_payment_id, paid_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_order.user_id, 'founder_pass_claimed', 'You are Founder No. ' || v_number,
          'Your Founders Pass is active. You are number ' || v_number || ' of ' || v_settings.total || '.',
          jsonb_build_object('url', '/founders'));

  RETURN 'completed';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.founder_pass_start(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founder_pass_start(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.founder_pass_complete(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founder_pass_complete(uuid, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
