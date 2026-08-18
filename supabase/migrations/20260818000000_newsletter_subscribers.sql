-- Create newsletter subscribers table
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure email uniqueness per store
  UNIQUE(email, store_id)
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Subscribers can unsubscribe themselves (by email)
CREATE POLICY "Subscribers can manage their subscription" ON public.newsletter_subscribers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Store admins can view and manage subscribers for their store
CREATE POLICY "Store admins can view subscribers" ON public.newsletter_subscribers
  FOR SELECT
  USING (
    store_id IN (
      SELECT s.id FROM stores s
      JOIN vendors v ON s.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Store admins can manage subscribers" ON public.newsletter_subscribers
  FOR UPDATE
  USING (
    store_id IN (
      SELECT s.id FROM stores s
      JOIN vendors v ON s.vendor_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON public.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_store_id ON public.newsletter_subscribers(store_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(status) WHERE status = 'active';
