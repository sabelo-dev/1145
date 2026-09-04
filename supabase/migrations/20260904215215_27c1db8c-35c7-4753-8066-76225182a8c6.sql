CREATE TABLE public.dropship_merchant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  fx_mode text NOT NULL DEFAULT 'live',
  manual_fx_rate numeric,
  fx_margin_pct numeric NOT NULL DEFAULT 0,
  auto_fulfill boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.dropship_merchant_settings TO authenticated;
GRANT ALL ON public.dropship_merchant_settings TO service_role;

ALTER TABLE public.dropship_merchant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage their own dropshipping settings"
ON public.dropship_merchant_settings
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()));

CREATE POLICY "Admins manage all dropshipping settings"
ON public.dropship_merchant_settings
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_dropship_merchant_settings_updated_at
BEFORE UPDATE ON public.dropship_merchant_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.dropship_fx_mode_valid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fx_mode NOT IN ('live', 'manual') THEN
    RAISE EXCEPTION 'fx_mode must be live or manual';
  END IF;
  IF NEW.fx_mode = 'manual' AND COALESCE(NEW.manual_fx_rate, 0) <= 0 THEN
    RAISE EXCEPTION 'A manual rate must be greater than zero';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dropship_merchant_settings_validate
BEFORE INSERT OR UPDATE ON public.dropship_merchant_settings
FOR EACH ROW EXECUTE FUNCTION public.dropship_fx_mode_valid();