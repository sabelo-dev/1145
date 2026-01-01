
-- Fix search_path for functions
ALTER FUNCTION public.generate_referral_code() SET search_path = public;
ALTER FUNCTION public.get_or_create_referral_code(UUID) SET search_path = public;
ALTER FUNCTION public.process_referral_signup(UUID, TEXT) SET search_path = public;
