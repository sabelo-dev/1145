-- 1145 Ride: fleet operators as an account type of their own.
--
-- How it fits together:
--   * A fleet is a verified vehicle owner (the same owner record individual
--     drivers' vehicles point at) with its own dashboard.
--   * The operator loads vehicles in bulk; 1145 approves each one.
--   * Drivers stay individual 1145 drivers, verified as people. They join a
--     fleet by accepting an invitation, and may belong to more than one fleet
--     and still drive their own vehicle.
--   * Who drives which vehicle when is a shift. A vehicle can have several
--     drivers across the day, never two at once. While a shift runs, that is
--     the vehicle the driver goes online in.
--   * The operating licence, roadworthy certificate and insurance belong to
--     the vehicle. For a fleet vehicle the operator files them once (the
--     operating licence through GPTRIS in Gauteng) and they cover whoever is
--     driving. The PrDP stays with the driver. An expired vehicle document
--     grounds the vehicle; it does not suspend the driver's account.
--   * Maintenance and safety devices are recorded per vehicle and raise
--     alerts. Safety devices are declared by the operator and checked by 1145.
--   * Earnings are reported per fleet from the trips its vehicles did. Each
--     fleet records whether 1145 pays the operator or the driver.

-- ------------------------------------------------------------- fleets
ALTER TABLE public.fleets
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS vehicle_owner_id uuid REFERENCES public.vehicle_owners(id),
  -- 'operator': 1145 pays the fleet, which pays its drivers. 'driver': 1145 pays the driver.
  ADD COLUMN IF NOT EXISTS payout_mode text NOT NULL DEFAULT 'operator',
  -- The share of each payout the operator has agreed with its drivers. Used for reporting.
  ADD COLUMN IF NOT EXISTS driver_share_pct numeric(5,2);

ALTER TABLE public.fleets DROP CONSTRAINT IF EXISTS fleets_verification_status_check;
ALTER TABLE public.fleets ADD CONSTRAINT fleets_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE public.fleets DROP CONSTRAINT IF EXISTS fleets_payout_check;
ALTER TABLE public.fleets ADD CONSTRAINT fleets_payout_check
  CHECK (payout_mode IN ('operator', 'driver') AND (driver_share_pct IS NULL OR driver_share_pct BETWEEN 0 AND 100));

-- An operator edits their fleet's name and contact details; verification and
-- who gets paid are set by 1145.
CREATE OR REPLACE FUNCTION public.guard_fleet_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending';
    NEW.verification_notes := NULL;
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.vehicle_owner_id := NULL;
    NEW.payout_mode := 'operator';
    NEW.status := 'active';
  ELSE
    NEW.owner_id := OLD.owner_id;
    NEW.verification_status := OLD.verification_status;
    NEW.verification_notes := OLD.verification_notes;
    NEW.verified_by := OLD.verified_by;
    NEW.verified_at := OLD.verified_at;
    NEW.vehicle_owner_id := OLD.vehicle_owner_id;
    NEW.payout_mode := OLD.payout_mode;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_fleet_client_writes ON public.fleets;
CREATE TRIGGER trg_guard_fleet_client_writes
  BEFORE INSERT OR UPDATE ON public.fleets
  FOR EACH ROW EXECUTE FUNCTION public.guard_fleet_client_writes();

-- ------------------------------------------------------------- tables
CREATE TABLE IF NOT EXISTS public.fleet_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'declined', 'ended')),
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  ended_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS fleet_drivers_one_live
  ON public.fleet_drivers (fleet_id, driver_id) WHERE status IN ('invited', 'active');
CREATE INDEX IF NOT EXISTS fleet_drivers_driver_idx ON public.fleet_drivers (driver_id);

-- Who drives which vehicle, when. ends_at NULL means until further notice.
CREATE TABLE IF NOT EXISTS public.fleet_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.fleets(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS fleet_shifts_vehicle_idx ON public.fleet_shifts (vehicle_id, starts_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS fleet_shifts_driver_idx ON public.fleet_shifts (driver_id, starts_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('service', 'tyres', 'brakes', 'inspection', 'other')),
  description text,
  due_on date NOT NULL,
  completed_on date,
  alerted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_maintenance_open_idx ON public.vehicle_maintenance (vehicle_id, due_on) WHERE completed_on IS NULL;

-- Declared by the operator, then checked by 1145.
CREATE TABLE IF NOT EXISTS public.vehicle_safety_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  device_type text NOT NULL CHECK (device_type IN ('dashcam', 'gps_tracker', 'panic_button', 'fire_extinguisher', 'first_aid_kit')),
  status text NOT NULL CHECK (status IN ('working', 'faulty', 'not_fitted')),
  serial_number text,
  last_checked_on date,
  verified_at timestamptz,
  verified_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, device_type)
);

-- Vehicle documents can now be filed without a driver.
ALTER TABLE public.driver_documents ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE public.driver_documents ADD COLUMN IF NOT EXISTS submitted_by uuid;
ALTER TABLE public.driver_documents DROP CONSTRAINT IF EXISTS driver_documents_holder_check;
ALTER TABLE public.driver_documents ADD CONSTRAINT driver_documents_holder_check
  CHECK (driver_id IS NOT NULL OR (vehicle_id IS NOT NULL AND doc_type <> 'prdp'));

ALTER TABLE public.gauteng_licence_applications ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE public.gauteng_licence_applications DROP CONSTRAINT IF EXISTS gauteng_licence_applications_holder_check;
ALTER TABLE public.gauteng_licence_applications ADD CONSTRAINT gauteng_licence_applications_holder_check
  CHECK (driver_id IS NOT NULL OR vehicle_id IS NOT NULL);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fleet_drivers', 'fleet_shifts', 'vehicle_maintenance', 'vehicle_safety_devices']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins read" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
  END LOOP;
END $$;
-- Operators and drivers read fleet data through the functions below.

-- ------------------------------------------------------------- helpers
-- Raises unless the caller runs this fleet (or is an admin).
CREATE OR REPLACE FUNCTION public.fleet_require_operator(p_fleet_id uuid)
RETURNS public.fleets LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fleet public.fleets;
BEGIN
  SELECT * INTO v_fleet FROM public.fleets WHERE id = p_fleet_id;
  IF NOT FOUND OR (auth.uid() IS NOT NULL AND v_fleet.owner_id <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN v_fleet;
END; $$;

-- The same check, starting from one of the fleet's vehicles.
CREATE OR REPLACE FUNCTION public.fleet_require_vehicle(p_vehicle_id uuid)
RETURNS public.fleets LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.fleet_require_operator((SELECT fleet_id FROM public.vehicles WHERE id = p_vehicle_id));
END; $$;

-- A running fleet shift decides the vehicle; otherwise it is the driver's own.
CREATE OR REPLACE FUNCTION public.driver_current_vehicle(p_driver_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.vehicle_id
     FROM public.fleet_shifts s
     JOIN public.vehicles v ON v.id = s.vehicle_id AND v.status = 'active'
     JOIN public.fleets f ON f.id = s.fleet_id AND f.verification_status = 'verified' AND f.status = 'active'
     JOIN public.fleet_drivers fd ON fd.fleet_id = s.fleet_id AND fd.driver_id = s.driver_id AND fd.status = 'active'
     WHERE s.driver_id = p_driver_id AND s.status = 'scheduled'
       AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now())
     ORDER BY s.starts_at DESC LIMIT 1),
    (SELECT a.vehicle_id FROM public.vehicle_driver_assignments a
     WHERE a.driver_id = p_driver_id AND a.status = 'approved'));
$$;

-- For a driver on a fleet vehicle, the three vehicle documents are the ones
-- the operator filed for that vehicle. Everything else is as before.
CREATE OR REPLACE FUNCTION public.driver_document_state(p_driver_id uuid, p_own_only boolean DEFAULT false)
RETURNS TABLE (doc_type text, expires_on date, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH fleet_vehicle AS (
    SELECT v.id FROM public.vehicles v
    WHERE NOT p_own_only AND v.fleet_id IS NOT NULL AND v.id = public.driver_current_vehicle(p_driver_id)
  )
  SELECT t.doc_type, held.expires_on,
         CASE WHEN held.expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN 'valid'
              WHEN held.expires_on IS NOT NULL THEN 'expired'
              WHEN t.doc_type = 'operating_licence' AND public.gauteng_transitional_active()
                   AND EXISTS (SELECT 1 FROM public.gauteng_licence_applications a
                               WHERE a.status = 'receipt_verified'
                                 AND CASE WHEN fv.id IS NOT NULL THEN a.vehicle_id = fv.id AND a.driver_id IS NULL
                                          ELSE a.driver_id = p_driver_id END) THEN 'transitional'
              WHEN EXISTS (SELECT 1 FROM public.driver_documents p
                           WHERE p.doc_type = t.doc_type AND p.status = 'pending'
                             AND CASE WHEN fv.id IS NOT NULL THEN p.vehicle_id = fv.id AND p.driver_id IS NULL
                                      ELSE p.driver_id = p_driver_id END) THEN 'pending'
              ELSE 'missing' END
  FROM unnest(ARRAY['prdp', 'operating_licence', 'roadworthy', 'insurance']) AS t(doc_type)
  LEFT JOIN fleet_vehicle fv ON t.doc_type <> 'prdp'
  LEFT JOIN LATERAL (
    SELECT max(d.expires_on) AS expires_on
    FROM public.driver_documents d
    WHERE d.doc_type = t.doc_type AND d.status IN ('approved', 'expired')
      AND CASE WHEN fv.id IS NOT NULL THEN d.vehicle_id = fv.id AND d.driver_id IS NULL
               ELSE d.driver_id = p_driver_id END
  ) held ON true
  WHERE auth.uid() IS NULL OR public.is_admin()
     OR EXISTS (SELECT 1 FROM public.drivers dr WHERE dr.id = p_driver_id AND dr.user_id = auth.uid());
$$;

-- Where a fleet vehicle's own documents stand.
CREATE OR REPLACE FUNCTION public.vehicle_document_state(p_vehicle_id uuid)
RETURNS TABLE (doc_type text, expires_on date, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.doc_type, held.expires_on,
         CASE WHEN held.expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN 'valid'
              WHEN held.expires_on IS NOT NULL THEN 'expired'
              WHEN EXISTS (SELECT 1 FROM public.driver_documents p
                           WHERE p.vehicle_id = p_vehicle_id AND p.driver_id IS NULL
                             AND p.doc_type = t.doc_type AND p.status = 'pending') THEN 'pending'
              ELSE 'missing' END
  FROM unnest(ARRAY['operating_licence', 'roadworthy', 'insurance']) AS t(doc_type)
  LEFT JOIN LATERAL (
    SELECT max(d.expires_on) AS expires_on
    FROM public.driver_documents d
    WHERE d.vehicle_id = p_vehicle_id AND d.driver_id IS NULL AND d.doc_type = t.doc_type AND d.status IN ('approved', 'expired')
  ) held ON true;
$$;

-- The Gauteng licence state of either a driver's own record or a fleet vehicle's.
CREATE OR REPLACE FUNCTION public.gauteng_licence_state_for(p_driver_id uuid, p_vehicle_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT a.* FROM public.gauteng_licence_applications a
    WHERE CASE WHEN p_vehicle_id IS NOT NULL THEN a.vehicle_id = p_vehicle_id AND a.driver_id IS NULL
               ELSE a.driver_id = p_driver_id END
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM mine WHERE status = 'issued'
                 AND licence_expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date) THEN 'verified'
    WHEN EXISTS (SELECT 1 FROM mine WHERE status = 'issued') THEN 'expired'
    ELSE COALESCE(
      (SELECT CASE status WHEN 'rejected' THEN 'rejected' ELSE 'application_pending' END
       FROM mine WHERE status IN ('submitted', 'receipt_verified', 'rejected')
       ORDER BY created_at DESC LIMIT 1),
      'not_applied')
  END;
$$;

-- A driver on a fleet vehicle takes that vehicle's state.
CREATE OR REPLACE FUNCTION public.driver_gauteng_licence_state(p_driver_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND NOT public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = p_driver_id AND d.user_id = auth.uid()) THEN NULL
    ELSE public.gauteng_licence_state_for(
      p_driver_id,
      (SELECT v.id FROM public.vehicles v WHERE v.fleet_id IS NOT NULL AND v.id = public.driver_current_vehicle(p_driver_id)))
  END;
$$;

-- ------------------------------------------------------------- fleet account
CREATE OR REPLACE FUNCTION public.register_fleet(
  p_name text, p_owner_type text, p_legal_name text, p_registration_number text, p_contact_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_fleet uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.fleets WHERE owner_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You already have a fleet account.');
  END IF;
  IF length(btrim(COALESCE(p_name, ''))) < 2 OR length(btrim(COALESCE(p_legal_name, ''))) < 3
     OR length(btrim(COALESCE(p_registration_number, ''))) < 6 OR p_owner_type NOT IN ('individual', 'company') THEN
    RETURN jsonb_build_object('ok', false, 'message',
      'Enter the fleet name, the legal name of the owner and their ID or company registration number.');
  END IF;

  SELECT id INTO v_owner FROM public.vehicle_owners
  WHERE owner_type = p_owner_type AND lower(id_number) = lower(btrim(p_registration_number));
  IF v_owner IS NULL THEN
    INSERT INTO public.vehicle_owners (owner_type, legal_name, id_number, phone, user_id, created_by)
    VALUES (p_owner_type, btrim(p_legal_name), btrim(p_registration_number), NULLIF(btrim(COALESCE(p_contact_phone, '')), ''), auth.uid(), auth.uid())
    RETURNING id INTO v_owner;
  END IF;

  INSERT INTO public.fleets (name, owner_id, legal_name, registration_number, contact_phone, vehicle_owner_id)
  VALUES (btrim(p_name), auth.uid(), btrim(p_legal_name), btrim(p_registration_number),
          NULLIF(btrim(COALESCE(p_contact_phone, '')), ''), v_owner)
  RETURNING id INTO v_fleet;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'fleet_manager')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', v_fleet);
END; $$;

CREATE OR REPLACE FUNCTION public.review_fleet(
  p_fleet_id uuid, p_approve boolean, p_notes text DEFAULT NULL,
  p_payout_mode text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fleet public.fleets;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF NOT p_approve AND COALESCE(btrim(p_notes), '') = '' THEN RAISE EXCEPTION 'Tell the operator why.'; END IF;

  UPDATE public.fleets
  SET verification_status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END,
      verification_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      verified_by = auth.uid(), verified_at = now(),
      payout_mode = COALESCE(p_payout_mode, payout_mode)
  WHERE id = p_fleet_id
  RETURNING * INTO v_fleet;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fleet not found.'; END IF;

  IF p_approve THEN
    UPDATE public.vehicle_owners SET verified_at = COALESCE(verified_at, now()), verified_by = COALESCE(verified_by, auth.uid())
    WHERE id = v_fleet.vehicle_owner_id;
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_fleet.owner_id, 'fleet',
          CASE WHEN p_approve THEN 'Your fleet is verified' ELSE 'Your fleet was not accepted' END,
          CASE WHEN p_approve THEN v_fleet.name || ' is verified. Your approved vehicles can now go on the road.'
               ELSE v_fleet.name || ' was not accepted: ' || btrim(p_notes) END,
          jsonb_build_object('url', '/fleet/dashboard'));
END; $$;

-- ------------------------------------------------------------- vehicles
-- Adds many vehicles at once. p_vehicles is an array of
--   {"license_plate", "make", "model", "year", "color", "vin_number"}
-- Each row is checked on its own; the result says what happened to every row.
CREATE OR REPLACE FUNCTION public.fleet_add_vehicles(p_fleet_id uuid, p_vehicles jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fleet public.fleets := public.fleet_require_operator(p_fleet_id);
  v_row jsonb;
  v_n integer := 0;
  v_added integer := 0;
  v_plate text;
  v_existing public.vehicles;
  v_problem text;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_vehicles) <> 'array' OR jsonb_array_length(p_vehicles) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'There are no vehicles to add.');
  END IF;
  IF jsonb_array_length(p_vehicles) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Add at most 500 vehicles at a time.');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_vehicles)
  LOOP
    v_n := v_n + 1;
    v_plate := upper(regexp_replace(COALESCE(v_row ->> 'license_plate', ''), '\s+', '', 'g'));
    v_problem := NULL;

    IF length(v_plate) < 4 THEN
      v_problem := 'The number plate is missing.';
    ELSIF COALESCE(btrim(v_row ->> 'make'), '') = '' OR COALESCE(btrim(v_row ->> 'model'), '') = '' THEN
      v_problem := 'The make or model is missing.';
    ELSIF COALESCE(v_row ->> 'year', '') !~ '^\d{4}$' OR (v_row ->> 'year')::integer NOT BETWEEN 1980 AND 2100 THEN
      v_problem := 'The year must be four digits.';
    ELSE
      SELECT * INTO v_existing FROM public.vehicles
      WHERE upper(regexp_replace(license_plate, '\s+', '', 'g')) = v_plate LIMIT 1;
      IF FOUND AND v_existing.fleet_id = p_fleet_id THEN
        v_problem := 'Already in your fleet.';
      ELSIF FOUND THEN
        v_problem := 'This plate is already registered on 1145. Contact support to move it to your fleet.';
      END IF;
    END IF;

    IF v_problem IS NULL THEN
      INSERT INTO public.vehicles (fleet_id, owner_id, is_fleet_vehicle, license_plate, make, model, year, color, vin_number)
      VALUES (p_fleet_id, v_fleet.vehicle_owner_id, true, v_plate, btrim(v_row ->> 'make'), btrim(v_row ->> 'model'),
              (v_row ->> 'year')::integer, COALESCE(NULLIF(btrim(v_row ->> 'color'), ''), 'Not given'),
              NULLIF(btrim(COALESCE(v_row ->> 'vin_number', '')), ''));
      v_added := v_added + 1;
    END IF;
    v_results := v_results || jsonb_build_object('row', v_n, 'license_plate', v_plate, 'ok', v_problem IS NULL, 'message', v_problem);
  END LOOP;

  UPDATE public.fleets SET total_vehicles = (SELECT count(*) FROM public.vehicles WHERE fleet_id = p_fleet_id) WHERE id = p_fleet_id;
  RETURN jsonb_build_object('ok', true, 'added', v_added, 'results', v_results);
END; $$;

-- 1145 checks each fleet vehicle against its registration papers before it can be driven.
CREATE OR REPLACE FUNCTION public.review_fleet_vehicles(p_vehicle_ids uuid[], p_approve boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.vehicles SET status = CASE WHEN p_approve THEN 'active' ELSE 'inactive' END
  WHERE id = ANY (p_vehicle_ids) AND fleet_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.fleets f SET active_vehicles = (SELECT count(*) FROM public.vehicles v WHERE v.fleet_id = f.id AND v.status = 'active')
  WHERE f.id IN (SELECT fleet_id FROM public.vehicles WHERE id = ANY (p_vehicle_ids));
  RETURN v_count;
END; $$;

-- ------------------------------------------------------------- drivers
-- Invites a registered 1145 driver, found by the phone number or email on their account.
CREATE OR REPLACE FUNCTION public.fleet_invite_driver(p_fleet_id uuid, p_contact text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fleet public.fleets := public.fleet_require_operator(p_fleet_id);
  v_contact text := btrim(COALESCE(p_contact, ''));
  v_digits text := right(regexp_replace(btrim(COALESCE(p_contact, '')), '\D', '', 'g'), 9);
  v_driver public.drivers;
BEGIN
  SELECT d.* INTO v_driver FROM public.drivers d
  LEFT JOIN public.profiles p ON p.id = d.user_id
  WHERE (position('@' IN v_contact) > 0 AND lower(p.email) = lower(v_contact))
     OR (length(v_digits) = 9 AND right(regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g'), 9) = v_digits)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message',
      'No registered 1145 driver has that phone number or email. Ask them to sign up as a driver first.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.fleet_drivers WHERE fleet_id = p_fleet_id AND driver_id = v_driver.id AND status IN ('invited', 'active')) THEN
    RETURN jsonb_build_object('ok', false, 'message', v_driver.name || ' is already in your fleet or has an invitation waiting.');
  END IF;

  INSERT INTO public.fleet_drivers (fleet_id, driver_id, invited_by) VALUES (p_fleet_id, v_driver.id, auth.uid());
  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_driver.user_id, 'fleet', 'You have been invited to a fleet',
          v_fleet.name || ' has invited you to drive its vehicles. Accept or decline on your Verification screen.',
          jsonb_build_object('url', '/driver/dashboard?tab=verification'));
  RETURN jsonb_build_object('ok', true, 'driver_name', v_driver.name);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_respond_fleet_invite(p_invite_id uuid, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.fleet_drivers;
BEGIN
  UPDATE public.fleet_drivers fd
  SET status = CASE WHEN p_accept THEN 'active' ELSE 'declined' END, responded_at = now()
  WHERE fd.id = p_invite_id AND fd.status = 'invited'
    AND fd.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  RETURNING * INTO v_invite;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This invitation is no longer open.');
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  SELECT f.owner_id, 'fleet', CASE WHEN p_accept THEN 'Driver joined your fleet' ELSE 'Invitation declined' END,
         d.name || CASE WHEN p_accept THEN ' accepted your invitation and can now be given shifts.' ELSE ' declined your invitation.' END,
         jsonb_build_object('url', '/fleet/dashboard')
  FROM public.fleets f, public.drivers d WHERE f.id = v_invite.fleet_id AND d.id = v_invite.driver_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Ends a driver's place in a fleet. The operator can remove a driver, and a driver can leave.
CREATE OR REPLACE FUNCTION public.fleet_end_driver(p_fleet_id uuid, p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id AND user_id = auth.uid()) THEN
    PERFORM public.fleet_require_operator(p_fleet_id);
  END IF;
  UPDATE public.fleet_drivers SET status = 'ended', ended_at = now()
  WHERE fleet_id = p_fleet_id AND driver_id = p_driver_id AND status IN ('invited', 'active');
  -- Shifts under way end now; ones still to come are cancelled.
  UPDATE public.fleet_shifts SET ends_at = now()
  WHERE fleet_id = p_fleet_id AND driver_id = p_driver_id AND status = 'scheduled'
    AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now());
  UPDATE public.fleet_shifts SET status = 'cancelled'
  WHERE fleet_id = p_fleet_id AND driver_id = p_driver_id AND status = 'scheduled' AND starts_at > now();
END; $$;

-- ------------------------------------------------------------- shifts
-- Puts a driver on a vehicle from p_starts_at to p_ends_at (NULL: until further
-- notice). p_repeat_days repeats the same hours on the following days. A shift
-- that would overlap another on the same vehicle, or another shift of the same
-- driver in any fleet, is skipped and reported.
CREATE OR REPLACE FUNCTION public.fleet_schedule_shift(
  p_fleet_id uuid, p_vehicle_id uuid, p_driver_id uuid, p_starts_at timestamptz, p_ends_at timestamptz DEFAULT NULL,
  p_repeat_days integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_repeat_days, 1), 1), 31);
  v_start timestamptz;
  v_end timestamptz;
  v_created integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_clash text;
BEGIN
  PERFORM public.fleet_require_operator(p_fleet_id);
  IF NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id = p_vehicle_id AND fleet_id = p_fleet_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That vehicle is not in your fleet.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fleet_drivers WHERE fleet_id = p_fleet_id AND driver_id = p_driver_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That driver has not joined your fleet yet.');
  END IF;
  IF p_starts_at IS NULL OR (p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The shift must end after it starts.');
  END IF;
  IF p_ends_at IS NULL AND v_days > 1 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A shift with no end cannot be repeated.');
  END IF;

  -- One schedule change at a time per vehicle and per driver.
  PERFORM pg_advisory_xact_lock(hashtext(p_vehicle_id::text));
  PERFORM pg_advisory_xact_lock(hashtext(p_driver_id::text));

  FOR i IN 0 .. v_days - 1 LOOP
    v_start := p_starts_at + make_interval(days => i);
    v_end := p_ends_at + make_interval(days => i);

    SELECT CASE WHEN s.vehicle_id = p_vehicle_id THEN 'the vehicle already has a driver then' ELSE 'the driver already has a shift then' END
    INTO v_clash
    FROM public.fleet_shifts s
    WHERE s.status = 'scheduled' AND (s.vehicle_id = p_vehicle_id OR s.driver_id = p_driver_id)
      AND s.starts_at < COALESCE(v_end, 'infinity'::timestamptz) AND COALESCE(s.ends_at, 'infinity'::timestamptz) > v_start
    ORDER BY (s.vehicle_id = p_vehicle_id) DESC LIMIT 1;

    IF v_clash IS NOT NULL THEN
      v_skipped := v_skipped || jsonb_build_object('starts_at', v_start, 'reason', v_clash);
    ELSE
      INSERT INTO public.fleet_shifts (fleet_id, vehicle_id, driver_id, starts_at, ends_at, created_by)
      VALUES (p_fleet_id, p_vehicle_id, p_driver_id, v_start, v_end, auth.uid());
      v_created := v_created + 1;
    END IF;
    v_clash := NULL;
  END LOOP;

  IF v_created = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not scheduled: ' || (v_skipped -> 0 ->> 'reason') || '.', 'skipped', v_skipped);
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  SELECT d.user_id, 'fleet', 'New shift',
         'You have been given ' || CASE WHEN v_created = 1 THEN 'a shift' ELSE v_created || ' shifts' END || ' on ' || v.license_plate
           || ', starting ' || to_char(p_starts_at AT TIME ZONE 'Africa/Johannesburg', 'DD Mon HH24:MI') || '.',
         jsonb_build_object('url', '/driver/dashboard?tab=verification')
  FROM public.drivers d, public.vehicles v WHERE d.id = p_driver_id AND v.id = p_vehicle_id;

  RETURN jsonb_build_object('ok', true, 'created', v_created, 'skipped', v_skipped);
END; $$;

-- A shift that has started is ended now; one still to come is cancelled.
CREATE OR REPLACE FUNCTION public.fleet_cancel_shift(p_shift_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shift public.fleet_shifts;
BEGIN
  SELECT * INTO v_shift FROM public.fleet_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found.'; END IF;
  PERFORM public.fleet_require_operator(v_shift.fleet_id);
  IF v_shift.starts_at <= now() THEN
    UPDATE public.fleet_shifts SET ends_at = now() WHERE id = p_shift_id AND (ends_at IS NULL OR ends_at > now());
  ELSE
    UPDATE public.fleet_shifts SET status = 'cancelled' WHERE id = p_shift_id;
  END IF;
END; $$;

-- Every few minutes: a driver still online in a fleet vehicle after their shift
-- is taken offline once they have no trip under way, so the next driver can start.
CREATE OR REPLACE FUNCTION public.fleet_end_overrun_sessions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session record;
  v_count integer := 0;
BEGIN
  FOR v_session IN
    SELECT s.driver_id, s.user_id
    FROM public.driver_sessions s JOIN public.vehicles v ON v.id = s.vehicle_id
    WHERE s.ended_at IS NULL AND v.fleet_id IS NOT NULL
      AND public.driver_current_vehicle(s.driver_id) IS DISTINCT FROM s.vehicle_id
      AND NOT public.driver_trip_in_flight(s.driver_id)
  LOOP
    PERFORM public.driver_end_session(v_session.driver_id, 'shift_ended');
    UPDATE public.drivers SET status = 'offline' WHERE id = v_session.driver_id AND status IN ('available', 'busy');
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_session.user_id, 'fleet', 'Your shift has ended',
            'You have been taken offline because your shift on this vehicle is over.',
            jsonb_build_object('url', '/driver/dashboard'));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ------------------------------------------------------------- vehicle compliance
CREATE OR REPLACE FUNCTION public.fleet_submit_vehicle_document(
  p_vehicle_id uuid, p_doc_type text, p_file_path text, p_expires_on date, p_document_number text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.fleet_require_vehicle(p_vehicle_id);
  IF p_doc_type NOT IN ('operating_licence', 'roadworthy', 'insurance') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown document type.');
  END IF;
  IF p_expires_on IS NULL OR p_expires_on < (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This document has already expired. Upload the renewed one.');
  END IF;
  IF p_file_path IS NULL OR left(p_file_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The file did not upload. Please try again.');
  END IF;

  UPDATE public.driver_documents SET status = 'superseded'
  WHERE vehicle_id = p_vehicle_id AND driver_id IS NULL AND doc_type = p_doc_type AND status = 'pending';
  INSERT INTO public.driver_documents (vehicle_id, doc_type, document_number, file_path, expires_on, submitted_by)
  VALUES (p_vehicle_id, p_doc_type, NULLIF(btrim(COALESCE(p_document_number, '')), ''), p_file_path, p_expires_on, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

-- The fleet's GPTRIS application for one vehicle. Reviewed with review_gauteng_application().
CREATE OR REPLACE FUNCTION public.fleet_submit_gauteng_application(
  p_vehicle_id uuid, p_gptris_reference text, p_receipt_path text, p_submitted_on date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reference text := upper(btrim(COALESCE(p_gptris_reference, '')));
  v_id uuid;
BEGIN
  PERFORM public.fleet_require_vehicle(p_vehicle_id);
  IF length(v_reference) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the GPTRIS reference number from the receipt.');
  END IF;
  IF p_submitted_on IS NULL OR p_submitted_on > (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the date on the receipt.');
  END IF;
  IF p_receipt_path IS NULL OR left(p_receipt_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The receipt did not upload. Please try again.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gauteng_licence_applications
             WHERE lower(gptris_reference) = lower(v_reference) AND status <> 'superseded'
               AND (driver_id IS NOT NULL OR vehicle_id <> p_vehicle_id OR status = 'issued')) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That GPTRIS reference is already on record. Contact support if this is a mistake.');
  END IF;

  UPDATE public.gauteng_licence_applications SET status = 'superseded'
  WHERE vehicle_id = p_vehicle_id AND driver_id IS NULL
    AND (status IN ('submitted', 'receipt_verified') OR lower(gptris_reference) = lower(v_reference));
  INSERT INTO public.gauteng_licence_applications (vehicle_id, gptris_reference, receipt_path, submitted_on)
  VALUES (p_vehicle_id, v_reference, p_receipt_path, p_submitted_on)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.fleet_submit_gauteng_licence(
  p_application_id uuid, p_licence_number text, p_licence_path text, p_licence_expires_on date, p_operating_area text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_app public.gauteng_licence_applications;
BEGIN
  SELECT * INTO v_app FROM public.gauteng_licence_applications WHERE id = p_application_id AND driver_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM public.fleet_require_vehicle(v_app.vehicle_id);
  IF v_app.status NOT IN ('submitted', 'receipt_verified') THEN
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
      licence_expires_on = p_licence_expires_on, operating_area = btrim(p_operating_area), licence_submitted_at = now()
  WHERE id = v_app.id;
  RETURN jsonb_build_object('ok', true, 'id', v_app.id);
END; $$;

-- Fleet vehicles' GPTRIS records, in the same shape as gauteng_compliance_overview().
CREATE OR REPLACE FUNCTION public.gauteng_fleet_vehicle_overview()
RETURNS TABLE (
  driver_id uuid, driver_name text, driver_status text, state text, may_operate boolean,
  application_id uuid, gptris_reference text, application_status text, submitted_on date, receipt_path text,
  licence_number text, licence_path text, licence_expires_on date, operating_area text,
  review_notes text, needs_review boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  RETURN QUERY
  SELECT v.id, v.license_plate || ' · ' || f.name, v.status, s.state,
         s.state = 'verified' OR (s.state = 'application_pending' AND a.status = 'receipt_verified' AND public.gauteng_transitional_active()),
         a.id, a.gptris_reference, a.status, a.submitted_on, a.receipt_path,
         a.licence_number, a.licence_path, a.licence_expires_on, a.operating_area, a.review_notes,
         a.status = 'submitted' OR (a.status = 'receipt_verified' AND a.licence_submitted_at IS NOT NULL)
  FROM public.vehicles v
  JOIN public.fleets f ON f.id = v.fleet_id
  CROSS JOIN LATERAL (SELECT public.gauteng_licence_state_for(NULL, v.id) AS state) s
  JOIN LATERAL (
    SELECT * FROM public.gauteng_licence_applications x
    WHERE x.vehicle_id = v.id AND x.driver_id IS NULL AND x.status <> 'superseded'
    ORDER BY x.created_at DESC LIMIT 1
  ) a ON true
  ORDER BY 16 DESC, 2;
END; $$;

-- ------------------------------------------------------------- safety devices and maintenance
CREATE OR REPLACE FUNCTION public.fleet_set_safety_device(
  p_vehicle_id uuid, p_device_type text, p_status text, p_serial_number text DEFAULT NULL, p_last_checked_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fleet_require_vehicle(p_vehicle_id);
  INSERT INTO public.vehicle_safety_devices (vehicle_id, device_type, status, serial_number, last_checked_on)
  VALUES (p_vehicle_id, p_device_type, p_status, NULLIF(btrim(COALESCE(p_serial_number, '')), ''), p_last_checked_on)
  ON CONFLICT (vehicle_id, device_type) DO UPDATE
  SET status = EXCLUDED.status, serial_number = EXCLUDED.serial_number, last_checked_on = EXCLUDED.last_checked_on,
      -- What the operator now says has not been checked by 1145 yet.
      verified_at = NULL, verified_by = NULL, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.verify_safety_device(p_device_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.vehicle_safety_devices SET verified_at = now(), verified_by = auth.uid() WHERE id = p_device_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fleet_log_maintenance(p_vehicle_id uuid, p_kind text, p_due_on date, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.fleet_require_vehicle(p_vehicle_id);
  IF p_due_on IS NULL THEN RAISE EXCEPTION 'Enter the date it is due.'; END IF;
  INSERT INTO public.vehicle_maintenance (vehicle_id, kind, due_on, description, created_by)
  VALUES (p_vehicle_id, p_kind, p_due_on, NULLIF(btrim(COALESCE(p_description, '')), ''), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Marks an item done. Give p_next_due_on to line up the next one of the same kind.
CREATE OR REPLACE FUNCTION public.fleet_complete_maintenance(p_maintenance_id uuid, p_completed_on date, p_next_due_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.vehicle_maintenance;
BEGIN
  SELECT * INTO v_item FROM public.vehicle_maintenance WHERE id = p_maintenance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance item not found.'; END IF;
  PERFORM public.fleet_require_vehicle(v_item.vehicle_id);
  UPDATE public.vehicle_maintenance SET completed_on = COALESCE(p_completed_on, (now() AT TIME ZONE 'Africa/Johannesburg')::date)
  WHERE id = v_item.id;
  IF p_next_due_on IS NOT NULL THEN
    INSERT INTO public.vehicle_maintenance (vehicle_id, kind, due_on, description, created_by)
    VALUES (v_item.vehicle_id, v_item.kind, p_next_due_on, v_item.description, auth.uid());
  END IF;
END; $$;

-- ------------------------------------------------------------- dashboard
-- Everything the fleet dashboard shows, in one call.
CREATE OR REPLACE FUNCTION public.fleet_overview(p_fleet_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fleet public.fleets := public.fleet_require_operator(p_fleet_id);
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_soon date := (now() AT TIME ZONE 'Africa/Johannesburg')::date + 14;
BEGIN
  RETURN jsonb_build_object(
    'fleet', jsonb_build_object(
      'id', v_fleet.id, 'name', v_fleet.name, 'legal_name', v_fleet.legal_name,
      'verification_status', v_fleet.verification_status, 'verification_notes', v_fleet.verification_notes,
      'payout_mode', v_fleet.payout_mode, 'driver_share_pct', v_fleet.driver_share_pct),

    'vehicles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'license_plate', v.license_plate, 'make', v.make, 'model', v.model, 'year', v.year, 'color', v.color,
        'status', v.status,
        'online', EXISTS (SELECT 1 FROM public.driver_sessions s WHERE s.vehicle_id = v.id AND s.ended_at IS NULL),
        'documents', (SELECT jsonb_agg(jsonb_build_object('doc_type', ds.doc_type, 'state', ds.state, 'expires_on', ds.expires_on))
                      FROM public.vehicle_document_state(v.id) ds),
        'gauteng_state', public.gauteng_licence_state_for(NULL, v.id),
        'gauteng_application', (
          SELECT jsonb_build_object('id', a.id, 'gptris_reference', a.gptris_reference, 'status', a.status,
                                    'review_notes', a.review_notes, 'licence_submitted', a.licence_submitted_at IS NOT NULL)
          FROM public.gauteng_licence_applications a
          WHERE a.vehicle_id = v.id AND a.driver_id IS NULL AND a.status IN ('submitted', 'receipt_verified', 'rejected')
          ORDER BY a.created_at DESC LIMIT 1),
        'devices', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', sd.id, 'device_type', sd.device_type, 'status', sd.status,
                                              'serial_number', sd.serial_number, 'last_checked_on', sd.last_checked_on,
                                              'verified', sd.verified_at IS NOT NULL) ORDER BY sd.device_type)
          FROM public.vehicle_safety_devices sd WHERE sd.vehicle_id = v.id), '[]'::jsonb),
        'maintenance', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind, 'description', m.description, 'due_on', m.due_on) ORDER BY m.due_on)
          FROM public.vehicle_maintenance m WHERE m.vehicle_id = v.id AND m.completed_on IS NULL), '[]'::jsonb)
      ) ORDER BY v.license_plate)
      FROM public.vehicles v WHERE v.fleet_id = p_fleet_id), '[]'::jsonb),

    'drivers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'driver_id', d.id, 'name', d.name, 'phone', d.phone, 'membership', fd.status,
        'driver_status', d.status, 'online', public.driver_active_session_id(d.id) IS NOT NULL) ORDER BY d.name)
      FROM public.fleet_drivers fd JOIN public.drivers d ON d.id = fd.driver_id
      WHERE fd.fleet_id = p_fleet_id AND fd.status IN ('invited', 'active')), '[]'::jsonb),

    'shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'vehicle_id', s.vehicle_id, 'driver_id', s.driver_id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'current', s.starts_at <= now()) ORDER BY s.starts_at)
      FROM public.fleet_shifts s
      WHERE s.fleet_id = p_fleet_id AND s.status = 'scheduled' AND (s.ends_at IS NULL OR s.ends_at > now())), '[]'::jsonb),

    'alerts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('severity', x.severity, 'vehicle_id', x.vehicle_id, 'license_plate', x.license_plate, 'message', x.message)
                       ORDER BY (x.severity = 'high') DESC, x.license_plate)
      FROM (
        SELECT 'info' AS severity, v.id AS vehicle_id, v.license_plate, 'Waiting for 1145 to approve this vehicle.' AS message
        FROM public.vehicles v WHERE v.fleet_id = p_fleet_id AND v.status = 'pending'
        UNION ALL
        SELECT CASE WHEN ds.state IN ('expired', 'missing') THEN 'high' ELSE 'medium' END, v.id, v.license_plate,
               CASE ds.state
                 WHEN 'expired' THEN initcap(public.driver_document_label(ds.doc_type)) || ' expired on ' || to_char(ds.expires_on, 'DD Mon YYYY') || '. The vehicle cannot go online.'
                 WHEN 'missing' THEN initcap(public.driver_document_label(ds.doc_type)) || ' has not been uploaded.'
                 WHEN 'pending' THEN initcap(public.driver_document_label(ds.doc_type)) || ' is being reviewed by 1145.'
                 ELSE initcap(public.driver_document_label(ds.doc_type)) || ' expires on ' || to_char(ds.expires_on, 'DD Mon YYYY') || '.' END
        FROM public.vehicles v CROSS JOIN LATERAL public.vehicle_document_state(v.id) ds
        WHERE v.fleet_id = p_fleet_id AND (ds.state <> 'valid' OR ds.expires_on <= v_soon)
        UNION ALL
        SELECT CASE WHEN m.due_on < v_today THEN 'high' ELSE 'medium' END, v.id, v.license_plate,
               initcap(m.kind) || CASE WHEN m.due_on < v_today THEN ' was due on ' ELSE ' is due on ' END || to_char(m.due_on, 'DD Mon YYYY') || '.'
        FROM public.vehicle_maintenance m JOIN public.vehicles v ON v.id = m.vehicle_id
        WHERE v.fleet_id = p_fleet_id AND m.completed_on IS NULL AND m.due_on <= v_soon
        UNION ALL
        SELECT CASE WHEN sd.status = 'faulty' THEN 'high' ELSE 'medium' END, v.id, v.license_plate,
               initcap(replace(sd.device_type, '_', ' ')) || CASE
                 WHEN sd.status = 'faulty' THEN ' is reported faulty.'
                 WHEN sd.last_checked_on IS NULL OR sd.last_checked_on < v_today - 90 THEN ' has not been checked in the last 90 days.'
                 ELSE ' has not been confirmed by 1145 yet.' END
        FROM public.vehicle_safety_devices sd JOIN public.vehicles v ON v.id = sd.vehicle_id
        WHERE v.fleet_id = p_fleet_id AND sd.status <> 'not_fitted'
          AND (sd.status = 'faulty' OR sd.verified_at IS NULL OR sd.last_checked_on IS NULL OR sd.last_checked_on < v_today - 90)
      ) x), '[]'::jsonb));
END; $$;

-- What the fleet's vehicles earned between two dates, by vehicle and driver.
--   payout       = fares less commission, plus the fuel adjustments (as for any driver)
--   driver_share = the part of the payout the operator has agreed to pass on, when set
CREATE OR REPLACE FUNCTION public.fleet_earnings(p_fleet_id uuid, p_from date, p_to date)
RETURNS TABLE (
  vehicle_id uuid, license_plate text, driver_id uuid, driver_name text,
  trips bigint, fares numeric, fuel_adjustments numeric, commission numeric, payout numeric, driver_share numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fleet public.fleets := public.fleet_require_operator(p_fleet_id);
BEGIN
  RETURN QUERY
  WITH trip AS (
    SELECT v.id AS vid, v.license_plate AS plate, d.id AS did, d.name AS dname,
           COALESCE(r.actual_fare, r.estimated_fare, 0) AS fare, COALESCE(r.fuel_surcharge, 0) AS fuel,
           COALESCE(r.platform_commission_pct, public.ride_platform_commission_pct()) AS pct
    FROM public.rides r
    JOIN public.driver_sessions s ON s.id = r.driver_session_id
    JOIN public.vehicles v ON v.id = s.vehicle_id AND v.fleet_id = p_fleet_id
    JOIN public.drivers d ON d.id = r.driver_id
    WHERE r.status = 'completed'
      AND (r.completed_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  )
  SELECT t.vid, t.plate, t.did, t.dname, count(*), round(sum(t.fare), 2), round(sum(t.fuel), 2),
         round(sum((t.fare - t.fuel) * t.pct / 100), 2),
         round(sum((t.fare - t.fuel) * (1 - t.pct / 100) + t.fuel), 2),
         round(sum((t.fare - t.fuel) * (1 - t.pct / 100) + t.fuel) * v_fleet.driver_share_pct / 100, 2)
  FROM trip t GROUP BY t.vid, t.plate, t.did, t.dname ORDER BY t.plate, t.dname;
END; $$;

-- What a driver sees of their fleets: invitations to answer, and their shifts.
CREATE OR REPLACE FUNCTION public.driver_fleet_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver uuid;
BEGIN
  SELECT id INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'on_fleet_vehicle', EXISTS (SELECT 1 FROM public.vehicles v WHERE v.fleet_id IS NOT NULL AND v.id = public.driver_current_vehicle(v_driver)),
    'memberships', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', fd.id, 'fleet_id', f.id, 'fleet_name', f.name, 'status', fd.status) ORDER BY fd.invited_at)
      FROM public.fleet_drivers fd JOIN public.fleets f ON f.id = fd.fleet_id
      WHERE fd.driver_id = v_driver AND fd.status IN ('invited', 'active')), '[]'::jsonb),
    'shifts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'fleet_name', f.name, 'license_plate', v.license_plate,
        'vehicle', v.year || ' ' || v.make || ' ' || v.model || ', ' || v.color,
        'starts_at', s.starts_at, 'ends_at', s.ends_at, 'current', s.starts_at <= now(),
        'vehicle_ready', v.status = 'active' AND f.verification_status = 'verified') ORDER BY s.starts_at)
      FROM public.fleet_shifts s JOIN public.fleets f ON f.id = s.fleet_id JOIN public.vehicles v ON v.id = s.vehicle_id
      WHERE s.driver_id = v_driver AND s.status = 'scheduled' AND (s.ends_at IS NULL OR s.ends_at > now())), '[]'::jsonb));
END; $$;

-- Nightly: tell operators about vehicle documents and maintenance coming due.
CREATE OR REPLACE FUNCTION public.fleet_send_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_warning_days integer;
  v_row record;
  v_count integer := 0;
BEGIN
  SELECT document_warning_days INTO v_warning_days FROM public.driver_verification_settings;

  FOR v_row IN
    SELECT doc.id, doc.doc_type, doc.expires_on, v.license_plate, f.owner_id
    FROM public.driver_documents doc
    JOIN public.vehicles v ON v.id = doc.vehicle_id
    JOIN public.fleets f ON f.id = v.fleet_id
    WHERE doc.driver_id IS NULL AND doc.status IN ('approved', 'expired') AND doc.expiry_warned_at IS NULL
      AND doc.expires_on <= v_today + v_warning_days
      AND NOT EXISTS (SELECT 1 FROM public.driver_documents n
                      WHERE n.vehicle_id = doc.vehicle_id AND n.driver_id IS NULL AND n.doc_type = doc.doc_type
                        AND n.status = 'approved' AND n.expires_on > doc.expires_on)
  LOOP
    UPDATE public.driver_documents SET expiry_warned_at = now() WHERE id = v_row.id;
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_row.owner_id, 'fleet', 'A vehicle document needs renewing',
            initcap(public.driver_document_label(v_row.doc_type)) || ' for ' || v_row.license_plate
              || CASE WHEN v_row.expires_on < v_today THEN ' expired on ' ELSE ' expires on ' END || to_char(v_row.expires_on, 'DD Mon YYYY')
              || '. The vehicle cannot go online without a valid one.',
            jsonb_build_object('url', '/fleet/dashboard'));
    v_count := v_count + 1;
  END LOOP;

  FOR v_row IN
    SELECT m.id, m.kind, m.due_on, v.license_plate, f.owner_id
    FROM public.vehicle_maintenance m
    JOIN public.vehicles v ON v.id = m.vehicle_id
    JOIN public.fleets f ON f.id = v.fleet_id
    WHERE m.completed_on IS NULL AND m.alerted_at IS NULL AND m.due_on <= v_today + 14
  LOOP
    UPDATE public.vehicle_maintenance SET alerted_at = now() WHERE id = v_row.id;
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_row.owner_id, 'fleet', 'Maintenance due',
            initcap(v_row.kind) || ' for ' || v_row.license_plate || ' is due on ' || to_char(v_row.due_on, 'DD Mon YYYY') || '.',
            jsonb_build_object('url', '/fleet/dashboard'));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- ------------------------------------------------------------- permissions
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'gauteng_licence_state_for(uuid, uuid)', 'vehicle_document_state(uuid)',
    'fleet_end_overrun_sessions()', 'fleet_send_alerts()']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'fleet_require_operator(uuid)', 'fleet_require_vehicle(uuid)',
    'register_fleet(text, text, text, text, text)', 'review_fleet(uuid, boolean, text, text)',
    'fleet_add_vehicles(uuid, jsonb)', 'review_fleet_vehicles(uuid[], boolean)',
    'fleet_invite_driver(uuid, text)', 'driver_respond_fleet_invite(uuid, boolean)', 'fleet_end_driver(uuid, uuid)',
    'fleet_schedule_shift(uuid, uuid, uuid, timestamptz, timestamptz, integer)', 'fleet_cancel_shift(uuid)',
    'fleet_submit_vehicle_document(uuid, text, text, date, text)',
    'fleet_submit_gauteng_application(uuid, text, text, date)',
    'fleet_submit_gauteng_licence(uuid, text, text, date, text)', 'gauteng_fleet_vehicle_overview()',
    'fleet_set_safety_device(uuid, text, text, text, date)', 'verify_safety_device(uuid)',
    'fleet_log_maintenance(uuid, text, date, text)', 'fleet_complete_maintenance(uuid, date, date)',
    'fleet_overview(uuid)', 'fleet_earnings(uuid, date, date)', 'driver_fleet_status()']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('fleet-end-overrun-sessions', 'fleet-send-alerts');
    PERFORM cron.schedule('fleet-end-overrun-sessions', '*/5 * * * *', 'SELECT public.fleet_end_overrun_sessions();');
    -- 22:15 UTC is a quarter past midnight in South Africa, after documents are marked expired.
    PERFORM cron.schedule('fleet-send-alerts', '15 22 * * *', 'SELECT public.fleet_send_alerts();');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; shift overruns and fleet alerts will not run automatically.';
  END IF;
END $$;
