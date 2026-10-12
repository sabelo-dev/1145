-- 1145 Ride: driver identity is verified continuously, not only at registration.
--
-- 1. A driver goes online through driver_go_online(), which needs a fresh
--    selfie check, and is asked for more selfies at random during the shift.
-- 2. Each driver is bound to one device; new, shared or changed devices and
--    SIMs raise alerts.
-- 3. A driver has at most one active session, and every session names the
--    verified driver, the device and the vehicle. Trips record their session.
-- 4. Vehicle owners are their own records, linked to drivers through dated
--    assignments.
-- 5. A PrDP, operating licence, roadworthy certificate or insurance document
--    that expires suspends the driver until a renewal is approved.
-- 6. Suspected profile sharing is handled as an investigation that can freeze
--    the account and keeps a timeline of what was done.
--
-- Drivers could previously write drivers.status themselves (approve, un-suspend
-- or put themselves online). Guard triggers below close that: they constrain
-- direct API writes only, as in 20260924120000_security_hardening.sql.

-- ------------------------------------------------------------- 0. settings
CREATE TABLE IF NOT EXISTS public.driver_verification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- When on, going online also needs all four documents approved and a
  -- verified vehicle. Off by default so existing drivers are not locked out
  -- before they have had a chance to upload.
  compliance_enforced boolean NOT NULL DEFAULT false,
  go_online_check_valid_minutes integer NOT NULL DEFAULT 10 CHECK (go_online_check_valid_minutes BETWEEN 1 AND 60),
  check_response_minutes integer NOT NULL DEFAULT 10 CHECK (check_response_minutes BETWEEN 2 AND 60),
  random_check_min_minutes integer NOT NULL DEFAULT 45 CHECK (random_check_min_minutes >= 5),
  random_check_max_minutes integer NOT NULL DEFAULT 180,
  device_changes_per_30_days integer NOT NULL DEFAULT 1 CHECK (device_changes_per_30_days >= 0),
  document_warning_days integer NOT NULL DEFAULT 14 CHECK (document_warning_days >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (random_check_max_minutes >= random_check_min_minutes)
);
INSERT INTO public.driver_verification_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- ------------------------------------------------------------- 1. tables
CREATE TABLE IF NOT EXISTS public.vehicle_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('individual', 'company')),
  legal_name text NOT NULL,
  -- SA ID / passport number for a person, registration number for a company.
  id_number text NOT NULL,
  phone text,
  email text,
  -- Set when the owner is also a 1145 user (an owner-driver, for example).
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verified_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_owners_identity_unique
  ON public.vehicle_owners (owner_type, lower(id_number));

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.vehicle_owners(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.vehicle_driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.vehicle_owners(id),
  relationship text NOT NULL CHECK (relationship IN ('owner_driver', 'authorised_driver')),
  -- The owner's signed permission, for a driver who is not the owner.
  authorisation_doc_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'ended')),
  starts_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_driver_assignments_one_pending
  ON public.vehicle_driver_assignments (driver_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_driver_assignments_one_approved
  ON public.vehicle_driver_assignments (driver_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS vehicle_driver_assignments_vehicle_idx
  ON public.vehicle_driver_assignments (vehicle_id);

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('prdp', 'operating_licence', 'roadworthy', 'insurance')),
  document_number text,
  file_path text NOT NULL,
  expires_on date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'superseded')),
  expiry_warned_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_documents_driver_idx ON public.driver_documents (driver_id, doc_type);
CREATE INDEX IF NOT EXISTS driver_documents_expiry_idx ON public.driver_documents (expires_on) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS public.driver_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  -- Random id the app generates once and keeps on the device.
  device_id text NOT NULL,
  platform text,
  label text,
  sim_fingerprint text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'replaced', 'revoked')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  -- When it last became the driver's bound device.
  activated_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, device_id)
);
CREATE INDEX IF NOT EXISTS driver_devices_device_idx ON public.driver_devices (device_id);

CREATE TABLE IF NOT EXISTS public.driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.driver_devices(id),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  -- The selfie check that opened the session. Set straight after the insert.
  identity_check_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  next_check_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_sessions_one_active_per_driver
  ON public.driver_sessions (driver_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS driver_sessions_one_active_per_vehicle
  ON public.driver_sessions (vehicle_id) WHERE ended_at IS NULL AND vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS driver_sessions_driver_idx ON public.driver_sessions (driver_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.driver_identity_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.driver_sessions(id) ON DELETE SET NULL,
  trigger text NOT NULL CHECK (trigger IN ('go_online', 'random')),
  -- A pose the driver is asked to hold, so a reviewer can tell the photo was
  -- taken for this request.
  challenge text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'passed', 'failed', 'missed', 'cancelled')),
  device_id text,
  selfie_path text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text
);
CREATE INDEX IF NOT EXISTS driver_identity_checks_driver_idx ON public.driver_identity_checks (driver_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS driver_identity_checks_open_idx ON public.driver_identity_checks (status, due_at) WHERE status IN ('pending', 'submitted');

ALTER TABLE public.driver_sessions DROP CONSTRAINT IF EXISTS driver_sessions_identity_check_id_fkey;
ALTER TABLE public.driver_sessions
  ADD CONSTRAINT driver_sessions_identity_check_id_fkey
  FOREIGN KEY (identity_check_id) REFERENCES public.driver_identity_checks(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.driver_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'profile_sharing' CHECK (category IN ('profile_sharing', 'identity_mismatch', 'document_fraud', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'confirmed')),
  summary text NOT NULL,
  account_frozen boolean NOT NULL DEFAULT false,
  identity_check_id uuid REFERENCES public.driver_identity_checks(id) ON DELETE SET NULL,
  -- NULL when the system opened it.
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  closed_at timestamptz,
  outcome_notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS driver_investigations_one_open
  ON public.driver_investigations (driver_id) WHERE status = 'open';

-- The timeline. Rows are only ever added.
CREATE TABLE IF NOT EXISTS public.driver_investigation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES public.driver_investigations(id) ON DELETE CASCADE,
  actor_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('opened', 'frozen', 'note', 'alert_linked', 'cleared', 'confirmed', 'reinstated')),
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_investigation_events_idx ON public.driver_investigation_events (investigation_id, created_at);

CREATE TABLE IF NOT EXISTS public.driver_security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN (
    'new_device', 'device_change_limit', 'shared_device', 'revoked_device', 'sim_changed',
    'concurrent_session', 'vehicle_in_use', 'identity_check_missed', 'identity_check_failed')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
  investigation_id uuid REFERENCES public.driver_investigations(id) ON DELETE SET NULL,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_security_alerts_open_idx ON public.driver_security_alerts (status, created_at DESC);

-- Which verified session carried each trip.
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS driver_session_id uuid REFERENCES public.driver_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS driver_session_id uuid REFERENCES public.driver_sessions(id) ON DELETE SET NULL;

-- ------------------------------------------------------------- 2. access
-- Everything is written by the functions below. Drivers read their own rows;
-- alerts and investigations are for admins only.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'driver_verification_settings', 'vehicle_owners', 'vehicle_driver_assignments', 'driver_documents',
    'driver_devices', 'driver_sessions', 'driver_identity_checks', 'driver_investigations',
    'driver_investigation_events', 'driver_security_alerts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admins read" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['vehicle_driver_assignments', 'driver_documents', 'driver_devices', 'driver_sessions', 'driver_identity_checks']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Drivers read own" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Drivers read own" ON public.%I FOR SELECT TO authenticated '
      'USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Drivers read their vehicle owner" ON public.vehicle_owners;
CREATE POLICY "Drivers read their vehicle owner" ON public.vehicle_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR id IN (
    SELECT a.owner_id FROM public.vehicle_driver_assignments a
    JOIN public.drivers d ON d.id = a.driver_id WHERE d.user_id = auth.uid()));

GRANT UPDATE ON public.driver_verification_settings TO authenticated;
DROP POLICY IF EXISTS "Admins update settings" ON public.driver_verification_settings;
CREATE POLICY "Admins update settings" ON public.driver_verification_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Selfies taken for identity checks are evidence: once uploaded, the driver
-- cannot replace or remove them.
DROP POLICY IF EXISTS "Drivers update own KYC files" ON storage.objects;
CREATE POLICY "Drivers update own KYC files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'driver-kyc' AND (storage.foldername(name))[1] = auth.uid()::text
       AND (storage.foldername(name))[2] IS DISTINCT FROM 'identity-checks');

DROP POLICY IF EXISTS "Drivers delete own KYC files" ON storage.objects;
CREATE POLICY "Drivers delete own KYC files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'driver-kyc' AND (storage.foldername(name))[1] = auth.uid()::text
       AND (storage.foldername(name))[2] IS DISTINCT FROM 'identity-checks');

-- ------------------------------------------------------------- 3. helpers
CREATE OR REPLACE FUNCTION public.driver_document_label(p_doc_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_doc_type
    WHEN 'prdp' THEN 'PrDP'
    WHEN 'operating_licence' THEN 'operating licence'
    WHEN 'roadworthy' THEN 'roadworthy certificate'
    WHEN 'insurance' THEN 'insurance'
    ELSE p_doc_type END;
$$;

-- Where each required document stands for a driver, judged on the South
-- African date. A document is good until the end of its expiry date.
CREATE OR REPLACE FUNCTION public.driver_document_state(p_driver_id uuid)
RETURNS TABLE (doc_type text, expires_on date, state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.doc_type, held.expires_on,
         CASE WHEN held.expires_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN 'valid'
              WHEN held.expires_on IS NOT NULL THEN 'expired'
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

CREATE OR REPLACE FUNCTION public.driver_active_session_id(p_driver_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.driver_sessions WHERE driver_id = p_driver_id AND ended_at IS NULL;
$$;

-- A driver with a passenger or parcel on board is never interrupted.
CREATE OR REPLACE FUNCTION public.driver_trip_in_flight(p_driver_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides r WHERE r.driver_id = p_driver_id
                 AND r.status IN ('accepted', 'driver_assigned', 'driver_arriving', 'arriving', 'arrived', 'started', 'in_progress'))
      OR EXISTS (SELECT 1 FROM public.delivery_jobs j WHERE j.driver_id = p_driver_id
                 AND j.status IN ('accepted', 'assigned', 'picked_up', 'in_transit', 'arrived'));
$$;

CREATE OR REPLACE FUNCTION public.driver_end_session(p_driver_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.driver_identity_checks c SET status = 'cancelled'
  FROM public.driver_sessions s
  WHERE s.driver_id = p_driver_id AND s.ended_at IS NULL AND c.session_id = s.id AND c.status = 'pending';

  UPDATE public.driver_sessions SET ended_at = now(), end_reason = p_reason
  WHERE driver_id = p_driver_id AND ended_at IS NULL;

  UPDATE public.driver_locations SET is_online = false, is_available = false
  WHERE driver_id = p_driver_id AND (is_online OR is_available);
END; $$;

-- One open alert per driver, type and set of details: repeated attempts do not pile up.
CREATE OR REPLACE FUNCTION public.driver_raise_alert(p_driver_id uuid, p_type text, p_severity text, p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.driver_security_alerts
             WHERE driver_id = p_driver_id AND alert_type = p_type AND status = 'open' AND details = p_details) THEN
    RETURN;
  END IF;
  INSERT INTO public.driver_security_alerts (driver_id, alert_type, severity, details)
  VALUES (p_driver_id, p_type, p_severity, p_details);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_next_check_at()
RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT now() + make_interval(mins =>
    s.random_check_min_minutes + floor(random() * (s.random_check_max_minutes - s.random_check_min_minutes + 1))::int)
  FROM public.driver_verification_settings s;
$$;

CREATE OR REPLACE FUNCTION public.driver_random_challenge()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT (ARRAY[
    'Turn your head slightly to the left',
    'Turn your head slightly to the right',
    'Smile with your teeth showing',
    'Hold one open hand next to your face',
    'Hold two fingers up next to your face',
    'Touch your chin with one finger'
  ])[1 + floor(random() * 6)::int];
$$;

-- A random check that was not answered in time: the driver is taken offline.
CREATE OR REPLACE FUNCTION public.driver_miss_identity_check(p_check_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_check public.driver_identity_checks;
  v_user uuid;
  v_missed integer;
BEGIN
  UPDATE public.driver_identity_checks SET status = 'missed'
  WHERE id = p_check_id AND status = 'pending'
  RETURNING * INTO v_check;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_missed FROM public.driver_identity_checks
  WHERE driver_id = v_check.driver_id AND status = 'missed' AND requested_at > now() - interval '30 days';

  PERFORM public.driver_raise_alert(v_check.driver_id, 'identity_check_missed',
    CASE WHEN v_missed >= 3 THEN 'high' ELSE 'medium' END,
    jsonb_build_object('check_id', v_check.id, 'missed_in_30_days', v_missed));

  PERFORM public.driver_end_session(v_check.driver_id, 'identity_check_missed');
  UPDATE public.drivers SET status = 'offline'
  WHERE id = v_check.driver_id AND status IN ('available', 'busy')
  RETURNING user_id INTO v_user;

  IF v_user IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_user, 'driver_verification', 'You were taken offline',
            'We asked for a selfie to confirm it is you driving and did not get one in time. Take a new selfie to go back online.',
            jsonb_build_object('url', '/driver/dashboard'));
  END IF;
END; $$;

-- Lifts a document suspension once nothing on file is out of date.
CREATE OR REPLACE FUNCTION public.driver_refresh_compliance(p_driver_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.driver_document_state(p_driver_id) s WHERE s.state = 'expired') THEN
    RETURN;
  END IF;
  UPDATE public.drivers SET status = 'offline'
  WHERE id = p_driver_id AND status = 'suspended' AND suspension_reason = 'documents_expired'
  RETURNING user_id INTO v_user;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_user, 'driver_verification', 'Your documents are up to date',
            'Your driver account is active again. You can go online.',
            jsonb_build_object('url', '/driver/dashboard'));
  END IF;
END; $$;

-- ------------------------------------------------------------- 4. guards
CREATE OR REPLACE FUNCTION public.guard_driver_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_client boolean := current_user IN ('authenticated', 'anon');
BEGIN
  IF NOT v_client OR public.is_admin() THEN
    -- A frozen account is released by closing its investigation, not by editing the status.
    IF v_client AND TG_OP = 'UPDATE' THEN
      IF OLD.status = 'suspended' AND NEW.status <> 'suspended'
         AND OLD.suspension_reason IN ('investigation', 'investigation_confirmed') THEN
        RAISE EXCEPTION 'This driver is frozen by an investigation. Close the investigation to reinstate them.';
      END IF;
    END IF;

    IF NEW.status = 'suspended' THEN
      NEW.suspension_reason := COALESCE(NEW.suspension_reason, 'admin');
      NEW.suspended_at := COALESCE(NEW.suspended_at, now());
    ELSE
      NEW.suspension_reason := NULL;
      NEW.suspended_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.suspension_reason := NULL;
    NEW.suspended_at := NULL;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.suspension_reason := OLD.suspension_reason;
    NEW.suspended_at := OLD.suspended_at;
    -- A driver may send their own application back for review, nothing else.
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (NEW.status = 'pending' AND OLD.status <> 'suspended') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_driver_client_writes ON public.drivers;
CREATE TRIGGER trg_guard_driver_client_writes
  BEFORE INSERT OR UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_client_writes();

-- Whatever takes a driver off the road also closes their session.
CREATE OR REPLACE FUNCTION public.driver_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('available', 'busy') THEN
    PERFORM public.driver_end_session(NEW.id, 'status_' || NEW.status);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_driver_status_changed ON public.drivers;
CREATE TRIGGER trg_driver_status_changed
  AFTER UPDATE OF status ON public.drivers
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.driver_status_changed();

-- Only a driver with a session can appear as online to ride matching.
CREATE OR REPLACE FUNCTION public.guard_driver_location_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (NEW.is_online OR NEW.is_available) AND public.driver_active_session_id(NEW.driver_id) IS NULL THEN
    NEW.is_online := false;
    NEW.is_available := false;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_driver_location_client_writes ON public.driver_locations;
CREATE TRIGGER trg_guard_driver_location_client_writes
  BEFORE INSERT OR UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.guard_driver_location_client_writes();

-- A trip can only be given to a driver who is online with a verified session,
-- and it keeps a reference to that session.
CREATE OR REPLACE FUNCTION public.stamp_driver_session_on_trip()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_assigning boolean := TG_OP = 'INSERT';
  v_session uuid;
BEGIN
  IF NEW.driver_id IS NULL THEN
    NEW.driver_session_id := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_assigning := NEW.driver_id IS DISTINCT FROM OLD.driver_id;
  END IF;

  IF v_assigning THEN
    v_session := public.driver_active_session_id(NEW.driver_id);
    IF v_session IS NULL AND current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'This driver is not online. Go online and confirm your identity before taking a trip.';
    END IF;
    NEW.driver_session_id := v_session;
  ELSE
    NEW.driver_session_id := OLD.driver_session_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stamp_driver_session ON public.rides;
CREATE TRIGGER trg_stamp_driver_session
  BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.stamp_driver_session_on_trip();

DROP TRIGGER IF EXISTS trg_stamp_driver_session ON public.delivery_jobs;
CREATE TRIGGER trg_stamp_driver_session
  BEFORE INSERT OR UPDATE ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_driver_session_on_trip();

-- The owner on a vehicle record is set when an assignment is approved.
CREATE OR REPLACE FUNCTION public.guard_vehicle_owner_client_writes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.owner_id := NULL; ELSE NEW.owner_id := OLD.owner_id; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_vehicle_owner_client_writes ON public.vehicles;
CREATE TRIGGER trg_guard_vehicle_owner_client_writes
  BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_owner_client_writes();

-- A frozen account cannot cash out.
CREATE OR REPLACE FUNCTION public.block_frozen_driver_cashout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = NEW.driver_id AND d.status = 'suspended'
             AND d.suspension_reason IN ('investigation', 'investigation_confirmed')) THEN
    RAISE EXCEPTION 'Cash-outs are on hold while your account is under review.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_block_frozen_driver_cashout ON public.driver_cashouts;
CREATE TRIGGER trg_block_frozen_driver_cashout
  BEFORE INSERT ON public.driver_cashouts
  FOR EACH ROW EXECUTE FUNCTION public.block_frozen_driver_cashout();

-- ------------------------------------------------------------- 5. identity checks
CREATE OR REPLACE FUNCTION public.driver_request_identity_check(p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_check public.driver_identity_checks;
  v_minutes integer;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_driver', 'message', 'No driver account was found.');
  END IF;
  IF v_driver.status IN ('pending', 'suspended') THEN
    RETURN jsonb_build_object('ok', false, 'code', v_driver.status, 'message', 'Your driver account cannot go online right now.');
  END IF;

  SELECT * INTO v_check FROM public.driver_identity_checks
  WHERE driver_id = v_driver.id AND trigger = 'go_online' AND status = 'pending'
    AND device_id = p_device_id AND due_at > now() + interval '1 minute'
  ORDER BY requested_at DESC LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.driver_identity_checks SET status = 'cancelled'
    WHERE driver_id = v_driver.id AND trigger = 'go_online' AND status = 'pending';

    SELECT check_response_minutes INTO v_minutes FROM public.driver_verification_settings;
    INSERT INTO public.driver_identity_checks (driver_id, trigger, challenge, device_id, due_at)
    VALUES (v_driver.id, 'go_online', public.driver_random_challenge(), p_device_id, now() + make_interval(mins => v_minutes))
    RETURNING * INTO v_check;
  END IF;

  RETURN jsonb_build_object('ok', true, 'check',
    jsonb_build_object('id', v_check.id, 'challenge', v_check.challenge, 'due_at', v_check.due_at, 'trigger', v_check.trigger));
END; $$;

CREATE OR REPLACE FUNCTION public.driver_submit_identity_check(p_check_id uuid, p_selfie_path text, p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_check public.driver_identity_checks;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_driver', 'message', 'No driver account was found.');
  END IF;

  SELECT * INTO v_check FROM public.driver_identity_checks
  WHERE id = p_check_id AND driver_id = v_driver.id FOR UPDATE;
  IF NOT FOUND OR v_check.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'check_closed', 'message', 'This selfie request is no longer open. Start again.');
  END IF;

  IF v_check.due_at < now() THEN
    IF v_check.trigger = 'random' THEN
      PERFORM public.driver_miss_identity_check(v_check.id);
    ELSE
      UPDATE public.driver_identity_checks SET status = 'cancelled' WHERE id = v_check.id;
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'check_expired', 'message', 'That selfie request ran out of time. Start again.');
  END IF;

  -- The photo must be the one uploaded for this request, in the driver's own folder.
  IF p_selfie_path IS NULL
     OR left(p_selfie_path, length(auth.uid()::text || '/identity-checks/' || v_check.id::text))
        <> auth.uid()::text || '/identity-checks/' || v_check.id::text
     OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'driver-kyc' AND o.name = p_selfie_path) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_selfie', 'message', 'The selfie did not upload. Please try again.');
  END IF;

  UPDATE public.driver_identity_checks
  SET status = 'submitted', submitted_at = now(), selfie_path = p_selfie_path, device_id = p_device_id
  WHERE id = v_check.id;

  IF v_check.session_id IS NOT NULL THEN
    UPDATE public.driver_sessions SET next_check_at = public.driver_next_check_at(), last_seen_at = now()
    WHERE id = v_check.session_id AND ended_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

-- ------------------------------------------------------------- 6. sessions
CREATE OR REPLACE FUNCTION public.driver_go_online(
  p_device_id text, p_platform text DEFAULT NULL, p_device_label text DEFAULT NULL, p_sim_fingerprint text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_cfg public.driver_verification_settings;
  v_device public.driver_devices;
  v_session public.driver_sessions;
  v_check public.driver_identity_checks;
  v_docs text;
  v_vehicle uuid;
  v_known boolean;
  v_others integer;
  v_recent integer;
  v_other_driver uuid;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_driver', 'message', 'No driver account was found.');
  END IF;
  IF p_device_id IS NULL OR length(p_device_id) NOT BETWEEN 16 AND 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_device', 'message', 'This device could not be identified. Update the app and try again.');
  END IF;
  IF v_driver.status = 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pending', 'message', 'Your driver application is still being reviewed.');
  END IF;
  IF v_driver.status = 'suspended' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'suspended', 'message',
      CASE v_driver.suspension_reason
        WHEN 'documents_expired' THEN 'Your account is suspended because a document has expired. Upload the renewed document to be reinstated.'
        WHEN 'investigation' THEN 'Your account is on hold while we review it. Contact support for help.'
        ELSE 'Your driver account is suspended. Contact support for help.' END);
  END IF;

  SELECT * INTO v_cfg FROM public.driver_verification_settings;

  -- Documents: an expired one always blocks; missing ones block once enforcement is on.
  SELECT string_agg(public.driver_document_label(s.doc_type), ', ') INTO v_docs
  FROM public.driver_document_state(v_driver.id) s
  -- 'transitional' is an operating licence still being applied for, during a
  -- transitional period (20261012160000_gauteng_operating_licences.sql).
  WHERE s.state = 'expired' OR (v_cfg.compliance_enforced AND s.state NOT IN ('valid', 'transitional'));
  IF v_docs IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'documents', 'message',
      'These documents are missing, expired or still being reviewed: ' || v_docs || '.');
  END IF;

  SELECT a.vehicle_id INTO v_vehicle FROM public.vehicle_driver_assignments a
  WHERE a.driver_id = v_driver.id AND a.status = 'approved';
  IF v_vehicle IS NULL AND v_cfg.compliance_enforced THEN
    RETURN jsonb_build_object('ok', false, 'code', 'vehicle', 'message',
      'Your vehicle and its owner have not been verified yet. Add them under Verification.');
  END IF;

  -- One active session per driver: a second device cannot join in.
  SELECT s.* INTO v_session FROM public.driver_sessions s
  JOIN public.driver_devices d ON d.id = s.device_id
  WHERE s.driver_id = v_driver.id AND s.ended_at IS NULL AND d.device_id <> p_device_id
    AND s.last_seen_at > now() - interval '3 minutes';
  IF FOUND THEN
    PERFORM public.driver_raise_alert(v_driver.id, 'concurrent_session', 'high',
      jsonb_build_object('device_id', p_device_id, 'session_id', v_session.id));
    RETURN jsonb_build_object('ok', false, 'code', 'already_online', 'message',
      'This account is already online on another device. Go offline there first.');
  END IF;

  -- Device binding: one bound device at a time. Switching is allowed now and
  -- then; switching often, or to a device another driver uses, is not.
  SELECT * INTO v_device FROM public.driver_devices WHERE driver_id = v_driver.id AND device_id = p_device_id;
  v_known := FOUND;
  IF v_known AND v_device.status = 'revoked' THEN
    PERFORM public.driver_raise_alert(v_driver.id, 'revoked_device', 'high', jsonb_build_object('device_id', p_device_id));
    RETURN jsonb_build_object('ok', false, 'code', 'device_blocked', 'message', 'This device has been blocked for your account. Contact support.');
  END IF;
  IF v_known AND v_device.status = 'pending_approval' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'device_pending', 'message', 'This device is waiting for approval. Contact support to speed it up.');
  END IF;

  IF v_known AND v_device.status = 'active' THEN
    IF p_sim_fingerprint IS NOT NULL AND v_device.sim_fingerprint IS NOT NULL
       AND p_sim_fingerprint <> v_device.sim_fingerprint THEN
      PERFORM public.driver_raise_alert(v_driver.id, 'sim_changed', 'medium', jsonb_build_object('device_id', p_device_id));
    END IF;
    UPDATE public.driver_devices
    SET last_seen_at = now(), sim_fingerprint = COALESCE(p_sim_fingerprint, sim_fingerprint),
        label = COALESCE(left(p_device_label, 200), label)
    WHERE id = v_device.id;
  ELSE
    SELECT d.driver_id INTO v_other_driver FROM public.driver_devices d
    WHERE d.device_id = p_device_id AND d.driver_id <> v_driver.id AND d.status = 'active' LIMIT 1;
    IF v_other_driver IS NOT NULL THEN
      PERFORM public.driver_raise_alert(v_driver.id, 'shared_device', 'high',
        jsonb_build_object('device_id', p_device_id, 'other_driver_id', v_other_driver));
      RETURN jsonb_build_object('ok', false, 'code', 'device_shared', 'message',
        'This device is registered to another driver, so you cannot go online from it. Contact support.');
    END IF;

    SELECT count(*), count(*) FILTER (WHERE activated_at > now() - interval '30 days')
    INTO v_others, v_recent
    FROM public.driver_devices WHERE driver_id = v_driver.id AND device_id <> p_device_id;

    IF v_others > 0 AND v_recent >= v_cfg.device_changes_per_30_days THEN
      INSERT INTO public.driver_devices (driver_id, device_id, platform, label, sim_fingerprint, status)
      VALUES (v_driver.id, p_device_id, p_platform, left(p_device_label, 200), p_sim_fingerprint, 'pending_approval')
      ON CONFLICT (driver_id, device_id) DO UPDATE SET status = 'pending_approval', last_seen_at = now();
      PERFORM public.driver_raise_alert(v_driver.id, 'device_change_limit', 'high',
        jsonb_build_object('device_id', p_device_id, 'label', left(p_device_label, 200)));
      RETURN jsonb_build_object('ok', false, 'code', 'device_pending', 'message',
        'You have changed devices recently, so this one needs approval before you can go online. Contact support.');
    END IF;

    UPDATE public.driver_devices SET status = 'replaced'
    WHERE driver_id = v_driver.id AND device_id <> p_device_id AND status = 'active';

    INSERT INTO public.driver_devices (driver_id, device_id, platform, label, sim_fingerprint, activated_at)
    VALUES (v_driver.id, p_device_id, p_platform, left(p_device_label, 200), p_sim_fingerprint, now())
    ON CONFLICT (driver_id, device_id) DO UPDATE SET status = 'active', activated_at = now(), last_seen_at = now()
    RETURNING * INTO v_device;

    IF v_others > 0 THEN
      PERFORM public.driver_raise_alert(v_driver.id, 'new_device', 'medium',
        jsonb_build_object('device_id', p_device_id, 'label', left(p_device_label, 200)));
    END IF;
  END IF;

  -- Already online on this device: nothing more to do. A session left behind
  -- on another device that has gone quiet is closed.
  SELECT * INTO v_session FROM public.driver_sessions WHERE driver_id = v_driver.id AND ended_at IS NULL;
  IF FOUND THEN
    IF v_session.device_id = v_device.id THEN
      UPDATE public.driver_sessions SET last_seen_at = now() WHERE id = v_session.id;
      RETURN jsonb_build_object('ok', true, 'session_id', v_session.id);
    END IF;
    PERFORM public.driver_end_session(v_driver.id, 'replaced_by_new_device');
  END IF;

  IF v_vehicle IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.driver_sessions s WHERE s.vehicle_id = v_vehicle AND s.ended_at IS NULL) THEN
    PERFORM public.driver_raise_alert(v_driver.id, 'vehicle_in_use', 'medium', jsonb_build_object('vehicle_id', v_vehicle));
    RETURN jsonb_build_object('ok', false, 'code', 'vehicle_in_use', 'message',
      'Another driver is online with this vehicle right now.');
  END IF;

  -- A selfie taken on this device in the last few minutes, not yet used.
  SELECT * INTO v_check FROM public.driver_identity_checks
  WHERE driver_id = v_driver.id AND trigger = 'go_online' AND session_id IS NULL
    AND status IN ('submitted', 'passed') AND device_id = p_device_id
    AND submitted_at > now() - make_interval(mins => v_cfg.go_online_check_valid_minutes)
  ORDER BY submitted_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'identity_check_required', 'message', 'Take a selfie to confirm it is you.');
  END IF;

  INSERT INTO public.driver_sessions (driver_id, user_id, device_id, vehicle_id, identity_check_id, next_check_at)
  VALUES (v_driver.id, v_driver.user_id, v_device.id, v_vehicle, v_check.id, public.driver_next_check_at())
  RETURNING * INTO v_session;
  UPDATE public.driver_identity_checks SET session_id = v_session.id WHERE id = v_check.id;
  UPDATE public.drivers SET status = 'available' WHERE id = v_driver.id;

  RETURN jsonb_build_object('ok', true, 'session_id', v_session.id);
END; $$;

CREATE OR REPLACE FUNCTION public.driver_go_offline()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_check uuid;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_a_driver', 'message', 'No driver account was found.');
  END IF;

  -- Going offline does not make an outstanding selfie request disappear.
  SELECT c.id INTO v_check FROM public.driver_identity_checks c
  JOIN public.driver_sessions s ON s.id = c.session_id
  WHERE s.driver_id = v_driver.id AND s.ended_at IS NULL AND c.status = 'pending' AND c.trigger = 'random';
  IF v_check IS NOT NULL THEN
    UPDATE public.driver_identity_checks SET status = 'missed' WHERE id = v_check;
    PERFORM public.driver_raise_alert(v_driver.id, 'identity_check_missed', 'medium',
      jsonb_build_object('check_id', v_check, 'went_offline', true));
  END IF;

  PERFORM public.driver_end_session(v_driver.id, 'driver');
  UPDATE public.drivers SET status = 'offline' WHERE id = v_driver.id AND status IN ('available', 'busy');
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Called by the driver app about once a minute while online. Hands back any
-- selfie request that is waiting, and decides when the next random one is due.
CREATE OR REPLACE FUNCTION public.driver_session_heartbeat(p_device_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_session public.driver_sessions;
  v_check public.driver_identity_checks;
  v_minutes integer;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('online', false); END IF;

  SELECT s.* INTO v_session FROM public.driver_sessions s
  JOIN public.driver_devices d ON d.id = s.device_id
  WHERE s.driver_id = v_driver.id AND s.ended_at IS NULL AND d.device_id = p_device_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('online', false, 'status', v_driver.status, 'reason',
      (SELECT e.end_reason FROM public.driver_sessions e WHERE e.driver_id = v_driver.id ORDER BY e.started_at DESC LIMIT 1));
  END IF;

  UPDATE public.driver_sessions SET last_seen_at = now() WHERE id = v_session.id;
  SELECT check_response_minutes INTO v_minutes FROM public.driver_verification_settings;

  SELECT * INTO v_check FROM public.driver_identity_checks
  WHERE session_id = v_session.id AND status = 'pending' AND trigger = 'random'
  ORDER BY requested_at DESC LIMIT 1;

  IF FOUND AND v_check.due_at < now() THEN
    IF public.driver_trip_in_flight(v_driver.id) THEN
      UPDATE public.driver_identity_checks SET due_at = now() + make_interval(mins => v_minutes)
      WHERE id = v_check.id RETURNING * INTO v_check;
    ELSE
      PERFORM public.driver_miss_identity_check(v_check.id);
      RETURN jsonb_build_object('online', false, 'status', 'offline', 'reason', 'identity_check_missed');
    END IF;
  ELSIF NOT FOUND AND v_session.next_check_at <= now()
        AND v_driver.status = 'available' AND NOT public.driver_trip_in_flight(v_driver.id) THEN
    INSERT INTO public.driver_identity_checks (driver_id, session_id, trigger, challenge, device_id, due_at)
    VALUES (v_driver.id, v_session.id, 'random', public.driver_random_challenge(), p_device_id, now() + make_interval(mins => v_minutes))
    RETURNING * INTO v_check;
    -- Reaches a driver who has since switched to their navigation app.
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_driver.user_id, 'driver_verification', 'Selfie needed to stay online',
            'Open 1145 and take a quick selfie within ' || v_minutes || ' minutes, or you will be taken offline.',
            jsonb_build_object('url', '/driver/dashboard'));
  END IF;

  RETURN jsonb_build_object('online', true, 'session_id', v_session.id, 'check',
    CASE WHEN v_check.id IS NOT NULL AND v_check.status = 'pending' AND NOT public.driver_trip_in_flight(v_driver.id) THEN
      jsonb_build_object('id', v_check.id, 'challenge', v_check.challenge, 'due_at', v_check.due_at, 'trigger', v_check.trigger)
    END);
END; $$;

-- Runs every few minutes: catches unanswered checks from apps that have gone quiet.
CREATE OR REPLACE FUNCTION public.driver_enforce_identity_checks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_check record;
  v_minutes integer;
  v_count integer := 0;
BEGIN
  SELECT check_response_minutes INTO v_minutes FROM public.driver_verification_settings;

  UPDATE public.driver_identity_checks SET status = 'cancelled'
  WHERE status = 'pending' AND trigger = 'go_online' AND due_at < now();

  FOR v_check IN
    SELECT id, driver_id FROM public.driver_identity_checks
    WHERE status = 'pending' AND trigger = 'random' AND due_at < now()
  LOOP
    IF public.driver_trip_in_flight(v_check.driver_id) THEN
      UPDATE public.driver_identity_checks SET due_at = now() + make_interval(mins => v_minutes) WHERE id = v_check.id;
    ELSE
      PERFORM public.driver_miss_identity_check(v_check.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END; $$;

-- ------------------------------------------------------------- 7. investigations
-- Opens (or adds to) the investigation for a driver. Used by admins, and by
-- the system when a selfie check fails.
CREATE OR REPLACE FUNCTION public.open_driver_investigation(
  p_driver_id uuid, p_category text, p_summary text, p_freeze boolean DEFAULT true,
  p_alert_id uuid DEFAULT NULL, p_identity_check_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_user uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_summary), '') = '' THEN
    RAISE EXCEPTION 'Describe what is being investigated.';
  END IF;

  SELECT id INTO v_id FROM public.driver_investigations WHERE driver_id = p_driver_id AND status = 'open';
  IF v_id IS NULL THEN
    INSERT INTO public.driver_investigations (driver_id, category, summary, identity_check_id, opened_by)
    VALUES (p_driver_id, COALESCE(p_category, 'profile_sharing'), btrim(p_summary), p_identity_check_id, auth.uid())
    RETURNING id INTO v_id;
    INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
    VALUES (v_id, auth.uid(), 'opened', btrim(p_summary));
  ELSE
    INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
    VALUES (v_id, auth.uid(), 'note', btrim(p_summary));
  END IF;

  IF p_alert_id IS NOT NULL THEN
    UPDATE public.driver_security_alerts
    SET status = 'escalated', investigation_id = v_id, resolved_by = auth.uid(), resolved_at = now()
    WHERE id = p_alert_id AND driver_id = p_driver_id;
    INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
    SELECT v_id, auth.uid(), 'alert_linked', a.alert_type || ' ' || a.details::text
    FROM public.driver_security_alerts a WHERE a.id = p_alert_id AND a.driver_id = p_driver_id;
  END IF;

  IF p_freeze AND NOT EXISTS (SELECT 1 FROM public.driver_investigations WHERE id = v_id AND account_frozen) THEN
    UPDATE public.driver_investigations SET account_frozen = true WHERE id = v_id;
    UPDATE public.drivers
    SET status = 'suspended', suspension_reason = 'investigation', suspended_at = now()
    WHERE id = p_driver_id
    RETURNING user_id INTO v_user;
    PERFORM public.driver_end_session(p_driver_id, 'frozen');
    INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
    VALUES (v_id, auth.uid(), 'frozen', 'Account frozen: the driver cannot go online or cash out.');
    IF v_user IS NOT NULL THEN
      INSERT INTO public.user_notifications (user_id, type, title, message, data)
      VALUES (v_user, 'driver_verification', 'Your driver account is on hold',
              'We are reviewing activity on your account. You cannot go online or cash out until the review is finished. Contact support if you have information to add.',
              jsonb_build_object('url', '/driver/dashboard?tab=verification'));
    END IF;
  END IF;

  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.add_driver_investigation_note(p_investigation_id uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF COALESCE(btrim(p_body), '') = '' THEN RAISE EXCEPTION 'Write a note first.'; END IF;
  INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
  SELECT id, auth.uid(), 'note', btrim(p_body) FROM public.driver_investigations WHERE id = p_investigation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investigation not found.'; END IF;
END; $$;

-- 'cleared' reinstates the driver; 'confirmed' leaves the account closed.
CREATE OR REPLACE FUNCTION public.close_driver_investigation(p_investigation_id uuid, p_outcome text, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.driver_investigations;
  v_driver public.drivers;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_outcome NOT IN ('cleared', 'confirmed') THEN RAISE EXCEPTION 'Outcome must be cleared or confirmed.'; END IF;
  IF COALESCE(btrim(p_notes), '') = '' THEN RAISE EXCEPTION 'Record how the investigation was decided.'; END IF;

  SELECT * INTO v_inv FROM public.driver_investigations WHERE id = p_investigation_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'open' THEN RAISE EXCEPTION 'This investigation is not open.'; END IF;

  UPDATE public.driver_investigations
  SET status = p_outcome, closed_by = auth.uid(), closed_at = now(), outcome_notes = btrim(p_notes)
  WHERE id = v_inv.id;
  INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
  VALUES (v_inv.id, auth.uid(), p_outcome, btrim(p_notes));

  SELECT * INTO v_driver FROM public.drivers WHERE id = v_inv.driver_id FOR UPDATE;

  IF p_outcome = 'confirmed' THEN
    UPDATE public.drivers
    SET status = 'suspended', suspension_reason = 'investigation_confirmed', suspended_at = COALESCE(suspended_at, now())
    WHERE id = v_driver.id;
    PERFORM public.driver_end_session(v_driver.id, 'investigation_confirmed');
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_driver.user_id, 'driver_verification', 'Your driver account has been closed',
            'Our review found that this account was used in a way that breaks the driver agreement. Contact support if you want to appeal.',
            jsonb_build_object('url', '/driver/dashboard?tab=verification'));
    RETURN;
  END IF;

  IF v_driver.status = 'suspended' AND v_driver.suspension_reason IN ('investigation', 'investigation_confirmed') THEN
    IF EXISTS (SELECT 1 FROM public.driver_document_state(v_driver.id) s WHERE s.state = 'expired') THEN
      UPDATE public.drivers SET suspension_reason = 'documents_expired' WHERE id = v_driver.id;
    ELSE
      UPDATE public.drivers SET status = 'offline' WHERE id = v_driver.id;
    END IF;
    INSERT INTO public.driver_investigation_events (investigation_id, actor_id, event_type, body)
    VALUES (v_inv.id, auth.uid(), 'reinstated', 'Freeze lifted.');
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_driver.user_id, 'driver_verification', 'Your account review is finished',
            'The hold on your driver account has been lifted. Thank you for your patience.',
            jsonb_build_object('url', '/driver/dashboard'));
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_driver_alert(p_alert_id uuid, p_notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  UPDATE public.driver_security_alerts
  SET status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolution_notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_alert_id AND status = 'open';
END; $$;

CREATE OR REPLACE FUNCTION public.set_driver_device_status(p_device_row_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_device public.driver_devices;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('active', 'revoked') THEN RAISE EXCEPTION 'Status must be active or revoked.'; END IF;

  SELECT * INTO v_device FROM public.driver_devices WHERE id = p_device_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Device not found.'; END IF;

  IF p_status = 'active' THEN
    UPDATE public.driver_devices SET status = 'replaced'
    WHERE driver_id = v_device.driver_id AND id <> v_device.id AND status = 'active';
  ELSIF EXISTS (SELECT 1 FROM public.driver_sessions WHERE device_id = v_device.id AND ended_at IS NULL) THEN
    PERFORM public.driver_end_session(v_device.driver_id, 'device_revoked');
    UPDATE public.drivers SET status = 'offline' WHERE id = v_device.driver_id AND status IN ('available', 'busy');
  END IF;
  UPDATE public.driver_devices
  SET status = p_status, activated_at = CASE WHEN p_status = 'active' THEN now() ELSE activated_at END
  WHERE id = v_device.id;
END; $$;

-- The reviewer's verdict on a selfie. A failed check freezes the account and
-- opens an investigation. An automated face-match service would call this too.
CREATE OR REPLACE FUNCTION public.review_driver_identity_check(p_check_id uuid, p_passed boolean, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_check public.driver_identity_checks;
  v_investigation uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_check FROM public.driver_identity_checks WHERE id = p_check_id FOR UPDATE;
  IF NOT FOUND OR v_check.status <> 'submitted' THEN RAISE EXCEPTION 'This check is not waiting for review.'; END IF;
  IF NOT p_passed AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'Say why the selfie does not match.';
  END IF;

  UPDATE public.driver_identity_checks
  SET status = CASE WHEN p_passed THEN 'passed' ELSE 'failed' END,
      reviewed_by = auth.uid(), reviewed_at = now(), review_notes = NULLIF(btrim(p_notes), '')
  WHERE id = v_check.id;

  IF NOT p_passed THEN
    PERFORM public.driver_raise_alert(v_check.driver_id, 'identity_check_failed', 'high', jsonb_build_object('check_id', v_check.id));
    v_investigation := public.open_driver_investigation(
      v_check.driver_id, 'profile_sharing', 'Selfie check failed: ' || btrim(p_notes), true, NULL, v_check.id);
    UPDATE public.driver_security_alerts SET status = 'escalated', investigation_id = v_investigation
    WHERE driver_id = v_check.driver_id AND alert_type = 'identity_check_failed' AND status = 'open'
      AND details ->> 'check_id' = v_check.id::text;
  END IF;
  RETURN v_investigation;
END; $$;

-- ------------------------------------------------------------- 8. documents
CREATE OR REPLACE FUNCTION public.driver_submit_document(
  p_doc_type text, p_file_path text, p_expires_on date, p_document_number text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_id uuid;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No driver account was found.');
  END IF;
  IF p_doc_type NOT IN ('prdp', 'operating_licence', 'roadworthy', 'insurance') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown document type.');
  END IF;
  IF p_expires_on IS NULL OR p_expires_on < (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This document has already expired. Upload the renewed one.');
  END IF;
  IF p_file_path IS NULL OR left(p_file_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The file did not upload. Please try again.');
  END IF;

  UPDATE public.driver_documents SET status = 'superseded'
  WHERE driver_id = v_driver.id AND doc_type = p_doc_type AND status = 'pending';

  INSERT INTO public.driver_documents (driver_id, vehicle_id, doc_type, document_number, file_path, expires_on)
  VALUES (v_driver.id,
          (SELECT a.vehicle_id FROM public.vehicle_driver_assignments a
           WHERE a.driver_id = v_driver.id AND a.status IN ('approved', 'pending')
           ORDER BY (a.status = 'approved') DESC LIMIT 1),
          p_doc_type, NULLIF(btrim(p_document_number), ''), p_file_path, p_expires_on)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.review_driver_document(
  p_document_id uuid, p_approve boolean, p_expires_on date DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.driver_documents;
  v_expiry date;
  v_user uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_doc FROM public.driver_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_doc.status <> 'pending' THEN RAISE EXCEPTION 'This document is not waiting for review.'; END IF;

  v_expiry := COALESCE(p_expires_on, v_doc.expires_on);
  IF p_approve AND v_expiry < (now() AT TIME ZONE 'Africa/Johannesburg')::date THEN
    RAISE EXCEPTION 'A document that has already expired cannot be approved.';
  END IF;
  IF NOT p_approve AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'Tell the driver why the document was rejected.';
  END IF;

  UPDATE public.driver_documents
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, expires_on = v_expiry,
      reviewed_by = auth.uid(), reviewed_at = now(), review_notes = NULLIF(btrim(p_notes), '')
  WHERE id = v_doc.id;

  SELECT user_id INTO v_user FROM public.drivers WHERE id = v_doc.driver_id;
  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_user, 'driver_verification',
          CASE WHEN p_approve THEN 'Document approved' ELSE 'Document rejected' END,
          CASE WHEN p_approve
               THEN 'Your ' || public.driver_document_label(v_doc.doc_type) || ' was approved and is valid until ' || to_char(v_expiry, 'DD Mon YYYY') || '.'
               ELSE 'Your ' || public.driver_document_label(v_doc.doc_type) || ' was not accepted: ' || btrim(p_notes) END,
          jsonb_build_object('url', '/driver/dashboard?tab=verification'));

  IF p_approve THEN
    PERFORM public.driver_refresh_compliance(v_doc.driver_id);
  END IF;
END; $$;

-- Nightly: suspend drivers whose documents ran out, and warn the ones coming up.
CREATE OR REPLACE FUNCTION public.suspend_drivers_with_expired_documents()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_warning_days integer;
  v_driver record;
  v_doc record;
  v_count integer := 0;
BEGIN
  SELECT document_warning_days INTO v_warning_days FROM public.driver_verification_settings;

  UPDATE public.driver_documents SET status = 'expired' WHERE status = 'approved' AND expires_on < v_today;

  FOR v_driver IN
    SELECT d.id, d.user_id,
           (SELECT string_agg(public.driver_document_label(s.doc_type), ', ')
            FROM public.driver_document_state(d.id) s WHERE s.state = 'expired') AS expired_docs
    FROM public.drivers d
    WHERE d.status NOT IN ('suspended', 'pending')
      AND EXISTS (SELECT 1 FROM public.driver_documents x WHERE x.driver_id = d.id AND x.status = 'expired')
  LOOP
    CONTINUE WHEN v_driver.expired_docs IS NULL;

    UPDATE public.drivers
    SET status = 'suspended', suspension_reason = 'documents_expired', suspended_at = now()
    WHERE id = v_driver.id;

    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_driver.user_id, 'driver_verification', 'Your driver account is suspended',
            'These documents have expired: ' || v_driver.expired_docs || '. Upload the renewed documents and you will be reinstated once they are approved.',
            jsonb_build_object('url', '/driver/dashboard?tab=verification'));
    v_count := v_count + 1;
  END LOOP;

  FOR v_doc IN
    SELECT doc.id, doc.doc_type, doc.expires_on, d.user_id
    FROM public.driver_documents doc JOIN public.drivers d ON d.id = doc.driver_id
    WHERE doc.status = 'approved' AND doc.expiry_warned_at IS NULL
      AND doc.expires_on <= v_today + v_warning_days
      -- Nothing newer already approved for the same document.
      AND NOT EXISTS (SELECT 1 FROM public.driver_documents n
                      WHERE n.driver_id = doc.driver_id AND n.doc_type = doc.doc_type
                        AND n.status = 'approved' AND n.expires_on > doc.expires_on)
  LOOP
    UPDATE public.driver_documents SET expiry_warned_at = now() WHERE id = v_doc.id;
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (v_doc.user_id, 'driver_verification', 'A document expires soon',
            'Your ' || public.driver_document_label(v_doc.doc_type) || ' expires on ' || to_char(v_doc.expires_on, 'DD Mon YYYY')
              || '. Upload the renewed one before then to avoid being suspended.',
            jsonb_build_object('url', '/driver/dashboard?tab=verification'));
  END LOOP;

  RETURN v_count;
END; $$;

-- ------------------------------------------------------------- 9. vehicles and owners
CREATE OR REPLACE FUNCTION public.driver_declare_vehicle(
  p_license_plate text, p_make text, p_model text, p_year integer, p_color text,
  p_owner_is_self boolean, p_owner_type text, p_owner_name text, p_owner_id_number text,
  p_owner_phone text DEFAULT NULL, p_owner_email text DEFAULT NULL, p_authorisation_doc_path text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_driver public.drivers;
  v_plate text := upper(regexp_replace(COALESCE(p_license_plate, ''), '\s+', '', 'g'));
  v_self boolean := COALESCE(p_owner_is_self, false);
  v_owner_type text := CASE WHEN COALESCE(p_owner_is_self, false) THEN 'individual' ELSE p_owner_type END;
  v_vehicle uuid;
  v_owner uuid;
  v_id uuid;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No driver account was found.');
  END IF;
  IF length(v_plate) < 4 OR COALESCE(btrim(p_make), '') = '' OR COALESCE(btrim(p_model), '') = ''
     OR COALESCE(btrim(p_color), '') = '' OR p_year IS NULL OR p_year NOT BETWEEN 1980 AND 2100 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Fill in the vehicle''s plate, make, model, year and colour.');
  END IF;
  IF v_owner_type NOT IN ('individual', 'company') OR length(COALESCE(btrim(p_owner_name), '')) < 3
     OR length(COALESCE(btrim(p_owner_id_number), '')) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Fill in the owner''s legal name and ID or company registration number.');
  END IF;
  IF NOT v_self AND (p_authorisation_doc_path IS NULL
       OR left(p_authorisation_doc_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Upload the owner''s signed permission for you to drive this vehicle.');
  END IF;

  SELECT id INTO v_vehicle FROM public.vehicles
  WHERE upper(regexp_replace(license_plate, '\s+', '', 'g')) = v_plate LIMIT 1;
  IF v_vehicle IS NULL THEN
    INSERT INTO public.vehicles (driver_id, make, model, year, color, license_plate)
    VALUES (v_driver.id, btrim(p_make), btrim(p_model), p_year, btrim(p_color), v_plate)
    RETURNING id INTO v_vehicle;
  END IF;

  SELECT id INTO v_owner FROM public.vehicle_owners
  WHERE owner_type = v_owner_type AND lower(id_number) = lower(btrim(p_owner_id_number));
  IF v_owner IS NULL THEN
    INSERT INTO public.vehicle_owners (owner_type, legal_name, id_number, phone, email, user_id, created_by)
    VALUES (v_owner_type, btrim(p_owner_name), btrim(p_owner_id_number), NULLIF(btrim(p_owner_phone), ''),
            NULLIF(btrim(p_owner_email), ''), CASE WHEN v_self THEN auth.uid() END, auth.uid())
    RETURNING id INTO v_owner;
  END IF;

  UPDATE public.vehicle_driver_assignments
  SET status = 'ended', ended_at = now(), end_reason = 'replaced_before_review'
  WHERE driver_id = v_driver.id AND status = 'pending';

  INSERT INTO public.vehicle_driver_assignments (vehicle_id, driver_id, owner_id, relationship, authorisation_doc_path)
  VALUES (v_vehicle, v_driver.id, v_owner,
          CASE WHEN v_self THEN 'owner_driver' ELSE 'authorised_driver' END,
          CASE WHEN v_self THEN NULL ELSE p_authorisation_doc_path END)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.review_vehicle_assignment(p_assignment_id uuid, p_approve boolean, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a public.vehicle_driver_assignments;
  v_user uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_a FROM public.vehicle_driver_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND OR v_a.status <> 'pending' THEN RAISE EXCEPTION 'This assignment is not waiting for review.'; END IF;
  IF NOT p_approve AND COALESCE(btrim(p_notes), '') = '' THEN
    RAISE EXCEPTION 'Tell the driver why the vehicle was rejected.';
  END IF;

  IF p_approve THEN
    UPDATE public.vehicle_driver_assignments
    SET status = 'ended', ended_at = now(), end_reason = 'replaced'
    WHERE driver_id = v_a.driver_id AND status = 'approved';

    UPDATE public.vehicle_driver_assignments
    SET status = 'approved', starts_at = now(), reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = NULLIF(btrim(p_notes), '')
    WHERE id = v_a.id;

    UPDATE public.vehicles SET owner_id = v_a.owner_id, driver_id = COALESCE(driver_id, v_a.driver_id) WHERE id = v_a.vehicle_id;
    UPDATE public.vehicle_owners SET verified_at = COALESCE(verified_at, now()), verified_by = COALESCE(verified_by, auth.uid())
    WHERE id = v_a.owner_id;
  ELSE
    UPDATE public.vehicle_driver_assignments
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = btrim(p_notes)
    WHERE id = v_a.id;
  END IF;

  SELECT user_id INTO v_user FROM public.drivers WHERE id = v_a.driver_id;
  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (v_user, 'driver_verification',
          CASE WHEN p_approve THEN 'Vehicle verified' ELSE 'Vehicle not accepted' END,
          CASE WHEN p_approve THEN 'Your vehicle and its owner have been verified.'
               ELSE 'Your vehicle details were not accepted: ' || btrim(p_notes) END,
          jsonb_build_object('url', '/driver/dashboard?tab=verification'));
END; $$;

-- Everything the driver's Verification screen shows, in one call.
CREATE OR REPLACE FUNCTION public.driver_verification_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver public.drivers;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'status', v_driver.status,
    'suspension_reason', v_driver.suspension_reason,
    'compliance_enforced', (SELECT compliance_enforced FROM public.driver_verification_settings),
    'kyc_status', (SELECT k.verification_status FROM public.driver_kyc k WHERE k.user_id = v_driver.user_id),
    'online', public.driver_active_session_id(v_driver.id) IS NOT NULL,
    'documents', (
      SELECT jsonb_agg(jsonb_build_object(
        'doc_type', s.doc_type, 'state', s.state, 'expires_on', s.expires_on,
        'latest', (SELECT jsonb_build_object('status', d.status, 'expires_on', d.expires_on, 'review_notes', d.review_notes, 'created_at', d.created_at)
                   FROM public.driver_documents d
                   WHERE d.driver_id = v_driver.id AND d.doc_type = s.doc_type AND d.status <> 'superseded'
                   ORDER BY d.created_at DESC LIMIT 1)))
      FROM public.driver_document_state(v_driver.id) s),
    'vehicle', (
      SELECT jsonb_build_object(
        'status', a.status, 'relationship', a.relationship, 'review_notes', a.review_notes,
        'license_plate', v.license_plate, 'make', v.make, 'model', v.model, 'year', v.year, 'color', v.color,
        'owner_name', o.legal_name, 'owner_type', o.owner_type)
      FROM public.vehicle_driver_assignments a
      JOIN public.vehicles v ON v.id = a.vehicle_id
      JOIN public.vehicle_owners o ON o.id = a.owner_id
      WHERE a.driver_id = v_driver.id AND a.status IN ('pending', 'approved', 'rejected')
      ORDER BY a.created_at DESC LIMIT 1),
    'device', (
      SELECT jsonb_build_object('label', d.label, 'platform', d.platform, 'first_seen_at', d.first_seen_at, 'last_seen_at', d.last_seen_at)
      FROM public.driver_devices d WHERE d.driver_id = v_driver.id AND d.status = 'active'
      ORDER BY d.last_seen_at DESC LIMIT 1));
END; $$;

-- ------------------------------------------------------------- 10. permissions
DO $$
DECLARE f text;
BEGIN
  -- Internal: reached only through the functions and triggers above, or cron.
  FOREACH f IN ARRAY ARRAY[
    'driver_end_session(uuid, text)', 'driver_raise_alert(uuid, text, text, jsonb)', 'driver_next_check_at()',
    'driver_miss_identity_check(uuid)', 'driver_refresh_compliance(uuid)',
    'driver_enforce_identity_checks()', 'suspend_drivers_with_expired_documents()']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;

  -- Signed-in callers; each function checks who is asking.
  FOREACH f IN ARRAY ARRAY[
    'driver_document_state(uuid)', 'driver_active_session_id(uuid)', 'driver_trip_in_flight(uuid)',
    'driver_request_identity_check(text)', 'driver_submit_identity_check(uuid, text, text)',
    'driver_go_online(text, text, text, text)', 'driver_go_offline()', 'driver_session_heartbeat(text)',
    'open_driver_investigation(uuid, text, text, boolean, uuid, uuid)', 'add_driver_investigation_note(uuid, text)',
    'close_driver_investigation(uuid, text, text)', 'resolve_driver_alert(uuid, text)',
    'set_driver_device_status(uuid, text)', 'review_driver_identity_check(uuid, boolean, text)',
    'driver_submit_document(text, text, date, text)', 'review_driver_document(uuid, boolean, date, text)',
    'driver_declare_vehicle(text, text, text, integer, text, boolean, text, text, text, text, text, text)',
    'review_vehicle_assignment(uuid, boolean, text)', 'driver_verification_status()']
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ------------------------------------------------------------- 11. existing drivers
-- Nobody has a verified session yet, so nobody is online: drivers go online
-- again through the new flow.
UPDATE public.drivers SET status = 'offline' WHERE status IN ('available', 'busy');
UPDATE public.driver_locations SET is_online = false, is_available = false WHERE is_online OR is_available;

-- ------------------------------------------------------------- 12. schedules
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
    WHERE jobname IN ('driver-enforce-identity-checks', 'driver-suspend-expired-documents');
    PERFORM cron.schedule('driver-enforce-identity-checks', '*/5 * * * *', 'SELECT public.driver_enforce_identity_checks();');
    -- 22:05 UTC is five past midnight in South Africa.
    PERFORM cron.schedule('driver-suspend-expired-documents', '5 22 * * *', 'SELECT public.suspend_drivers_with_expired_documents();');
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; unanswered selfie checks and expired documents will not be enforced automatically.';
  END IF;
END $$;
