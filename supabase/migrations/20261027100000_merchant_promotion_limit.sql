-- Merchant-named enforce_promotion_limit.
--
-- 20261002090000_enforce_promotion_limit was written against public.vendors.
-- The vendor-to-merchant rename (20261010090050) rewrote only the functions
-- that were live when it was generated, which did not include this one, so on
-- any database where it ran first its body still pointed at the old names.
-- Same rules as before: starter 1, bronze 5, silver 20, gold unlimited per
-- calendar month (South African time), counted across a merchant's stores.

CREATE OR REPLACE FUNCTION public.enforce_promotion_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_merchant_id uuid;
  v_tier text;
  v_limit integer;
  v_used integer;
BEGIN
  SELECT v.id, lower(coalesce(v.subscription_tier, ''))
    INTO v_merchant_id, v_tier
    FROM public.stores s
    JOIN public.merchants v ON v.id = s.merchant_id
   WHERE s.id = NEW.store_id;

  IF v_merchant_id IS NULL THEN
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

  -- One at a time per merchant, so two simultaneous inserts cannot both pass.
  PERFORM pg_advisory_xact_lock(hashtext('promotion_limit:' || v_merchant_id::text));

  SELECT count(*) INTO v_used
    FROM public.promotions p
    JOIN public.stores s ON s.id = p.store_id
   WHERE s.merchant_id = v_merchant_id
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
