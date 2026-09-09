
-- 1. Order event timeline -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text,
  title text NOT NULL,
  description text,
  actor text NOT NULL DEFAULT 'system',
  location jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON public.order_events(order_id, created_at DESC);
GRANT SELECT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their order events" ON public.order_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins manage order events" ON public.order_events FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 2. Notification log ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL,
  provider text NOT NULL DEFAULT 'infobip',
  recipient text NOT NULL,
  template text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_log_order_idx ON public.notification_log(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_status_idx ON public.notification_log(status, created_at DESC);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their notifications" ON public.notification_log FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Admins manage notification log" ON public.notification_log FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 3. Payment attempts ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  gateway text NOT NULL,
  method text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'initiated',
  reference text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_payment_attempts_order_idx ON public.order_payment_attempts(order_id, created_at DESC);
GRANT SELECT, INSERT ON public.order_payment_attempts TO authenticated;
GRANT ALL ON public.order_payment_attempts TO service_role;
ALTER TABLE public.order_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payment attempts" ON public.order_payment_attempts FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Users log own payment attempts" ON public.order_payment_attempts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage payment attempts" ON public.order_payment_attempts FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER order_payment_attempts_updated_at BEFORE UPDATE ON public.order_payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. UCoin on orders -----------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ucoin_spent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ucoin_value_zar numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_gateway text;

-- 5. UCoin cash-out requests --------------------------------------------
CREATE TABLE IF NOT EXISTS public.ucoin_cashouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ucoin_amount integer NOT NULL,
  zar_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  destination text,
  admin_note text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ucoin_cashouts TO authenticated;
GRANT ALL ON public.ucoin_cashouts TO service_role;
ALTER TABLE public.ucoin_cashouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own cashouts" ON public.ucoin_cashouts FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Admins manage cashouts" ON public.ucoin_cashouts FOR ALL TO authenticated
USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER ucoin_cashouts_updated_at BEFORE UPDATE ON public.ucoin_cashouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Auto timeline entry on order status change --------------------------
CREATE OR REPLACE FUNCTION public.log_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, event_type, status, title, description, metadata)
    VALUES (NEW.id, 'order_placed', NEW.status, 'Order placed',
            'We received your order and are preparing it.',
            jsonb_build_object('total', NEW.total, 'payment_status', NEW.payment_status));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, event_type, status, title, description)
    VALUES (NEW.id, 'status_changed', NEW.status,
            initcap(replace(NEW.status, '_', ' ')),
            format('Your order is now %s.', replace(NEW.status, '_', ' ')));
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_events (order_id, event_type, status, title, description, metadata)
    VALUES (NEW.id, 'payment_' || NEW.payment_status, NEW.status,
            format('Payment %s', NEW.payment_status),
            format('Payment for this order is %s.', NEW.payment_status),
            jsonb_build_object('gateway', NEW.payment_gateway, 'total', NEW.total));
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number AND NEW.tracking_number IS NOT NULL THEN
    INSERT INTO public.order_events (order_id, event_type, status, title, description, metadata)
    VALUES (NEW.id, 'tracking_added', NEW.status, 'Tracking available',
            'A tracking number was added to your order.',
            jsonb_build_object('tracking_number', NEW.tracking_number, 'tracking_url', NEW.tracking_url));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_event_log ON public.orders;
CREATE TRIGGER orders_event_log
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_event();

-- 7. Pay with UCoin ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_ucoin_for_order(p_order_id uuid, p_ucoin integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet RECORD;
  v_order RECORD;
  v_rate numeric := 0.10;
  v_value numeric;
  v_max_ucoin integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in.');
  END IF;
  IF p_ucoin IS NULL OR p_ucoin <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enter how much UCoin to use.');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found.');
  END IF;
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This order is already paid.');
  END IF;

  SELECT * INTO v_wallet FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No UCoin wallet found.');
  END IF;

  v_max_ucoin := LEAST(v_wallet.balance, FLOOR(GREATEST(v_order.total - v_order.ucoin_value_zar, 0) / v_rate));
  IF p_ucoin > v_max_ucoin THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('You can use at most %s UCoin on this order.', v_max_ucoin), 'max_ucoin', v_max_ucoin);
  END IF;

  v_value := ROUND(p_ucoin * v_rate, 2);

  UPDATE public.ucoin_wallets
  SET balance = balance - p_ucoin,
      lifetime_spent = COALESCE(lifetime_spent, 0) + p_ucoin,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description, reference_id, reference_type)
  VALUES (v_user, p_ucoin, 'spend', 'marketplace_purchase',
          format('Paid R%s of order with UCoin', to_char(v_value, 'FM999999990.00')),
          p_order_id::text, 'order');

  UPDATE public.orders
  SET ucoin_spent = ucoin_spent + p_ucoin,
      ucoin_value_zar = ucoin_value_zar + v_value,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, event_type, status, title, description, metadata)
  VALUES (p_order_id, 'ucoin_applied', v_order.status, 'UCoin applied',
          format('%s UCoin (R%s) was used towards this order.', p_ucoin, to_char(v_value, 'FM999999990.00')),
          jsonb_build_object('ucoin', p_ucoin, 'zar', v_value));

  RETURN jsonb_build_object('success', true, 'ucoin', p_ucoin, 'zar_value', v_value,
                            'remaining_due', GREATEST(v_order.total - v_order.ucoin_value_zar - v_value, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_ucoin_for_order(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.redeem_ucoin_for_order(uuid, integer) TO authenticated;

-- 8. Request a UCoin cash-out -------------------------------------------
CREATE OR REPLACE FUNCTION public.request_ucoin_cashout(p_ucoin integer, p_destination text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_wallet RECORD;
  v_rate numeric := 0.10;
  v_zar numeric;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be signed in.');
  END IF;
  IF p_ucoin IS NULL OR p_ucoin < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'The smallest cash-out is 500 UCoin.');
  END IF;

  SELECT * INTO v_wallet FROM public.ucoin_wallets WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_ucoin THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have enough UCoin.');
  END IF;

  v_zar := ROUND(p_ucoin * v_rate, 2);

  UPDATE public.ucoin_wallets
  SET balance = balance - p_ucoin,
      lifetime_spent = COALESCE(lifetime_spent, 0) + p_ucoin,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.ucoin_transactions (user_id, amount, type, category, description)
  VALUES (v_user, p_ucoin, 'spend', 'cashout_request',
          format('Cash-out request for R%s', to_char(v_zar, 'FM999999990.00')));

  INSERT INTO public.ucoin_cashouts (user_id, ucoin_amount, zar_amount, destination)
  VALUES (v_user, p_ucoin, v_zar, p_destination)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'cashout_id', v_id, 'zar_amount', v_zar);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_ucoin_cashout(integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_ucoin_cashout(integer, text) TO authenticated;
