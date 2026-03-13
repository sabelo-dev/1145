-- Add listing_type column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'sale';

-- Add lease-to-own and insurance fields to leaseable_assets
ALTER TABLE public.leaseable_assets 
ADD COLUMN IF NOT EXISTS lease_to_own BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lease_to_own_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lease_to_own_months INTEGER,
ADD COLUMN IF NOT EXISTS accumulated_payments NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
ADD COLUMN IF NOT EXISTS insurance_monthly_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS maintenance_responsibility TEXT DEFAULT 'owner';

-- Add lease-to-own and insurance fields to lease_contracts
ALTER TABLE public.lease_contracts 
ADD COLUMN IF NOT EXISTS is_lease_to_own BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ownership_transfer_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ownership_transferred BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS insurance_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
ADD COLUMN IF NOT EXISTS insurance_monthly_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_pay_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

-- Create lease_insurance table for tracking insurance claims
CREATE TABLE IF NOT EXISTS public.lease_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.lease_contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  policy_number TEXT,
  coverage_type TEXT DEFAULT 'standard',
  monthly_premium NUMERIC NOT NULL DEFAULT 0,
  coverage_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  claim_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lease_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insurance" ON public.lease_insurance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own insurance" ON public.lease_insurance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all insurance" ON public.lease_insurance
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_listing_type ON public.products(listing_type);
CREATE INDEX IF NOT EXISTS idx_leaseable_assets_lease_to_own ON public.leaseable_assets(lease_to_own);
CREATE INDEX IF NOT EXISTS idx_lease_insurance_contract_id ON public.lease_insurance(contract_id);

-- Trigger for lease_insurance updated_at
CREATE TRIGGER update_lease_insurance_updated_at
  BEFORE UPDATE ON public.lease_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();