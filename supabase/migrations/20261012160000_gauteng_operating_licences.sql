-- 1145 Ride: Gauteng operating licences applied for through GPTRIS.
--
-- A driver records their GPTRIS reference and submission receipt, and later
-- the licence itself. Staff check each step. From those records every driver
-- falls into one state: verified, application_pending, expired, rejected, or
-- not_applied when nothing has been recorded.
--
-- A receipt is not a licence. A driver whose application is still pending has
-- no valid operating licence, and can go online on the strength of the receipt
-- only while a transitional period is switched on in the settings, with the
-- rule relied on written down next to it. It is off unless someone sets it.
--
-- An issued licence is also filed as the driver's operating-licence document,
-- so the expiry warnings, suspension and reinstatement from
-- 20261012150000_driver_continuous_verification.sql apply to it unchanged.

ALTER TABLE public.driver_verification_settings
  ADD COLUMN IF NOT EXISTS gauteng_transitional_until date,
  ADD COLUMN IF NOT EXISTS gauteng_transitional_basis text;

ALTER TABLE public.driver_verification_settings DROP CONSTRAINT IF EXISTS gauteng_transitional_needs_basis;
ALTER TABLE public.driver_verification_settings
  ADD CONSTRAINT gauteng_transitional_needs_basis
  CHECK (gauteng_transitional_until IS NULL OR length(btrim(COALESCE(gauteng_transitional_basis, ''))) >= 10);

CREATE TABLE IF NOT EXISTS public.gauteng_licence_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  gptris_reference text NOT NULL,
  receipt_path text NOT NULL,
  -- The date on the receipt.
  submitted_on date NOT NULL,
  -- submitted: entered by the driver, not checked yet.
  -- receipt_verified: staff confirmed the receipt; the regulator has not decided.
  -- issued: the licence has been issued and staff have checked it.
  -- rejected: refused or withdrawn by the regulator, or the record was not genuine.
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'receipt_verified', 'issued', 'rejected', 'superseded')),
  licence_number text,
  licence_path text,
  licence_expires_on date,
  operating_area text,
  -- Set when the driver sends in licence details for staff to check.
  licence_submitted_at timestamptz,
  -- The operating-licence document filed when the licence was issued.
  document_id uuid REFERENCES public.driver_documents(id) ON DELETE SET NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'issued' OR (licence_number IS NOT NULL AND licence_path IS NOT NULL
                                AND licence_expires_on IS NOT NULL AND operating_area IS NOT NULL))
);
-- One GPTRIS reference belongs to one live record.
CREATE UNIQUE INDEX IF NOT EXISTS gauteng_licence_applications_reference_unique
  ON public.gauteng_licence_applications (lower(gptris_reference)) WHERE status <> 'superseded';
CREATE INDEX IF NOT EXISTS gauteng_licence_applications_driver_idx
  ON public.gauteng_licence_applications (driver_id, created_at DESC);

ALTER TABLE public.gauteng_licence_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gauteng_licence_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.gauteng_licence_applications TO authenticated;
GRANT ALL ON public.gauteng_licence_applications TO service_role;

DROP POLICY IF EXISTS "Admins read" ON public.gauteng_licence_applications;
CREATE POLICY "Admins read" ON public.gauteng_licence_applications FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS "Drivers read own" ON public.gauteng_licence_applications;
CREATE POLICY "Drivers read own" ON public.gauteng_licence_applications FOR SELECT TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- ------------------------------------------------------------- state
CREATE OR REPLACE FUNCTION public.gauteng_transitional_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT gauteng_transitional_until >= (now() AT TIME ZONE 'Africa/Johannesburg')::date
     FROM public.driver_verification_settings), false);
$$;

-- verified:            an issued licence that is in date
-- expired:             a licence was issued and has run out
-- rejected:            the latest application was refused
-- application_pending: an application is with the regulator (receipt only)
-- not_applied:         nothing recorded
CREATE OR REPLACE FUNCTION public.driver_gauteng_licence_state(p_driver_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND NOT public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = p_driver_id AND d.user_id = auth.uid()) THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.gauteng_licence_applications a
                 WHERE a.driver_id = p_driver_id AND a.status = 'issued'
                   AND a.licence_expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date) THEN 'verified'
    WHEN EXISTS (SELECT 1 FROM public.gauteng_licence_applications a
                 WHERE a.driver_id = p_driver_id AND a.status = 'issued') THEN 'expired'
    ELSE COALESCE(
      (SELECT CASE a.status WHEN 'rejected' THEN 'rejected' ELSE 'application_pending' END
       FROM public.gauteng_licence_applications a
       WHERE a.driver_id = p_driver_id AND a.status IN ('submitted', 'receipt_verified', 'rejected')
       ORDER BY a.created_at DESC LIMIT 1),
      'not_applied')
  END;
$$;

-- Adds one state to the operating licence: 'transitional', for a driver with
-- no licence on file whose receipt staff have verified, while the transitional
-- period runs. driver_go_online() lets 'valid' and 'transitional' through.
CREATE OR REPLACE FUNCTION public.driver_document_state(p_driver_id uuid, p_own_only boolean DEFAULT false)
RETURNS TABLE (doc_type text, expires_on date, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.doc_type, held.expires_on,
         CASE WHEN held.expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN 'valid'
              WHEN held.expires_on IS NOT NULL THEN 'expired'
              WHEN t.doc_type = 'operating_licence' AND public.gauteng_transitional_active()
                   AND EXISTS (SELECT 1 FROM public.gauteng_licence_applications a
                               WHERE a.driver_id = p_driver_id AND a.status = 'receipt_verified') THEN 'transitional'
              WHEN EXISTS (SELECT 1 FROM public.driver_documents p
                           WHERE p.driver_id = p_driver_id AND p.doc_type = t.doc_type AND p.status = 'pending') THEN 'pending'
              ELSE 'missing' END
  FROM unnest(ARRAY['prdp', 'operating_licence', 'roadworthy', 'insurance']) AS t(doc_type)
  LEFT JOIN LATERAL (
    SELECT max(d.expires_on) AS expires_on
    FROM public.driver_documents d
    WHERE d.driver_id = p_driver_id AND d.doc_type = t.doc_type AND d.status IN ('approved', 'expired')
  ) held ON true
  WHERE auth.uid() IS NULL OR public.is_admin()
     OR EXISTS (SELECT 1 FROM public.drivers dr WHERE dr.id = p_driver_id AND dr.user_id = auth.uid());
$$;

-- ------------------------------------------------------------- driver side
CREATE OR REPLACE FUNCTION public.driver_submit_gauteng_application(
  p_gptris_reference text, p_receipt_path text, p_submitted_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_reference text := upper(btrim(COALESCE(p_gptris_reference, '')));
  v_id uuid;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No driver account was found.');
  END IF;
  IF length(v_reference) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the GPTRIS reference number from your receipt.');
  END IF;
  IF p_submitted_on IS NULL OR p_submitted_on > (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the date on your receipt.');
  END IF;
  IF p_receipt_path IS NULL OR left(p_receipt_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The receipt did not upload. Please try again.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gauteng_licence_applications
             WHERE lower(gptris_reference) = lower(v_reference) AND status <> 'superseded' AND driver_id <> v_driver.id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That GPTRIS reference is already recorded for another driver. Contact support.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gauteng_licence_applications
             WHERE lower(gptris_reference) = lower(v_reference) AND status = 'issued' AND driver_id = v_driver.id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A licence has already been recorded for that reference.');
  END IF;

  -- A corrected or newer application replaces one that is still open.
  UPDATE public.gauteng_licence_applications SET status = 'superseded'
  WHERE driver_id = v_driver.id
    AND (status IN ('submitted', 'receipt_verified') OR lower(gptris_reference) = lower(v_reference));

  INSERT INTO public.gauteng_licence_applications (driver_id, vehicle_id, gptris_reference, receipt_path, submitted_on)
  VALUES (v_driver.id,
          (SELECT a.vehicle_id FROM public.vehicle_driver_assignments a
           WHERE a.driver_id = v_driver.id AND a.status IN ('approved', 'pending')
           ORDER BY (a.status = 'approved') DESC LIMIT 1),
          v_reference, p_receipt_path, p_submitted_on)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

-- The licence has arrived: the driver sends its details for staff to check.
CREATE OR REPLACE FUNCTION public.driver_submit_gauteng_licence(
  p_application_id uuid, p_licence_number text, p_licence_path text, p_licence_expires_on date, p_operating_area text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.gauteng_licence_applications;
BEGIN
  SELECT a.* INTO v_app FROM public.gauteng_licence_applications a
  JOIN public.drivers d ON d.id = a.driver_id
  WHERE a.id = p_application_id AND d.user_id = auth.uid() FOR UPDATE OF a;
  IF NOT FOUND OR v_app.status NOT IN ('submitted', 'receipt_verified') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This application is not open. Record a new one.');
  END IF;
  IF length(btrim(COALESCE(p_licence_number, ''))) < 3 OR length(btrim(COALESCE(p_operating_area, ''))) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the licence number and the operating area printed on the licence.');
  END IF;
  IF p_licence_expires_on IS NULL OR p_licence_expires_on < (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This licence has already expired.');
  END IF;
  IF p_licence_path IS NULL OR left(p_licence_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The licence did not upload. Please try again.');
  END IF;

  UPDATE public.gauteng_licence_applications
  SET licence_number = btrim(p_licence_number), licence_path = p_licence_path,
      licence_expires_on = p_licence_expires_on, operating_area = btrim(p_operating_area),
      licence_submitted_at = now()
  WHERE id = v_app.id;
  RETURN jsonb_build_object('ok', true, 'id', v_app.id);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_gauteng_licence_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver uuid;
  v_state text;
  v_transitional boolean := public.gauteng_transitional_active();
BEGIN
  SELECT id INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver IS NULL THEN RETURN NULL; END IF;
  v_state := public.driver_gauteng_licence_state(v_driver);

  RETURN jsonb_build_object(
    'state', v_state,
    -- Whether the operating-licence requirement is met today.
    'may_operate', v_state = 'verified' OR (v_transitional AND EXISTS (
      SELECT 1 FROM public.gauteng_licence_applications a WHERE a.driver_id = v_driver AND a.status = 'receipt_verified')
      AND v_state = 'application_pending'),
    'transitional_until', CASE WHEN v_transitional THEN (SELECT gauteng_transitional_until FROM public.driver_verification_settings) END,
    'licence', (
      SELECT jsonb_build_object('licence_number', a.licence_number, 'licence_expires_on', a.licence_expires_on,
                                'operating_area', a.operating_area, 'gptris_reference', a.gptris_reference)
      FROM public.gauteng_licence_applications a
      WHERE a.driver_id = v_driver AND a.status = 'issued'
      ORDER BY a.licence_expires_on DESC LIMIT 1),
    'application', (
      SELECT jsonb_build_object('id', a.id, 'gptris_reference', a.gptris_reference, 'submitted_on', a.submitted_on,
                                'status', a.status, 'review_notes', a.review_notes,
                                'licence_submitted', a.licence_submitted_at IS NOT NULL)
      FROM public.gauteng_licence_applications a
      WHERE a.driver_id = v_driver AND a.status IN ('submitted', 'receipt_verified', 'rejected')
      ORDER BY a.created_at DESC LIMIT 1));
END; $$;

-- ------------------------------------------------------------- staff side
-- p_decision:
--   receipt_verified  the receipt is genuine; the application is still pending
--                     (also used to send licence details back to the driver)
--   issued            the licence has been issued and checked
--   rejected          refused, withdrawn or revoked by the regulator, or not genuine
CREATE OR REPLACE FUNCTION public.review_gauteng_application(
  p_application_id uuid, p_decision text, p_notes text DEFAULT NULL,
  p_licence_number text DEFAULT NULL, p_licence_expires_on date DEFAULT NULL, p_operating_area text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.gauteng_licence_applications;
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_number text;
  v_expiry date;
  v_area text;
  v_document uuid;
  v_user uuid;
  v_title text;
  v_message text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('receipt_verified', 'issued', 'rejected') THEN RAISE EXCEPTION 'Unknown decision.'; END IF;

  SELECT * INTO v_app FROM public.gauteng_licence_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND OR v_app.status IN ('rejected', 'superseded') THEN RAISE EXCEPTION 'This application is closed.'; END IF;
  IF v_app.status = 'issued' AND p_decision <> 'rejected' THEN
    RAISE EXCEPTION 'A licence has already been recorded for this application.';
  END IF;

  IF p_decision = 'rejected' THEN
    IF v_notes IS NULL THEN RAISE EXCEPTION 'Tell the driver why.'; END IF;
    UPDATE public.gauteng_licence_applications
    SET status = 'rejected', licence_submitted_at = NULL, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = v_notes
    WHERE id = v_app.id;
    -- A licence that was on file no longer counts.
    UPDATE public.driver_documents
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = v_notes
    WHERE id = v_app.document_id;
    v_title := 'Operating licence application not accepted';
    v_message := 'Your GPTRIS application ' || v_app.gptris_reference || ' was not accepted: ' || v_notes;

  ELSIF p_decision = 'receipt_verified' THEN
    -- Sending licence details back needs a reason; confirming a receipt does not.
    IF v_app.status = 'receipt_verified' AND v_notes IS NULL THEN
      RAISE EXCEPTION 'Tell the driver what is wrong with the licence details.';
    END IF;
    UPDATE public.gauteng_licence_applications
    SET status = 'receipt_verified', licence_submitted_at = NULL, reviewed_by = auth.uid(), reviewed_at = now(), review_notes = v_notes
    WHERE id = v_app.id;
    IF v_app.status = 'receipt_verified' THEN
      v_title := 'Licence details not accepted';
      v_message := 'The licence details for GPTRIS application ' || v_app.gptris_reference || ' were not accepted: ' || v_notes;
    ELSE
      v_title := 'GPTRIS receipt confirmed';
      v_message := 'We confirmed your receipt for application ' || v_app.gptris_reference
        || '. A receipt is not a licence: add your operating licence here as soon as it is issued.';
    END IF;

  ELSE
    v_number := COALESCE(NULLIF(btrim(COALESCE(p_licence_number, '')), ''), v_app.licence_number);
    v_expiry := COALESCE(p_licence_expires_on, v_app.licence_expires_on);
    v_area := COALESCE(NULLIF(btrim(COALESCE(p_operating_area, '')), ''), v_app.operating_area);
    IF v_app.licence_path IS NULL THEN
      RAISE EXCEPTION 'The driver has not uploaded the licence yet. A receipt cannot be recorded as a licence.';
    END IF;
    IF v_number IS NULL OR v_area IS NULL OR v_expiry IS NULL THEN
      RAISE EXCEPTION 'Record the licence number, expiry date and approved operating area.';
    END IF;
    IF v_expiry < (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
      RAISE EXCEPTION 'A licence that has already expired cannot be recorded as issued.';
    END IF;

    UPDATE public.driver_documents SET status = 'superseded'
    WHERE driver_id = v_app.driver_id AND doc_type = 'operating_licence' AND status = 'pending';
    INSERT INTO public.driver_documents
      (driver_id, vehicle_id, doc_type, document_number, file_path, expires_on, status, reviewed_by, reviewed_at, review_notes)
    VALUES (v_app.driver_id, v_app.vehicle_id, 'operating_licence', v_number, v_app.licence_path, v_expiry,
            'approved', auth.uid(), now(), 'Gauteng operating licence, GPTRIS ' || v_app.gptris_reference)
    RETURNING id INTO v_document;

    UPDATE public.gauteng_licence_applications
    SET status = 'issued', licence_number = v_number, licence_expires_on = v_expiry, operating_area = v_area,
        licence_submitted_at = NULL, document_id = v_document,
        reviewed_by = auth.uid(), reviewed_at = now(), review_notes = v_notes
    WHERE id = v_app.id;
    v_title := 'Operating licence verified';
    v_message := 'Your Gauteng operating licence ' || v_number || ' is on record, valid until '
      || to_char(v_expiry, 'DD Mon YYYY') || ' for ' || v_area || '.';
  END IF;

  SELECT user_id INTO v_user FROM public.drivers WHERE id = v_app.driver_id;
  -- A document filed for a fleet vehicle has no driver: tell the fleet operator.
  IF v_user IS NULL THEN
    SELECT f.owner_id INTO v_user FROM public.vehicles v JOIN public.fleets f ON f.id = v.fleet_id WHERE v.id = v_app.vehicle_id;
  END IF;
  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_user, 'driver_verification', v_title, v_message, jsonb_build_object('url', '/driver/dashboard?tab=verification'));

  IF p_decision = 'issued' THEN
    PERFORM public.driver_refresh_compliance(v_app.driver_id);
  END IF;
END; $$;

-- One row per driver who has a GPTRIS record or gave a Gauteng home address,
-- with their state and their latest application.
CREATE OR REPLACE FUNCTION public.gauteng_compliance_overview()
RETURNS TABLE (
  driver_id uuid, driver_name text, driver_status text, state text, may_operate boolean,
  application_id uuid, gptris_reference text, application_status text, submitted_on date, receipt_path text,
  licence_number text, licence_path text, licence_expires_on date, operating_area text,
  review_notes text, needs_review boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  RETURN QUERY
  SELECT d.id, d.name, d.status, s.state,
         s.state = 'verified' OR (s.state = 'application_pending' AND public.gauteng_transitional_active()
           AND EXISTS (SELECT 1 FROM public.gauteng_licence_applications v
                       WHERE v.driver_id = d.id AND v.status = 'receipt_verified')),
         a.id, a.gptris_reference, a.status, a.submitted_on, a.receipt_path,
         a.licence_number, a.licence_path, a.licence_expires_on, a.operating_area, a.review_notes,
         COALESCE(a.status = 'submitted' OR (a.status = 'receipt_verified' AND a.licence_submitted_at IS NOT NULL), false)
  FROM public.drivers d
  CROSS JOIN LATERAL (SELECT public.driver_gauteng_licence_state(d.id) AS state) s
  LEFT JOIN LATERAL (
    SELECT * FROM public.gauteng_licence_applications x
    WHERE x.driver_id = d.id AND x.status <> 'superseded'
    ORDER BY x.created_at DESC LIMIT 1
  ) a ON true
  WHERE a.id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.driver_kyc k WHERE k.user_id = d.user_id
                AND (k.province ILIKE '%gauteng%' OR upper(btrim(k.province)) = 'GP'))
  ORDER BY 16 DESC, d.name;
END; $$;

-- ------------------------------------------------------------- permissions
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'gauteng_transitional_active()', 'driver_gauteng_licence_state(uuid)',
    'driver_submit_gauteng_application(text, text, date)',
    'driver_submit_gauteng_licence(uuid, text, text, date, text)', 'driver_gauteng_licence_status()',
    'review_gauteng_application(uuid, text, text, text, date, text)', 'gauteng_compliance_overview()']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;
