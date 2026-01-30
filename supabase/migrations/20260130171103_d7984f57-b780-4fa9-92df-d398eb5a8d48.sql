-- Create cron job to process scheduled posts every minute
SELECT cron.schedule(
  'process-scheduled-posts',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://hipomusjocacncjsvgfa.supabase.co/functions/v1/process-scheduled-posts',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);