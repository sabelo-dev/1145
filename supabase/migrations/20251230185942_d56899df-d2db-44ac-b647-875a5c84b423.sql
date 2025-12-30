-- Create function to notify on new order creation
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_email TEXT;
  customer_name TEXT;
  order_items_json JSONB;
  payload JSONB;
BEGIN
  -- Get customer email and name from profiles
  SELECT email, name INTO customer_email, customer_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get order items with store_id
  SELECT jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'quantity', oi.quantity,
    'price', oi.price,
    'store_id', oi.store_id
  )) INTO order_items_json
  FROM public.order_items oi
  WHERE oi.order_id = NEW.id;

  -- Build payload for edge function
  payload := jsonb_build_object(
    'orderId', NEW.id,
    'orderTotal', NEW.total,
    'customerName', COALESCE(customer_name, 'Customer'),
    'customerEmail', customer_email,
    'shippingAddress', NEW.shipping_address,
    'orderItems', COALESCE(order_items_json, '[]'::jsonb),
    'createdAt', NEW.created_at
  );

  -- Log the notification attempt
  RAISE LOG 'New order notification queued for order %', NEW.id;

  -- Call the edge function via pg_net (async HTTP call)
  PERFORM net.http_post(
    url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/send-new-order-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA'
    ),
    body := payload
  );

  RETURN NEW;
END;
$function$;

-- Create trigger for new orders
DROP TRIGGER IF EXISTS on_new_order_notify ON public.orders;
CREATE TRIGGER on_new_order_notify
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();