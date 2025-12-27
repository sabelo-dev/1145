-- Add images column to reviews table
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images', 
  'review-images', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload review images
CREATE POLICY "Users can upload review images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to review images
CREATE POLICY "Review images are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'review-images');

-- Allow users to delete their own review images
CREATE POLICY "Users can delete their own review images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'review-images' AND (storage.foldername(name))[1] = auth.uid()::text);