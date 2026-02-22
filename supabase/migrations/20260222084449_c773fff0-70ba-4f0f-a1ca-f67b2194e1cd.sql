
-- =============================================
-- 1. SUBSCRIPTION PAYMENTS
-- =============================================
CREATE TABLE public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('platform_balance', 'payfast_debit', 'manual_card')),
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payfast_payment_id TEXT,
  reference TEXT,
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own subscription payments"
ON public.subscription_payments FOR SELECT
USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all subscription payments"
ON public.subscription_payments FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert subscription payments"
ON public.subscription_payments FOR INSERT
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- Add subscription payment columns to vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS subscription_payment_method TEXT DEFAULT 'manual_card',
  ADD COLUMN IF NOT EXISTS subscription_next_billing_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS subscription_auto_renew BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS platform_balance NUMERIC DEFAULT 0;

-- =============================================
-- 2. MERCHANT API ACCESS (Gold tier only)
-- =============================================
CREATE TABLE public.merchant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  api_secret_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  scopes TEXT[] DEFAULT ARRAY['read:products', 'read:orders'],
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own API keys"
ON public.merchant_api_keys FOR ALL
USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all API keys"
ON public.merchant_api_keys FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE TABLE public.merchant_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.merchant_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view own API logs"
ON public.merchant_api_logs FOR SELECT
USING (api_key_id IN (
  SELECT id FROM public.merchant_api_keys WHERE vendor_id IN (
    SELECT id FROM public.vendors WHERE user_id = auth.uid()
  )
));

-- =============================================
-- 3. CUSTOM DOMAINS (Gold tier only)
-- =============================================
CREATE TABLE public.merchant_custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'active', 'failed', 'removed')),
  verification_token TEXT,
  ssl_status TEXT DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_custom_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can manage own custom domains"
ON public.merchant_custom_domains FOR ALL
USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all custom domains"
ON public.merchant_custom_domains FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can read active domains for routing"
ON public.merchant_custom_domains FOR SELECT
USING (status = 'active');

-- Triggers for updated_at
CREATE TRIGGER update_subscription_payments_updated_at BEFORE UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_api_keys_updated_at BEFORE UPDATE ON public.merchant_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_custom_domains_updated_at BEFORE UPDATE ON public.merchant_custom_domains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := 'mk_live_';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;
