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