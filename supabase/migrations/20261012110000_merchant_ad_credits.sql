-- Merchant ad credits: grant the monthly allowance and move credits in one place.
--
-- The plan's monthly ad credits were shown on the Ad Credits page but never
-- reached the spendable balance (promo_credits.balance), so a campaign could
-- not be created. Credits were also moved from the browser in separate steps,
-- the history rows it tried to write were refused (the table has no insert
-- policy), and resuming a paused campaign did not take back the credits its
-- pause had refunded.
--
-- Rules:
--   * each calendar month a merchant receives their plan's allowance
--     (get_merchant_tier_config.ad_credits_monthly); an upgrade during the
--     month tops it up to the new plan's allowance; unused credits carry over
--   * a campaign's budget leaves the balance when it is created or resumed, and
--     the unused part comes back when it is paused or deleted

CREATE OR REPLACE FUNCTION public.merchant_ad_credits_sync()
 RETURNS public.promo_credits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_allowance integer;
  v_granted integer;
  v_due integer;
  v_row public.promo_credits;
BEGIN
  -- The lock makes two calls at once run one after the other.
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1 FOR UPDATE;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.promo_credits WHERE merchant_id = v_merchant) THEN
    INSERT INTO public.promo_credits (merchant_id, balance, lifetime_earned, lifetime_spent)
    VALUES (v_merchant, 0, 0, 0);
  END IF;

  v_allowance := COALESCE((public.get_merchant_tier_config(v_merchant) ->> 'ad_credits_monthly')::integer, 0);

  SELECT COALESCE(sum(amount), 0) INTO v_granted
  FROM public.promo_credit_transactions
  WHERE merchant_id = v_merchant AND category = 'monthly_allowance'
    AND created_at >= date_trunc('month', now());

  v_due := v_allowance - v_granted;
  IF v_due > 0 THEN
    UPDATE public.promo_credits
      SET balance = COALESCE(balance, 0) + v_due,
          lifetime_earned = COALESCE(lifetime_earned, 0) + v_due,
          last_monthly_grant = now(),
          updated_at = now()
    WHERE merchant_id = v_merchant;

    INSERT INTO public.promo_credit_transactions (merchant_id, amount, type, category, description)
    VALUES (v_merchant, v_due, 'grant', 'monthly_allowance',
            'Monthly allowance for ' || to_char(now(), 'FMMonth YYYY'));
  END IF;

  SELECT * INTO v_row FROM public.promo_credits WHERE merchant_id = v_merchant LIMIT 1;
  RETURN v_row;
END;
$function$;

-- Moves credits for the signed-in merchant and records it. A negative amount
-- is a spend and fails when the balance does not cover it.
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
        lifetime_spent = COALESCE(lifetime_spent, 0) + CASE WHEN p_type = 'spend' THEN -p_amount ELSE 0 END,
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

CREATE OR REPLACE FUNCTION public.merchant_ad_campaign_create(
  p_type text, p_budget integer, p_duration_days integer, p_keywords text[], p_product_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_campaign uuid;
BEGIN
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1 FOR UPDATE;
  IF v_merchant IS NULL THEN
    RAISE EXCEPTION 'No merchant account found for this user';
  END IF;
  IF COALESCE(p_type, '') = '' OR COALESCE(p_budget, 0) <= 0 THEN
    RAISE EXCEPTION 'Choose a campaign type and a budget above zero';
  END IF;

  PERFORM public.merchant_ad_credits_move(v_merchant, -p_budget, 'spend', p_type, 'Campaign budget: ' || p_type);

  INSERT INTO public.auto_campaigns (merchant_id, store_id, campaign_type, trigger_conditions, action_config,
                                     credit_budget, credits_used, is_active)
  VALUES (
    v_merchant,
    (SELECT id FROM public.stores WHERE merchant_id = v_merchant ORDER BY created_at LIMIT 1),
    p_type,
    jsonb_build_object('duration_days', COALESCE(p_duration_days, 7),
                       'keywords', to_jsonb(COALESCE(p_keywords, ARRAY[]::text[])),
                       'product_id', NULLIF(p_product_id, '')),
    jsonb_build_object('boost_type', p_type, 'started_at', now()),
    p_budget, 0, true)
  RETURNING id INTO v_campaign;

  RETURN v_campaign;
END;
$function$;

-- Pauses (refunds the unused budget), resumes (takes it back) or deletes.
CREATE OR REPLACE FUNCTION public.merchant_ad_campaign_update(p_campaign_id uuid, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant uuid;
  v_campaign public.auto_campaigns;
  v_unused integer;
BEGIN
  SELECT id INTO v_merchant FROM public.merchants WHERE user_id = auth.uid() LIMIT 1 FOR UPDATE;
  SELECT * INTO v_campaign FROM public.auto_campaigns
  WHERE id = p_campaign_id AND merchant_id = v_merchant FOR UPDATE;
  IF v_campaign.id IS NULL THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  v_unused := GREATEST(COALESCE(v_campaign.credit_budget, 0) - COALESCE(v_campaign.credits_used, 0), 0);

  IF p_action = 'pause' AND v_campaign.is_active THEN
    UPDATE public.auto_campaigns SET is_active = false, updated_at = now() WHERE id = p_campaign_id;
    PERFORM public.merchant_ad_credits_move(v_merchant, v_unused, 'refund', v_campaign.campaign_type,
      'Refund: paused ' || v_campaign.campaign_type || ' campaign');
  ELSIF p_action = 'resume' AND NOT v_campaign.is_active THEN
    PERFORM public.merchant_ad_credits_move(v_merchant, -v_unused, 'spend', v_campaign.campaign_type,
      'Campaign budget: resumed ' || v_campaign.campaign_type);
    UPDATE public.auto_campaigns SET is_active = true, updated_at = now() WHERE id = p_campaign_id;
  ELSIF p_action = 'delete' THEN
    DELETE FROM public.auto_campaigns WHERE id = p_campaign_id;
    -- A paused campaign's unused budget was already refunded.
    IF v_campaign.is_active THEN
      PERFORM public.merchant_ad_credits_move(v_merchant, v_unused, 'refund', v_campaign.campaign_type,
        'Refund: deleted ' || v_campaign.campaign_type || ' campaign');
    END IF;
  ELSIF p_action NOT IN ('pause', 'resume') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merchant_ad_credits_sync() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_ad_campaign_create(text, integer, integer, text[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merchant_ad_campaign_update(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_ad_credits_sync() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_ad_campaign_create(text, integer, integer, text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_ad_campaign_update(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
