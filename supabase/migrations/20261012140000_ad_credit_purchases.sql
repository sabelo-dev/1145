-- Buying ad credits.
--
-- Packs are priced in rand and paid once through PayFast (ad-credits-purchase
-- starts the payment, payfast-itn confirms it). The credits are added by
-- ad_credit_purchase_complete, which only the payment notification can call.

CREATE TABLE IF NOT EXISTS public.ad_credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credits integer NOT NULL CHECK (credits > 0),
  price numeric(10, 2) NOT NULL CHECK (price >= 5), -- PayFast's minimum payment
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credits)
);

INSERT INTO public.ad_credit_packs (credits, price) VALUES
  (100, 100),
  (250, 225),
  (500, 400)
ON CONFLICT (credits) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ad_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  pack_id uuid REFERENCES public.ad_credit_packs(id) ON DELETE SET NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  payfast_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_credit_purchases_merchant ON public.ad_credit_purchases (merchant_id, created_at DESC);

ALTER TABLE public.ad_credit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_credit_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users see active packs" ON public.ad_credit_packs;
CREATE POLICY "Signed-in users see active packs"
  ON public.ad_credit_packs FOR SELECT TO authenticated
  USING (is_active OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage packs" ON public.ad_credit_packs;
CREATE POLICY "Admins manage packs"
  ON public.ad_credit_packs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Purchases are written by the payment functions only.
DROP POLICY IF EXISTS "Merchants see own credit purchases" ON public.ad_credit_purchases;
CREATE POLICY "Merchants see own credit purchases"
  ON public.ad_credit_purchases FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = ad_credit_purchases.merchant_id AND m.user_id = auth.uid()));

-- Confirms a paid purchase and adds its credits. Safe to call again for a
-- repeated payment notification. Returns what happened.
CREATE OR REPLACE FUNCTION public.ad_credit_purchase_complete(
  p_purchase_id uuid, p_payfast_payment_id text, p_amount numeric)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_purchase public.ad_credit_purchases;
  v_user uuid;
BEGIN
  SELECT * INTO v_purchase FROM public.ad_credit_purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_purchase.id IS NULL THEN RETURN 'not_found'; END IF;
  IF v_purchase.status = 'completed' THEN RETURN 'already_completed'; END IF;
  IF round(p_amount * 100) <> round(v_purchase.amount * 100) THEN RETURN 'amount_mismatch'; END IF;

  UPDATE public.ad_credit_purchases
    SET status = 'completed', payfast_payment_id = p_payfast_payment_id, paid_at = now()
  WHERE id = p_purchase_id;

  IF NOT EXISTS (SELECT 1 FROM public.promo_credits WHERE merchant_id = v_purchase.merchant_id) THEN
    INSERT INTO public.promo_credits (merchant_id, balance, lifetime_earned, lifetime_spent)
    VALUES (v_purchase.merchant_id, 0, 0, 0);
  END IF;

  PERFORM public.merchant_ad_credits_move(v_purchase.merchant_id, v_purchase.credits, 'purchase', 'purchase',
    'Bought ' || v_purchase.credits || ' credits for R' || to_char(v_purchase.amount, 'FM999990.00'));

  SELECT user_id INTO v_user FROM public.merchants WHERE id = v_purchase.merchant_id;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_user, 'ad_credits_purchased', 'Ad credits added',
            v_purchase.credits || ' ad credits were added to your balance.',
            jsonb_build_object('url', '/merchant/dashboard?tab=ad-credits'));
  END IF;

  RETURN 'completed';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.ad_credit_purchase_complete(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_credit_purchase_complete(uuid, text, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
