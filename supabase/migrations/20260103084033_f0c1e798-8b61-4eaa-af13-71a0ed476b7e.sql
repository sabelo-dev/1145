-- Create storage bucket for driver vehicle photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-vehicles', 'driver-vehicles', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own vehicle photos
CREATE POLICY "Drivers can upload their own vehicle photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'driver-vehicles');

-- Allow public read access to vehicle photos
CREATE POLICY "Vehicle photos are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'driver-vehicles');

-- Allow drivers to update their own vehicle photos
CREATE POLICY "Drivers can update their own vehicle photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'driver-vehicles');

-- Allow drivers to delete their own vehicle photos
CREATE POLICY "Drivers can delete their own vehicle photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'driver-vehicles');