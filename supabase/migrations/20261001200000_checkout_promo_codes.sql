-- Promo codes at checkout.
--
-- Vendors could already create codes (public.promotions), but checkout never
-- read them. payfast-payment now validates a code and prices the order with
-- it; these columns record what was applied. orders.total is already net of
-- the promo, so payfast-itn's amount check needs no change.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS promo_discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_ids uuid[] NOT NULL DEFAULT '{}';

-- Promo fields are money fields: server-controlled like the rest.
CREATE OR REPLACE FUNCTION public.guard_order_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.status := 'pending';
    NEW.ucoin_spent := 0;
    NEW.ucoin_value_zar := 0;
    NEW.promo_code := NULL;
    NEW.promo_discount := 0;
    NEW.promotion_ids := '{}';
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.total := OLD.total;
    NEW.payment_status := OLD.payment_status;
    NEW.ucoin_spent := OLD.ucoin_spent;
    NEW.ucoin_value_zar := OLD.ucoin_value_zar;
    NEW.promo_code := OLD.promo_code;
    NEW.promo_discount := OLD.promo_discount;
    NEW.promotion_ids := OLD.promotion_ids;
  END IF;
  RETURN NEW;
END; $$;

-- A use only counts once the order is paid (PayFast ITN or UCoin in full),
-- so abandoned checkouts don't eat into a code's usage limit.
CREATE OR REPLACE FUNCTION public.count_order_promo_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.promotions
     SET usage_count = COALESCE(usage_count, 0) + 1
   WHERE id = ANY (NEW.promotion_ids);
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.count_order_promo_usage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_count_order_promo_usage ON public.orders;
CREATE TRIGGER trg_count_order_promo_usage
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid'
        AND OLD.payment_status IS DISTINCT FROM 'paid'
        AND cardinality(NEW.promotion_ids) > 0)
  EXECUTE FUNCTION public.count_order_promo_usage();
