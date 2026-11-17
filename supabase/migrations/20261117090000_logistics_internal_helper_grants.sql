-- =============================================================================
-- 1145 Logistics: internal helpers are not part of the public API.
--
-- Supabase lets anon and authenticated call any function by default. These
-- three SECURITY DEFINER helpers have no caller check of their own because
-- they are only meant to be called from other database functions, triggers,
-- cron and the logistics-dispatch edge function (service role):
--   route_refresh_etas          recomputes a route's arrival times (writes)
--   logistics_shipment_on_hold  says whether a job awaits high-value approval
--   logistics_eta_params        learned speed figures for ETA estimates
-- Found by the Supabase security advisor after go-live (2026-11-17).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.route_refresh_etas(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.logistics_shipment_on_hold(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.logistics_eta_params(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.route_refresh_etas(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.logistics_shipment_on_hold(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.logistics_eta_params(UUID, TIMESTAMPTZ) TO service_role;
