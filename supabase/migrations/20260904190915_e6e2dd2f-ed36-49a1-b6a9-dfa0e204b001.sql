
CREATE OR REPLACE FUNCTION public.dropship_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'dropship_audit_log records are immutable';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dropship_available_stock(uuid) FROM anon;
