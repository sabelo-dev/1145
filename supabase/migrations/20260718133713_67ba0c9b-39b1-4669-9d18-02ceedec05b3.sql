
CREATE OR REPLACE FUNCTION public.can_write_product_image(p_first_segment text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- Shared vendor asset folders
    (p_first_segment IN ('attribute-images', 'variation-images', 'downloadable-files')
      AND EXISTS (SELECT 1 FROM public.vendors v WHERE v.user_id = auth.uid()))
    -- Vendor uploading under their vendor.id folder (e.g. onboarding first product)
    OR EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id::text = p_first_segment AND v.user_id = auth.uid()
    )
    -- Product-scoped folder (product.id)
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      JOIN public.vendors v ON v.id = s.vendor_id
      WHERE p.id::text = p_first_segment AND v.user_id = auth.uid()
    );
$function$;
