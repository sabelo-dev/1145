-- Subscription prices rounded to the nearest R100.
--
-- Merchant plans (monthly / yearly; yearly stays 10x monthly):
--   Bronze R99 / R990 -> R100 / R1,000
--   Silver R249 / R2,490 -> R200 / R2,000
--   Gold   R499 / R4,990 -> R500 / R5,000
-- These must match PRICING in supabase/functions/merchant-subscription and
-- TIER_PRICING in src/services/subscription.ts.
--
-- UC tiers (monthly): Bronze R200, Silver R400, Gold R700, Platinum R1,200,
-- Diamond R1,800 (from R199, R399, R699, R1,199, R1,799).
--
-- Only new sign-ups and plan changes use the new prices. Existing PayFast
-- subscriptions keep renewing at the amount they started with: renewals are
-- checked against that stored amount (subscription_payments.amount,
-- uc_tier_subscriptions.amount), so nothing here touches them.

UPDATE public.subscription_plans p
SET price = v.price, updated_at = now()
FROM (VALUES
  ('starter', 'monthly', 0), ('starter', 'yearly', 0),
  ('bronze', 'monthly', 100), ('bronze', 'yearly', 1000),
  ('silver', 'monthly', 200), ('silver', 'yearly', 2000),
  ('gold', 'monthly', 500), ('gold', 'yearly', 5000)
) AS v(name, billing_period, price)
WHERE lower(p.name) = v.name AND p.billing_period = v.billing_period AND p.price IS DISTINCT FROM v.price;

UPDATE public.affiliate_tiers t
SET monthly_price = v.price
FROM (VALUES
  ('bronze', 200), ('silver', 400), ('gold', 700), ('platinum', 1200), ('diamond', 1800)
) AS v(name, price)
WHERE t.name = v.name AND t.monthly_price IS DISTINCT FROM v.price;
