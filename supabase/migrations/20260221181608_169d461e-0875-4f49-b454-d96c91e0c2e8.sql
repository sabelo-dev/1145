-- Allow anyone to view basic vendor information (needed for product listings)
CREATE POLICY "Anyone can view approved vendor profiles"
ON public.vendors
FOR SELECT
USING (status = 'approved');