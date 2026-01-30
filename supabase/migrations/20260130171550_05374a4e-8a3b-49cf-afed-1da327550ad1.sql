-- Drop and recreate the UPDATE policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "Influencers can update their own profile" ON public.influencer_profiles;

CREATE POLICY "Influencers can update their own profile"
ON public.influencer_profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());