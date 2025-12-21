-- Enable realtime on delivery_jobs table
ALTER TABLE public.delivery_jobs REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_jobs;