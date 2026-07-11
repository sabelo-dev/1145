
-- Remove recursive policies: profiles ↔ vendors caused infinite recursion.

-- 1. Drop vendors policies that reference profiles; replace with has_role.
DROP POLICY IF EXISTS "Admins can update vendor status" ON public.vendors;
DROP POLICY IF EXISTS "Admins can view all vendors" ON public.vendors;

CREATE POLICY "Admins can update vendor status" ON public.vendors
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all vendors" ON public.vendors
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Drop the profiles policy that recurses through vendors→stores→conversations.
DROP POLICY IF EXISTS "Vendors view customers with active conversations" ON public.profiles;

-- 3. Consolidate duplicate profiles policies for clarity.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.profiles;
