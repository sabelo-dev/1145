
-- Add onboarding_status to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'PENDING_PROFILE';

-- Add onboarding-related fields
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS legal_business_name text,
ADD COLUMN IF NOT EXISTS bank_account_holder text,
ADD COLUMN IF NOT EXISTS bank_account_number text,
ADD COLUMN IF NOT EXISTS bank_routing_code text,
ADD COLUMN IF NOT EXISTS vat_registered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 15,
ADD COLUMN IF NOT EXISTS fee_agreement_accepted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_schedule text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS shipping_regions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shipping_methods text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS return_policy text,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Create merchant_kyc_documents table for KYC
CREATE TABLE IF NOT EXISTS public.merchant_kyc_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_url text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_kyc_documents ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own documents
CREATE POLICY "Vendors can view own KYC documents"
  ON public.merchant_kyc_documents FOR SELECT
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Vendors can insert their own documents
CREATE POLICY "Vendors can upload KYC documents"
  ON public.merchant_kyc_documents FOR INSERT
  WITH CHECK (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Vendors can update their own documents
CREATE POLICY "Vendors can update own KYC documents"
  ON public.merchant_kyc_documents FOR UPDATE
  USING (
    vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Admins can manage all documents
CREATE POLICY "Admins can manage all KYC documents"
  ON public.merchant_kyc_documents FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create index
CREATE INDEX IF NOT EXISTS idx_merchant_kyc_vendor_id ON public.merchant_kyc_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_onboarding_status ON public.vendors(onboarding_status);
