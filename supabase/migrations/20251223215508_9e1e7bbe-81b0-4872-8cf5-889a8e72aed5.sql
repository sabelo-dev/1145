-- Update product_images policy to allow viewing images for products in auctions
DROP POLICY IF EXISTS "Anyone can view product images for approved products" ON product_images;

CREATE POLICY "Anyone can view product images for viewable products" ON product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_images.product_id
    AND (
      products.status IN ('approved', 'active')
      OR EXISTS (
        SELECT 1 FROM auctions 
        WHERE auctions.product_id = products.id 
        AND auctions.status IN ('approved', 'active', 'unsold', 'sold')
      )
    )
  )
);