-- Four loose ends in merchant subscriptions and ad credits.
--
-- 1. A paid plan whose period has run out is downgraded to Starter.
-- 2. subscription_plans carries the prices that are actually charged.
-- 3. An active ad campaign promotes its store's products, and uses up its
--    budget day by day.
-- 4. Merchants can no longer write their credit balance or campaigns from the
--    browser; every change goes through the database functions.

-- ---------------------------------------------------------------- 1. expiry
-- PayFast charges a recurring plan on its billing date and the payment
-- notification moves subscription_expires_at forward, so a plan is only
-- overdue once that date has passed. Three days of grace cover a late charge.
-- Plans assigned by an admin have no expiry date and are left alone.
CREATE OR REPLACE FUNCTION public.expire_merchant_subscriptions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant record;
  v_count integer := 0;
BEGIN
  FOR v_merchant IN
    SELECT id, user_id, subscription_tier, subscription_status, subscription_expires_at
    FROM public.merchants
    WHERE subscription_tier IN ('bronze', 'silver', 'gold')
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < now() - interval '3 days'
    FOR UPDATE
  LOOP
    -- The tier triggers reset commission, payout days, search boost and custom domains.
    UPDATE public.merchants
      SET subscription_tier = 'starter', subscription_status = 'expired'
    WHERE id = v_merchant.id;

    INSERT INTO public.merchant_subscription_audit_log
      (merchant_id, changed_by, change_type, old_tier, new_tier, old_status, new_status, reason)
    VALUES
      (v_merchant.id, v_merchant.user_id, 'expiry', v_merchant.subscription_tier, 'starter',
       v_merchant.subscription_status, 'expired',
       'Paid period ended on ' || to_char(v_merchant.subscription_expires_at, 'YYYY-MM-DD') || ' with no renewal payment');

    IF v_merchant.user_id IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, type, title, message, data)
      VALUES (v_merchant.user_id, 'subscription_expired', 'Your plan has ended',
              'Your ' || upper(v_merchant.subscription_tier) || ' plan was not renewed, so your store is now on the Starter plan. Choose a plan to restore your benefits.',
              jsonb_build_object('url', '/merchant/dashboard?tab=subscription'));
    END IF;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_merchant_subscriptions() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- 2. prices
-- What merchant-subscription charges (and the app shows): the table had drifted.
UPDATE public.subscription_plans p
SET price = v.price, updated_at = now()
FROM (VALUES
  ('starter', 'monthly', 0), ('starter', 'yearly', 0),
  ('bronze', 'monthly', 99), ('bronze', 'yearly', 990),
  ('silver', 'monthly', 249), ('silver', 'yearly', 2490),
  ('gold', 'monthly', 499), ('gold', 'yearly', 4990)
) AS v(name, billing_period, price)
WHERE lower(p.name) = v.name AND p.billing_period = v.billing_period AND p.price IS DISTINCT FROM v.price;

-- ---------------------------------------------------------------- 3. campaigns
-- What shoppers' catalogue reads: the stores (or single products) being
-- promoted right now. "featured" campaigns also lead the home page's featured list.
CREATE OR REPLACE FUNCTION public.active_ad_boosts()
 RETURNS TABLE(store_id uuid, product_id uuid, featured boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.store_id,
         CASE WHEN c.trigger_conditions ->> 'product_id' ~* '^[0-9a-f-]{36}$'
              THEN (c.trigger_conditions ->> 'product_id')::uuid END,
         bool_or(c.campaign_type IN ('featured_listing', 'flash_promotion'))
  FROM public.auto_campaigns c
  WHERE c.is_active AND c.store_id IS NOT NULL
    AND COALESCE(c.credits_used, 0) < COALESCE(c.credit_budget, 0)
  GROUP BY 1, 2;
$function$;

GRANT EXECUTE ON FUNCTION public.active_ad_boosts() TO anon, authenticated, service_role;

-- Once a day each running campaign uses one day's share of its budget. It ends
-- when the budget is used or its days are up; anything unused at that point
-- goes back to the merchant's balance.
CREATE OR REPLACE FUNCTION public.run_ad_campaigns()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_campaign public.auto_campaigns;
  v_days integer;
  v_daily integer;
  v_spend integer;
  v_used integer;
  v_count integer := 0;
BEGIN
  FOR v_campaign IN
    SELECT * FROM public.auto_campaigns
    WHERE is_active AND (last_triggered IS NULL OR last_triggered < now() - interval '20 hours')
    FOR UPDATE
  LOOP
    v_days := GREATEST(COALESCE((v_campaign.trigger_conditions ->> 'duration_days')::integer, 7), 1);
    v_daily := GREATEST(ceil(COALESCE(v_campaign.credit_budget, 0)::numeric / v_days)::integer, 1);
    v_spend := LEAST(v_daily, GREATEST(COALESCE(v_campaign.credit_budget, 0) - COALESCE(v_campaign.credits_used, 0), 0));
    v_used := COALESCE(v_campaign.credits_used, 0) + v_spend;

    UPDATE public.auto_campaigns
      SET credits_used = v_used,
          trigger_count = COALESCE(trigger_count, 0) + 1,
          last_triggered = now(),
          is_active = v_used < COALESCE(credit_budget, 0) AND COALESCE(trigger_count, 0) + 1 < v_days,
          updated_at = now()
    WHERE id = v_campaign.id;

    -- Days ran out before the budget did: return what is left.
    IF COALESCE(v_campaign.trigger_count, 0) + 1 >= v_days AND v_used < COALESCE(v_campaign.credit_budget, 0) THEN
      PERFORM public.merchant_ad_credits_move(v_campaign.merchant_id, v_campaign.credit_budget - v_used, 'refund',
        v_campaign.campaign_type, 'Refund: ' || v_campaign.campaign_type || ' campaign ended with budget left');
      UPDATE public.auto_campaigns SET credit_budget = v_used WHERE id = v_campaign.id;
    END IF;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.run_ad_campaigns() FROM PUBLIC, anon, authenticated;

-- A refund now also comes off "lifetime spent", so that figure is what
-- campaigns really used.
CREATE OR REPLACE FUNCTION public.merchant_ad_credits_move(
  p_merchant_id uuid, p_amount integer, p_type text, p_category text, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_amount = 0 THEN RETURN; END IF;

  UPDATE public.promo_credits
    SET balance = COALESCE(balance, 0) + p_amount,
        lifetime_spent = GREATEST(COALESCE(lifetime_spent, 0)
          - CASE WHEN p_type IN ('spend', 'refund') THEN p_amount ELSE 0 END, 0),
        lifetime_earned = COALESCE(lifetime_earned, 0) + CASE WHEN p_type IN ('grant', 'purchase') THEN p_amount ELSE 0 END,
        updated_at = now()
  WHERE merchant_id = p_merchant_id AND COALESCE(balance, 0) + p_amount >= 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough ad credits';
  END IF;

  INSERT INTO public.promo_credit_transactions (merchant_id, amount, type, category, description)
  VALUES (p_merchant_id, p_amount, p_type, p_category, p_description);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_ad_credits_move(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- 4. lock down
-- Credits spent outside a campaign (sponsored placements in the brand tools).
CREATE OR REPLACE FUNCTION public.merchant_ad_credits_spend(p_amount integer, p_category text, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
BEGIN
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1 FOR UPDATE;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user';
  END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'The amount must be above zero';
  END IF;
  PERFORM public.merchant_ad_credits_move(v_merchant, -p_amount, 'spend', p_category, p_description);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_ad_credits_spend(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_ad_credits_spend(integer, text, text) TO authenticated, service_role;

-- Reading stays; writing was how a merchant could set their own balance or
-- create a campaign without paying for it.
DROP POLICY IF EXISTS "Merchants manage own credits" ON public.promo_credits;
DROP POLICY IF EXISTS "Merchants manage own campaigns" ON public.auto_campaigns;
DROP POLICY IF EXISTS "Merchants view own campaigns" ON public.auto_campaigns;
CREATE POLICY "Merchants view own campaigns"
  ON public.auto_campaigns FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = auto_campaigns.merchant_id AND m.user_id = auth.uid()));

-- ---------------------------------------------------------------- schedules
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname IN ('expire-merchant-subscriptions', 'run-ad-campaigns');
SELECT cron.schedule('expire-merchant-subscriptions', '40 0 * * *', 'SELECT public.expire_merchant_subscriptions();');
SELECT cron.schedule('run-ad-campaigns', '50 0 * * *', 'SELECT public.run_ad_campaigns();');

NOTIFY pgrst, 'reload schema';
