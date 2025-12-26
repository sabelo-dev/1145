-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Anyone can view approved or auctioned products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view approved/active auctions" ON public.auctions;

-- Recreate products policy without referencing auctions table
CREATE POLICY "Anyone can view approved products"
ON public.products
FOR SELECT
USING (status = 'approved' OR status = 'active');

-- Recreate auctions policy without referencing products table in a way that causes recursion
CREATE POLICY "Anyone can view public auctions"
ON public.auctions
FOR SELECT
USING (status IN ('approved', 'active', 'ended', 'sold', 'unsold'));