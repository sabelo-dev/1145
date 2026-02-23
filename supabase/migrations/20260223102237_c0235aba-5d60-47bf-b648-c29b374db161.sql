
-- Add unique constraint to ensure one domain maps to one store only
ALTER TABLE public.merchant_custom_domains 
  ADD CONSTRAINT merchant_custom_domains_domain_unique UNIQUE (domain);

-- Create function to suspend custom domains when merchant downgrades from Gold
CREATE OR REPLACE FUNCTION public.handle_vendor_tier_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when tier changes FROM gold to something else
  IF OLD.subscription_tier = 'gold' AND NEW.subscription_tier != 'gold' THEN
    -- Suspend all active custom domains for this vendor
    UPDATE public.merchant_custom_domains
    SET status = 'suspended'
    WHERE vendor_id = NEW.id AND status = 'active';
    
    -- Disable white-label on all stores for this vendor
    UPDATE public.storefront_customizations sc
    SET white_label = false
    FROM public.stores s
    WHERE sc.store_id = s.id AND s.vendor_id = NEW.id;
  END IF;
  
  -- If upgrading back to Gold, reactivate suspended domains
  IF OLD.subscription_tier != 'gold' AND NEW.subscription_tier = 'gold' THEN
    UPDATE public.merchant_custom_domains
    SET status = 'active'
    WHERE vendor_id = NEW.id AND status = 'suspended';
    
    -- Re-enable white-label if they have active domains
    IF EXISTS (SELECT 1 FROM public.merchant_custom_domains WHERE vendor_id = NEW.id AND status = 'active') THEN
      UPDATE public.storefront_customizations sc
      SET white_label = true
      FROM public.stores s
      WHERE sc.store_id = s.id AND s.vendor_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on vendors table for tier changes
DROP TRIGGER IF EXISTS handle_vendor_tier_downgrade_trigger ON public.vendors;
CREATE TRIGGER handle_vendor_tier_downgrade_trigger
  AFTER UPDATE OF subscription_tier ON public.vendors
  FOR EACH ROW
  WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
  EXECUTE FUNCTION public.handle_vendor_tier_downgrade();
