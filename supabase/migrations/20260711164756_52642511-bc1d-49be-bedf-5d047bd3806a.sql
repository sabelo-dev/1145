
-- 1. Orders tracking exposure
DROP POLICY IF EXISTS "Anyone can view order by tracking number" ON public.orders;

CREATE OR REPLACE FUNCTION public.get_order_by_tracking(p_tracking text)
RETURNS TABLE (
  id uuid, status text, total numeric, created_at timestamptz,
  tracking_number text, courier_company text, courier_name text,
  estimated_delivery text, shipping_city text, shipping_country text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.status::text, o.total, o.created_at, o.tracking_number,
    o.courier_company, o.courier_name,
    o.estimated_delivery::text,
    (o.shipping_address->>'city'), (o.shipping_address->>'country')
  FROM public.orders o
  WHERE o.tracking_number IS NOT NULL AND o.tracking_number = p_tracking
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_order_by_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking(text) TO anon, authenticated;

-- 2. Gold price cache
DROP POLICY IF EXISTS "Anyone can view gold prices" ON public.gold_price_cache;
CREATE POLICY "Anyone can view current gold price"
  ON public.gold_price_cache FOR SELECT USING (is_current = true);

-- 3. driver-vehicles ownership
DROP POLICY IF EXISTS "Drivers can upload their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can update their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Drivers can delete their own vehicle photos" ON storage.objects;
DROP POLICY IF EXISTS "Vehicle photos are publicly accessible" ON storage.objects;

CREATE POLICY "Drivers can upload their own vehicle photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-vehicles' AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1] AND d.user_id = auth.uid()));
CREATE POLICY "Drivers can update their own vehicle photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-vehicles' AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1] AND d.user_id = auth.uid()));
CREATE POLICY "Drivers can delete their own vehicle photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-vehicles' AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id::text = (storage.foldername(name))[1] AND d.user_id = auth.uid()));

-- 4. vendor-logos / banners / videos ownership
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete banners" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vendor banners" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vendor logos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload vendor videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own vendor videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own vendor videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view vendor videos" ON storage.objects;

CREATE OR REPLACE FUNCTION public.is_vendor_owned_path(p_first_segment text, p_second_segment text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_first_segment = auth.uid()::text
    OR p_second_segment = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.vendors v
      WHERE v.id::text = p_first_segment AND v.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_vendor_owned_path(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_vendor_owned_path(text, text) TO authenticated;

CREATE POLICY "Vendor logos: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor logos: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor logos: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-logos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor banners: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor banners: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor banners: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-banners' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor videos: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor videos: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));
CREATE POLICY "Vendor videos: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vendor-videos' AND public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2]));

-- 5. product-images ownership
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete their product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to product images" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_write_product_image(p_first_segment text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (p_first_segment IN ('attribute-images', 'variation-images')
      AND EXISTS (SELECT 1 FROM public.vendors v WHERE v.user_id = auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      JOIN public.vendors v ON v.id = s.vendor_id
      WHERE p.id::text = p_first_segment AND v.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_write_product_image(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_product_image(text) TO authenticated;

CREATE POLICY "Product images: owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.can_write_product_image((storage.foldername(name))[1]));
CREATE POLICY "Product images: owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.can_write_product_image((storage.foldername(name))[1]));
CREATE POLICY "Product images: owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.can_write_product_image((storage.foldername(name))[1]));

-- 6. Always-true system policies
DROP POLICY IF EXISTS "System inserts violations" ON public.zone_violations;
DROP POLICY IF EXISTS "System can insert order history" ON public.order_history;
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
DROP POLICY IF EXISTS "System can manage streaks" ON public.consumer_streaks;
DROP POLICY IF EXISTS "System can award badges" ON public.consumer_badges;
DROP POLICY IF EXISTS "System inserts fines" ON public.zone_fines;
DROP POLICY IF EXISTS "System creates PINs" ON public.trip_pins;
DROP POLICY IF EXISTS "System updates PINs" ON public.trip_pins;
DROP POLICY IF EXISTS "System inserts audit log" ON public.compliance_audit_log;
DROP POLICY IF EXISTS "Service role can insert metrics" ON public.social_post_metrics;
DROP POLICY IF EXISTS "Authenticated insert dispatch events" ON public.dispatch_events;

-- safety_alerts: caller must be the passenger/driver on the ride
DROP POLICY IF EXISTS "Anyone can create alerts" ON public.safety_alerts;
CREATE POLICY "Users create alerts on their own ride"
  ON public.safety_alerts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = safety_alerts.ride_id
        AND (r.passenger_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = r.driver_id AND d.user_id = auth.uid()))
    )
  );

-- 7. Revoke EXECUTE on trigger-only SECURITY DEFINER functions
DO $$
DECLARE
  f text;
  fns text[] := ARRAY[
    'public.update_updated_at_column()',
    'public.update_profiles_updated_at()',
    'public.update_wefullfil_product_variants_updated_at()',
    'public.update_wefullfil_products_updated_at()',
    'public.log_order_change()',
    'public.log_auction_status_change()',
    'public.log_auction_creation()',
    'public.notify_order_status_change()',
    'public.notify_new_order()',
    'public.handle_new_user()',
    'public.handle_vendor_tier_downgrade()',
    'public.process_proxy_bids()',
    'public.update_auction_current_bid()',
    'public.trigger_ucoin_order_completed()',
    'public.trigger_ucoin_review_submitted()',
    'public.trigger_ucoin_delivery_completed()',
    'public.apply_subscription_tier_benefits()',
    'public.update_consumer_streak()',
    'public.auto_dispatch_event_on_delivery_change()',
    'public.auto_dispatch_event_on_ride_change()'
  ];
BEGIN
  FOREACH f IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
