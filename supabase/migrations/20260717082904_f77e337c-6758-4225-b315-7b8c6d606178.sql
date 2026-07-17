
-- 1. driver_locations: restrict SELECT
DROP POLICY IF EXISTS "Users can view online drivers" ON public.driver_locations;

CREATE POLICY "Driver can view own location"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.driver_id = driver_locations.driver_id
      AND r.passenger_id = auth.uid()
      AND r.status IN ('accepted','arrived','in_progress','started')
  )
  OR EXISTS (
    SELECT 1 FROM public.delivery_jobs dj
    JOIN public.orders o ON o.id = dj.order_id
    WHERE dj.driver_id = driver_locations.driver_id
      AND o.user_id = auth.uid()
      AND dj.status IN ('accepted','picked_up','in_transit','arrived')
  )
);

-- 2. brand_bundle_products: drop overly broad SELECT
DROP POLICY IF EXISTS "Vendors view bundle products" ON public.brand_bundle_products;

CREATE POLICY "Vendors view own bundle products"
ON public.brand_bundle_products FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = brand_bundle_products.vendor_id AND v.user_id = auth.uid())
  OR public.is_admin(auth.uid())
);

-- 3. influencer_comments: restrict admin ALL policy to SELECT only
DROP POLICY IF EXISTS "Admins can view all comments" ON public.influencer_comments;

CREATE POLICY "Admins can view all comments"
ON public.influencer_comments FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- 4. user_referral_codes: remove public exposure, add validation RPC
DROP POLICY IF EXISTS "Anyone can view referral codes for validation" ON public.user_referral_codes;

CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_referral_codes
    WHERE code = p_code AND is_active = true
  );
$$;
REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- 5. Storage: remove broad SELECT that permits listing on public buckets.
-- Files remain accessible via public URLs because buckets are public.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Review images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view category images" ON storage.objects;

-- 6. Lock down internal/admin SECURITY DEFINER functions
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.update_updated_at_column()',
    'public.update_profiles_updated_at()',
    'public.update_wefullfil_product_variants_updated_at()',
    'public.update_wefullfil_products_updated_at()',
    'public.update_product_gold_price()',
    'public.trigger_ucoin_order_completed()',
    'public.handle_new_user()',
    'public.delete_vendor_cascade(uuid)',
    'public.reset_demo_data(text[])',
    'public.verify_mining_completion(uuid,boolean,uuid,text)',
    'public.process_referral_mining_bonus(uuid,uuid,integer)',
    'public.award_ucoin(uuid,text,uuid,text)',
    'public.award_user_badges(uuid)',
    'public.check_and_award_badges(uuid)',
    'public.evaluate_driver_tier(uuid)',
    'public.calculate_delivery_earnings(uuid,numeric,boolean,numeric)',
    'public.generate_api_key()',
    'public.generate_referral_code()',
    'public.score_driver_for_dispatch(uuid,numeric,numeric,text)',
    'public.calculate_zone_surge(uuid)',
    'public.check_vendor_upgrade_triggers(uuid)'
  ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
