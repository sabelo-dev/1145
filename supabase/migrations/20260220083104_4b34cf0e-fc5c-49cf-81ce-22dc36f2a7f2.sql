
-- Create storage bucket for vendor videos
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-videos', 'vendor-videos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for vendor-videos bucket
CREATE POLICY "Anyone can view vendor videos" ON storage.objects FOR SELECT USING (bucket_id = 'vendor-videos');

CREATE POLICY "Authenticated users can upload vendor videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vendor-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own vendor videos" ON storage.objects FOR UPDATE USING (bucket_id = 'vendor-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own vendor videos" ON storage.objects FOR DELETE USING (bucket_id = 'vendor-videos' AND auth.role() = 'authenticated');
