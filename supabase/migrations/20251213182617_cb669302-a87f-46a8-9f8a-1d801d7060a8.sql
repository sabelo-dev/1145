-- Create drivers table
CREATE TABLE public.drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  phone text,
  vehicle_type text,
  license_number text,
  vehicle_registration text,
  status text NOT NULL DEFAULT 'pending',
  current_location jsonb,
  rating numeric DEFAULT 5.0,
  total_deliveries integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create delivery_jobs table
CREATE TABLE public.delivery_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  driver_id uuid REFERENCES public.drivers(id),
  status text NOT NULL DEFAULT 'pending',
  pickup_address jsonb NOT NULL,
  delivery_address jsonb NOT NULL,
  distance_km numeric,
  earnings numeric,
  pickup_time timestamp with time zone,
  estimated_delivery_time timestamp with time zone,
  actual_delivery_time timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create driver_analytics table
CREATE TABLE public.driver_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  deliveries_completed integer DEFAULT 0,
  total_distance_km numeric DEFAULT 0,
  total_earnings numeric DEFAULT 0,
  average_delivery_time_mins integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_id, date)
);

-- Create driver_payouts table
CREATE TABLE public.driver_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id),
  amount numeric NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  deliveries_count integer DEFAULT 0,
  total_distance_km numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  payment_reference text,
  notes text,
  processed_at timestamp with time zone,
  processed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

-- Drivers policies
CREATE POLICY "Admins can manage drivers" ON public.drivers FOR ALL USING (is_admin());
CREATE POLICY "Drivers can view their own profile" ON public.drivers FOR SELECT USING ((user_id = auth.uid()) OR is_admin());
CREATE POLICY "Drivers can update their own profile" ON public.drivers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can register as drivers" ON public.drivers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Delivery jobs policies
CREATE POLICY "Drivers can view available and their own jobs" ON public.delivery_jobs FOR SELECT 
  USING ((driver_id IS NULL) OR (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())) OR is_admin() OR is_vendor(auth.uid()));
CREATE POLICY "Admins and vendors can create jobs" ON public.delivery_jobs FOR INSERT WITH CHECK (is_admin() OR is_vendor(auth.uid()));
CREATE POLICY "Drivers can claim available jobs" ON public.delivery_jobs FOR UPDATE 
  USING (((driver_id IS NULL) AND (status = 'pending')) OR (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())) OR is_admin());

-- Driver analytics policies
CREATE POLICY "Drivers can view their own analytics" ON public.driver_analytics FOR SELECT 
  USING ((driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())) OR is_admin());
CREATE POLICY "System can insert analytics" ON public.driver_analytics FOR INSERT 
  WITH CHECK ((driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())) OR is_admin());
CREATE POLICY "System can update analytics" ON public.driver_analytics FOR UPDATE 
  USING ((driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())) OR is_admin());

-- Driver payouts policies
CREATE POLICY "Admins can manage all driver payouts" ON public.driver_payouts FOR ALL USING (is_admin());
CREATE POLICY "Drivers can view their own payouts" ON public.driver_payouts FOR SELECT 
  USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Create updated_at trigger for drivers
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for delivery_jobs
CREATE TRIGGER update_delivery_jobs_updated_at BEFORE UPDATE ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for driver_payouts
CREATE TRIGGER update_driver_payouts_updated_at BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();