-- Merchants may only change the fulfilment step of their order lines.
--
-- The policy "Vendors can update order items from their stores" lets a
-- merchant update any column of their own lines. merchant_payout_balance()
-- adds up order_items.price x quantity, so raising the price of a delivered
-- line through the API would raise the merchant's withdrawable balance.
--
-- The dashboard only ever changes merchant_status. From the API roles (anon,
-- authenticated) this trigger allows exactly that, plus updated_at; admins and
-- database functions (which run as their owner) are not limited.

CREATE OR REPLACE FUNCTION public.guard_order_item_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - 'merchant_status' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'merchant_status' - 'updated_at') THEN
    RAISE EXCEPTION 'Only the fulfilment status of an order item can be changed' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_order_item_edits ON public.order_items;
CREATE TRIGGER guard_order_item_edits
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_item_edits();
