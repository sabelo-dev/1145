-- Create driver_payouts table for tracking driver payments
CREATE TABLE public.driver_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  deliveries_count INTEGER DEFAULT 0,
  total_distance_km NUMERIC DEFAULT 0,
  payment_method TEXT,
  payment_reference TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all driver payouts"
ON public.driver_payouts
FOR ALL
USING (is_admin());

CREATE POLICY "Drivers can view their own payouts"
ON public.driver_payouts
FOR SELECT
USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_driver_payouts_updated_at
BEFORE UPDATE ON public.driver_payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime on driver_payouts
ALTER TABLE public.driver_payouts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_payouts;