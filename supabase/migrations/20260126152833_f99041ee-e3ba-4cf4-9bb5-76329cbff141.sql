-- Create a function to fully delete a vendor and all associated data
CREATE OR REPLACE FUNCTION public.delete_vendor_cascade(vendor_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vendor_user_id UUID;
  vendor_store_ids UUID[];
BEGIN
  -- Get the user_id associated with this vendor
  SELECT user_id INTO vendor_user_id FROM vendors WHERE id = vendor_uuid;
  
  IF vendor_user_id IS NULL THEN
    RAISE EXCEPTION 'Vendor not found';
  END IF;
  
  -- Get all store IDs for this vendor
  SELECT ARRAY_AGG(id) INTO vendor_store_ids FROM stores WHERE vendor_id = vendor_uuid;
  
  -- Delete products associated with vendor's stores (if not cascaded)
  IF vendor_store_ids IS NOT NULL THEN
    DELETE FROM products WHERE store_id = ANY(vendor_store_ids);
    DELETE FROM collections WHERE store_id = ANY(vendor_store_ids);
    DELETE FROM conversations WHERE store_id = ANY(vendor_store_ids);
  END IF;
  
  -- Delete stores
  DELETE FROM stores WHERE vendor_id = vendor_uuid;
  
  -- Delete vendor-related data (most should cascade, but being explicit)
  DELETE FROM vendor_documents WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_notifications WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_payment_methods WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_subscription_features WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_subscription_usage WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_upgrade_triggers WHERE vendor_id = vendor_uuid;
  DELETE FROM vendor_subscription_audit_log WHERE vendor_id = vendor_uuid;
  DELETE FROM payouts WHERE vendor_id = vendor_uuid;
  DELETE FROM promo_credit_transactions WHERE vendor_id = vendor_uuid;
  DELETE FROM support_tickets WHERE vendor_id = vendor_uuid;
  DELETE FROM custom_attribute_values WHERE vendor_id = vendor_uuid;
  DELETE FROM brand_improvement_tips WHERE vendor_id = vendor_uuid;
  DELETE FROM brand_performance WHERE vendor_id = vendor_uuid;
  DELETE FROM brand_tier_history WHERE vendor_id = vendor_uuid;
  DELETE FROM auto_campaigns WHERE vendor_id = vendor_uuid;
  
  -- Delete the vendor record itself
  DELETE FROM vendors WHERE id = vendor_uuid;
  
  -- Remove vendor role from user_roles table
  DELETE FROM user_roles WHERE user_id = vendor_user_id AND role = 'vendor';
  
  -- Update profile role back to consumer if they have no other roles
  UPDATE profiles 
  SET role = 'consumer' 
  WHERE id = vendor_user_id 
    AND NOT EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = vendor_user_id AND role != 'consumer'
    );
END;
$$;

-- Grant execute permission to authenticated users (admin check happens in app)
GRANT EXECUTE ON FUNCTION public.delete_vendor_cascade(UUID) TO authenticated;