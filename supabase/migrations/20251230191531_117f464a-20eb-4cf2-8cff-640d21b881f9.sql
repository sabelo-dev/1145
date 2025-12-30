-- Drop existing trigger if it exists and recreate with new name
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP TRIGGER IF EXISTS on_order_status_change_notify ON public.orders;

-- Create trigger for order status changes with unique name
CREATE TRIGGER on_order_status_change_notify_user
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_status_change();