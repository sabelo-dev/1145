-- =============================================================================
-- 1145 Logistics ⇄ platform nearby dispatch
--
-- Marketplace delivery jobs are offered to drivers by the platform's nearby
-- dispatch (driver_dispatch_requests / dispatch_assignments, 5 → 10 → 15 km,
-- device-verified, service preferences). Logistics never offers jobs itself;
-- it only tells nearby dispatch when a job must not be offered:
--   * the job is on a planned multi-stop route (route_id), or
--   * its shipment is waiting for a high-value approval,
-- and reopens the search when that no longer applies.
-- Dispatchers can still assign a driver directly (logistics_assign_job), which
-- closes the search the same way an accepted offer does.
-- =============================================================================

-- Close or reopen the nearby search for one delivery job.
CREATE OR REPLACE FUNCTION public.logistics_sync_nearby_dispatch(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job public.delivery_jobs;
  v_blocked BOOLEAN;
BEGIN
  SELECT * INTO v_job FROM public.delivery_jobs WHERE id = p_job_id;
  IF v_job.id IS NULL THEN
    RETURN;
  END IF;
  v_blocked := v_job.route_id IS NOT NULL OR public.logistics_shipment_on_hold(v_job.id);

  IF v_blocked THEN
    -- Offers disappear from drivers' screens (driver_nearby_offers only lists
    -- searching requests) and can no longer be accepted.
    UPDATE public.driver_dispatch_requests SET state = 'closed'
     WHERE entity_type = 'delivery_job' AND entity_id = v_job.id AND state IN ('searching', 'no_drivers');
    UPDATE public.dispatch_assignments SET status = 'expired', responded_at = now()
     WHERE entity_type = 'delivery_job' AND entity_id = v_job.id AND status = 'offered';
  ELSIF v_job.status = 'pending' AND v_job.driver_id IS NULL THEN
    -- Released: search again from the smallest radius. A closed request on an
    -- open job can only have been closed here (the platform closes requests
    -- only once a job is taken or no longer pending).
    UPDATE public.driver_dispatch_requests SET state = 'searching', radius_km = 5, next_check_at = now()
     WHERE entity_type = 'delivery_job' AND entity_id = v_job.id AND state = 'closed';
    IF FOUND THEN
      DELETE FROM public.dispatch_assignments
       WHERE entity_type = 'delivery_job' AND entity_id = v_job.id AND status IN ('expired', 'rejected');
      PERFORM public.dispatch_nearby('delivery_job', v_job.id);
    END IF;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_function THEN
  RETURN; -- nearby dispatch not installed in this environment
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_sync_nearby_dispatch(UUID) FROM PUBLIC, anon, authenticated;

-- Job joins or leaves a route.
CREATE OR REPLACE FUNCTION public.delivery_job_route_sync_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.logistics_sync_nearby_dispatch(NEW.id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_job_route_sync_dispatch ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_route_sync_dispatch
  AFTER UPDATE OF route_id ON public.delivery_jobs
  FOR EACH ROW WHEN (OLD.route_id IS DISTINCT FROM NEW.route_id)
  EXECUTE FUNCTION public.delivery_job_route_sync_dispatch();

-- Shipment created for a job, flagged for approval, or approved. Marketplace
-- shipments are created by an AFTER INSERT trigger on delivery_jobs that runs
-- after the platform's (nearby_delivery_dispatch < trg_delivery_job_create_shipment),
-- so the nearby request already exists here and a held job is closed at once.
CREATE OR REPLACE FUNCTION public.shipments_sync_nearby_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_job_id IS NOT NULL THEN
    PERFORM public.logistics_sync_nearby_dispatch(NEW.delivery_job_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_shipments_sync_nearby_dispatch ON public.shipments;
CREATE TRIGGER trg_shipments_sync_nearby_dispatch
  AFTER INSERT OR UPDATE OF requires_approval, approved_at, delivery_job_id ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.shipments_sync_nearby_dispatch();

-- A driver was put on the job outside an accepted offer (dispatcher or
-- auto-assign): stop the search and mark the driver busy, as an accepted
-- offer does. An accepted offer runs this too; the platform then records the
-- request as 'accepted' and its own updates win.
CREATE OR REPLACE FUNCTION public.delivery_job_assigned_close_dispatch()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.driver_dispatch_requests SET state = 'closed'
   WHERE entity_type = 'delivery_job' AND entity_id = NEW.id AND state IN ('searching', 'no_drivers');
  IF NEW.route_id IS NULL THEN
    UPDATE public.drivers SET status = 'busy' WHERE id = NEW.driver_id AND status = 'available';
    UPDATE public.driver_locations SET is_available = false WHERE driver_id = NEW.driver_id;
  END IF;
  RETURN NULL;
EXCEPTION WHEN undefined_table THEN
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_delivery_job_assigned_close_dispatch ON public.delivery_jobs;
CREATE TRIGGER trg_delivery_job_assigned_close_dispatch
  AFTER UPDATE OF driver_id ON public.delivery_jobs
  FOR EACH ROW WHEN (NEW.driver_id IS NOT NULL AND OLD.driver_id IS DISTINCT FROM NEW.driver_id)
  EXECUTE FUNCTION public.delivery_job_assigned_close_dispatch();

-- Dispatcher assigns a driver. The platform blocks direct driver_id writes
-- from app users (nearby_claim_guard), so this goes through a checked RPC.
CREATE OR REPLACE FUNCTION public.logistics_assign_job(p_job_id UUID, p_driver_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT public.is_logistics_staff(ARRAY['owner', 'dispatcher']) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'driver_not_found';
  END IF;
  UPDATE public.delivery_jobs
     SET driver_id = p_driver_id, status = 'accepted', failure_reason = NULL
   WHERE id = p_job_id AND route_id IS NULL
     AND ((status = 'pending' AND driver_id IS NULL) OR status = 'failed');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.logistics_assign_job(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logistics_assign_job(UUID, UUID) TO authenticated;
