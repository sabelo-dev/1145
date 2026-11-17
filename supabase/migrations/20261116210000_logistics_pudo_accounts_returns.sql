-- =============================================================================
-- 1145 Logistics: pickup points & lockers, business accounts & invoicing, returns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pickup points & lockers (PUDO)
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_hubs
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,      -- offered to customers as a collection point
  ADD COLUMN IF NOT EXISTS opening_hours_text TEXT;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS collect_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS shipments_ready_for_collection_idx ON public.shipments (collect_by) WHERE status = 'ready_for_collection';

-- Nearest public collection points (anyone can list them).
CREATE OR REPLACE FUNCTION public.list_pickup_points(p_lat NUMERIC DEFAULT NULL, p_lng NUMERIC DEFAULT NULL, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (id UUID, code TEXT, name TEXT, hub_type TEXT, address JSONB, lat NUMERIC, lng NUMERIC, opening_hours_text TEXT, distance_km NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.id, h.code, h.name, h.hub_type, h.address, h.lat, h.lng, h.opening_hours_text,
         CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL ELSE round((2 * 6371 * asin(sqrt(
           power(sin(radians(h.lat - p_lat) / 2), 2) +
           cos(radians(p_lat)) * cos(radians(h.lat)) * power(sin(radians(h.lng - p_lng) / 2), 2))))::numeric, 1) END
    FROM public.logistics_hubs h
   WHERE h.is_active AND h.is_public AND h.hub_type IN ('pickup_point', 'locker') AND h.lat IS NOT NULL
   ORDER BY 9 NULLS LAST, h.name
   LIMIT least(greatest(coalesce(p_limit, 10), 1), 50)
$$;
GRANT EXECUTE ON FUNCTION public.list_pickup_points(NUMERIC, NUMERIC, INTEGER) TO anon, authenticated;

-- Counter / locker handover: the collector shows the code from their SMS.
CREATE OR REPLACE FUNCTION public.pudo_release(p_tracking_number TEXT, p_otp TEXT, p_collector_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = upper(trim(p_tracking_number)) FOR UPDATE;
  IF v_ship.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_ship.status <> 'ready_for_collection' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_ready', 'status', v_ship.status);
  END IF;
  IF v_ship.otp_failures >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'otp_locked');
  END IF;
  IF p_otp IS DISTINCT FROM v_ship.delivery_otp THEN
    UPDATE public.shipments SET otp_failures = otp_failures + 1 WHERE id = v_ship.id;
    RETURN jsonb_build_object('ok', false, 'error', CASE WHEN v_ship.otp_failures + 1 >= 5 THEN 'otp_locked' ELSE 'invalid_otp' END,
                              'attempts_left', greatest(4 - v_ship.otp_failures, 0));
  END IF;
  PERFORM set_config('logistics.event_notes', 'Collected' || coalesce(' by ' || nullif(trim(p_collector_name), ''), ''), true);
  UPDATE public.shipments SET status = 'delivered', delivered_at = now(), collected_at = now() WHERE id = v_ship.id;
  RETURN jsonb_build_object('ok', true, 'recipient', v_ship.recipient_name, 'cod_amount', v_ship.cod_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION public.pudo_release(TEXT, TEXT, TEXT) TO authenticated;

-- A parcel scanned in at its own destination point is ready for collection.
CREATE OR REPLACE FUNCTION public.shipments_pudo_arrival()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'at_hub' AND NEW.current_hub_id IS NOT NULL AND NEW.current_hub_id = NEW.destination_hub_id
     AND EXISTS (SELECT 1 FROM public.logistics_hubs h WHERE h.id = NEW.current_hub_id AND h.hub_type IN ('pickup_point', 'locker')) THEN
    NEW.status := 'ready_for_collection';
    NEW.collect_by := coalesce(NEW.collect_by, now() + interval '7 days');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_pudo_arrival ON public.shipments;
CREATE TRIGGER trg_shipments_pudo_arrival
  BEFORE UPDATE OF status, current_hub_id ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_pudo_arrival();

-- Uncollected after the deadline → return to sender (run by the nightly job).
CREATE OR REPLACE FUNCTION public.logistics_expire_collections()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM set_config('logistics.event_notes', 'Not collected in time, so returning to sender', true);
  UPDATE public.shipments SET status = 'returning'
   WHERE status = 'ready_for_collection' AND collect_by < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_expire_collections() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Business accounts & monthly invoicing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_no TEXT,
  vat_no TEXT,
  billing_email TEXT,
  billing_address TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 120),
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 10000,
  discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 60),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff view accounts" ON public.logistics_accounts;
CREATE POLICY "Staff view accounts" ON public.logistics_accounts FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff()));
DROP POLICY IF EXISTS "Owners manage accounts" ON public.logistics_accounts;
CREATE POLICY "Owners manage accounts" ON public.logistics_accounts FOR ALL TO authenticated
  USING ((SELECT public.is_logistics_staff(ARRAY['owner']))) WITH CHECK ((SELECT public.is_logistics_staff(ARRAY['owner'])));
DROP TRIGGER IF EXISTS update_logistics_accounts_updated_at ON public.logistics_accounts;
CREATE TRIGGER update_logistics_accounts_updated_at BEFORE UPDATE ON public.logistics_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_audit ON public.logistics_accounts;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.logistics_accounts FOR EACH ROW EXECUTE FUNCTION public.logistics_audit();

ALTER TABLE public.logistics_api_keys ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.logistics_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.logistics_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS shipments_account_idx ON public.shipments (account_id, created_at) WHERE account_id IS NOT NULL;

-- API shipments inherit the key's account; account discount applies to the fee.
CREATE OR REPLACE FUNCTION public.shipments_apply_account()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_discount NUMERIC;
BEGIN
  IF NEW.account_id IS NULL AND NEW.api_key_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.logistics_api_keys WHERE id = NEW.api_key_id;
  END IF;
  IF NEW.account_id IS NOT NULL THEN
    SELECT discount_pct INTO v_discount FROM public.logistics_accounts WHERE id = NEW.account_id;
    IF coalesce(v_discount, 0) > 0 AND NEW.shipping_fee IS NOT NULL THEN
      NEW.shipping_fee := round(NEW.shipping_fee * (1 - v_discount / 100), 2);
    END IF;
    NEW.payment_status := 'unpaid'; -- billed on the monthly invoice
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_apply_account ON public.shipments;
CREATE TRIGGER trg_shipments_apply_account
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_apply_account();

CREATE TABLE IF NOT EXISTS public.logistics_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES public.logistics_accounts(id) ON DELETE RESTRICT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  issued_at TIMESTAMPTZ,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, period_start, period_end)
);
ALTER TABLE public.logistics_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.logistics_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.logistics_invoices(id) ON DELETE CASCADE,
  shipment_id UUID UNIQUE REFERENCES public.shipments(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL
);
ALTER TABLE public.logistics_invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS logistics_invoice_lines_invoice_idx ON public.logistics_invoice_lines (invoice_id);

DROP POLICY IF EXISTS "Owners view invoices" ON public.logistics_invoices;
CREATE POLICY "Owners view invoices" ON public.logistics_invoices FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));
DROP POLICY IF EXISTS "Owners view invoice lines" ON public.logistics_invoice_lines;
CREATE POLICY "Owners view invoice lines" ON public.logistics_invoice_lines FOR SELECT TO authenticated USING ((SELECT public.is_logistics_staff(ARRAY['owner'])));

-- Draft one invoice per account for all billable, not-yet-invoiced shipments
-- delivered or returned in the period (inclusive dates, SAST). VAT 15%.
CREATE OR REPLACE FUNCTION public.logistics_generate_invoices(p_period_start DATE, p_period_end DATE)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a RECORD;
  v_invoice UUID;
  v_count INTEGER := 0;
  v_seq INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  FOR a IN
    SELECT DISTINCT s.account_id FROM public.shipments s
     WHERE s.account_id IS NOT NULL AND s.shipping_fee > 0
       AND s.status IN ('delivered', 'returned')
       AND coalesce(s.delivered_at, s.updated_at) >= (p_period_start::timestamp AT TIME ZONE 'Africa/Johannesburg')
       AND coalesce(s.delivered_at, s.updated_at) < ((p_period_end + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
       AND NOT EXISTS (SELECT 1 FROM public.logistics_invoice_lines l WHERE l.shipment_id = s.id)
  LOOP
    SELECT count(*) + 1 INTO v_seq FROM public.logistics_invoices WHERE to_char(created_at, 'YYYYMM') = to_char(now(), 'YYYYMM');
    INSERT INTO public.logistics_invoices (number, account_id, period_start, period_end)
    VALUES ('LX-INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0'), a.account_id, p_period_start, p_period_end)
    ON CONFLICT (account_id, period_start, period_end) DO UPDATE SET number = logistics_invoices.number
    RETURNING id INTO v_invoice;

    -- Only top up drafts; issued invoices are immutable.
    IF (SELECT status FROM public.logistics_invoices WHERE id = v_invoice) <> 'draft' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.logistics_invoice_lines (invoice_id, shipment_id, description, amount)
    SELECT v_invoice, s.id,
           s.tracking_number || coalesce(' · ' || s.reference, '') || ' · ' || initcap(replace(s.service_level, '_', ' '))
             || CASE WHEN s.source = 'api' AND s.metadata ? 'return_of' THEN ' · return' ELSE '' END,
           round(s.shipping_fee / 1.15, 2)                -- fees are VAT-inclusive
      FROM public.shipments s
     WHERE s.account_id = a.account_id AND s.shipping_fee > 0
       AND s.status IN ('delivered', 'returned')
       AND coalesce(s.delivered_at, s.updated_at) >= (p_period_start::timestamp AT TIME ZONE 'Africa/Johannesburg')
       AND coalesce(s.delivered_at, s.updated_at) < ((p_period_end + 1)::timestamp AT TIME ZONE 'Africa/Johannesburg')
       AND NOT EXISTS (SELECT 1 FROM public.logistics_invoice_lines l WHERE l.shipment_id = s.id)
    ON CONFLICT (shipment_id) DO NOTHING;

    UPDATE public.logistics_invoices i
       SET subtotal = t.sub, vat = round(t.sub * 0.15, 2), total = t.sub + round(t.sub * 0.15, 2)
      FROM (SELECT coalesce(sum(amount), 0) AS sub FROM public.logistics_invoice_lines WHERE invoice_id = v_invoice) t
     WHERE i.id = v_invoice;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_generate_invoices(DATE, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.logistics_set_invoice_status(p_invoice_id UUID, p_status TEXT, p_payment_ref TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.logistics_invoices;
  v_terms INTEGER;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_inv FROM public.logistics_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF NOT ((v_inv.status = 'draft' AND p_status IN ('issued', 'void'))
       OR (v_inv.status = 'issued' AND p_status IN ('paid', 'void'))) THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;
  IF p_status = 'paid' AND coalesce(trim(p_payment_ref), '') = '' THEN
    RAISE EXCEPTION 'payment_reference_required';
  END IF;
  SELECT payment_terms_days INTO v_terms FROM public.logistics_accounts WHERE id = v_inv.account_id;

  UPDATE public.logistics_invoices
     SET status = p_status,
         issued_at = CASE WHEN p_status = 'issued' THEN now() ELSE issued_at END,
         due_date = CASE WHEN p_status = 'issued' THEN current_date + v_terms ELSE due_date END,
         paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
         payment_ref = CASE WHEN p_status = 'paid' THEN left(trim(p_payment_ref), 80) ELSE payment_ref END
   WHERE id = v_inv.id;

  IF p_status = 'void' THEN
    DELETE FROM public.logistics_invoice_lines WHERE invoice_id = v_inv.id; -- shipments become billable again
  ELSIF p_status = 'paid' THEN
    UPDATE public.shipments SET payment_status = 'paid'
     WHERE id IN (SELECT shipment_id FROM public.logistics_invoice_lines WHERE invoice_id = v_inv.id);
  END IF;

  INSERT INTO public.logistics_audit_log (actor_id, action, entity_type, entity_id, details, ip)
  VALUES (auth.uid(), 'invoice_' || p_status, 'logistics_invoices', v_inv.id::text,
          jsonb_build_object('number', v_inv.number, 'total', v_inv.total, 'payment_ref', p_payment_ref), public.logistics_client_ip());
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_set_invoice_status(UUID, TEXT, TEXT) TO authenticated;

-- Credit control: balance = issued unpaid invoices + uninvoiced delivered fees + open parcels.
CREATE OR REPLACE FUNCTION public.logistics_account_standing(p_account_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', a.status,
    'credit_limit', a.credit_limit,
    'invoiced_unpaid', coalesce((SELECT sum(total) FROM public.logistics_invoices i WHERE i.account_id = a.id AND i.status = 'issued'), 0),
    'overdue', coalesce((SELECT sum(total) FROM public.logistics_invoices i WHERE i.account_id = a.id AND i.status = 'issued' AND i.due_date < current_date), 0),
    'unbilled', coalesce((SELECT sum(s.shipping_fee) FROM public.shipments s
                           WHERE s.account_id = a.id AND s.status NOT IN ('cancelled')
                             AND NOT EXISTS (SELECT 1 FROM public.logistics_invoice_lines l JOIN public.logistics_invoices i ON i.id = l.invoice_id
                                              WHERE l.shipment_id = s.id AND i.status IN ('issued', 'paid'))), 0)
  )
  FROM public.logistics_accounts a WHERE a.id = p_account_id
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_account_standing(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logistics_account_standing(UUID) TO authenticated, service_role;

-- New account shipments are refused when the account is on hold, has overdue
-- invoices, or would exceed its credit limit. Staff can still book manually.
CREATE OR REPLACE FUNCTION public.shipments_credit_check()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v JSONB;
BEGIN
  IF NEW.account_id IS NULL OR (auth.uid() IS NOT NULL AND public.is_logistics_staff()) THEN
    RETURN NEW;
  END IF;
  v := public.logistics_account_standing(NEW.account_id);
  IF v->>'status' <> 'active' THEN
    RAISE EXCEPTION 'account_on_hold' USING ERRCODE = 'P0402';
  END IF;
  IF (v->>'overdue')::numeric > 0 THEN
    RAISE EXCEPTION 'account_overdue' USING ERRCODE = 'P0402';
  END IF;
  IF (v->>'invoiced_unpaid')::numeric + (v->>'unbilled')::numeric + coalesce(NEW.shipping_fee, 0) > (v->>'credit_limit')::numeric THEN
    RAISE EXCEPTION 'credit_limit_exceeded' USING ERRCODE = 'P0402';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_credit_check ON public.shipments;
CREATE TRIGGER trg_shipments_credit_check
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_credit_check();

-- ---------------------------------------------------------------------------
-- 3. Returns
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_settings
  ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS return_window_days INTEGER NOT NULL DEFAULT 14 CHECK (return_window_days BETWEEN 1 AND 90);
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS return_of_shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_reason TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS shipments_one_return_key ON public.shipments (return_of_shipment_id)
  WHERE return_of_shipment_id IS NOT NULL AND status <> 'cancelled';

-- Create the reverse shipment (internal). Billing follows the original:
-- account parcels go on the account; consumer parcels are pay-on-collection.
CREATE OR REPLACE FUNCTION public.logistics_create_return(p_shipment_id UUID, p_reason TEXT, p_initiator TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_orig public.shipments;
  v_cfg public.logistics_settings;
  v_ret public.shipments;
  v_fee NUMERIC;
BEGIN
  SELECT * INTO v_cfg FROM public.logistics_settings WHERE id;
  SELECT * INTO v_orig FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT v_cfg.returns_enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'returns_disabled');
  END IF;
  IF v_orig.id IS NULL OR v_orig.status <> 'delivered' OR v_orig.return_of_shipment_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_returnable');
  END IF;
  IF v_orig.pii_redacted_at IS NOT NULL OR v_orig.delivered_at < now() - make_interval(days => v_cfg.return_window_days) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'return_window_closed');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shipments WHERE return_of_shipment_id = v_orig.id AND status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'return_exists');
  END IF;

  v_fee := CASE WHEN v_orig.shipping_fee IS NULL THEN NULL ELSE round(v_orig.shipping_fee * 0.9, 0) END;

  INSERT INTO public.shipments (
    return_of_shipment_id, return_reason, reference, account_id, api_key_id, customer_user_id, source,
    sender_name, sender_phone, recipient_name, recipient_phone,
    pickup_address, delivery_address, origin_hub_id, service_level, status, parcel_count, weight_kg,
    shipping_fee, payment_status, require_otp, promised_by, metadata
  ) VALUES (
    v_orig.id, left(p_reason, 300), coalesce(v_orig.reference, v_orig.tracking_number) || '-RTN',
    v_orig.account_id, v_orig.api_key_id, v_orig.customer_user_id, v_orig.source,
    v_orig.recipient_name, v_orig.recipient_phone, v_orig.sender_name, v_orig.sender_phone,
    v_orig.delivery_address, v_orig.pickup_address, v_orig.destination_hub_id, 'standard', 'awaiting_pickup',
    v_orig.parcel_count, v_orig.weight_kg,
    v_fee, CASE WHEN v_fee IS NULL THEN 'not_required' ELSE 'unpaid' END, false, now() + interval '72 hours',
    jsonb_build_object('return_of', v_orig.tracking_number, 'initiator', p_initiator)
  ) RETURNING * INTO v_ret;

  INSERT INTO public.shipment_events (shipment_id, status, event_type, notes)
  VALUES (v_orig.id, v_orig.status, 'note', 'Return requested (' || p_initiator || '): ' || coalesce(nullif(p_reason, ''), 'no reason') || ' → ' || v_ret.tracking_number);
  RETURN jsonb_build_object('ok', true, 'tracking_number', v_ret.tracking_number, 'fee', v_ret.shipping_fee);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_create_return(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Recipient-initiated return from the tracking page (same verification as self-service).
CREATE OR REPLACE FUNCTION public.recipient_request_return(p_tracking_number TEXT, p_phone_last4 TEXT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  IF NOT public.logistics_rate_hit('selfserve:' || coalesce(public.logistics_client_ip(), 'unknown'), 10, 60) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = upper(trim(p_tracking_number));
  IF v_ship.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_ship.selfservice_failures >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked');
  END IF;
  IF v_ship.recipient_phone IS NULL OR right(regexp_replace(v_ship.recipient_phone, '\D', '', 'g'), 4) IS DISTINCT FROM p_phone_last4 THEN
    UPDATE public.shipments SET selfservice_failures = selfservice_failures + 1 WHERE id = v_ship.id;
    RETURN jsonb_build_object('ok', false, 'error', 'verification_failed', 'attempts_left', greatest(4 - v_ship.selfservice_failures, 0));
  END IF;
  IF coalesce(trim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
  END IF;
  RETURN public.logistics_create_return(v_ship.id, p_reason, 'recipient');
END;
$$;
GRANT EXECUTE ON FUNCTION public.recipient_request_return(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Staff-initiated return from the console.
CREATE OR REPLACE FUNCTION public.logistics_staff_return(p_shipment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.logistics_create_return(p_shipment_id, p_reason, 'staff');
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_staff_return(UUID, TEXT) TO authenticated;

-- Tracking: expose collection point & return eligibility (wraps v2 output).
ALTER FUNCTION public.track_shipment(TEXT) RENAME TO track_shipment_base;
REVOKE EXECUTE ON FUNCTION public.track_shipment_base(TEXT) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.track_shipment(p_tracking_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base JSONB := public.track_shipment_base(p_tracking_number);
  v_ship public.shipments;
  v_hub public.logistics_hubs;
  v_cfg public.logistics_settings;
BEGIN
  IF v_base IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = upper(trim(p_tracking_number));
  SELECT * INTO v_cfg FROM public.logistics_settings WHERE id;
  IF v_ship.destination_hub_id IS NOT NULL THEN
    SELECT * INTO v_hub FROM public.logistics_hubs WHERE id = v_ship.destination_hub_id AND hub_type IN ('pickup_point', 'locker');
  END IF;
  RETURN v_base || jsonb_build_object(
    -- Merchant branding for account shipments (columns added in the branding migration).
    'brand', (SELECT CASE WHEN a.brand_name IS NULL AND a.brand_logo_url IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(
                'name', coalesce(a.brand_name, a.name), 'logo_url', a.brand_logo_url, 'color', a.brand_color,
                'support_phone', a.support_phone, 'support_email', a.support_email, 'message', a.tracking_message)) END
                FROM public.logistics_accounts a WHERE a.id = v_ship.account_id),
    'pickup_point', CASE WHEN v_hub.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_hub.name, 'type', v_hub.hub_type, 'address', v_hub.address,
      'lat', v_hub.lat, 'lng', v_hub.lng, 'opening_hours', v_hub.opening_hours_text) END,
    'collect_by', v_ship.collect_by,
    'is_return', v_ship.return_of_shipment_id IS NOT NULL,
    'can_return', v_cfg.returns_enabled AND v_ship.status = 'delivered' AND v_ship.return_of_shipment_id IS NULL
                  AND v_ship.pii_redacted_at IS NULL AND v_ship.recipient_phone IS NOT NULL
                  AND v_ship.delivered_at > now() - make_interval(days => v_cfg.return_window_days)
                  AND NOT EXISTS (SELECT 1 FROM public.shipments r WHERE r.return_of_shipment_id = v_ship.id AND r.status <> 'cancelled')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_shipment(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Schedules
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('logistics-expire-collections', 'logistics-monthly-invoices');
    PERFORM cron.schedule('logistics-expire-collections', '30 1 * * *', 'SELECT public.logistics_expire_collections()');
    -- 1st of each month 03:00: draft invoices for the previous month.
    PERFORM cron.schedule('logistics-monthly-invoices', '0 3 1 * *',
      $c$SELECT public.logistics_generate_invoices((date_trunc('month', current_date) - interval '1 month')::date, (date_trunc('month', current_date) - interval '1 day')::date)$c$);
  END IF;
END;
$$;
