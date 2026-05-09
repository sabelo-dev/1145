
-- 1) STORAGE: tighten product-images policies
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;

-- 2) DRIVER RISK SCORES: drop public-true ALL policy; admin-only manage
DROP POLICY IF EXISTS "System manages risk scores" ON public.driver_risk_scores;

CREATE POLICY "Admins manage risk scores"
ON public.driver_risk_scores
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 3) PROFILES: replace overly broad vendor-view policy with conversation-scoped policy
DROP POLICY IF EXISTS "Vendors can view customer profiles for messaging" ON public.profiles;

CREATE POLICY "Vendors view customers with active conversations"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.stores s ON s.id = c.store_id
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE v.user_id = auth.uid()
      AND c.customer_id = profiles.id
  )
);

-- 4) VENDORS: split sensitive financial fields into a separate, owner-only table
CREATE TABLE IF NOT EXISTS public.vendor_financial_details (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  bank_account_holder text,
  bank_account_number text,
  bank_routing_code text,
  tax_id text,
  vat_number text,
  vat_registered boolean DEFAULT false,
  business_email text,
  business_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_financial_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own financials"
ON public.vendor_financial_details
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Owner inserts own financials"
ON public.vendor_financial_details
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Owner updates own financials"
ON public.vendor_financial_details
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
);

CREATE POLICY "Admins manage all financials"
ON public.vendor_financial_details
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Migrate existing sensitive data
INSERT INTO public.vendor_financial_details (
  vendor_id, bank_account_holder, bank_account_number, bank_routing_code,
  tax_id, vat_number, vat_registered, business_email, business_phone
)
SELECT
  id, bank_account_holder, bank_account_number, bank_routing_code,
  tax_id, vat_number, COALESCE(vat_registered, false), business_email, business_phone
FROM public.vendors
WHERE bank_account_holder IS NOT NULL
   OR bank_account_number IS NOT NULL
   OR bank_routing_code IS NOT NULL
   OR tax_id IS NOT NULL
   OR vat_number IS NOT NULL
   OR business_email IS NOT NULL
   OR business_phone IS NOT NULL
ON CONFLICT (vendor_id) DO NOTHING;

-- Drop sensitive columns from vendors so they're no longer exposed by the public approved-vendor RLS policy
ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS bank_account_holder,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_routing_code,
  DROP COLUMN IF EXISTS tax_id,
  DROP COLUMN IF EXISTS vat_number,
  DROP COLUMN IF EXISTS vat_registered,
  DROP COLUMN IF EXISTS business_email,
  DROP COLUMN IF EXISTS business_phone;

-- updated_at trigger for new table
CREATE TRIGGER update_vendor_financial_details_updated_at
BEFORE UPDATE ON public.vendor_financial_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
