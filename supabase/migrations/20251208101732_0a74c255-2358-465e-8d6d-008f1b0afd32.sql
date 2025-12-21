-- Allow vendors to view customer profiles for messaging purposes
CREATE POLICY "Vendors can view customer profiles for messaging"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vendors v
    WHERE v.user_id = auth.uid()
  )
);