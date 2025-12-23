-- Allow anyone to view order status by tracking number
CREATE POLICY "Anyone can view order by tracking number"
ON public.orders
FOR SELECT
USING (tracking_number IS NOT NULL);