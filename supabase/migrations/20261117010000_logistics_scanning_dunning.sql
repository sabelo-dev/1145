-- =============================================================================
-- 1145 Logistics: driver piece scanning, automated billing & dunning
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Driver piece scans (pickup & delivery)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shipment_pieces
  ADD COLUMN IF NOT EXISTS pickup_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_scanned_at TIMESTAMPTZ;

-- Drivers scan box labels at a stop. Validates the box belongs to the stop's
-- shipment and the stop belongs to the caller's live route.
CREATE OR REPLACE FUNCTION public.driver_scan_piece(p_stop_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stop public.route_stops;
  v_route public.delivery_routes;
  v_piece public.shipment_pieces;
  v_code TEXT := upper(trim(p_code));
  v_done INTEGER;
  v_total INTEGER;
BEGIN
  SELECT * INTO v_stop FROM public.route_stops WHERE id = p_stop_id;
  SELECT * INTO v_route FROM public.delivery_routes WHERE id = v_stop.route_id;
  IF v_stop.id IS NULL OR v_route.driver_id IS DISTINCT FROM (SELECT id FROM public.drivers WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'stop_not_assigned' USING ERRCODE = '42501';
  END IF;
  IF v_route.status <> 'in_progress' OR v_stop.status NOT IN ('pending', 'arrived') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'stop_not_open');
  END IF;

  SELECT * INTO v_piece FROM public.shipment_pieces
   WHERE shipment_id = v_stop.shipment_id
     AND (barcode = v_code OR (piece_no = 1 AND v_code = (SELECT tracking_number FROM public.shipments WHERE id = v_stop.shipment_id)));
  IF v_piece.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_parcel');
  END IF;

  IF v_stop.stop_type = 'pickup' THEN
    UPDATE public.shipment_pieces SET pickup_scanned_at = coalesce(pickup_scanned_at, now()) WHERE id = v_piece.id;
  ELSE
    UPDATE public.shipment_pieces SET delivery_scanned_at = coalesce(delivery_scanned_at, now()) WHERE id = v_piece.id;
  END IF;

  SELECT count(*) FILTER (WHERE CASE WHEN v_stop.stop_type = 'pickup' THEN pickup_scanned_at ELSE delivery_scanned_at END IS NOT NULL), count(*)
    INTO v_done, v_total
    FROM public.shipment_pieces WHERE shipment_id = v_stop.shipment_id;

  RETURN jsonb_build_object('ok', true, 'piece_no', v_piece.piece_no, 'scanned', v_done, 'total', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_scan_piece(UUID, TEXT) TO authenticated;

-- Scan progress for the driver's open stops (drivers can't read pieces directly).
CREATE OR REPLACE FUNCTION public.driver_route_piece_progress(p_route_id UUID)
RETURNS TABLE (stop_id UUID, scanned INTEGER, total INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rs.id,
         count(p.id) FILTER (WHERE CASE WHEN rs.stop_type = 'pickup' THEN p.pickup_scanned_at ELSE p.delivery_scanned_at END IS NOT NULL)::int,
         count(p.id)::int
    FROM public.route_stops rs
    JOIN public.delivery_routes r ON r.id = rs.route_id
    LEFT JOIN public.shipment_pieces p ON p.shipment_id = rs.shipment_id
   WHERE rs.route_id = p_route_id
     AND (r.driver_id = (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_logistics_staff())
   GROUP BY rs.id
$$;
GRANT EXECUTE ON FUNCTION public.driver_route_piece_progress(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Billing automation
-- ---------------------------------------------------------------------------
ALTER TABLE public.logistics_settings
  ADD COLUMN IF NOT EXISTS auto_issue_invoices BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_monthly_statements BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_days INTEGER[] NOT NULL DEFAULT ARRAY[1, 7, 14],
  ADD COLUMN IF NOT EXISTS auto_hold_after_days INTEGER NOT NULL DEFAULT 30 CHECK (auto_hold_after_days BETWEEN 0 AND 180);

ALTER TABLE public.logistics_invoices ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.logistics_accounts
  ADD COLUMN IF NOT EXISTS statement_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_held_at TIMESTAMPTZ;

-- Shared secret for cron → edge function calls. Lives only here: no policies,
-- so neither anon nor authenticated users can read it; the function reads it
-- with the service role and compares.
CREATE TABLE IF NOT EXISTS public.logistics_internal_secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.logistics_internal_secrets ENABLE ROW LEVEL SECURITY;
INSERT INTO public.logistics_internal_secrets (name, value)
VALUES ('billing_cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

-- Daily at 06:00 SAST (04:00 UTC): issue/email drafts (if enabled), overdue
-- reminders, monthly statements on the 1st, automatic holds.
CREATE OR REPLACE FUNCTION public.logistics_trigger_billing_run()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.logistics_function_url('logistics-billing-run') IS NULL THEN
    RETURN; -- calls disabled for this environment
  END IF;
  PERFORM net.http_post(
    url := public.logistics_function_url('logistics-billing-run'),
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'X-Logistics-Cron', (SELECT value FROM public.logistics_internal_secrets WHERE name = 'billing_cron')),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_trigger_billing_run() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'logistics-billing-run';
    PERFORM cron.schedule('logistics-billing-run', '0 4 * * *', 'SELECT public.logistics_trigger_billing_run()');
  END IF;
END;
$$;
