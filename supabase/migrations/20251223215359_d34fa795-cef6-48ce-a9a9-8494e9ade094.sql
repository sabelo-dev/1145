-- Drop and recreate the policy to include products that are part of auctions
DROP POLICY IF EXISTS "Anyone can view approved products" ON products;

CREATE POLICY "Anyone can view approved or auctioned products" ON products
FOR SELECT
USING (
  (status = 'approved' OR status = 'active')
  OR 
  EXISTS (
    SELECT 1 FROM auctions 
    WHERE auctions.product_id = products.id 
    AND auctions.status IN ('approved', 'active', 'unsold', 'sold')
  )
);