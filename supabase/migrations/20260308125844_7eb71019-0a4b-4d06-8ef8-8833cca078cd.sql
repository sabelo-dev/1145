
-- Leasing Database Schema

-- Asset providers (external companies/individuals listing assets for lease)
CREATE TABLE public.asset_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  business_registration TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected')),
  commission_rate NUMERIC DEFAULT 10,
  total_assets INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaseable assets
CREATE TABLE public.leaseable_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.asset_providers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  images TEXT[] DEFAULT '{}',
  lease_price_monthly NUMERIC NOT NULL DEFAULT 0,
  lease_price_weekly NUMERIC DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  min_lease_duration_months INTEGER DEFAULT 1,
  max_lease_duration_months INTEGER DEFAULT 24,
  terms_and_conditions TEXT,
  maintenance_requirements TEXT,
  is_available BOOLEAN DEFAULT true,
  is_purchasable BOOLEAN DEFAULT false,
  purchase_price NUMERIC DEFAULT 0,
  condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'refurbished')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'leased', 'maintenance', 'retired', 'pending_approval')),
  total_leases INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lease applications
CREATE TABLE public.lease_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.leaseable_assets(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'cancelled')),
  lease_duration_months INTEGER NOT NULL DEFAULT 1,
  monthly_payment NUMERIC NOT NULL DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  applicant_name TEXT,
  applicant_email TEXT,
  applicant_phone TEXT,
  id_document_url TEXT,
  proof_of_income_url TEXT,
  credit_score INTEGER,
  employment_status TEXT,
  monthly_income NUMERIC,
  notes TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lease contracts (approved leases)
CREATE TABLE public.lease_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.lease_applications(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.leaseable_assets(id) ON DELETE CASCADE NOT NULL,
  contract_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated', 'defaulted', 'renewed')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  security_deposit NUMERIC DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT false,
  total_paid NUMERIC DEFAULT 0,
  total_due NUMERIC DEFAULT 0,
  next_payment_date DATE,
  payments_made INTEGER DEFAULT 0,
  payments_remaining INTEGER DEFAULT 0,
  late_payments INTEGER DEFAULT 0,
  contract_document_url TEXT,
  e_signature_url TEXT,
  signed_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  termination_reason TEXT,
  renewal_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lease payments
CREATE TABLE public.lease_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.lease_contracts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_type IN ('monthly', 'weekly', 'security_deposit', 'late_fee', 'early_termination')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'failed', 'refunded')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  transaction_reference TEXT,
  late_fee NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asset maintenance records
CREATE TABLE public.asset_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.leaseable_assets(id) ON DELETE CASCADE NOT NULL,
  contract_id UUID REFERENCES public.lease_contracts(id) ON DELETE SET NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'routine' CHECK (maintenance_type IN ('routine', 'repair', 'inspection', 'replacement')),
  description TEXT,
  scheduled_date DATE,
  completed_date DATE,
  cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  performed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaseable_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Asset providers: owners see their own, admins see all
CREATE POLICY "Users can view own provider profile" ON public.asset_providers FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can insert own provider profile" ON public.asset_providers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own provider profile" ON public.asset_providers FOR UPDATE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete providers" ON public.asset_providers FOR DELETE USING (public.is_admin(auth.uid()));

-- Leaseable assets: public read, provider/admin write
CREATE POLICY "Anyone can view active assets" ON public.leaseable_assets FOR SELECT USING (true);
CREATE POLICY "Providers and admins can insert assets" ON public.leaseable_assets FOR INSERT WITH CHECK (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.asset_providers WHERE user_id = auth.uid() AND status = 'approved'));
CREATE POLICY "Providers and admins can update assets" ON public.leaseable_assets FOR UPDATE USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.asset_providers ap WHERE ap.user_id = auth.uid() AND ap.id = leaseable_assets.provider_id));
CREATE POLICY "Admins can delete assets" ON public.leaseable_assets FOR DELETE USING (public.is_admin(auth.uid()));

-- Lease applications: users see own, admins see all
CREATE POLICY "Users can view own applications" ON public.lease_applications FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Users can submit applications" ON public.lease_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can update applications" ON public.lease_applications FOR UPDATE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Lease contracts: users see own, admins see all
CREATE POLICY "Users can view own contracts" ON public.lease_contracts FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert contracts" ON public.lease_contracts FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update contracts" ON public.lease_contracts FOR UPDATE USING (public.is_admin(auth.uid()));

-- Lease payments: users see own, admins see all
CREATE POLICY "Users can view own payments" ON public.lease_payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "System can insert payments" ON public.lease_payments FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update payments" ON public.lease_payments FOR UPDATE USING (public.is_admin(auth.uid()));

-- Asset maintenance: admins and providers
CREATE POLICY "Admins and providers can view maintenance" ON public.asset_maintenance FOR SELECT USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.leaseable_assets la JOIN public.asset_providers ap ON la.provider_id = ap.id WHERE la.id = asset_maintenance.asset_id AND ap.user_id = auth.uid()));
CREATE POLICY "Admins can manage maintenance" ON public.asset_maintenance FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update maintenance" ON public.asset_maintenance FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete maintenance" ON public.asset_maintenance FOR DELETE USING (public.is_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_asset_providers_updated_at BEFORE UPDATE ON public.asset_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaseable_assets_updated_at BEFORE UPDATE ON public.leaseable_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lease_applications_updated_at BEFORE UPDATE ON public.lease_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lease_contracts_updated_at BEFORE UPDATE ON public.lease_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_asset_maintenance_updated_at BEFORE UPDATE ON public.asset_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
