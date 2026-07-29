
-- Trigger: when a vendor row is inserted, assign the 'vendor' role in user_roles
CREATE OR REPLACE FUNCTION public.assign_vendor_role_on_vendor_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'vendor'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_vendor_role_on_vendor_insert ON public.vendors;
CREATE TRIGGER trg_assign_vendor_role_on_vendor_insert
AFTER INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.assign_vendor_role_on_vendor_insert();

-- Backfill: any vendor with a user_id but no 'vendor' role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT v.user_id, 'vendor'::app_role
FROM public.vendors v
WHERE v.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
