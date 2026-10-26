-- Conversion analytics for the 1145 Growth Command Centre.
--
-- The website records a small set of funnel events: homepage impressions,
-- category clicks, product views, app-download clicks, merchant applications,
-- cart activity and completed purchases. Anyone (signed in or not) may insert;
-- only admins may read. Rows carry no personal data beyond the user id of a
-- signed-in visitor and a random per-browser session id.

CREATE TABLE IF NOT EXISTS public.growth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event text NOT NULL CHECK (event IN (
    'home_impression', 'category_click', 'search', 'product_view',
    'download_click', 'merchant_apply_click', 'merchant_application',
    'add_to_cart', 'checkout_start', 'purchase',
    'campaign_click', 'referral_click', 'creator_click', 'area_selected'
  )),
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  path text CHECK (char_length(path) <= 300),
  area text CHECK (char_length(area) <= 80),
  props jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(props) <= 2048),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growth_events_event_time_idx ON public.growth_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS growth_events_time_idx ON public.growth_events (created_at DESC);

ALTER TABLE public.growth_events ENABLE ROW LEVEL SECURITY;

-- Visitors may only add events, and only as themselves (or anonymously).
DROP POLICY IF EXISTS "Anyone can record growth events" ON public.growth_events;
CREATE POLICY "Anyone can record growth events"
  ON public.growth_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read growth events" ON public.growth_events;
CREATE POLICY "Admins read growth events"
  ON public.growth_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT INSERT ON public.growth_events TO anon, authenticated;
GRANT SELECT ON public.growth_events TO authenticated;

-- Daily funnel for the Growth Command Centre: events and unique sessions per day.
CREATE OR REPLACE VIEW public.growth_funnel_daily
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day,
  event,
  count(*) AS events,
  count(DISTINCT session_id) AS sessions
FROM public.growth_events
GROUP BY 1, 2;

GRANT SELECT ON public.growth_funnel_daily TO authenticated;
