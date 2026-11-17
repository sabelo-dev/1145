-- =============================================================================
-- 1145 Logistics: business portal, multi-piece shipments, invoice delivery
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pieces (one barcode per physical parcel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipment_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  piece_no INTEGER NOT NULL CHECK (piece_no > 0),
  barcode TEXT NOT NULL UNIQUE,
  last_scan_hub_id UUID REFERENCES public.logistics_hubs(id) ON DELETE SET NULL,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, piece_no)
);
ALTER TABLE public.shipment_pieces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View pieces of visible shipments" ON public.shipment_pieces;
CREATE POLICY "View pieces of visible shipments" ON public.shipment_pieces
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.shipments s WHERE s.id = shipment_pieces.shipment_id));

-- Keep pieces 1..parcel_count in sync (never drops a piece that's been scanned).
CREATE OR REPLACE FUNCTION public.shipments_sync_pieces()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shipment_pieces (shipment_id, piece_no, barcode)
  SELECT NEW.id, n, NEW.tracking_number || '-' || n
    FROM generate_series(1, greatest(NEW.parcel_count, 1)) n
  ON CONFLICT (shipment_id, piece_no) DO NOTHING;
  DELETE FROM public.shipment_pieces
   WHERE shipment_id = NEW.id AND piece_no > NEW.parcel_count AND last_scanned_at IS NULL;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_sync_pieces ON public.shipments;
CREATE TRIGGER trg_shipments_sync_pieces
  AFTER INSERT OR UPDATE OF parcel_count ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_sync_pieces();

INSERT INTO public.shipment_pieces (shipment_id, piece_no, barcode)
SELECT s.id, n, s.tracking_number || '-' || n
  FROM public.shipments s, generate_series(1, greatest(s.parcel_count, 1)) n
ON CONFLICT DO NOTHING;

-- Hub scan by piece barcode (LX…-2) or tracking number (single-piece only).
-- The shipment moves to the hub once every piece has been scanned there.
CREATE OR REPLACE FUNCTION public.logistics_scan_piece(p_code TEXT, p_hub_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code TEXT := upper(trim(p_code));
  v_piece public.shipment_pieces;
  v_ship public.shipments;
  v_here INTEGER;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher', 'hub_operator']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_piece FROM public.shipment_pieces WHERE barcode = v_code;
  IF v_piece.id IS NULL THEN
    SELECT * INTO v_ship FROM public.shipments WHERE tracking_number = v_code;
    IF v_ship.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
    IF v_ship.parcel_count > 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'scan_each_piece', 'tracking_number', v_ship.tracking_number, 'pieces', v_ship.parcel_count);
    END IF;
    SELECT * INTO v_piece FROM public.shipment_pieces WHERE shipment_id = v_ship.id AND piece_no = 1;
  ELSE
    SELECT * INTO v_ship FROM public.shipments WHERE id = v_piece.shipment_id;
  END IF;

  IF v_ship.status IN ('delivered', 'returned', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'closed', 'tracking_number', v_ship.tracking_number, 'status', v_ship.status);
  END IF;

  UPDATE public.shipment_pieces SET last_scan_hub_id = p_hub_id, last_scanned_at = now() WHERE id = v_piece.id;
  SELECT count(*) INTO v_here FROM public.shipment_pieces
   WHERE shipment_id = v_ship.id AND last_scan_hub_id = p_hub_id AND last_scanned_at > now() - interval '24 hours';

  IF v_here >= v_ship.parcel_count AND (v_ship.current_hub_id IS DISTINCT FROM p_hub_id OR v_ship.status NOT IN ('at_hub', 'ready_for_collection')) THEN
    PERFORM set_config('logistics.event_notes', 'All ' || v_ship.parcel_count || ' piece(s) received', true);
    UPDATE public.shipments
       SET status = CASE WHEN status = 'returning' THEN 'returning' ELSE 'at_hub' END, current_hub_id = p_hub_id
     WHERE id = v_ship.id
    RETURNING * INTO v_ship;
  END IF;

  RETURN jsonb_build_object('ok', true, 'tracking_number', v_ship.tracking_number, 'piece_no', v_piece.piece_no,
    'pieces', v_ship.parcel_count, 'scanned_here', v_here, 'complete', v_here >= v_ship.parcel_count,
    'status', v_ship.status, 'recipient', v_ship.recipient_name, 'flagged', v_ship.status = 'exception');
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_scan_piece(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Business portal: account members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logistics_account_members (
  account_id UUID NOT NULL REFERENCES public.logistics_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);
ALTER TABLE public.logistics_account_members ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_audit ON public.logistics_account_members;
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.logistics_account_members FOR EACH ROW EXECUTE FUNCTION public.logistics_audit();

-- Accounts the caller belongs to (optionally only as admin). Active accounts only.
CREATE OR REPLACE FUNCTION public.logistics_my_account_ids(p_admin_only BOOLEAN DEFAULT false)
RETURNS UUID[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(array_agg(m.account_id), '{}')
    FROM public.logistics_account_members m
    JOIN public.logistics_accounts a ON a.id = m.account_id
   WHERE m.user_id = auth.uid() AND a.status <> 'closed'
     AND (NOT p_admin_only OR m.role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.logistics_my_account_ids(BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "Members view memberships" ON public.logistics_account_members;
CREATE POLICY "Members view memberships" ON public.logistics_account_members
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR account_id IN (SELECT unnest(public.logistics_my_account_ids(true))) OR (SELECT public.is_logistics_staff(ARRAY['owner'])));

DROP POLICY IF EXISTS "Portal: own account" ON public.logistics_accounts;
CREATE POLICY "Portal: own account" ON public.logistics_accounts
  FOR SELECT TO authenticated USING (id IN (SELECT unnest(public.logistics_my_account_ids())));

DROP POLICY IF EXISTS "Portal: account shipments" ON public.shipments;
CREATE POLICY "Portal: account shipments" ON public.shipments
  FOR SELECT TO authenticated USING (account_id IN (SELECT unnest(public.logistics_my_account_ids())));

DROP POLICY IF EXISTS "Portal: account invoices" ON public.logistics_invoices;
CREATE POLICY "Portal: account invoices" ON public.logistics_invoices
  FOR SELECT TO authenticated USING (account_id IN (SELECT unnest(public.logistics_my_account_ids(true))) AND status <> 'draft');
DROP POLICY IF EXISTS "Portal: account invoice lines" ON public.logistics_invoice_lines;
CREATE POLICY "Portal: account invoice lines" ON public.logistics_invoice_lines
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.logistics_invoices i WHERE i.id = logistics_invoice_lines.invoice_id));

-- Account admins manage their own account's keys and webhooks.
DROP POLICY IF EXISTS "Portal: account keys" ON public.logistics_api_keys;
CREATE POLICY "Portal: account keys" ON public.logistics_api_keys
  FOR ALL TO authenticated
  USING (account_id IN (SELECT unnest(public.logistics_my_account_ids(true))))
  WITH CHECK (account_id IN (SELECT unnest(public.logistics_my_account_ids(true))));

DROP POLICY IF EXISTS "Portal: account webhooks" ON public.logistics_webhooks;
CREATE POLICY "Portal: account webhooks" ON public.logistics_webhooks
  FOR ALL TO authenticated
  USING (api_key_id IN (SELECT id FROM public.logistics_api_keys WHERE account_id IN (SELECT unnest(public.logistics_my_account_ids(true)))))
  WITH CHECK (api_key_id IN (SELECT id FROM public.logistics_api_keys WHERE account_id IN (SELECT unnest(public.logistics_my_account_ids(true)))));

DROP POLICY IF EXISTS "Portal: webhook deliveries" ON public.logistics_webhook_deliveries;
CREATE POLICY "Portal: webhook deliveries" ON public.logistics_webhook_deliveries
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.logistics_webhooks w WHERE w.id = logistics_webhook_deliveries.webhook_id));

-- Portal key rows can't pick a hub or bypass the account's own limits.
CREATE OR REPLACE FUNCTION public.logistics_api_keys_portal_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_logistics_staff(ARRAY['owner']) THEN
    NEW.rate_limit_per_min := least(coalesce(NEW.rate_limit_per_min, 120), 300);
    IF TG_OP = 'UPDATE' THEN
      NEW.account_id := OLD.account_id;
      NEW.key_hash := OLD.key_hash;
      NEW.default_hub_id := OLD.default_hub_id;
    ELSE
      NEW.default_hub_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_logistics_api_keys_portal_guard ON public.logistics_api_keys;
CREATE TRIGGER trg_logistics_api_keys_portal_guard
  BEFORE INSERT OR UPDATE ON public.logistics_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.logistics_api_keys_portal_guard();

-- Invite an existing 1145 user to an account (platform owners or account admins).
CREATE OR REPLACE FUNCTION public.logistics_set_account_member(p_account_id UUID, p_email TEXT, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  IF NOT (public.is_logistics_staff(ARRAY['owner']) OR p_account_id = ANY (public.logistics_my_account_ids(true))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'user', 'remove') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
  IF p_role = 'remove' THEN
    IF v_user = auth.uid() THEN
      RAISE EXCEPTION 'cannot_remove_self';
    END IF;
    DELETE FROM public.logistics_account_members WHERE account_id = p_account_id AND user_id = v_user;
  ELSE
    INSERT INTO public.logistics_account_members (account_id, user_id, role, invited_by)
    VALUES (p_account_id, v_user, p_role, auth.uid())
    ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_set_account_member(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.logistics_list_account_members(p_account_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_logistics_staff(ARRAY['owner']) OR p_account_id = ANY (public.logistics_my_account_ids(true))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.user_id, u.email::text, m.role, m.created_at
    FROM public.logistics_account_members m JOIN auth.users u ON u.id = m.user_id
   WHERE m.account_id = p_account_id ORDER BY m.created_at;
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_list_account_members(UUID) TO authenticated;

-- Portal bookings: same pricing, credit and approval rules as the API.
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_source_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_source_check
  CHECK (source IN ('ops', 'csv_import', 'marketplace', 'consumer', 'api', 'portal'));

CREATE OR REPLACE FUNCTION public.portal_book_shipment(p_account_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account public.logistics_accounts;
  v_service TEXT := coalesce(p_payload->>'service_level', 'next_day');
  v_size TEXT := coalesce(p_payload->>'size', 'small');
  v_window TEXT := coalesce(p_payload->>'delivery_window', 'any');
  v_pickup JSONB := p_payload->'pickup_address';
  v_delivery JSONB := p_payload->'delivery_address';
  v_point public.logistics_hubs;
  v_quote JSONB;
  v_promise TIMESTAMPTZ;
  v_ship public.shipments;
BEGIN
  IF NOT p_account_id = ANY (public.logistics_my_account_ids()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_account FROM public.logistics_accounts WHERE id = p_account_id;
  IF coalesce(trim(p_payload->>'recipient_name'), '') = '' OR coalesce(trim(p_payload->>'recipient_phone'), '') = '' THEN
    RAISE EXCEPTION 'missing_recipient';
  END IF;
  IF NOT (v_service IN ('express', 'same_day', 'next_day', 'standard')) OR NOT (v_size IN ('small', 'medium', 'large', 'xl')) THEN
    RAISE EXCEPTION 'invalid_service_or_size';
  END IF;
  IF p_payload ? 'pickup_point_id' AND nullif(p_payload->>'pickup_point_id', '') IS NOT NULL THEN
    SELECT * INTO v_point FROM public.logistics_hubs
     WHERE id = (p_payload->>'pickup_point_id')::uuid AND is_active AND is_public AND hub_type IN ('pickup_point', 'locker');
    IF v_point.id IS NULL OR v_service = 'express' THEN
      RAISE EXCEPTION 'invalid_pickup_point';
    END IF;
    v_delivery := coalesce(v_point.address, '{}'::jsonb) || jsonb_build_object('lat', v_point.lat, 'lng', v_point.lng, 'pickup_point', v_point.name);
    v_window := 'any';
  END IF;
  IF v_service NOT IN ('next_day', 'standard') OR v_window NOT IN ('morning', 'afternoon', 'evening') THEN
    v_window := 'any';
  END IF;

  v_quote := public.quote_parcel(v_pickup, v_delivery, v_size, v_service);
  v_promise := (v_quote->>'promised_by')::timestamptz;
  IF v_window <> 'any' THEN
    SELECT window_end INTO v_promise FROM public.logistics_window_bounds(v_window, (v_promise AT TIME ZONE 'Africa/Johannesburg')::date);
  END IF;

  INSERT INTO public.shipments (
    account_id, source, created_by, reference, sender_name, sender_phone, recipient_name, recipient_phone, recipient_email,
    pickup_address, delivery_address, destination_hub_id, service_level, delivery_window, status,
    parcel_count, weight_kg, declared_value, cod_amount, require_otp, shipping_fee, promised_by, notes, metadata
  ) VALUES (
    v_account.id, 'portal', auth.uid(), nullif(left(p_payload->>'reference', 80), ''),
    coalesce(nullif(trim(p_payload->>'sender_name'), ''), v_account.name), nullif(p_payload->>'sender_phone', ''),
    left(trim(p_payload->>'recipient_name'), 120), left(trim(p_payload->>'recipient_phone'), 30), nullif(left(p_payload->>'recipient_email', 200), ''),
    v_pickup, v_delivery, v_point.id, v_service, v_window, 'awaiting_pickup',
    least(greatest(coalesce((p_payload->>'parcel_count')::int, 1), 1), 50),
    nullif(p_payload->>'weight_kg', '')::numeric, nullif(p_payload->>'declared_value', '')::numeric, nullif(p_payload->>'cod_amount', '')::numeric,
    coalesce((p_payload->>'require_otp')::boolean, true),
    CASE WHEN v_point.id IS NULL THEN (v_quote->>'fee')::numeric ELSE round((v_quote->>'fee')::numeric * 0.8, 0) END,
    v_promise, nullif(left(p_payload->>'notes', 500), ''), jsonb_build_object('size', v_size)
  ) RETURNING * INTO v_ship;

  RETURN jsonb_build_object('tracking_number', v_ship.tracking_number, 'fee', v_ship.shipping_fee, 'promised_by', v_ship.promised_by,
                            'requires_approval', v_ship.requires_approval);
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_book_shipment(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_cancel_shipment(p_shipment_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
BEGIN
  SELECT * INTO v_ship FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL OR NOT v_ship.account_id = ANY (public.logistics_my_account_ids()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_ship.status NOT IN ('created', 'awaiting_pickup', 'at_hub') OR EXISTS (
    SELECT 1 FROM public.route_stops rs JOIN public.delivery_routes r ON r.id = rs.route_id
     WHERE rs.shipment_id = v_ship.id AND r.status IN ('dispatched', 'in_progress') AND rs.status = 'pending') THEN
    RAISE EXCEPTION 'not_cancellable';
  END IF;
  PERFORM set_config('logistics.event_notes', 'Cancelled in business portal', true);
  UPDATE public.route_stops SET status = 'skipped', failure_reason = 'Cancelled by customer' WHERE shipment_id = v_ship.id AND status = 'pending';
  UPDATE public.shipments SET status = 'cancelled' WHERE id = v_ship.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_cancel_shipment(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_request_return(p_shipment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shipments WHERE id = p_shipment_id AND account_id = ANY (public.logistics_my_account_ids())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.logistics_create_return(p_shipment_id, coalesce(nullif(trim(p_reason), ''), 'Merchant-initiated return'), 'portal');
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_request_return(UUID, TEXT) TO authenticated;

-- Access status now includes portal accounts.
CREATE OR REPLACE FUNCTION public.logistics_access_status()
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'role', public.logistics_role(auth.uid()),
    'member_role', public.logistics_role_raw(auth.uid()),
    'mfa_required', s.require_mfa,
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'idle_timeout_minutes', s.idle_timeout_minutes,
    'accounts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'role', m.role, 'status', a.status) ORDER BY a.name)
        FROM public.logistics_account_members m JOIN public.logistics_accounts a ON a.id = m.account_id
       WHERE m.user_id = auth.uid() AND a.status <> 'closed'), '[]'::jsonb)
  )
  FROM public.logistics_settings s WHERE s.id
$$;

-- ---------------------------------------------------------------------------
-- 3. Invoice delivery
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_invoices
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
