
-- PASSENGER SECURITY & ZONE COMPLIANCE SYSTEM

-- 1. Ride Zones (polygon-based geofences)
CREATE TABLE IF NOT EXISTS public.ride_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  polygon JSONB NOT NULL DEFAULT '[]',
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  radius_km NUMERIC NOT NULL DEFAULT 25,
  severity NUMERIC NOT NULL DEFAULT 1.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  province TEXT,
  municipality TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Driver Zone Licenses
CREATE TABLE IF NOT EXISTS public.driver_zone_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.ride_zones(id) ON DELETE CASCADE,
  permit_number TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, zone_id)
);

-- 3. Zone Access Passes (temporary overrides)
CREATE TABLE IF NOT EXISTS public.zone_access_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.ride_zones(id) ON DELETE CASCADE,
  pass_type TEXT NOT NULL DEFAULT 'DAILY',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ NOT NULL,
  price_zar NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Zone Violations
CREATE TABLE IF NOT EXISTS public.zone_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.ride_zones(id),
  ride_id UUID REFERENCES public.rides(id),
  violation_type TEXT NOT NULL DEFAULT 'unlicensed_pickup',
  location_lat NUMERIC,
  location_lng NUMERIC,
  detected_zone TEXT,
  licensed_zones TEXT[] DEFAULT '{}',
  severity NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Zone Fines
CREATE TABLE IF NOT EXISTS public.zone_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_id UUID NOT NULL REFERENCES public.zone_violations(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount_zar NUMERIC NOT NULL,
  base_fine NUMERIC NOT NULL DEFAULT 50,
  severity_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  demand_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  repeat_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'pending',
  deducted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Trip Security PINs
CREATE TABLE IF NOT EXISTS public.trip_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE UNIQUE,
  pin_code TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Safety Alerts
CREATE TABLE IF NOT EXISTS public.safety_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id),
  driver_id UUID REFERENCES public.drivers(id),
  passenger_id UUID,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  trigger_source TEXT NOT NULL DEFAULT 'passenger',
  location_lat NUMERIC,
  location_lng NUMERIC,
  payload JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Driver Risk Scores
CREATE TABLE IF NOT EXISTS public.driver_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE UNIQUE,
  overall_score NUMERIC NOT NULL DEFAULT 100,
  speed_factor NUMERIC NOT NULL DEFAULT 0,
  braking_factor NUMERIC NOT NULL DEFAULT 0,
  rating_factor NUMERIC NOT NULL DEFAULT 0,
  cancellation_factor NUMERIC NOT NULL DEFAULT 0,
  violation_factor NUMERIC NOT NULL DEFAULT 0,
  complaint_factor NUMERIC NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Compliance Audit Log
CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  driver_id UUID,
  ride_id UUID,
  zone_id UUID,
  payload JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Emergency Contacts
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ride_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_zone_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_access_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active zones" ON public.ride_zones FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage zones" ON public.ride_zones FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers see own licenses" ON public.driver_zone_licenses FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage licenses" ON public.driver_zone_licenses FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers see own passes" ON public.zone_access_passes FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Drivers buy passes" ON public.zone_access_passes FOR INSERT WITH CHECK (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage passes" ON public.zone_access_passes FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Drivers see own violations" ON public.zone_violations FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage violations" ON public.zone_violations FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "System inserts violations" ON public.zone_violations FOR INSERT WITH CHECK (true);

CREATE POLICY "Drivers see own fines" ON public.zone_fines FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage fines" ON public.zone_fines FOR ALL USING (public.is_admin(auth.uid()));
CREATE POLICY "System inserts fines" ON public.zone_fines FOR INSERT WITH CHECK (true);

CREATE POLICY "Trip PIN access" ON public.trip_pins FOR SELECT USING (
  ride_id IN (SELECT id FROM rides WHERE passenger_id = auth.uid())
  OR EXISTS (SELECT 1 FROM dispatch_assignments da JOIN drivers d ON da.driver_id = d.id WHERE da.entity_id = trip_pins.ride_id AND d.user_id = auth.uid())
);
CREATE POLICY "System creates PINs" ON public.trip_pins FOR INSERT WITH CHECK (true);
CREATE POLICY "System updates PINs" ON public.trip_pins FOR UPDATE USING (true);

CREATE POLICY "Participants see alerts" ON public.safety_alerts FOR SELECT USING (
  passenger_id = auth.uid() OR driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid())
);
CREATE POLICY "Anyone can create alerts" ON public.safety_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage alerts" ON public.safety_alerts FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Driver sees own risk" ON public.driver_risk_scores FOR SELECT USING (
  driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid())
);
CREATE POLICY "System manages risk scores" ON public.driver_risk_scores FOR ALL USING (true);

CREATE POLICY "Admins read audit log" ON public.compliance_audit_log FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "System inserts audit log" ON public.compliance_audit_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Users manage own contacts" ON public.emergency_contacts FOR ALL USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_driver_zone_licenses_driver ON public.driver_zone_licenses(driver_id);
CREATE INDEX idx_driver_zone_licenses_zone ON public.driver_zone_licenses(zone_id);
CREATE INDEX idx_zone_violations_driver ON public.zone_violations(driver_id);
CREATE INDEX idx_zone_violations_created ON public.zone_violations(created_at);
CREATE INDEX idx_safety_alerts_ride ON public.safety_alerts(ride_id);
CREATE INDEX idx_safety_alerts_status ON public.safety_alerts(status);
CREATE INDEX idx_safety_alerts_created ON public.safety_alerts(created_at);
CREATE INDEX idx_compliance_audit_event ON public.compliance_audit_log(event_type);
CREATE INDEX idx_compliance_audit_created ON public.compliance_audit_log(created_at);
CREATE INDEX idx_trip_pins_ride ON public.trip_pins(ride_id);
CREATE INDEX idx_zone_access_passes_driver ON public.zone_access_passes(driver_id);
CREATE INDEX idx_emergency_contacts_user ON public.emergency_contacts(user_id);

-- Generate trip PIN function
CREATE OR REPLACE FUNCTION public.generate_trip_pin(p_ride_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pin TEXT;
BEGIN
  v_pin := lpad(floor(random() * 10000)::TEXT, 4, '0');
  INSERT INTO trip_pins (ride_id, pin_code, expires_at)
  VALUES (p_ride_id, v_pin, now() + interval '30 minutes')
  ON CONFLICT (ride_id) DO UPDATE SET pin_code = v_pin, verified = false, verified_at = NULL, attempts = 0, expires_at = now() + interval '30 minutes';
  INSERT INTO compliance_audit_log (event_type, entity_type, entity_id, ride_id, payload)
  VALUES ('trip.pin.generated', 'ride', p_ride_id::TEXT, p_ride_id, jsonb_build_object('pin_generated', true));
  RETURN v_pin;
END; $$;

-- Verify trip PIN function
CREATE OR REPLACE FUNCTION public.verify_trip_pin(p_ride_id UUID, p_pin TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_record RECORD;
BEGIN
  SELECT * INTO v_record FROM trip_pins WHERE ride_id = p_ride_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_record.verified THEN RETURN true; END IF;
  IF v_record.expires_at < now() THEN RETURN false; END IF;
  IF v_record.attempts >= v_record.max_attempts THEN RETURN false; END IF;
  IF v_record.pin_code = p_pin THEN
    UPDATE trip_pins SET verified = true, verified_at = now() WHERE ride_id = p_ride_id;
    INSERT INTO compliance_audit_log (event_type, entity_type, entity_id, ride_id, payload)
    VALUES ('trip.pin.verified', 'ride', p_ride_id::TEXT, p_ride_id, jsonb_build_object('success', true));
    RETURN true;
  ELSE
    UPDATE trip_pins SET attempts = attempts + 1 WHERE ride_id = p_ride_id;
    RETURN false;
  END IF;
END; $$;

-- Check driver zone compliance function
CREATE OR REPLACE FUNCTION public.check_driver_zone_compliance(p_driver_id UUID, p_lat NUMERIC, p_lng NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_zone RECORD; v_licensed BOOLEAN := false; v_has_pass BOOLEAN := false; v_zone_id UUID; v_zone_name TEXT; v_distance NUMERIC;
BEGIN
  FOR v_zone IN SELECT * FROM ride_zones WHERE is_active = true LOOP
    v_distance := 6371 * 2 * atan2(
      sqrt(sin(radians((p_lat - v_zone.center_lat)/2))^2 + cos(radians(v_zone.center_lat)) * cos(radians(p_lat)) * sin(radians((p_lng - v_zone.center_lng)/2))^2),
      sqrt(1 - sin(radians((p_lat - v_zone.center_lat)/2))^2 - cos(radians(v_zone.center_lat)) * cos(radians(p_lat)) * sin(radians((p_lng - v_zone.center_lng)/2))^2)
    );
    IF v_distance <= v_zone.radius_km THEN
      v_zone_id := v_zone.id; v_zone_name := v_zone.name;
      SELECT EXISTS(SELECT 1 FROM driver_zone_licenses WHERE driver_id = p_driver_id AND zone_id = v_zone.id AND status = 'active' AND (expiry_date IS NULL OR expiry_date > now())) INTO v_licensed;
      IF NOT v_licensed THEN
        SELECT EXISTS(SELECT 1 FROM zone_access_passes WHERE driver_id = p_driver_id AND zone_id = v_zone.id AND is_active = true AND valid_from <= now() AND valid_to > now() AND payment_status = 'paid') INTO v_has_pass;
      END IF;
      EXIT;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('zone_id', v_zone_id, 'zone_name', v_zone_name, 'is_licensed', v_licensed, 'has_pass', v_has_pass, 'is_compliant', (v_licensed OR v_has_pass OR v_zone_id IS NULL), 'checked_at', now());
END; $$;

-- Apply zone fine function
CREATE OR REPLACE FUNCTION public.apply_zone_fine(p_violation_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_violation RECORD; v_base_fine NUMERIC := 50; v_severity_mult NUMERIC; v_repeat_mult NUMERIC; v_repeat_count INTEGER; v_total_fine NUMERIC;
BEGIN
  SELECT * INTO v_violation FROM zone_violations WHERE id = p_violation_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_severity_mult := COALESCE(v_violation.severity, 1.0);
  SELECT COUNT(*) INTO v_repeat_count FROM zone_violations WHERE driver_id = v_violation.driver_id AND created_at > now() - interval '30 days' AND id != p_violation_id;
  v_repeat_mult := LEAST(1.0 + (v_repeat_count * 0.5), 3.0);
  v_total_fine := ROUND(v_base_fine * v_severity_mult * v_repeat_mult, 2);
  INSERT INTO zone_fines (violation_id, driver_id, amount_zar, base_fine, severity_multiplier, demand_multiplier, repeat_multiplier)
  VALUES (p_violation_id, v_violation.driver_id, v_total_fine, v_base_fine, v_severity_mult, 1.0, v_repeat_mult);
  UPDATE zone_violations SET status = 'fined' WHERE id = p_violation_id;
  INSERT INTO compliance_audit_log (event_type, entity_type, entity_id, driver_id, payload)
  VALUES ('fine.applied', 'zone_violation', p_violation_id::TEXT, v_violation.driver_id, jsonb_build_object('amount', v_total_fine, 'repeat_count', v_repeat_count));
  IF v_repeat_count >= 3 THEN
    UPDATE drivers SET status = 'suspended' WHERE id = v_violation.driver_id;
  END IF;
  RETURN v_total_fine;
END; $$;

-- Evaluate driver risk function
CREATE OR REPLACE FUNCTION public.evaluate_driver_risk(p_driver_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_driver RECORD; v_speed NUMERIC := 0; v_braking NUMERIC := 0; v_rating NUMERIC := 0; v_cancel NUMERIC := 0; v_violation NUMERIC := 0; v_complaint NUMERIC := 0; v_overall NUMERIC; v_level TEXT; v_violation_count INTEGER; v_alert_count INTEGER;
BEGIN
  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'driver_not_found'); END IF;
  v_rating := GREATEST(0, (5.0 - COALESCE(v_driver.rating, 4.5)) * 10);
  v_cancel := GREATEST(0, (100 - COALESCE(v_driver.acceptance_rate, 90)) * 0.5);
  SELECT COUNT(*) INTO v_violation_count FROM zone_violations WHERE driver_id = p_driver_id AND created_at > now() - interval '90 days';
  v_violation := v_violation_count * 8;
  SELECT COUNT(*) INTO v_alert_count FROM safety_alerts WHERE driver_id = p_driver_id AND created_at > now() - interval '90 days' AND alert_type IN ('SOS', 'ROUTE_DEVIATION', 'SPEED_ALERT');
  v_complaint := v_alert_count * 12;
  v_overall := GREATEST(0, 100 - v_rating - v_cancel - v_violation - v_complaint);
  v_level := CASE WHEN v_overall >= 80 THEN 'low' WHEN v_overall >= 60 THEN 'medium' WHEN v_overall >= 40 THEN 'high' ELSE 'critical' END;
  INSERT INTO driver_risk_scores (driver_id, overall_score, speed_factor, braking_factor, rating_factor, cancellation_factor, violation_factor, complaint_factor, risk_level, last_evaluated_at)
  VALUES (p_driver_id, v_overall, v_speed, v_braking, v_rating, v_cancel, v_violation, v_complaint, v_level, now())
  ON CONFLICT (driver_id) DO UPDATE SET overall_score = EXCLUDED.overall_score, speed_factor = EXCLUDED.speed_factor, braking_factor = EXCLUDED.braking_factor, rating_factor = EXCLUDED.rating_factor, cancellation_factor = EXCLUDED.cancellation_factor, violation_factor = EXCLUDED.violation_factor, complaint_factor = EXCLUDED.complaint_factor, risk_level = EXCLUDED.risk_level, last_evaluated_at = EXCLUDED.last_evaluated_at, updated_at = now();
  IF v_level = 'critical' THEN
    UPDATE driver_risk_scores SET is_blocked = true, blocked_reason = 'Critical risk score' WHERE driver_id = p_driver_id;
  END IF;
  RETURN jsonb_build_object('score', v_overall, 'level', v_level, 'factors', jsonb_build_object('speed', v_speed, 'braking', v_braking, 'rating', v_rating, 'cancellation', v_cancel, 'violations', v_violation, 'complaints', v_complaint));
END; $$;
