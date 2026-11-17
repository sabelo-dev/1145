-- =============================================================================
-- 1145 Logistics: proof of delivery for shippers, branded tracking, daily digest
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Proof of delivery
-- ---------------------------------------------------------------------------
-- Who may see a shipment's POD: staff, the booking account's members, or the
-- consumer who booked it.
CREATE OR REPLACE FUNCTION public.logistics_can_view_shipment(p_shipment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_logistics_staff() OR EXISTS (
    SELECT 1 FROM public.shipments s
     WHERE s.id = p_shipment_id
       AND (s.account_id = ANY (public.logistics_my_account_ids()) OR s.customer_user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.logistics_pod(p_shipment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ship public.shipments;
  v_stop public.route_stops;
  v_job public.delivery_jobs;
  v_event public.shipment_events;
  v_proof JSONB := '{}'::jsonb;
BEGIN
  IF NOT public.logistics_can_view_shipment(p_shipment_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ship FROM public.shipments WHERE id = p_shipment_id;
  IF v_ship.status <> 'delivered' THEN
    RETURN jsonb_build_object('available', false, 'status', v_ship.status);
  END IF;

  SELECT * INTO v_stop FROM public.route_stops
   WHERE shipment_id = v_ship.id AND stop_type = 'delivery' AND status = 'completed'
   ORDER BY completed_at DESC LIMIT 1;
  IF v_ship.delivery_job_id IS NOT NULL THEN
    SELECT * INTO v_job FROM public.delivery_jobs WHERE id = v_ship.delivery_job_id;
  END IF;
  SELECT * INTO v_event FROM public.shipment_events
   WHERE shipment_id = v_ship.id AND status = 'delivered' AND event_type = 'status_change'
   ORDER BY created_at DESC LIMIT 1;

  v_proof := coalesce(v_stop.proof, v_job.proof, '{}'::jsonb);

  RETURN jsonb_build_object(
    'available', true,
    'tracking_number', v_ship.tracking_number,
    'delivered_at', v_ship.delivered_at,
    'method', CASE WHEN v_ship.collected_at IS NOT NULL THEN 'collection_point' ELSE coalesce(v_proof->>'method', 'name') END,
    'received_by', coalesce(v_proof->>'received_by', substring(v_event.notes FROM 'by (.*)$')),
    'otp_verified', v_ship.require_otp,
    'photo_path', v_proof->>'photo_path',
    'signature_path', v_proof->>'signature_path',
    'pieces_scanned', (v_proof->>'pieces_scanned')::int,
    'pieces_total', coalesce((v_proof->>'pieces_total')::int, v_ship.parcel_count),
    'counted_by_hand', coalesce((v_proof->>'unscanned_confirmed')::boolean, false),
    'lat', v_event.lat,
    'lng', v_event.lng,
    'collection_point', (SELECT name FROM public.logistics_hubs WHERE id = v_ship.destination_hub_id AND v_ship.collected_at IS NOT NULL),
    'redacted', v_ship.pii_redacted_at IS NOT NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.logistics_pod(UUID) TO authenticated;

-- Storage: shippers can open the proof files of their own shipments.
CREATE OR REPLACE FUNCTION public.logistics_can_read_proof(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.route_stops rs
     WHERE rs.proof->>'photo_path' = p_path AND public.logistics_can_view_shipment(rs.shipment_id))
  OR EXISTS (
    SELECT 1 FROM public.delivery_jobs j JOIN public.shipments s ON s.delivery_job_id = j.id
     WHERE (j.proof->>'photo_path' = p_path OR j.proof->>'signature_path' = p_path)
       AND public.logistics_can_view_shipment(s.id))
$$;
GRANT EXECUTE ON FUNCTION public.logistics_can_read_proof(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Shippers read their proofs" ON storage.objects;
CREATE POLICY "Shippers read their proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-proofs' AND public.logistics_can_read_proof(name));

CREATE INDEX IF NOT EXISTS route_stops_proof_photo_idx ON public.route_stops ((proof->>'photo_path')) WHERE proof ? 'photo_path';

-- ---------------------------------------------------------------------------
-- 2. Branding & contact settings for business accounts
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_accounts
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT CHECK (brand_logo_url IS NULL OR brand_logo_url ~ '^https://[^\s]{4,500}$'),
  ADD COLUMN IF NOT EXISTS brand_color TEXT CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS tracking_message TEXT CHECK (tracking_message IS NULL OR length(tracking_message) <= 240),
  ADD COLUMN IF NOT EXISTS ops_email TEXT,
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;

-- Account admins edit only their presentation & contact fields.
CREATE OR REPLACE FUNCTION public.portal_update_account_settings(p_account_id UUID, p_settings JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (p_account_id = ANY (public.logistics_my_account_ids(true)) OR public.is_logistics_staff(ARRAY['owner'])) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.logistics_accounts SET
    brand_name = nullif(left(trim(p_settings->>'brand_name'), 80), ''),
    brand_logo_url = nullif(trim(p_settings->>'brand_logo_url'), ''),
    brand_color = nullif(trim(p_settings->>'brand_color'), ''),
    support_phone = nullif(left(trim(p_settings->>'support_phone'), 30), ''),
    support_email = nullif(left(trim(p_settings->>'support_email'), 200), ''),
    tracking_message = nullif(left(trim(p_settings->>'tracking_message'), 240), ''),
    ops_email = nullif(left(trim(p_settings->>'ops_email'), 200), ''),
    digest_enabled = coalesce((p_settings->>'digest_enabled')::boolean, digest_enabled),
    billing_email = CASE WHEN p_settings ? 'billing_email' THEN nullif(left(trim(p_settings->>'billing_email'), 200), '') ELSE billing_email END
  WHERE id = p_account_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.portal_update_account_settings(UUID, JSONB) TO authenticated;
