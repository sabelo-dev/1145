-- End-to-end checks of the 1145 Logistics database layer on a throwaway PG 18.
\set ON_ERROR_STOP 1
\set QUIET 1
SET search_path = public, extensions;

-- ---------- helpers ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.t_ok(cond boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'PASS  %', label;
END $$;
GRANT EXECUTE ON FUNCTION public.t_ok(boolean, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.t_as(uid uuid, aal text DEFAULT 'aal1', ip text DEFAULT '10.9.9.9') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  PERFORM set_config('request.jwt.claims', json_build_object('aal', aal)::text, false);
  PERFORM set_config('request.headers', json_build_object('x-forwarded-for', ip)::text, false);
END $$;
GRANT EXECUTE ON FUNCTION public.t_as(uuid, text, text) TO anon, authenticated, service_role;

-- ---------- fixtures (as postgres: bypasses RLS) -----------------------------
ALTER TABLE auth.users DISABLE TRIGGER USER; -- unrelated legacy signup triggers
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner@lx.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'disp@lx.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'driver@lx.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'consumer@lx.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'merchant@lx.test'),
  ('00000000-0000-0000-0000-0000000000a6', 'othermerchant@lx.test'),
  ('00000000-0000-0000-0000-0000000000a7', 'driver2@lx.test');
INSERT INTO public.logistics_members (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2', 'dispatcher');
INSERT INTO public.drivers (id, user_id, name, status, rating) VALUES
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000a3', 'Sipho', 'available', 4.9),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000000a7', 'Lerato', 'available', 4.7);
-- Location via drivers.current_location → trigger mirrors into driver_locations.
UPDATE public.drivers SET current_location = '{"lat": -26.1076, "lng": 28.0567}' WHERE id = '00000000-0000-0000-0000-00000000d001';
UPDATE public.drivers SET current_location = '{"lat": -26.2041, "lng": 28.0473}' WHERE id = '00000000-0000-0000-0000-00000000d002';
SELECT t_ok((SELECT count(*) FROM driver_locations WHERE is_online AND is_available) = 2, 'driver presence mirrored into driver_locations');

INSERT INTO public.logistics_hubs (id, code, name, hub_type, address, lat, lng, is_public, opening_hours_text) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'JNB1', 'Johannesburg Hub', 'hub', '{"street":"1 Hub Rd","city":"Johannesburg"}', -26.2, 28.04, false, NULL),
  ('00000000-0000-0000-0000-0000000000b2', 'RSB1', 'Rosebank Locker', 'locker', '{"street":"Mall Level 1","city":"Rosebank"}', -26.146, 28.041, true, 'Daily 06:00-22:00');

-- ---------- 1. consumer booking ------------------------------------------------
SELECT t_as('00000000-0000-0000-0000-0000000000a4');
SET ROLE authenticated;
SELECT t_ok((quote_parcel('{"lat":-26.10,"lng":28.05}', '{"lat":-26.20,"lng":28.04}', 'small', 'next_day')->>'fee')::numeric > 0, 'quote_parcel returns a fee');
SELECT book_parcel('{"street":"10 Rivonia Rd","city":"Sandton","lat":-26.10,"lng":28.05}', '{"street":"5 Main St","city":"Johannesburg","lat":-26.20,"lng":28.04}',
                   'Zanele', '0821110000', 'Thabo M', '0839998877', 'small', 'next_day', 'Gate 2', true, 'morning') AS booking \gset b_
SELECT t_ok(length(:'b_booking'::jsonb->>'tracking_number') = 16, 'tracking number is 16 chars (LX+date+8)');
SELECT t_ok(:'b_booking'::jsonb->>'delivery_otp' ~ '^\d{4}$', 'sender gets the 4-digit handover code');
SELECT t_ok((SELECT delivery_window FROM shipments WHERE tracking_number = :'b_booking'::jsonb->>'tracking_number') = 'morning', 'delivery window stored');
SELECT t_ok((SELECT count(*) FROM shipments) = 1, 'consumer sees own shipment via RLS');
RESET ROLE;
SELECT id AS ship1 FROM shipments WHERE tracking_number = :'b_booking'::jsonb->>'tracking_number' \gset
SELECT t_ok((SELECT count(*) FROM shipment_pieces WHERE shipment_id = :'ship1') = 1, 'piece row created');
SELECT t_ok((SELECT count(*) FROM shipment_events WHERE shipment_id = :'ship1' AND event_type = 'created') = 1, 'timeline: created event');
SELECT t_ok((SELECT count(*) FROM net.calls WHERE url LIKE '%logistics-notify') >= 1, 'notification webhook call queued (pg_net)');
SELECT t_ok(extract(hour FROM (SELECT promised_by FROM shipments WHERE id = :'ship1') AT TIME ZONE 'Africa/Johannesburg') = 12, 'promise = end of morning window (12:00 SAST)');

-- Another consumer must not see it.
SELECT t_as('00000000-0000-0000-0000-0000000000a6');
SET ROLE authenticated;
SELECT t_ok((SELECT count(*) FROM shipments) = 0, 'other users cannot read the shipment');
RESET ROLE;
SET ROLE anon;
SELECT t_ok((SELECT count(*) FROM shipments) = 0, 'anon cannot read shipments');
RESET ROLE;

-- ---------- 2. express → instant dispatch offer --------------------------------
SELECT t_as('00000000-0000-0000-0000-0000000000a4');
SET ROLE authenticated;
SELECT book_parcel('{"street":"Sandton City","city":"Sandton","lat":-26.108,"lng":28.057}', '{"street":"Melville","city":"Johannesburg","lat":-26.17,"lng":28.0}',
                   'Zanele', '0821110000', 'Ayanda', '0711234567', 'small', 'express', NULL, true) AS exp \gset e_
RESET ROLE;
SELECT delivery_job_id AS job1, id AS ship2 FROM shipments WHERE tracking_number = :'e_exp'::jsonb->>'tracking_number' \gset
SELECT t_ok((SELECT offered_driver_id FROM delivery_jobs WHERE id = :'job1') = '00000000-0000-0000-0000-00000000d001', 'express job offered instantly to the NEAREST driver');
SELECT t_ok((SELECT offer_expires_at - now() FROM delivery_jobs WHERE id = :'job1') <= interval '10 seconds', 'ring window is 10 s');

SELECT t_as('00000000-0000-0000-0000-0000000000a3');
SET ROLE authenticated;
SELECT driver_live_offers() AS offers \gset
SELECT t_ok(jsonb_array_length(:'offers'::jsonb) = 1 AND (:'offers'::jsonb->0->>'kind') = 'order', 'driver_live_offers returns the order');
SELECT t_ok((:'offers'::jsonb->0) ? 'serverNow' AND (:'offers'::jsonb->0) ? 'expiresAt', 'offer carries serverNow/expiresAt');
SELECT t_ok((driver_accept_offer('order', :'job1')->>'ok')::boolean, 'accept succeeds');
SELECT t_ok((driver_accept_offer('order', :'job1')->>'ok')::boolean, 'repeat accept is idempotent');
RESET ROLE;
SELECT t_ok((SELECT driver_id FROM delivery_jobs WHERE id = :'job1') = '00000000-0000-0000-0000-00000000d001', 'job assigned');
SELECT t_ok((SELECT offered_driver_id FROM delivery_jobs WHERE id = :'job1') IS NULL, 'offer cleared on assignment');

-- Second driver cannot steal it.
SELECT t_as('00000000-0000-0000-0000-0000000000a7');
SET ROLE authenticated;
SELECT t_ok(NOT (driver_accept_offer('order', :'job1')->>'ok')::boolean, 'other driver cannot accept a taken job');
RESET ROLE;

-- On-demand POD: wrong OTP x5 locks; correct after reset.
SELECT delivery_otp AS otp2 FROM shipments WHERE id = :'ship2' \gset
UPDATE delivery_jobs SET status = 'in_transit' WHERE id = :'job1';
SELECT t_as('00000000-0000-0000-0000-0000000000a3');
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE delivery_jobs SET status = 'delivered' WHERE driver_id = '00000000-0000-0000-0000-00000000d001' AND status = 'in_transit';
    RAISE EXCEPTION 'expected otp_required';
  EXCEPTION WHEN others THEN
    PERFORM t_ok(SQLERRM LIKE '%otp_required%', 'plain UPDATE to delivered is blocked for OTP parcels');
  END;
END $$;
SELECT driver_complete_job(:'job1', 'otp', '0000', '{}') AS r1 \gset
SELECT t_ok((:'r1'::jsonb->>'error') IN ('invalid_otp'), 'wrong code rejected (and counted)');
SELECT driver_complete_job(:'job1', 'otp', '0000', '{}'), driver_complete_job(:'job1', 'otp', '0000', '{}'), driver_complete_job(:'job1', 'otp', '0000', '{}');
SELECT driver_complete_job(:'job1', 'otp', '0000', '{}') AS r5 \gset
SELECT t_ok((:'r5'::jsonb->>'error') = 'otp_locked', '5th wrong code locks the parcel');
SELECT t_ok((driver_complete_job(:'job1', 'otp', :'otp2', '{}')->>'error') = 'otp_locked', 'even the right code is refused while locked');
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a2');
SET ROLE authenticated;
SELECT logistics_reset_otp(:'ship2') AS newotp \gset
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a3');
SET ROLE authenticated;
SELECT t_ok((driver_complete_job(:'job1', 'otp', :'newotp', '{"received_by":"Ayanda"}')->>'ok')::boolean, 'new code from dispatch completes delivery');
RESET ROLE;
SELECT t_ok((SELECT status FROM shipments WHERE id = :'ship2') = 'delivered', 'shipment synced to delivered');
SELECT t_ok((SELECT count(*) FROM delivery_earnings WHERE delivery_job_id = :'job1') = 1, 'driver earnings credited for on-demand delivery');
SELECT t_ok((SELECT count(*) FROM logistics_audit_log WHERE action = 'otp_reset') = 1, 'OTP reset audited');

-- ---------- 3. missed offers → auto-offline --------------------------------
INSERT INTO delivery_jobs (id, pickup_address, delivery_address, status, priority)
SELECT gen_random_uuid(), '{"lat":-26.205,"lng":28.048}', '{"lat":-26.19,"lng":28.03}', 'pending', 'normal' FROM generate_series(1, 3);
SELECT t_ok((SELECT count(*) FROM delivery_jobs WHERE offered_driver_id = '00000000-0000-0000-0000-00000000d002') = 1, 'one live offer per driver at a time');
SELECT logistics_dispatch_sweep();  -- cron re-offers waiting jobs
SELECT t_as('00000000-0000-0000-0000-0000000000a7');
SET ROLE authenticated;
SELECT driver_offer_missed('order', (SELECT id FROM delivery_jobs WHERE offered_driver_id = '00000000-0000-0000-0000-00000000d002' LIMIT 1)) AS miss \gset
RESET ROLE;
SELECT t_ok((:'miss'::jsonb->>'misses')::int = 1, 'miss 1 counted');
SELECT logistics_dispatch_sweep();  -- cron re-offers waiting jobs
SELECT t_as('00000000-0000-0000-0000-0000000000a7');
SET ROLE authenticated;
SELECT driver_offer_missed('order', (SELECT id FROM delivery_jobs WHERE offered_driver_id = '00000000-0000-0000-0000-00000000d002' LIMIT 1)) AS miss \gset
RESET ROLE;
SELECT t_ok((:'miss'::jsonb->>'misses')::int = 2, 'miss 2 counted');
SELECT logistics_dispatch_sweep();  -- cron re-offers waiting jobs
SELECT t_as('00000000-0000-0000-0000-0000000000a7');
SET ROLE authenticated;
SELECT driver_offer_missed('order', (SELECT id FROM delivery_jobs WHERE offered_driver_id = '00000000-0000-0000-0000-00000000d002' LIMIT 1)) AS miss \gset
RESET ROLE;
SELECT t_ok((:'miss'::jsonb->>'went_offline')::boolean, '3rd consecutive miss sets the driver offline');
SELECT t_ok((SELECT status FROM drivers WHERE id = '00000000-0000-0000-0000-00000000d002') = 'offline', 'driver status is offline');
SELECT t_ok((SELECT is_online FROM driver_locations WHERE driver_id = '00000000-0000-0000-0000-00000000d002') = false, 'map no longer shows them online');

-- ---------- 4. routed delivery to a locker (PUDO) with box scans -------------
UPDATE shipments SET parcel_count = 2, destination_hub_id = '00000000-0000-0000-0000-0000000000b2', cod_amount = 150 WHERE id = :'ship1';
SELECT t_ok((SELECT count(*) FROM shipment_pieces WHERE shipment_id = :'ship1') = 2, 'pieces follow parcel_count');
SELECT t_as('00000000-0000-0000-0000-0000000000a2');
SET ROLE authenticated;
INSERT INTO delivery_routes (id, name, hub_id, driver_id, status) VALUES ('00000000-0000-0000-0000-0000000000c1', 'JNB-TEST-01', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000d001', 'dispatched');
INSERT INTO route_stops (id, route_id, sequence, stop_type, shipment_id, address, lat, lng, contact_name) VALUES
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 1, 'pickup', :'ship1', '{"street":"10 Rivonia Rd"}', -26.10, 28.05, 'Zanele'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 2, 'hub', :'ship1', '{"street":"Mall Level 1"}', -26.146, 28.041, 'Rosebank Locker');
UPDATE route_stops SET hub_id = '00000000-0000-0000-0000-0000000000b2' WHERE id = '00000000-0000-0000-0000-0000000000e2';
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a3');
SET ROLE authenticated;
SELECT t_ok((SELECT count(*) FROM shipments WHERE id = :'ship1') = 0, 'driver cannot read shipments directly (OTP stays hidden)');
SELECT t_ok((SELECT count(*) FROM route_stops) = 2, 'driver sees stops of their dispatched route');
SELECT driver_start_route('00000000-0000-0000-0000-0000000000c1');
SELECT t_ok((SELECT eta FROM route_stops WHERE id = '00000000-0000-0000-0000-0000000000e1') IS NOT NULL, 'route start computes live ETAs');
SELECT t_ok((driver_scan_piece('00000000-0000-0000-0000-0000000000e1', :'b_booking'::jsonb->>'tracking_number' || '-1')->>'scanned')::int = 1, 'box 1 scanned at pickup');
SELECT t_ok((driver_scan_piece('00000000-0000-0000-0000-0000000000e1', 'LX000000BADBAD-1')->>'error') = 'wrong_parcel', 'foreign label rejected');
SELECT t_ok((driver_update_stop('00000000-0000-0000-0000-0000000000e1', 'complete', NULL, NULL, '{"pieces_scanned":1,"pieces_total":2,"unscanned_confirmed":true}')->>'ok')::boolean, 'pickup completed');
SELECT t_ok((driver_update_stop('00000000-0000-0000-0000-0000000000e2', 'complete')->>'ok')::boolean, 'locker drop completed');
RESET ROLE;
SELECT t_ok((SELECT status FROM shipments WHERE id = :'ship1') = 'ready_for_collection', 'locker drop → ready for collection');
SELECT t_ok((SELECT collect_by > now() + interval '6 days' FROM shipments WHERE id = :'ship1'), 'collect-by deadline set (7 days)');
SELECT t_ok((SELECT status FROM delivery_routes WHERE id = '00000000-0000-0000-0000-0000000000c1') = 'completed', 'route auto-completes when all stops close');
SELECT t_ok((SELECT count(*) FROM delivery_earnings WHERE route_stop_id IS NOT NULL) = 1, 'route stop earnings credited (pickup only; hub drop unpaid)');

-- Counter handover at the locker.
SELECT delivery_otp AS otp1 FROM shipments WHERE id = :'ship1' \gset
SELECT t_as('00000000-0000-0000-0000-0000000000a2');
SET ROLE authenticated;
SELECT t_ok((pudo_release(:'b_booking'::jsonb->>'tracking_number', '9999')->>'error') = 'invalid_otp', 'counter: wrong code refused');
SELECT t_ok((pudo_release(:'b_booking'::jsonb->>'tracking_number', :'otp1', 'Thabo')->>'ok')::boolean, 'counter: right code releases parcel');
RESET ROLE;
SELECT t_ok((SELECT status FROM shipments WHERE id = :'ship1') = 'delivered', 'collected → delivered');
SELECT t_ok((SELECT count(*) FROM cod_collections WHERE shipment_id = :'ship1') = 1, 'COD collection recorded');

-- ---------- 5. public tracking, self-service, returns ------------------------
SELECT t_as(NULL, 'aal1', '203.0.113.5');
SET ROLE anon;
SELECT track_shipment(:'b_booking'::jsonb->>'tracking_number') AS tr \gset
SELECT t_ok((:'tr'::jsonb->>'status') = 'delivered' AND (:'tr'::jsonb->>'recipient') = 'Thabo', 'anon tracking works (first name only)');
SELECT t_ok(NOT (:'tr'::jsonb::text LIKE '%0839998877%') AND NOT (:'tr'::jsonb::text LIKE '%' || :'otp1' || '"%'), 'tracking leaks no phone or OTP');
SELECT t_ok((:'tr'::jsonb->>'can_return')::boolean, 'delivered parcel offers a return');
SELECT t_ok((recipient_update_delivery(:'b_booking'::jsonb->>'tracking_number', '0000', 'verify')->>'error') = 'verification_failed', 'self-service: wrong digits refused');
SELECT t_ok((recipient_request_return(:'b_booking'::jsonb->>'tracking_number', '8877', 'Wrong size')->>'ok')::boolean, 'recipient books a return');
SELECT t_ok((recipient_request_return(:'b_booking'::jsonb->>'tracking_number', '8877', 'Again')->>'error') IN ('not_returnable', 'return_exists'), 'only one open return per parcel');
RESET ROLE;
SELECT t_ok((SELECT count(*) FROM shipments WHERE return_of_shipment_id = :'ship1' AND sender_name = 'Thabo M') = 1, 'return shipment reverses sender/recipient');

-- Rate limit: 60 lookups per minute per IP.
SELECT t_as(NULL, 'aal1', '198.51.100.77');
SET ROLE anon;
DO $$ DECLARE i int; ok boolean := false; BEGIN
  FOR i IN 1..61 LOOP
    BEGIN PERFORM track_shipment('LX000000NOPE0000'); EXCEPTION WHEN others THEN ok := SQLERRM LIKE '%rate_limited%'; EXIT; END;
  END LOOP;
  PERFORM t_ok(ok, 'tracking is rate-limited per IP');
END $$;
RESET ROLE;

-- ---------- 6. business portal, credit control, approvals --------------------
INSERT INTO logistics_accounts (id, name, credit_limit, discount_pct, billing_email) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'Acme Store', 500, 10, 'billing@acme.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'Other Co', 10000, 0, NULL);
INSERT INTO logistics_account_members (account_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a5', 'admin'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a6', 'admin');
SELECT t_as('00000000-0000-0000-0000-0000000000a5');
SET ROLE authenticated;
SELECT t_ok(jsonb_array_length(logistics_access_status()->'accounts') = 1, 'access status lists the portal account');
SELECT portal_book_shipment('00000000-0000-0000-0000-0000000000f1', '{"recipient_name":"Cust A","recipient_phone":"0820000001","service_level":"standard","size":"small","pickup_address":{"lat":-26.10,"lng":28.05},"delivery_address":{"lat":-26.20,"lng":28.04}}') AS pb \gset
SELECT t_ok((SELECT shipping_fee FROM shipments WHERE tracking_number = :'pb'::jsonb->>'tracking_number') < (quote_parcel('{"lat":-26.10,"lng":28.05}','{"lat":-26.20,"lng":28.04}','small','standard')->>'fee')::numeric, 'account discount applied');
DO $$ BEGIN
  BEGIN
    PERFORM portal_book_shipment('00000000-0000-0000-0000-0000000000f1', '{"recipient_name":"Big","recipient_phone":"0820000002","service_level":"express","size":"xl","pickup_address":{"lat":-26.10,"lng":28.05},"delivery_address":{"lat":-25.75,"lng":28.19}}');
    PERFORM portal_book_shipment('00000000-0000-0000-0000-0000000000f1', '{"recipient_name":"Big","recipient_phone":"0820000002","service_level":"express","size":"xl","pickup_address":{"lat":-26.10,"lng":28.05},"delivery_address":{"lat":-25.75,"lng":28.19}}');
    RAISE EXCEPTION 'expected credit_limit_exceeded';
  EXCEPTION WHEN others THEN PERFORM t_ok(SQLERRM LIKE '%credit_limit_exceeded%', 'credit limit enforced on portal bookings');
  END;
END $$;
SELECT t_ok((SELECT count(*) FROM shipments WHERE account_id = '00000000-0000-0000-0000-0000000000f2') = 0, 'portal sees nothing of another account');
DO $$ BEGIN
  BEGIN
    PERFORM portal_book_shipment('00000000-0000-0000-0000-0000000000f2', '{"recipient_name":"X","recipient_phone":"1"}');
    RAISE EXCEPTION 'expected forbidden';
  EXCEPTION WHEN others THEN PERFORM t_ok(SQLERRM LIKE '%forbidden%', 'cannot book on someone else''s account');
  END;
END $$;
RESET ROLE;

-- High value: approval hold + four-eyes.
SELECT t_as('00000000-0000-0000-0000-0000000000a2');
SET ROLE authenticated;
INSERT INTO shipments (sender_name, recipient_name, recipient_phone, pickup_address, delivery_address, declared_value, status)
VALUES ('Jeweller', 'VIP', '0820000003', '{"lat":-26.1,"lng":28.05}', '{"lat":-26.2,"lng":28.04}', 50000, 'awaiting_pickup')
RETURNING id AS hv, requires_approval AS hv_hold \gset
SELECT t_ok(:'hv_hold'::boolean, 'high declared value is held for review');
DO $$ BEGIN
  BEGIN
    PERFORM logistics_review_shipment((SELECT id FROM shipments WHERE recipient_name = 'VIP'), true, NULL);
    RAISE EXCEPTION 'expected cannot_approve_own_booking';
  EXCEPTION WHEN others THEN PERFORM t_ok(SQLERRM LIKE '%cannot_approve_own_booking%', 'booker cannot approve own high-value parcel');
  END;
END $$;
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a1');
SET ROLE authenticated;
SELECT logistics_review_shipment(:'hv', true, 'ID checked');
RESET ROLE;
SELECT t_ok((SELECT approved_at IS NOT NULL FROM shipments WHERE id = :'hv'), 'second person (owner) approves');

-- Invoicing.
UPDATE shipments SET status = 'delivered', delivered_at = now() WHERE tracking_number = :'pb'::jsonb->>'tracking_number';
SELECT t_as('00000000-0000-0000-0000-0000000000a1');
SET ROLE authenticated;
SELECT t_ok(logistics_generate_invoices(current_date - 1, current_date + 1) = 1, 'monthly invoice drafted');
SELECT id AS inv FROM logistics_invoices LIMIT 1 \gset
SELECT t_ok((SELECT round(total - subtotal - vat, 2) FROM logistics_invoices WHERE id = :'inv') = 0 AND (SELECT vat FROM logistics_invoices WHERE id = :'inv') > 0, 'invoice totals add up with 15% VAT');
SELECT logistics_set_invoice_status(:'inv', 'issued');
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a5');
SET ROLE authenticated;
SELECT t_ok((SELECT count(*) FROM logistics_invoices) = 1, 'portal admin sees their issued invoice');
RESET ROLE;

-- ---------- 7. MFA enforcement ---------------------------------------------
SELECT t_as(NULL); UPDATE logistics_settings SET require_mfa = true;  -- no user session (SQL editor)
SELECT t_as('00000000-0000-0000-0000-0000000000a2', 'aal1');
SET ROLE authenticated;
SELECT t_ok(logistics_role() IS NULL, 'MFA required: aal1 session has no logistics role');
SELECT t_ok((SELECT count(*) FROM shipments) = 0, 'MFA required: aal1 session sees no shipments');
RESET ROLE;
SELECT t_as('00000000-0000-0000-0000-0000000000a2', 'aal2');
SET ROLE authenticated;
SELECT t_ok(logistics_role() = 'dispatcher', 'MFA satisfied: aal2 session regains its role');
RESET ROLE;
UPDATE logistics_settings SET require_mfa = false;
SELECT t_as('00000000-0000-0000-0000-0000000000a1', 'aal1');
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE logistics_settings SET require_mfa = true WHERE id;
    RAISE EXCEPTION 'expected guard';
  EXCEPTION WHEN others THEN PERFORM t_ok(SQLERRM LIKE '%enable_mfa_yourself_first%', 'owner cannot require MFA from a non-MFA session');
  END;
END $$;
SELECT t_ok(logistics_role('00000000-0000-0000-0000-0000000000a2') IS NULL, 'non-admin users cannot probe other users'' roles');
RESET ROLE;

-- ---------- 8. jobs: sweep, ETA training, retention, POPIA ------------------
SELECT t_ok((logistics_dispatch_sweep() ? 'reoffered'), 'dispatch sweep runs');
SELECT t_ok(logistics_train_eta() >= 0, 'ETA training runs');
SELECT t_ok(logistics_apply_retention() = 0, 'retention skips recent parcels');
SELECT t_ok(logistics_redact_shipments(ARRAY[:'ship2']::uuid[], 'test') = 1, 'redaction works');
SELECT t_ok((SELECT recipient_phone IS NULL AND delivery_otp IS NULL AND (delivery_address->>'redacted')::boolean FROM shipments WHERE id = :'ship2'), 'PII removed, coarse location kept');
SELECT t_as('00000000-0000-0000-0000-0000000000a1');
SET ROLE authenticated;
SELECT t_ok((SELECT count(*) FROM logistics_find_personal_data('083 999 8877', NULL)) >= 1, 'POPIA: find data by phone');
RESET ROLE;

-- ---------- 9. per-environment functions URL -----------------------------
UPDATE logistics_config SET value = 'https://staging-ref.supabase.co/functions/v1/' WHERE key = 'functions_base_url';
INSERT INTO shipment_events (shipment_id, status, event_type) VALUES (:'ship1', 'delivered', 'status_change');
SELECT t_ok((SELECT url FROM net.calls ORDER BY id DESC LIMIT 1) = 'https://staging-ref.supabase.co/functions/v1/logistics-notify', 'triggers use the configured functions URL');
UPDATE logistics_config SET value = '' WHERE key = 'functions_base_url';
SELECT count(*) AS calls_before FROM net.calls \gset
INSERT INTO shipment_events (shipment_id, status, event_type) VALUES (:'ship1', 'delivered', 'status_change');
SELECT logistics_trigger_billing_run();
SELECT t_ok((SELECT count(*) FROM net.calls) = :calls_before, 'empty functions URL disables outbound calls cleanly');

\echo ALL E2E CHECKS PASSED
