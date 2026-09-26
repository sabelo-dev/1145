ALTER TABLE public.dropship_listings
  ADD COLUMN IF NOT EXISTS auto_unpublished_out_of_stock boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.dropship_auto_stock_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock IS NOT DISTINCT FROM OLD.stock THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.stock, 0) <= 0 THEN
    UPDATE public.products p
      SET status = 'inactive'
      FROM public.dropship_listings dl
      WHERE dl.dropship_product_id = NEW.id
        AND dl.product_id = p.id
        AND dl.status = 'published';

    UPDATE public.dropship_listings
      SET status = 'unpublished', auto_unpublished_out_of_stock = true
      WHERE dropship_product_id = NEW.id
        AND status = 'published';
  ELSE
    UPDATE public.products p
      SET status = 'approved'
      FROM public.dropship_listings dl
      WHERE dl.dropship_product_id = NEW.id
        AND dl.product_id = p.id
        AND dl.auto_unpublished_out_of_stock = true;

    UPDATE public.dropship_listings
      SET status = 'published', auto_unpublished_out_of_stock = false
      WHERE dropship_product_id = NEW.id
        AND auto_unpublished_out_of_stock = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dropship_auto_stock_visibility ON public.dropship_products;
CREATE TRIGGER trg_dropship_auto_stock_visibility
AFTER UPDATE OF stock ON public.dropship_products
FOR EACH ROW EXECUTE FUNCTION public.dropship_auto_stock_visibility();

DROP VIEW IF EXISTS public.dropship_public_products;
CREATE VIEW public.dropship_public_products AS
SELECT p.id,
       p.name,
       p.description,
       p.images,
       p.category,
       p.stock,
       COALESCE(l.selling_price, p.recommended_price_zar) AS price_zar,
       l.product_id AS store_product_id,
       p.status,
       p.created_at,
       p.updated_at
FROM public.dropship_products p
LEFT JOIN LATERAL (
  SELECT dl.selling_price, dl.product_id
  FROM public.dropship_listings dl
  WHERE dl.dropship_product_id = p.id
    AND dl.status = 'published'
    AND dl.product_id IS NOT NULL
  ORDER BY dl.selling_price ASC NULLS LAST
  LIMIT 1
) l ON TRUE
WHERE p.status IN ('approved','published');

GRANT SELECT ON public.dropship_public_products TO anon, authenticated;

-- Apply current stock levels to existing listings
UPDATE public.dropship_listings dl
  SET status = 'unpublished', auto_unpublished_out_of_stock = true
  FROM public.dropship_products dp
  WHERE dp.id = dl.dropship_product_id
    AND COALESCE(dp.stock, 0) <= 0
    AND dl.status = 'published';

UPDATE public.products p
  SET status = 'inactive'
  FROM public.dropship_listings dl
  WHERE dl.product_id = p.id
    AND dl.auto_unpublished_out_of_stock = true;