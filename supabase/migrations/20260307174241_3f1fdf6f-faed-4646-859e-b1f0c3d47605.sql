
-- Add coordinate columns to rides table for map integration
ALTER TABLE public.rides 
  ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC;
