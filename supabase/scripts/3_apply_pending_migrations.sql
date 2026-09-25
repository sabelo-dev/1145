-- =============================================================================
-- Applies the 4 pending migrations in order. Paste into the Supabase SQL Editor
-- and run once. The editor runs it as one transaction: all or nothing.
-- (Use this instead of 'supabase db push' — the remote migration history is
--  out of sync with the repo, see the notes in the chat.)
-- =============================================================================


-- >>>>>>>>>> 20260924120000_security_hardening.sql
-- Security hardening: privilege escalation, wallet RPCs, KYC self-approval,
-- and client-forged payment state on orders / auctions / auction registrations.
--
-- The guard triggers below only constrain direct API writes. They check
-- current_user, which is 'authenticated'/'anon' for PostgREST requests but is
-- the function owner inside SECURITY DEFINER functions and 'service_role' for
-- edge functions, so trusted server-side paths are unaffected.

-- ---------------------------------------------------------------------------
-- 1. Signup must never grant admin from user-controlled metadata.
-- ---------------------------------------------------------------------------
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
    WHEN 'vendor' THEN 'vendor'::app_role
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wallet mutation RPCs are server-only (edge functions use service_role).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_1145_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_wallet(uuid,public.wallet_bucket,numeric,public.ledger_type,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_1145_wallet(uuid) TO service_role;

-- Users may only read their own summary (service_role has no auth.uid()).
CREATE OR REPLACE FUNCTION public.get_wallet_summary(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_wallet public.wallets; v_kyc public.kyc_profiles; v_limits public.transaction_limits;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  SELECT * INTO v_kyc FROM public.kyc_profiles WHERE user_id = p_user_id;
  SELECT * INTO v_limits FROM public.transaction_limits WHERE kyc_level = COALESCE(v_kyc.level,'none'::public.kyc_level);
  RETURN jsonb_build_object('wallet',to_jsonb(v_wallet),'kyc',to_jsonb(v_kyc),'limits',to_jsonb(v_limits));
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_wallet_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. KYC: users submit details; only admins / server code set review outcome.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_email_confirmed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL);
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_email_confirmed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email_confirmed() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_kyc_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Every client submission goes back to review.
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;

  IF TG_OP = 'INSERT' THEN
    IF NEW.level NOT IN ('none', 'basic') THEN
      NEW.level := 'basic';
    END IF;
    NEW.mobile_verified := false;
    NEW.liveness_passed := false;
    NEW.rejection_reason := NULL;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.level := OLD.level;
    NEW.mobile_verified := OLD.mobile_verified;
    NEW.liveness_passed := OLD.liveness_passed;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;

  NEW.email_verified := public.current_user_email_confirmed();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_kyc_client_writes ON public.kyc_profiles;
CREATE TRIGGER trg_guard_kyc_client_writes
  BEFORE INSERT OR UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_client_writes();

-- ---------------------------------------------------------------------------
-- 4. Orders: payment state and money fields are server-controlled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.status := 'pending';
    NEW.ucoin_spent := 0;
    NEW.ucoin_value_zar := 0;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.total := OLD.total;
    NEW.payment_status := OLD.payment_status;
    NEW.ucoin_spent := OLD.ucoin_spent;
    NEW.ucoin_value_zar := OLD.ucoin_value_zar;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_order_client_writes ON public.orders;
CREATE TRIGGER trg_guard_order_client_writes
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_client_writes();

-- ---------------------------------------------------------------------------
-- 5. Auction registrations: deposit amount and payment come from the server.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_auction_registration_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.is_winner := false;
    NEW.deposit_applied := false;
    NEW.registration_fee_paid := COALESCE(
      (SELECT a.registration_fee FROM public.auctions a WHERE a.id = NEW.auction_id), 0);
  ELSE
    NEW.auction_id := OLD.auction_id;
    NEW.user_id := OLD.user_id;
    NEW.payment_status := OLD.payment_status;
    NEW.is_winner := OLD.is_winner;
    NEW.deposit_applied := OLD.deposit_applied;
    NEW.registration_fee_paid := OLD.registration_fee_paid;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_auction_registration_client_writes ON public.auction_registrations;
CREATE TRIGGER trg_guard_auction_registration_client_writes
  BEFORE INSERT OR UPDATE ON public.auction_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_auction_registration_client_writes();

-- ---------------------------------------------------------------------------
-- 6. Auctions: only admins / server code settle an auction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_auction_settlement_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.winner_id := OLD.winner_id;
  NEW.winning_bid := OLD.winning_bid;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('sold', 'completed', 'unsold') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_auction_settlement_client_writes ON public.auctions;
CREATE TRIGGER trg_guard_auction_settlement_client_writes
  BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.guard_auction_settlement_client_writes();


-- >>>>>>>>>> 20260924120100_subscription_payment_constraints.sql
-- merchant-subscription inserts payment_method 'payfast' and payfast-itn sets
-- status 'cancelled', but the original CHECK constraints allowed neither, so
-- PayFast plan upgrades failed on insert. Widen both to a superset.
ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_payment_method_check;
ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_payment_method_check
  CHECK (payment_method IN ('platform_balance', 'payfast_debit', 'manual_card', 'payfast'));

ALTER TABLE public.subscription_payments
  DROP CONSTRAINT IF EXISTS subscription_payments_status_check;
ALTER TABLE public.subscription_payments
  ADD CONSTRAINT subscription_payments_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled'));


-- >>>>>>>>>> 20260924130000_remove_lovable_references.sql
-- Remove remaining Lovable-hosted URLs from live database objects and data.

-- 1. Order status emails linked to the Lovable preview domain. The edge
--    function now uses its own SITE_URL, but keep the payload clean too.
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  customer_email TEXT;
  customer_name TEXT;
  payload JSONB;
BEGIN
  -- Only trigger on status changes (not on other updates)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get customer email and name from profiles
    SELECT email, name INTO customer_email, customer_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Only send email for specific status changes
    IF NEW.status IN ('processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled') THEN
      -- Build payload for edge function
      payload := jsonb_build_object(
        'orderId', NEW.id,
        'newStatus', NEW.status,
        'customerEmail', customer_email,
        'customerName', COALESCE(customer_name, 'Valued Customer'),
        'trackingNumber', NEW.tracking_number,
        'courierCompany', NEW.courier_company,
        'estimatedDelivery', NEW.estimated_delivery,
        'siteUrl', 'https://1145.io'
      );

      -- Log the notification attempt
      RAISE LOG 'Order status email notification queued for order % with status %', NEW.id, NEW.status;

      -- Call the edge function via pg_net (async HTTP call)
      PERFORM net.http_post(
        url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/send-order-status-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA'
        ),
        body := payload
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;

-- 2. Seed product images pointed at /lovable-uploads/, which were only ever
--    served by Lovable's hosting and don't exist in this repo. Replace the
--    broken paths with the placeholder image that ships in public/.
UPDATE public.product_images
SET image_url = '/placeholder.svg'
WHERE image_url LIKE '/lovable-uploads/%';


-- >>>>>>>>>> 20260925090000_remove_dropshipping.sql
-- Remove the third-party dropshipping integration (CJ Dropshipping, WeFulfil)
-- and everything built on it. Safe to run on a database where some of these
-- objects never existed.

-- 1. Products imported from CJ were copied into the normal catalogue
--    (external_source = 'dropship'). Delete the ones nobody ordered; keep the
--    rest as hidden (rejected) so past orders still point at a real product.
DO $$
BEGIN
  DELETE FROM public.products p
  WHERE p.external_source = 'dropship'
    AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'Some imported products are still referenced; hiding them instead.';
END $$;

UPDATE public.products SET status = 'rejected' WHERE external_source = 'dropship';

-- 2. The "1145 Marketplace" store the dropship admin created to hold imports
--    (not the "marketplace" store used for 1145 merchandise). Remove it once
--    it is empty.
DO $$
BEGIN
  DELETE FROM public.stores s
  WHERE s.slug = '1145-marketplace'
    AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.store_id = s.id);
  DELETE FROM public.vendors v
  WHERE v.business_name = '1145 Marketplace'
    AND NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.vendor_id = v.id);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'The 1145 Marketplace dropship store is still referenced; left in place.';
END $$;

-- 3. Stop any scheduled sync jobs (none are in these migrations, but they may
--    have been added from the dashboard).
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE command ILIKE '%dropship%' OR command ILIKE '%wefulfil%' OR command ILIKE '%wefullfil%';
  END IF;
END $$;

-- 4. Driver jobs no longer link to supplier shipments.
ALTER TABLE IF EXISTS public.delivery_jobs DROP COLUMN IF EXISTS fulfillment_id;

-- 5. Views, tables and functions.
DROP VIEW IF EXISTS public.dropship_public_variants CASCADE;
DROP VIEW IF EXISTS public.dropship_public_products CASCADE;

DROP TABLE IF EXISTS
  public.dropship_tracking_events,
  public.dropship_fulfillment_items,
  public.dropship_refunds,
  public.dropship_returns,
  public.dropship_fulfillments,
  public.dropship_price_history,
  public.dropship_listings,
  public.dropship_variants,
  public.dropship_products,
  public.dropship_sync_jobs,
  public.dropship_webhook_events,
  public.dropship_api_logs,
  public.dropship_audit_log,
  public.dropship_merchant_settings,
  public.dropship_suppliers,
  public.wefullfil_product_variants,
  public.wefullfil_products
CASCADE;

DROP FUNCTION IF EXISTS public.dropship_available_stock(uuid);
DROP FUNCTION IF EXISTS public.dropship_auto_stock_visibility();
DROP FUNCTION IF EXISTS public.dropship_audit_immutable();
DROP FUNCTION IF EXISTS public.dropship_fx_mode_valid();
DROP FUNCTION IF EXISTS public.update_wefullfil_product_variants_updated_at();
DROP FUNCTION IF EXISTS public.update_wefullfil_products_updated_at();
