-- Add personal details columns to influencer_profiles
ALTER TABLE public.influencer_profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS id_number text,
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'South Africa';

-- Add comments for documentation
COMMENT ON COLUMN public.influencer_profiles.first_name IS 'Legal first name for admin records';
COMMENT ON COLUMN public.influencer_profiles.last_name IS 'Legal last name for admin records';
COMMENT ON COLUMN public.influencer_profiles.phone IS 'Contact phone number';
COMMENT ON COLUMN public.influencer_profiles.date_of_birth IS 'Date of birth for verification';
COMMENT ON COLUMN public.influencer_profiles.id_number IS 'National ID or passport number';
COMMENT ON COLUMN public.influencer_profiles.street_address IS 'Street address';
COMMENT ON COLUMN public.influencer_profiles.city IS 'City of residence';
COMMENT ON COLUMN public.influencer_profiles.province IS 'Province/State';
COMMENT ON COLUMN public.influencer_profiles.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN public.influencer_profiles.country IS 'Country of residence';