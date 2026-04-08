
-- Create emergency_events table
CREATE TABLE public.emergency_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'rider')),
  trip_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dispatched', 'resolved', 'cancelled')),
  lat NUMERIC NULL,
  lng NUMERIC NULL,
  silent_mode BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ NULL,
  resolved_by UUID NULL,
  responder_notes TEXT NULL,
  cancel_reason TEXT NULL,
  cancelled_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_emergency_events_user_id ON public.emergency_events(user_id);
CREATE INDEX idx_emergency_events_status ON public.emergency_events(status);
CREATE INDEX idx_emergency_events_created_at ON public.emergency_events(created_at DESC);
CREATE INDEX idx_emergency_events_trip_id ON public.emergency_events(trip_id) WHERE trip_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.emergency_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own emergency events
CREATE POLICY "Users can view own emergency events"
  ON public.emergency_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Users can create their own emergency events
CREATE POLICY "Users can create own emergency events"
  ON public.emergency_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can cancel their own active events; admins can update any
CREATE POLICY "Users can update own events or admin all"
  ON public.emergency_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_emergency_events_updated_at
  BEFORE UPDATE ON public.emergency_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for emergency_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_events;
