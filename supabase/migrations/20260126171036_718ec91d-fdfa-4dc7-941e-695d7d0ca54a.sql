-- Schedule gold price updates every 15 minutes
SELECT
  cron.schedule(
    'update-gold-prices-every-15-min',
    '*/15 * * * *',
    $$
    SELECT
      net.http_post(
        url:='https://hipomusjocacncjsvgfa.supabase.co/functions/v1/update-gold-prices',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpcG9tdXNqb2NhY25janN2Z2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5MDE0NjksImV4cCI6MjA2MjQ3NzQ2OX0.JZy5M3kCTYsFiLke1Okbk4-dRuXFpzpvVjvn9zyG2yA'
        ),
        body:='{}'::jsonb
      ) as request_id;
    $$
  );