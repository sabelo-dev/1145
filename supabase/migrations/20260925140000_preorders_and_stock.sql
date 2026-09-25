-- Pre-orders for XIXLV products on the official Marketplace store, plus stock
-- that actually moves.
--
-- * products.brand: the label on the garment (e.g. 1145, XIXLV).
-- * stores.allow_preorders: only stores with this flag may sell out-of-stock
--   items as pre-orders. It is set for the official "marketplace" store and can
--   only be changed by admins / server code. Checkout only allows a pre-order
--   when the store has the flag AND the product brand is XIXLV.
-- * order_items.is_preorder marks lines bought while out of stock.
-- * apply_paid_order_stock() decrements stock once an order is paid (stock was
--   never reduced before, so items could be oversold indefinitely).
-- * The vendor "new order" alert now fires when an order is PAID, not when a
--   checkout is started (it used to email merchants about unpaid checkouts,
--   before any items were even attached).

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;

-- 1. Pre-order capability per store --------------------------------------------
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS allow_preorders boolean NOT NULL DEFAULT false;
UPDATE public.stores SET allow_preorders = true WHERE slug = 'marketplace';

CREATE OR REPLACE FUNCTION public.guard_store_preorder_flag()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.allow_preorders := false;
  ELSE
    NEW.allow_preorders := OLD.allow_preorders;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_store_preorder_flag ON public.stores;
CREATE TRIGGER trg_guard_store_preorder_flag
  BEFORE INSERT OR UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_preorder_flag();

-- 2. Mark pre-order lines ------------------------------------------------------
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false;

-- 3. Decrement stock when an order is paid ---------------------------------------
-- Pre-order lines were bought with no stock available, so they don't consume
-- units; restocked units then go to fulfilling them.
CREATE OR REPLACE FUNCTION public.apply_paid_order_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line record;
BEGIN
  FOR line IN
    SELECT product_id, variation_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id AND NOT is_preorder
  LOOP
    IF line.variation_id IS NOT NULL THEN
      UPDATE public.product_variations
      SET quantity = GREATEST(quantity - line.quantity, 0)
      WHERE id = line.variation_id;
    ELSE
      UPDATE public.products
      SET quantity = GREATEST(quantity - line.quantity, 0)
      WHERE id = line.product_id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_order_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_order_stock(uuid) TO service_role;

-- 4. Only alert vendors about paid orders ---------------------------------------
DROP TRIGGER IF EXISTS on_new_order_notify ON public.orders;
DROP TRIGGER IF EXISTS on_new_order_paid_notify ON public.orders;
DROP TRIGGER IF EXISTS on_order_paid_notify ON public.orders;

CREATE TRIGGER on_new_order_paid_notify
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid')
  EXECUTE FUNCTION public.notify_new_order();

CREATE TRIGGER on_order_paid_notify
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION public.notify_new_order();
