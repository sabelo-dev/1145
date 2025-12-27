-- Create a function to trigger order status email notifications
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  customer_email TEXT;
  customer_name TEXT;
  payload JSONB;
BEGIN
  -- Only trigger on status changes (not on other updates)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get customer email and name from profiles
    SELECT email, name INTO customer_email, customer_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Only send email for specific status changes
    IF NEW.status IN ('processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled') THEN
      -- Build payload for edge function
      payload := jsonb_build_object(
        'orderId', NEW.id,
        'newStatus', NEW.status,
        'customerEmail', customer_email,
        'customerName', COALESCE(customer_name, 'Valued Customer'),
        'trackingNumber', NEW.tracking_number,
        'courierCompany', NEW.courier_company,
        'estimatedDelivery', NEW.estimated_delivery,
        'siteUrl', 'https://hipomusjocacncjsvgfa.lovableproject.com'
      );

      -- Log the notification attempt
      RAISE LOG 'Order status email notification queued for order % with status %', NEW.id, NEW.status;

      -- Call the edge function via pg_net (async HTTP call)
      PERFORM net.http_post(
        url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/send-order-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA'
        ),
        body := payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();

-- Add a comment for documentation
COMMENT ON FUNCTION public.notify_order_status_change() IS 'Sends email notification to customer when order status changes';