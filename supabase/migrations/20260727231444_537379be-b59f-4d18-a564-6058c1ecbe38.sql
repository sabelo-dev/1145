
-- 1. profiles: prevent role escalation via trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change profile role';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- 2. auction_status_history: restrict insert
DROP POLICY IF EXISTS "Authenticated users can insert auction status history" ON public.auction_status_history;
CREATE POLICY "Vendors or admins insert auction status history" ON public.auction_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM auctions a
      JOIN products p ON a.product_id = p.id
      JOIN stores s ON p.store_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      WHERE a.id = auction_status_history.auction_id AND v.user_id = auth.uid()
    )
  );

-- 3. user_notifications: restrict insert to self or admins
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.user_notifications;
CREATE POLICY "Users insert own notifications" ON public.user_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- 4. auto_campaigns: add admin oversight
CREATE POLICY "Admins can view all auto campaigns" ON public.auto_campaigns
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. merchant_custom_domains: remove public SELECT, expose routing via SECURITY DEFINER function
DROP POLICY IF EXISTS "Anyone can read active domains for routing" ON public.merchant_custom_domains;

CREATE OR REPLACE FUNCTION public.resolve_custom_domain(p_domain text)
RETURNS TABLE(vendor_id uuid, store_id uuid, domain text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_id, store_id, domain
  FROM public.merchant_custom_domains
  WHERE domain = lower(p_domain) AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_custom_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_custom_domain(text) TO anon, authenticated;

-- 6. Storage: vendor-documents owner-only reads (bucket already flipped to private)
DROP POLICY IF EXISTS "Vendor documents: public read" ON storage.objects;
CREATE POLICY "Vendor documents: owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vendor-documents'
    AND (
      public.is_admin(auth.uid())
      OR public.is_vendor_owned_path((storage.foldername(name))[1], (storage.foldername(name))[2])
    )
  );

-- 7. Revoke EXECUTE from anon/authenticated on privileged & trigger definer functions
REVOKE EXECUTE ON FUNCTION public.delete_vendor_cascade(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_demo_data(text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_zone_fine(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_ucoin(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_purchase(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_signup(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_mining_bonus(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_mining_completion(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_mining_task_from_approved_source(uuid, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_driver_risk(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.evaluate_driver_tier(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_driver_for_dispatch(uuid, numeric, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_delivery_earnings(uuid, numeric, boolean, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_lease_credit_score(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_user_badges(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_trip_pin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.currency_to_mg_gold(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_wallet(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions: revoke EXECUTE (they run in trigger context)
REVOKE EXECUTE ON FUNCTION public.apply_subscription_tier_benefits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_dispatch_event_on_delivery_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_dispatch_event_on_ride_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_vendor_tier_downgrade() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auction_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auction_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_proxy_bids() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ucoin_delivery_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ucoin_order_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_ucoin_review_submitted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_auction_current_bid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_consumer_streak() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_product_gold_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profiles_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_wefullfil_product_variants_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_wefullfil_products_updated_at() FROM PUBLIC, anon, authenticated;
