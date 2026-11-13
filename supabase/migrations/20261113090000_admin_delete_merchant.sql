-- Admin → Merchant Management could not delete merchants: the vendor → merchant
-- rename (20261010090050) revoked EXECUTE on delete_merchant_cascade from
-- authenticated, so the admin page's RPC got "permission denied" (shown as
-- "Failed to remove merchant: Unknown error").
--
-- The function is SECURITY DEFINER, so callers are checked inside it: only
-- admins may run it. Signed-in users can execute it again; anyone else is
-- refused before anything is deleted. The body is unchanged otherwise.

CREATE OR REPLACE FUNCTION public.delete_merchant_cascade(merchant_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  merchant_user_id UUID;
  merchant_store_ids UUID[];
BEGIN
  -- auth.uid() is null for the service role, which keeps its access.
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete merchants' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO merchant_user_id FROM merchants WHERE id = merchant_uuid;

  IF merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Merchant not found';
  END IF;

  SELECT ARRAY_AGG(id) INTO merchant_store_ids FROM stores WHERE merchant_id = merchant_uuid;

  IF merchant_store_ids IS NOT NULL THEN
    DELETE FROM products WHERE store_id = ANY(merchant_store_ids);
    DELETE FROM collections WHERE store_id = ANY(merchant_store_ids);
    DELETE FROM conversations WHERE store_id = ANY(merchant_store_ids);
  END IF;

  DELETE FROM stores WHERE merchant_id = merchant_uuid;

  DELETE FROM merchant_documents WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_notifications WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_payment_methods WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_features WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_usage WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_upgrade_triggers WHERE merchant_id = merchant_uuid;
  DELETE FROM merchant_subscription_audit_log WHERE merchant_id = merchant_uuid;
  DELETE FROM payouts WHERE merchant_id = merchant_uuid;
  DELETE FROM promo_credit_transactions WHERE merchant_id = merchant_uuid;
  DELETE FROM support_tickets WHERE merchant_id = merchant_uuid;
  DELETE FROM custom_attribute_values WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_improvement_tips WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_performance WHERE merchant_id = merchant_uuid;
  DELETE FROM brand_tier_history WHERE merchant_id = merchant_uuid;
  DELETE FROM auto_campaigns WHERE merchant_id = merchant_uuid;

  DELETE FROM merchants WHERE id = merchant_uuid;

  -- Keep the merchant role while the user still owns another merchant record
  -- (duplicate onboarding rows used to be created for one account).
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE user_id = merchant_user_id) THEN
    DELETE FROM user_roles WHERE user_id = merchant_user_id AND role = 'merchant';

    UPDATE profiles
    SET role = 'consumer'
    WHERE id = merchant_user_id
      AND NOT EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = merchant_user_id AND role != 'consumer'
      );
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_merchant_cascade(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_merchant_cascade(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_merchant_cascade(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
