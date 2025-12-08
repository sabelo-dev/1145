-- Create a security definer function to check if a user is a vendor (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_vendor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendors
    WHERE user_id = _user_id
  )
$$;

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Vendors can view customer profiles for messaging" ON public.profiles;

-- Recreate the policy using the security definer function
CREATE POLICY "Vendors can view customer profiles for messaging"
ON public.profiles
FOR SELECT
USING (public.is_vendor(auth.uid()));