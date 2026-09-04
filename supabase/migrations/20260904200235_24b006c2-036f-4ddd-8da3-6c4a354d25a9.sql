CREATE OR REPLACE VIEW public.dropship_public_products AS
SELECT p.id,
       p.name,
       p.description,
       p.images,
       p.category,
       p.stock,
       p.recommended_price_zar AS price_zar,
       p.status,
       p.created_at,
       p.updated_at
FROM public.dropship_products p
WHERE p.status IN ('approved','published');

CREATE OR REPLACE VIEW public.dropship_public_variants AS
SELECT v.id,
       v.dropship_product_id,
       v.name,
       v.sku,
       v.attributes,
       v.image_url,
       v.stock,
       v.recommended_price_zar AS price_zar
FROM public.dropship_variants v
JOIN public.dropship_products p ON p.id = v.dropship_product_id
WHERE p.status IN ('approved','published');

GRANT SELECT ON public.dropship_public_products TO anon, authenticated;
GRANT SELECT ON public.dropship_public_variants TO anon, authenticated;