ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.dropship_fulfillments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_jobs_fulfillment_id_key
  ON public.delivery_jobs (fulfillment_id) WHERE fulfillment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_jobs_order_id_key
  ON public.delivery_jobs (order_id) WHERE order_id IS NOT NULL;

DROP POLICY IF EXISTS "Customers view delivery jobs for their orders" ON public.delivery_jobs;
CREATE POLICY "Customers view delivery jobs for their orders"
ON public.delivery_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = delivery_jobs.order_id AND o.user_id = auth.uid()
  )
);