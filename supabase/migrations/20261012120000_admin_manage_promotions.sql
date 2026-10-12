-- Admins can see and manage every store's promotions.
--
-- Until now only the store's own merchant could, and everyone else could only
-- read promotions that are live, so the admin dashboard had nothing to show.

DROP POLICY IF EXISTS "Admins can manage all promotions" ON public.promotions;
CREATE POLICY "Admins can manage all promotions"
  ON public.promotions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
