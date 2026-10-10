-- Rename "vendor" to "merchant" throughout the database.
--
-- Generated from the live catalog on 2026-10-10 (the function bodies below are
-- the live definitions with the names swapped). There is NO compatibility
-- layer: the old table, column, function and role names stop existing, so the
-- web app, the edge functions and the mobile apps must all be on a build that
-- uses the new names.
--
-- Not renamed: the storage buckets vendor-logos / vendor-banners /
-- vendor-videos / vendor-documents, and the storage policies named after them
-- (storage.objects is owned by Supabase, so its policies cannot be renamed).
-- The bucket ids are part of every stored image and document URL.
--
-- Run in a single transaction, after 20261010090000_restaurateur_role_enum
-- and before 20261010090100_restaurateur_role.

-- 1. Role and ledger enum values. Policies that compare against them follow.
ALTER TYPE public.app_role RENAME VALUE 'vendor' TO 'merchant';
ALTER TYPE public.ledger_type RENAME VALUE 'vendor_payout' TO 'merchant_payout';

-- 2. Tables, columns, constraints, indexes, triggers and policies.
--    Pure renames: data, foreign keys, grants and policy expressions follow.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', r.relname, replace(r.relname, 'vendor', 'merchant'));
  END LOOP;

  FOR r IN SELECT c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
             AND a.attnum > 0 AND NOT a.attisdropped AND a.attname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.relname, r.attname, replace(r.attname, 'vendor', 'merchant'));
  END LOOP;

  -- Renaming a primary key or unique constraint renames its index too.
  FOR r IN SELECT c.relname, k.conname FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
           WHERE c.relnamespace = 'public'::regnamespace AND k.conname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', r.relname, r.conname, replace(r.conname, 'vendor', 'merchant'));
  END LOOP;

  FOR r IN SELECT c.relname FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'i' AND c.relname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER INDEX public.%I RENAME TO %I', r.relname, replace(r.relname, 'vendor', 'merchant'));
  END LOOP;

  FOR r IN SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal AND t.tgname LIKE '%vendor%' LOOP
    EXECUTE format('ALTER TRIGGER %I ON public.%I RENAME TO %I', r.tgname, r.relname, replace(r.tgname, 'vendor', 'merchant'));
  END LOOP;

  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND policyname ILIKE '%vendor%' LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I RENAME TO %I', r.policyname, r.schemaname, r.tablename,
      replace(replace(r.policyname, 'vendor', 'merchant'), 'Vendor', 'Merchant'));
  END LOOP;
END $$;

-- 3. Functions. Renamed in place where only the name changes (policies and
--    triggers keep pointing at them); dropped and recreated where a parameter
--    name changes, which CREATE OR REPLACE cannot do. None of the dropped
--    functions is used by a policy or trigger.
ALTER FUNCTION public.assign_vendor_role_on_vendor_insert() RENAME TO assign_merchant_role_on_merchant_insert;
DROP FUNCTION public.can_vendor_add_product(p_vendor_id uuid);
DROP FUNCTION public.can_vendor_create_promotion(p_vendor_id uuid);
DROP FUNCTION public.check_vendor_upgrade_triggers(p_vendor_id uuid);
DROP FUNCTION public.delete_vendor_cascade(vendor_uuid uuid);
DROP FUNCTION public.get_vendor_features(vendor_id uuid);
DROP FUNCTION public.get_vendor_tier_config(p_vendor_id uuid);
ALTER FUNCTION public.guard_vendor_bank_details() RENAME TO guard_merchant_bank_details;
ALTER FUNCTION public.handle_vendor_tier_downgrade() RENAME TO handle_merchant_tier_downgrade;
DROP FUNCTION public.is_trial_expired(vendor_id uuid);
ALTER FUNCTION public.is_vendor(_user_id uuid) RENAME TO is_merchant;
ALTER FUNCTION public.is_vendor_owned_path(p_first_segment text, p_second_segment text) RENAME TO is_merchant_owned_path;
DROP FUNCTION public.resolve_custom_domain(p_domain text);
DROP FUNCTION public.uc_merchant_milestones(p_vendor_id uuid);

CREATE OR REPLACE FUNCTION public.assign_merchant_role_on_merchant_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'merchant'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_lease_agreement(p_contract_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.lease_contracts lc
    LEFT JOIN public.leaseable_assets la ON la.id = lc.asset_id
    LEFT JOIN public.merchants v ON v.id = la.provider_id
    WHERE lc.id = p_contract_id
      AND (
        lc.user_id = auth.uid()
        OR v.user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_merchant_add_product(p_merchant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_product_count INTEGER;
  v_max_products INTEGER;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.merchants WHERE id = p_merchant_id;

  IF v_tier = 'gold' THEN
    RETURN true; -- unlimited
  END IF;

  v_max_products := CASE v_tier
    WHEN 'silver' THEN 300
    WHEN 'bronze' THEN 100
    ELSE 25
  END;

  SELECT COUNT(*) INTO v_product_count
  FROM public.products p
  JOIN public.stores s ON p.store_id = s.id
  WHERE s.merchant_id = p_merchant_id
    AND p.status != 'deleted';

  RETURN v_product_count < v_max_products;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_merchant_create_promotion(p_merchant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_promo_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.merchants WHERE id = p_merchant_id;

  IF v_tier = 'gold' THEN
    RETURN true; -- unlimited
  END IF;

  v_limit := CASE v_tier
    WHEN 'silver' THEN 20
    WHEN 'bronze' THEN 5
    ELSE 1
  END;

  SELECT COUNT(*) INTO v_promo_count
  FROM public.promotions p
  JOIN public.stores s ON p.store_id = s.id
  WHERE s.merchant_id = p_merchant_id
    AND p.created_at >= date_trunc('month', now());

  RETURN v_promo_count < v_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_write_product_image(p_first_segment text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- Shared merchant asset folders
    (p_first_segment IN ('attribute-images', 'variation-images', 'downloadable-files')
      AND EXISTS (SELECT 1 FROM public.merchants v WHERE v.user_id = auth.uid()))
    -- Merchant uploading under their merchant.id folder (e.g. onboarding first product)
    OR EXISTS (
      SELECT 1 FROM public.merchants v
      WHERE v.id::text = p_first_segment AND v.user_id = auth.uid()
    )
    -- Product-scoped folder (product.id)
    OR EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      JOIN public.merchants v ON v.id = s.merchant_id
      WHERE p.id::text = p_first_segment AND v.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  badge_record RECORD;
  user_stats RECORD;
  badges_awarded INTEGER := 0;
BEGIN
  -- Gather user statistics
  SELECT 
    COALESCE((SELECT COUNT(*) FROM orders WHERE user_id = p_user_id AND status IN ('delivered', 'completed')), 0) as order_count,
    COALESCE((SELECT SUM(total) FROM orders WHERE user_id = p_user_id AND status IN ('delivered', 'completed')), 0) as total_spent,
    COALESCE((SELECT current_streak FROM consumer_streaks WHERE user_id = p_user_id), 0) as current_streak,
    COALESCE((SELECT COUNT(*) FROM referrals WHERE referrer_id = p_user_id AND status = 'completed'), 0) as referral_count,
    COALESCE((SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id), 0) as review_count,
    COALESCE((SELECT COUNT(DISTINCT oi.store_id) FROM orders o JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = p_user_id AND o.status IN ('delivered', 'completed')), 0) as unique_merchants
  INTO user_stats;
  
  -- Check each badge
  FOR badge_record IN SELECT * FROM badge_definitions WHERE is_active = true LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM consumer_badges WHERE user_id = p_user_id AND badge_id = badge_record.id) THEN
      CONTINUE;
    END IF;
    
    -- Check requirements
    IF (badge_record.requirement_type = 'orders' AND user_stats.order_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'spending' AND user_stats.total_spent >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'streak' AND user_stats.current_streak >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'referrals' AND user_stats.referral_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'reviews' AND user_stats.review_count >= badge_record.requirement_value) OR
       (badge_record.requirement_type = 'local_orders' AND user_stats.unique_merchants >= badge_record.requirement_value) THEN
      
      -- Award badge
      INSERT INTO consumer_badges (user_id, badge_id) VALUES (p_user_id, badge_record.id);
      
      -- Award UCoin reward
      IF badge_record.ucoin_reward > 0 THEN
        PERFORM award_bigold(p_user_id, 'badge_earned', badge_record.ucoin_reward, badge_record.id::TEXT, 'badge');
      END IF;
      
      badges_awarded := badges_awarded + 1;
    END IF;
  END LOOP;
  
  RETURN badges_awarded;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_merchant_upgrade_triggers(p_merchant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_product_count INTEGER;
  v_max_products INTEGER := 25;
  v_promo_count INTEGER;
  v_monthly_revenue NUMERIC;
  v_triggers JSONB := '[]'::jsonb;
BEGIN
  SELECT subscription_tier INTO v_tier FROM merchants WHERE id = p_merchant_id;
  
  -- Only check for Standard tier
  IF v_tier = 'premium' THEN
    RETURN v_triggers;
  END IF;
  
  -- Check product limit (80% threshold)
  SELECT COUNT(*) INTO v_product_count 
  FROM products p
  JOIN stores s ON p.store_id = s.id
  WHERE s.merchant_id = p_merchant_id AND p.status != 'deleted';
  
  IF v_product_count >= (v_max_products * 0.8) THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'product_limit_80',
      'message', format('You''ve used %s of %s product slots', v_product_count, v_max_products),
      'percentage', round((v_product_count::numeric / v_max_products) * 100)
    );
  END IF;
  
  -- Check promotion cap
  SELECT COUNT(*) INTO v_promo_count
  FROM promotions p
  JOIN stores s ON p.store_id = s.id
  WHERE s.merchant_id = p_merchant_id 
    AND p.created_at >= date_trunc('month', now());
  
  IF v_promo_count >= 1 THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'promotion_cap',
      'message', 'You''ve used your monthly promotion. Upgrade for unlimited promotions!'
    );
  END IF;
  
  -- Check monthly revenue threshold (e.g., R10,000)
  SELECT COALESCE(SUM(oi.price * oi.quantity), 0) INTO v_monthly_revenue
  FROM order_items oi
  JOIN stores s ON oi.store_id = s.id
  WHERE s.merchant_id = p_merchant_id 
    AND oi.created_at >= date_trunc('month', now());
  
  IF v_monthly_revenue >= 10000 THEN
    v_triggers := v_triggers || jsonb_build_object(
      'type', 'sales_threshold',
      'message', format('You''ve earned R%s this month! Upgrade to Premium for lower fees.', round(v_monthly_revenue)),
      'potential_savings', round(v_monthly_revenue * 0.04) -- 4% difference
    );
  END IF;
  
  RETURN v_triggers;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_merchant_cascade(merchant_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  merchant_user_id UUID;
  merchant_store_ids UUID[];
BEGIN
  -- Get the user_id associated with this merchant
  SELECT user_id INTO merchant_user_id FROM merchants WHERE id = merchant_uuid;
  
  IF merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Merchant not found';
  END IF;
  
  -- Get all store IDs for this merchant
  SELECT ARRAY_AGG(id) INTO merchant_store_ids FROM stores WHERE merchant_id = merchant_uuid;
  
  -- Delete products associated with merchant's stores (if not cascaded)
  IF merchant_store_ids IS NOT NULL THEN
    DELETE FROM products WHERE store_id = ANY(merchant_store_ids);
    DELETE FROM collections WHERE store_id = ANY(merchant_store_ids);
    DELETE FROM conversations WHERE store_id = ANY(merchant_store_ids);
  END IF;
  
  -- Delete stores
  DELETE FROM stores WHERE merchant_id = merchant_uuid;
  
  -- Delete merchant-related data (most should cascade, but being explicit)
  DELETE FROM merchant_documents WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_notifications WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_payment_methods WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_features WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_usage WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_upgrade_triggers WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_audit_log WHERE merchant_id = merchant_uuid;
  DELETE FROM payouts WHERE merchant_id = merchant_uuid;
  DELETE FROM promo_credit_transactions WHERE merchant_id = merchant_uuid;
  DELETE FROM support_tickets WHERE merchant_id = merchant_uuid;
  DELETE FROM custom_attribute_values WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_improvement_tips WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_performance WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_tier_history WHERE merchant_id = merchant_uuid;
  DELETE FROM auto_campaigns WHERE merchant_id = merchant_uuid;
  
  -- Delete the merchant record itself
  DELETE FROM merchants WHERE id = merchant_uuid;
  
  -- Remove merchant role from user_roles table
  DELETE FROM user_roles WHERE user_id = merchant_user_id AND role = 'merchant';
  
  -- Update profile role back to consumer if they have no other roles
  UPDATE profiles 
  SET role = 'consumer' 
  WHERE id = merchant_user_id 
    AND NOT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = merchant_user_id AND role != 'consumer'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_merchant_features(merchant_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(sp.features, '[]'::jsonb)
  FROM public.merchants v
  LEFT JOIN public.subscription_plans sp
    ON lower(sp.name) = lower(initcap(v.subscription_tier))
   AND sp.billing_period = 'monthly'
  WHERE v.id = merchant_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_merchant_tier_config(p_merchant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_config JSONB;
BEGIN
  SELECT COALESCE(subscription_tier, 'starter') INTO v_tier FROM public.merchants WHERE id = p_merchant_id;

  IF v_tier = 'gold' THEN
    v_config := jsonb_build_object(
      'max_products', NULL,
      'monthly_promotions', NULL,
      'commission_rate', 6,
      'payout_days', 2,
      'search_boost', 1.5,
      'ad_credits_monthly', 500
    );
  ELSIF v_tier = 'silver' THEN
    v_config := jsonb_build_object(
      'max_products', 300,
      'monthly_promotions', 20,
      'commission_rate', 8,
      'payout_days', 3,
      'search_boost', 1.25,
      'ad_credits_monthly', 250
    );
  ELSIF v_tier = 'bronze' THEN
    v_config := jsonb_build_object(
      'max_products', 100,
      'monthly_promotions', 5,
      'commission_rate', 9,
      'payout_days', 5,
      'search_boost', 1.1,
      'ad_credits_monthly', 100
    );
  ELSE
    -- Starter (Free)
    v_config := jsonb_build_object(
      'max_products', 25,
      'monthly_promotions', 1,
      'commission_rate', 10,
      'payout_days', 7,
      'search_boost', 1.0,
      'ad_credits_monthly', 0
    );
  END IF;

  RETURN v_config;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_merchant_bank_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin tools and server-side jobs are not restricted.
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') <> 'authenticated'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.bank_account_holder IS NOT NULL OR NEW.bank_account_number IS NOT NULL OR NEW.bank_routing_code IS NOT NULL THEN
      RAISE EXCEPTION 'Bank details must be added through bank verification';
    END IF;
  ELSIF NEW.bank_account_holder IS DISTINCT FROM OLD.bank_account_holder
     OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
     OR NEW.bank_routing_code IS DISTINCT FROM OLD.bank_routing_code THEN
    RAISE EXCEPTION 'Bank details must be changed through bank verification';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role app_role;
BEGIN
  -- Only self-service roles are accepted here. Admins are granted manually.
  user_role := CASE NEW.raw_user_meta_data ->> 'role'
    WHEN 'merchant' THEN 'merchant'::app_role
    WHEN 'driver' THEN 'driver'::app_role
    WHEN 'influencer' THEN 'influencer'::app_role
    ELSE 'consumer'::app_role
  END;

  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    user_role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_merchant_tier_downgrade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when tier changes FROM gold to something else
  IF OLD.subscription_tier = 'gold' AND NEW.subscription_tier != 'gold' THEN
    -- Suspend all active custom domains for this merchant
    UPDATE public.merchant_custom_domains
    SET status = 'suspended'
    WHERE merchant_id = NEW.id AND status = 'active';
    
    -- Disable white-label on all stores for this merchant
    UPDATE public.storefront_customizations sc
    SET white_label = false
    FROM public.stores s
    WHERE sc.store_id = s.id AND s.merchant_id = NEW.id;
  END IF;
  
  -- If upgrading back to Gold, reactivate suspended domains
  IF OLD.subscription_tier != 'gold' AND NEW.subscription_tier = 'gold' THEN
    UPDATE public.merchant_custom_domains
    SET status = 'active'
    WHERE merchant_id = NEW.id AND status = 'suspended';
    
    -- Re-enable white-label if they have active domains
    IF EXISTS (SELECT 1 FROM public.merchant_custom_domains WHERE merchant_id = NEW.id AND status = 'active') THEN
      UPDATE public.storefront_customizations sc
      SET white_label = true
      FROM public.stores s
      WHERE sc.store_id = s.id AND s.merchant_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_trial_expired(merchant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN v.subscription_tier = 'trial' AND v.trial_end_date < now() THEN true
      ELSE false
    END
  FROM merchants v
  WHERE v.id = merchant_id;
$function$;

CREATE OR REPLACE FUNCTION public.is_merchant(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = _user_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_merchant_owned_path(p_first_segment text, p_second_segment text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p_first_segment = auth.uid()::text
    OR p_second_segment = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.merchants v
      WHERE v.id::text = p_first_segment AND v.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.primary_role(p_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = p_user_id
     ORDER BY CASE role::text
       WHEN 'admin' THEN 1 WHEN 'merchant' THEN 2 WHEN 'driver' THEN 3
       WHEN 'influencer' THEN 4 WHEN 'consumer' THEN 5 ELSE 6 END
     LIMIT 1),
    'consumer'::public.app_role);
$function$;

CREATE OR REPLACE FUNCTION public.require_verified_payout_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin tools and server-side jobs are not restricted.
  IF COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'service_role') <> 'authenticated'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.merchant_payment_methods m
    WHERE m.merchant_id = NEW.merchant_id AND m.is_default AND m.verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Add a verified bank account before requesting a payout';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_custom_domain(p_domain text)
 RETURNS TABLE(merchant_id uuid, store_id uuid, domain text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT merchant_id, store_id, domain
  FROM public.merchant_custom_domains
  WHERE domain = lower(p_domain) AND status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.uc_merchant_milestones(p_merchant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_sales integer;
  v_gmv numeric;
  v_referrer uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.merchants WHERE id = p_merchant_id;
  IF v_user IS NULL THEN RETURN; END IF;

  SELECT count(DISTINCT o.id), COALESCE(sum(oi.price * oi.quantity), 0)
    INTO v_sales, v_gmv
  FROM public.order_items oi
  JOIN public.stores s ON s.id = oi.store_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE s.merchant_id = p_merchant_id
    AND o.payment_status = 'paid'
    AND o.status IN ('delivered', 'completed');

  IF v_sales >= 1   THEN PERFORM public.uc_award(v_user, 'merchant_first_sale', 'merchant_first_sale:' || v_user, NULL, 'merchant', p_merchant_id::text); END IF;
  IF v_sales >= 10  THEN PERFORM public.uc_award(v_user, 'merchant_sales_10',   'merchant_sales_10:'   || v_user, NULL, 'merchant', p_merchant_id::text); END IF;
  IF v_sales >= 100 THEN PERFORM public.uc_award(v_user, 'merchant_sales_100',  'merchant_sales_100:'  || v_user, NULL, 'merchant', p_merchant_id::text); END IF;
  IF v_gmv >= 10000 THEN PERFORM public.uc_award(v_user, 'merchant_gmv_10k',    'merchant_gmv_10k:'    || v_user, NULL, 'merchant', p_merchant_id::text); END IF;

  -- Referred merchant qualifies at the first sale: both referral rewards stack.
  IF v_sales >= 1 THEN
    v_referrer := public.uc_referrer_of(v_user);
    IF v_referrer IS NOT NULL THEN
      PERFORM public.uc_award(v_referrer, 'referral_merchant', 'referral_merchant:' || v_user, NULL, 'referral', v_user::text);
      PERFORM public.uc_award(v_referrer, 'merchant_referral', 'merchant_referral:' || v_user, NULL, 'referral', v_user::text);
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uc_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_paid numeric;
  v_referrer uuid;
  v_merchant uuid;
  v_done boolean;
  v_was_done boolean;
BEGIN
  BEGIN
    v_done := NEW.payment_status = 'paid' AND NEW.status IN ('delivered', 'completed');
    v_was_done := TG_OP = 'UPDATE' AND OLD.payment_status = 'paid' AND OLD.status IN ('delivered', 'completed');

    IF v_done AND NOT v_was_done AND NOT public.uc_actor_is(NEW.user_id) THEN
      v_paid := GREATEST(COALESCE(NEW.total, 0) - COALESCE(NEW.ucoin_value_zar, 0), 0);

      PERFORM public.uc_award(NEW.user_id, 'purchase_cashback', 'purchase_cashback:' || NEW.id,
        public.uc_cashback(NEW.user_id, v_paid), 'order', NEW.id::text,
        'Cashback on order ' || left(NEW.id::text, 8));

      IF v_paid >= 500 THEN
        PERFORM public.uc_award(NEW.user_id, 'first_purchase', 'first_purchase:' || NEW.user_id, NULL, 'order', NEW.id::text);
      END IF;

      v_referrer := public.uc_referrer_of(NEW.user_id);
      IF v_referrer IS NOT NULL THEN
        PERFORM public.uc_award(v_referrer, 'referral_first_purchase', 'referral_first_purchase:' || NEW.user_id, NULL, 'referral', NEW.user_id::text);
        UPDATE public.referrals
          SET status = 'completed',
              first_purchase_date = COALESCE(first_purchase_date, now()),
              first_purchase_amount = COALESCE(first_purchase_amount, v_paid),
              updated_at = now()
        WHERE referred_id = NEW.user_id AND status IS DISTINCT FROM 'completed';
        PERFORM public.uc_mark_referral_qualified(NEW.user_id);
      END IF;

      FOR v_merchant IN
        SELECT DISTINCT s.merchant_id FROM public.order_items oi JOIN public.stores s ON s.id = oi.store_id
        WHERE oi.order_id = NEW.id
      LOOP
        PERFORM public.uc_merchant_milestones(v_merchant);
      END LOOP;
    END IF;

    IF TG_OP = 'UPDATE'
       AND (COALESCE(NEW.refund_status, '') IN ('refunded', 'completed', 'processed') OR NEW.status IN ('refunded', 'returned'))
       AND NOT (COALESCE(OLD.refund_status, '') IN ('refunded', 'completed', 'processed') OR OLD.status IN ('refunded', 'returned')) THEN
      PERFORM public.uc_reverse('order', NEW.id::text, 'order refunded');
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'uc_on_order: %', SQLERRM;
  END;
  RETURN NEW;
END; $function$;

GRANT EXECUTE ON FUNCTION public.can_merchant_add_product(p_merchant_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_merchant_create_promotion(p_merchant_id uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_merchant_upgrade_triggers(p_merchant_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_merchant_upgrade_triggers(p_merchant_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_merchant_upgrade_triggers(p_merchant_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_merchant_upgrade_triggers(p_merchant_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.delete_merchant_cascade(merchant_uuid uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_merchant_cascade(merchant_uuid uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_merchant_cascade(merchant_uuid uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_merchant_cascade(merchant_uuid uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_merchant_features(merchant_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_merchant_tier_config(p_merchant_id uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_trial_expired(merchant_id uuid) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_custom_domain(p_domain text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_custom_domain(p_domain text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.uc_merchant_milestones(p_merchant_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.uc_merchant_milestones(p_merchant_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.uc_merchant_milestones(p_merchant_id uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.uc_merchant_milestones(p_merchant_id uuid) TO service_role;

-- 4. The role trigger passes the role name as text.
DROP TRIGGER IF EXISTS grant_merchant_role ON public.merchants;
CREATE TRIGGER grant_merchant_role AFTER INSERT OR UPDATE OF user_id ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.grant_role_for_record('merchant');

-- 5. Stored values that spell out the old name.
ALTER TABLE public.messages DROP CONSTRAINT messages_sender_type_check;
UPDATE public.messages SET sender_type = 'merchant' WHERE sender_type = 'vendor';
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_type_check
  CHECK (sender_type = ANY (ARRAY['customer'::text, 'merchant'::text, 'admin'::text]));

ALTER TABLE public.ucoin_spending_options
  ALTER COLUMN user_types SET DEFAULT ARRAY['consumer'::text, 'merchant'::text, 'driver'::text];
UPDATE public.ucoin_spending_options SET user_types = array_replace(user_types, 'vendor', 'merchant')
  WHERE 'vendor' = ANY (user_types);

UPDATE public.badge_definitions
  SET description = replace(replace(description, 'vendor', 'merchant'), 'Vendor', 'Merchant')
  WHERE description ILIKE '%vendor%';

-- Sign-up metadata is what handle_new_user reads the requested role from.
UPDATE auth.users SET raw_user_meta_data = jsonb_set(raw_user_meta_data, '{role}', '"merchant"')
  WHERE raw_user_meta_data->>'role' = 'vendor';

-- 6. Make the API see the new names straight away.
NOTIFY pgrst, 'reload schema';
