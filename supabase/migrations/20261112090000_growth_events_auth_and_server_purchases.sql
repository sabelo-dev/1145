-- Growth funnel: sign-up/verify/login steps, and purchases recorded by the server.
--
-- * sign_up, email_verified, login: the account steps between checkout_start
--   and purchase, where new shoppers were being lost without a trace.
-- * checkout_return: the browser landed back on /checkout/success. "purchase"
--   is now written by payfast-itn (and payfast-payment for orders paid fully in
--   UCoin) with the service role, so buyers who close PayFast early still count.
--
-- Apply this before deploying the matching app code: an unknown event fails
-- the whole analytics batch it was sent in.

ALTER TABLE public.growth_events DROP CONSTRAINT IF EXISTS growth_events_event_check;
ALTER TABLE public.growth_events ADD CONSTRAINT growth_events_event_check CHECK (event IN (
  'home_impression', 'category_click', 'search', 'product_view',
  'download_click', 'merchant_apply_click', 'merchant_application',
  'add_to_cart', 'checkout_start', 'checkout_return', 'purchase',
  'campaign_click', 'referral_click', 'creator_click', 'area_selected',
  'sign_up', 'email_verified', 'login'
));

-- One server-side purchase row per order, even if PayFast repeats an ITN.
CREATE UNIQUE INDEX IF NOT EXISTS growth_events_purchase_order_uidx
  ON public.growth_events ((props->>'order_id'))
  WHERE event = 'purchase' AND props ? 'order_id';
