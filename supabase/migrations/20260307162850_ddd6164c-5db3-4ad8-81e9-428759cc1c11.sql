
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'passenger';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fleet_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'service_provider';

-- Platform Wallet (real money alongside UCoin)
CREATE TABLE public.platform_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance_zar NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance_zar NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_deposited NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_earned NUMERIC(12,2) NOT NULL DEFAULT 0,
  lifetime_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.platform_wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'earning', 'transfer_in', 'transfer_out', 'refund', 'ride_payment', 'delivery_payment')),
  amount NUMERIC(12,2) NOT NULL,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'reversed')),
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  counterparty_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Vehicle types & vehicles
CREATE TABLE public.vehicle_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  base_fare NUMERIC(8,2) NOT NULL DEFAULT 15.00,
  per_km_rate NUMERIC(8,2) NOT NULL DEFAULT 8.00,
  per_minute_rate NUMERIC(8,2) NOT NULL DEFAULT 1.50,
  minimum_fare NUMERIC(8,2) NOT NULL DEFAULT 35.00,
  max_passengers INTEGER NOT NULL DEFAULT 4,
  icon TEXT DEFAULT 'car',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  fleet_id UUID,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  vehicle_type_id UUID REFERENCES public.vehicle_types(id),
  vin_number TEXT,
  insurance_expiry DATE,
  registration_expiry DATE,
  inspection_status TEXT DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'approved', 'rejected', 'expired')),
  is_fleet_vehicle BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'maintenance', 'decommissioned')),
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fleet management
CREATE TABLE public.fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  total_vehicles INTEGER NOT NULL DEFAULT 0,
  active_vehicles INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add fleet_id FK to vehicles
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_fleet_id_fkey FOREIGN KEY (fleet_id) REFERENCES public.fleets(id) ON DELETE SET NULL;

-- Driver real-time location tracking
CREATE TABLE public.driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  heading NUMERIC(5,2),
  speed NUMERIC(6,2),
  is_online BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT false,
  current_vehicle_id UUID REFERENCES public.vehicles(id),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rides (ride-hailing)
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  vehicle_id UUID REFERENCES public.vehicles(id),
  vehicle_type_id UUID REFERENCES public.vehicle_types(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'searching', 'driver_assigned', 'driver_arriving', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_drivers')),
  pickup_address TEXT NOT NULL,
  pickup_latitude NUMERIC(10,7),
  pickup_longitude NUMERIC(10,7),
  dropoff_address TEXT NOT NULL,
  dropoff_latitude NUMERIC(10,7),
  dropoff_longitude NUMERIC(10,7),
  estimated_distance_km NUMERIC(8,2),
  actual_distance_km NUMERIC(8,2),
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  estimated_fare NUMERIC(10,2),
  actual_fare NUMERIC(10,2),
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  payment_method TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'cash', 'card')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  rating_by_passenger INTEGER CHECK (rating_by_passenger BETWEEN 1 AND 5),
  rating_by_driver INTEGER CHECK (rating_by_driver BETWEEN 1 AND 5),
  feedback_by_passenger TEXT,
  feedback_by_driver TEXT,
  cancellation_reason TEXT,
  cancelled_by TEXT CHECK (cancelled_by IN ('passenger', 'driver', 'system')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ride status history
CREATE TABLE public.ride_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service modules registry
CREATE TABLE public.service_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  route TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default vehicle types
INSERT INTO public.vehicle_types (name, display_name, description, base_fare, per_km_rate, per_minute_rate, minimum_fare, max_passengers, icon) VALUES
  ('economy', 'Economy', 'Affordable rides for everyday trips', 15.00, 8.00, 1.50, 35.00, 4, 'car'),
  ('comfort', 'Comfort', 'More space and comfort for your trip', 25.00, 12.00, 2.00, 50.00, 4, 'car'),
  ('premium', 'Premium', 'Luxury vehicles with top-rated drivers', 45.00, 18.00, 3.00, 80.00, 4, 'crown'),
  ('xl', 'XL', 'Larger vehicles for groups up to 6', 35.00, 14.00, 2.50, 65.00, 6, 'users');

-- Insert default service modules
INSERT INTO public.service_modules (name, display_name, description, icon, color, route, sort_order) VALUES
  ('commerce', 'Shop', 'Browse and buy products from local merchants', 'shopping-bag', '#4361EE', '/shop', 1),
  ('rides', 'Rides', 'Request a ride to your destination', 'car', '#3A0CA3', '/rides', 2),
  ('delivery', 'Delivery', 'Send and receive packages', 'package', '#F72585', '/delivery', 3),
  ('wallet', 'Wallet', 'Manage your money and payments', 'wallet', '#FFB703', '/wallet', 4),
  ('business', 'Business', 'Tools for merchants and service providers', 'briefcase', '#06D6A0', '/merchant/dashboard', 5);

-- Enable RLS
ALTER TABLE public.platform_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_modules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Platform wallets: users see own, admins see all
CREATE POLICY "Users can view own wallet" ON public.platform_wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create own wallet" ON public.platform_wallets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON public.platform_wallets FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Wallet transactions: users see own
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users can create transactions" ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Vehicle types: public read
CREATE POLICY "Anyone can view vehicle types" ON public.vehicle_types FOR SELECT USING (true);
CREATE POLICY "Admins manage vehicle types" ON public.vehicle_types FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Vehicles: drivers see own, admins see all, fleet managers see fleet
CREATE POLICY "Drivers can view own vehicles" ON public.vehicles FOR SELECT TO authenticated USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR 
  fleet_id IN (SELECT id FROM public.fleets WHERE owner_id = auth.uid()) OR 
  public.is_admin(auth.uid())
);
CREATE POLICY "Drivers can manage own vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid())
);
CREATE POLICY "Drivers can update own vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid())
);

-- Fleets: owners see own, admins see all
CREATE POLICY "Fleet owners can view own fleets" ON public.fleets FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Fleet owners can manage fleets" ON public.fleets FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Fleet owners can update fleets" ON public.fleets FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- Driver locations: drivers update own, riders see available
CREATE POLICY "Drivers update own location" ON public.driver_locations FOR ALL TO authenticated USING (
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR public.is_admin(auth.uid())
);
CREATE POLICY "Users can view online drivers" ON public.driver_locations FOR SELECT TO authenticated USING (is_online = true AND is_available = true);

-- Rides: passengers see own, drivers see assigned
CREATE POLICY "Users can view own rides" ON public.rides FOR SELECT TO authenticated USING (
  passenger_id = auth.uid() OR 
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR 
  public.is_admin(auth.uid())
);
CREATE POLICY "Users can request rides" ON public.rides FOR INSERT TO authenticated WITH CHECK (passenger_id = auth.uid());
CREATE POLICY "Ride participants can update" ON public.rides FOR UPDATE TO authenticated USING (
  passenger_id = auth.uid() OR 
  driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()) OR 
  public.is_admin(auth.uid())
);

-- Ride status history
CREATE POLICY "Users can view ride history" ON public.ride_status_history FOR SELECT TO authenticated USING (
  ride_id IN (SELECT id FROM public.rides WHERE passenger_id = auth.uid() OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())) OR
  public.is_admin(auth.uid())
);

-- Service modules: public read
CREATE POLICY "Anyone can view service modules" ON public.service_modules FOR SELECT USING (true);
CREATE POLICY "Admins manage service modules" ON public.service_modules FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_platform_wallets_updated_at BEFORE UPDATE ON public.platform_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleets_updated_at BEFORE UPDATE ON public.fleets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate ride fare
CREATE OR REPLACE FUNCTION public.calculate_ride_fare(
  p_vehicle_type_id UUID,
  p_distance_km NUMERIC,
  p_duration_minutes INTEGER,
  p_surge_multiplier NUMERIC DEFAULT 1.0
) RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type RECORD;
  v_fare NUMERIC;
BEGIN
  SELECT * INTO v_type FROM vehicle_types WHERE id = p_vehicle_type_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  
  v_fare := v_type.base_fare + (p_distance_km * v_type.per_km_rate) + (p_duration_minutes * v_type.per_minute_rate);
  v_fare := v_fare * p_surge_multiplier;
  v_fare := GREATEST(v_fare, v_type.minimum_fare);
  
  RETURN ROUND(v_fare, 2);
END;
$$;

-- Function to get/create platform wallet
CREATE OR REPLACE FUNCTION public.get_or_create_wallet(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM platform_wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO platform_wallets (user_id) VALUES (p_user_id) RETURNING id INTO v_wallet_id;
  END IF;
  RETURN v_wallet_id;
END;
$$;

-- Realtime for rides and driver locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
