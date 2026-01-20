-- Admin-only safe reset of demo data (public tables only). Does NOT touch auth.*

CREATE OR REPLACE FUNCTION public.reset_demo_data(p_scopes text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_scopes IS NULL OR array_length(p_scopes, 1) IS NULL THEN
    RAISE EXCEPTION 'scopes_required';
  END IF;

  -- Auctions
  IF 'auctions' = ANY(p_scopes) THEN
    DELETE FROM public.auction_bids;
    DELETE FROM public.auction_registrations;
    DELETE FROM public.auction_status_history;
    DELETE FROM public.auction_watchlist;
    DELETE FROM public.proxy_bids;
    DELETE FROM public.auctions;

    v_result := v_result || jsonb_build_object('auctions', true);
  END IF;

  -- Orders
  IF 'orders' = ANY(p_scopes) THEN
    DELETE FROM public.order_history;
    DELETE FROM public.order_insurance;
    DELETE FROM public.order_items;
    DELETE FROM public.delivery_tips;
    DELETE FROM public.delivery_earnings;
    DELETE FROM public.delivery_jobs;
    DELETE FROM public.orders;

    v_result := v_result || jsonb_build_object('orders', true);
  END IF;

  -- Products & store catalog
  IF 'products' = ANY(p_scopes) THEN
    DELETE FROM public.variation_images;
    DELETE FROM public.product_variations;
    DELETE FROM public.product_images;
    DELETE FROM public.downloadable_files;
    DELETE FROM public.collection_products;
    DELETE FROM public.reviews;
    DELETE FROM public.wishlists;
    DELETE FROM public.products;
    DELETE FROM public.collections;

    -- Store/category catalog tied to products
    DELETE FROM public.store_categories;
    DELETE FROM public.stores;

    v_result := v_result || jsonb_build_object('products', true);
  END IF;

  RETURN v_result;
END;
$$;

-- Lock down execution: only authenticated users can call it (and the function checks admin role).
REVOKE ALL ON FUNCTION public.reset_demo_data(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_data(text[]) TO authenticated;