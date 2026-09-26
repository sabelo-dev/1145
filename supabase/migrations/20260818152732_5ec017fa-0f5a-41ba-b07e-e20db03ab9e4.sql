CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','unsubscribed','bounced')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email, store_id)
);

GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Store owners can view subscribers" ON public.newsletter_subscribers
  FOR SELECT TO authenticated USING (
    store_id IN (
      SELECT s.id FROM public.stores s
      JOIN public.vendors v ON s.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Store owners can manage subscribers" ON public.newsletter_subscribers
  FOR UPDATE TO authenticated USING (
    store_id IN (
      SELECT s.id FROM public.stores s
      JOIN public.vendors v ON s.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  ) WITH CHECK (
    store_id IN (
      SELECT s.id FROM public.stores s
      JOIN public.vendors v ON s.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_store_id ON public.newsletter_subscribers(store_id);