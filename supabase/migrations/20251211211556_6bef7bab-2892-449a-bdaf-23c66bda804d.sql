-- Add 'driver' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- Create drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_type TEXT,
  vehicle_registration TEXT,
  license_number TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
  current_location JSONB,
  rating NUMERIC(3,2) DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create delivery_jobs table for scheduled deliveries
CREATE TABLE public.delivery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  pickup_address JSONB NOT NULL,
  delivery_address JSONB NOT NULL,
  pickup_time TIMESTAMPTZ,
  estimated_delivery_time TIMESTAMPTZ,
  actual_delivery_time TIMESTAMPTZ,
  distance_km NUMERIC(10,2),
  earnings NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create driver_analytics table
CREATE TABLE public.driver_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  deliveries_completed INTEGER DEFAULT 0,
  total_distance_km NUMERIC(10,2) DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  average_delivery_time_mins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id, date)
);

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_analytics ENABLE ROW LEVEL SECURITY;

-- Create is_driver function
CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers
    WHERE user_id = _user_id
  )
$$;

-- RLS Policies for drivers
CREATE POLICY "Drivers can view their own profile"
ON public.drivers FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Drivers can update their own profile"
ON public.drivers FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage drivers"
ON public.drivers FOR ALL
TO authenticated
USING (public.is_admin());

-- RLS Policies for delivery_jobs
CREATE POLICY "Drivers can view available and their own jobs"
ON public.delivery_jobs FOR SELECT
TO authenticated
USING (
  driver_id IS NULL 
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin()
  OR public.is_vendor(auth.uid())
);

CREATE POLICY "Drivers can claim available jobs"
ON public.delivery_jobs FOR UPDATE
TO authenticated
USING (
  (driver_id IS NULL AND status = 'pending')
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Admins and vendors can create jobs"
ON public.delivery_jobs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_vendor(auth.uid()));

-- RLS Policies for driver_analytics
CREATE POLICY "Drivers can view their own analytics"
ON public.driver_analytics FOR SELECT
TO authenticated
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "System can insert analytics"
ON public.driver_analytics FOR INSERT
TO authenticated
WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "System can update analytics"
ON public.driver_analytics FOR UPDATE
TO authenticated
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_drivers_updated_at
BEFORE UPDATE ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_jobs_updated_at
BEFORE UPDATE ON public.delivery_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();