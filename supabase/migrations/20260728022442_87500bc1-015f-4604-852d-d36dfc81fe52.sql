
-- Onboarding completion flags
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.influencer_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Unique constraints (partial, to allow legacy NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS drivers_license_number_unique
  ON public.drivers (lower(license_number)) WHERE license_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drivers_vehicle_registration_unique
  ON public.drivers (lower(vehicle_registration)) WHERE vehicle_registration IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS influencer_profiles_username_unique
  ON public.influencer_profiles (lower(username)) WHERE username IS NOT NULL;

-- Driver KYC table
CREATE TABLE IF NOT EXISTS public.driver_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_legal_name text NOT NULL,
  date_of_birth date NOT NULL,
  id_number text NOT NULL,
  id_document_front_url text NOT NULL,
  id_document_back_url text,
  license_number text NOT NULL,
  license_expiry date NOT NULL,
  license_front_url text NOT NULL,
  license_back_url text NOT NULL,
  street_address text NOT NULL,
  city text NOT NULL,
  province text NOT NULL,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'South Africa',
  vehicle_photo_url text,
  vehicle_registration_doc_url text,
  vehicle_insurance_url text,
  vehicle_roadworthy_url text,
  selfie_url text NOT NULL,
  selfie_hash text NOT NULL,
  bank_name text,
  bank_account_last4 text,
  tax_number text,
  background_check_consent boolean NOT NULL DEFAULT false,
  code_of_conduct_accepted boolean NOT NULL DEFAULT false,
  fic_declaration_accepted boolean NOT NULL DEFAULT false,
  ip_address text,
  device_fingerprint text,
  verification_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_kyc_id_number_unique
  ON public.driver_kyc (lower(id_number));
CREATE UNIQUE INDEX IF NOT EXISTS driver_kyc_license_number_unique
  ON public.driver_kyc (lower(license_number));
CREATE UNIQUE INDEX IF NOT EXISTS driver_kyc_selfie_hash_unique
  ON public.driver_kyc (selfie_hash);

GRANT SELECT, INSERT, UPDATE ON public.driver_kyc TO authenticated;
GRANT ALL ON public.driver_kyc TO service_role;

ALTER TABLE public.driver_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own KYC" ON public.driver_kyc
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Drivers insert own KYC" ON public.driver_kyc
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Drivers update own pending KYC" ON public.driver_kyc
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND verification_status = 'pending')
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage KYC" ON public.driver_kyc
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 18+ age enforcement
CREATE OR REPLACE FUNCTION public.enforce_driver_kyc_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NULL OR NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'Driver must be at least 18 years old.';
  END IF;
  IF NEW.license_expiry IS NULL OR NEW.license_expiry <= CURRENT_DATE THEN
    RAISE EXCEPTION 'Driver license must not be expired.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_kyc_age_check ON public.driver_kyc;
CREATE TRIGGER driver_kyc_age_check
  BEFORE INSERT OR UPDATE ON public.driver_kyc
  FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_kyc_age();

DROP TRIGGER IF EXISTS driver_kyc_updated_at ON public.driver_kyc;
CREATE TRIGGER driver_kyc_updated_at
  BEFORE UPDATE ON public.driver_kyc
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
