-- Enforce the monthly promotion allowance of the merchant's tier.
--
-- The dashboard only displayed the limit (e.g. "3 / 1"), so merchants could
-- keep creating promotions past it. Limits match useVendorSubscription:
-- starter 1, bronze 5, silver 20, gold unlimited. Counted per vendor across
-- all of its stores, per calendar month (South African time).

CREATE OR REPLACE FUNCTION public.enforce_promotion_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vendor_id uuid;
  v_tier text;
  v_limit integer;
  v_used integer;
BEGIN
  SELECT v.id, lower(coalesce(v.subscription_tier, ''))
    INTO v_vendor_id, v_tier
    FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
   WHERE s.id = NEW.store_id;

  IF v_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Unknown or legacy tiers ("trial", "free") count as starter.
  v_limit := CASE v_tier
    WHEN 'gold' THEN NULL
    WHEN 'silver' THEN 20
    WHEN 'bronze' THEN 5
    ELSE 1
  END;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- One at a time per vendor, so two simultaneous inserts cannot both pass.
  PERFORM pg_advisory_xact_lock(hashtext('promotion_limit:' || v_vendor_id::text));

  SELECT count(*) INTO v_used
    FROM public.promotions p
    JOIN public.stores s ON s.id = p.store_id
   WHERE s.vendor_id = v_vendor_id
     AND p.created_at >= (date_trunc('month', now() AT TIME ZONE 'Africa/Johannesburg') AT TIME ZONE 'Africa/Johannesburg');

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Monthly promotion limit reached (% of %). Upgrade your plan to create more.', v_used, v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.enforce_promotion_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_promotion_limit ON public.promotions;
CREATE TRIGGER trg_enforce_promotion_limit
  BEFORE INSERT ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_promotion_limit();
