
-- Fix the overly permissive ALL policy on store_featured_products
DROP POLICY "Vendors can manage their featured products" ON public.store_featured_products;

CREATE POLICY "Vendors can insert featured products"
ON public.store_featured_products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update featured products"
ON public.store_featured_products FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can delete featured products"
ON public.store_featured_products FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);
