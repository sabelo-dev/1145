-- Service marketplace ("Hire a pro"): providers, listings, fixed-price packages,
-- orders with a brief / messages / files / delivery, reviews, and an admin ledger.
--
-- Principles
--   * Providers are a profile on the existing account (no second identity).
--   * Money is integer minor units (cents) with an explicit currency.
--   * Clients never write orders, payments, events, messages or reviews directly:
--     every change goes through a SECURITY DEFINER function that checks the caller,
--     the state transition and the amounts, and records an event.
--   * Payment is confirmed only by the payment webhook (service role).
--   * Refunds and payouts are recorded by an admin after the payment provider
--     confirms them; nothing here claims funds are held in escrow.

-- ── Tables ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 1200),
  location TEXT CHECK (location IS NULL OR char_length(location) <= 120),
  service_mode TEXT NOT NULL DEFAULT 'remote' CHECK (service_mode IN ('remote', 'in_person', 'both')),
  -- Public samples: [{ "title": text, "url": https link }]; the provider confirms they may show them.
  portfolio JSONB NOT NULL DEFAULT '[]'::jsonb,
  portfolio_rights_confirmed BOOLEAN NOT NULL DEFAULT false,
  onboarding_status TEXT NOT NULL DEFAULT 'draft' CHECK (onboarding_status IN
    ('draft', 'submitted', 'under_review', 'approved', 'changes_requested', 'rejected', 'suspended')),
  review_note TEXT,
  approved_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contact and payout references: never public, never shown to customers.
CREATE TABLE IF NOT EXISTS public.service_provider_private (
  provider_id UUID PRIMARY KEY REFERENCES public.service_provider_profiles(id) ON DELETE CASCADE,
  contact_email TEXT,
  contact_phone TEXT,
  -- A reference issued by the payment provider. Never bank details.
  payment_provider_account_ref TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.service_provider_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 4 AND 100),
  slug TEXT NOT NULL UNIQUE,
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 5000),
  exclusions TEXT CHECK (exclusions IS NULL OR char_length(exclusions) <= 1500),
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
    ('draft', 'submitted', 'changes_requested', 'published', 'paused', 'rejected', 'archived')),
  review_note TEXT,
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  -- What the customer must tell the provider: [{ key, label, type: text|textarea, required }]
  required_brief_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_listings_provider_idx ON public.service_listings (provider_id);
CREATE INDEX IF NOT EXISTS service_listings_catalog_idx ON public.service_listings (status, category_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 600),
  price_minor INTEGER NOT NULL CHECK (price_minor BETWEEN 100 AND 100000000),
  currency TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  delivery_days INTEGER NOT NULL CHECK (delivery_days BETWEEN 1 AND 365),
  revisions_included INTEGER NOT NULL DEFAULT 0 CHECK (revisions_included BETWEEN 0 AND 20),
  deliverables TEXT NOT NULL CHECK (char_length(deliverables) BETWEEN 3 AND 1500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS service_packages_listing_idx ON public.service_packages (listing_id, sort_order);

CREATE SEQUENCE IF NOT EXISTS public.service_order_number_seq START 100001;

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('SV-' || nextval('public.service_order_number_seq')),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES public.service_provider_profiles(id) ON DELETE RESTRICT,
  listing_id UUID REFERENCES public.service_listings(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.service_packages(id) ON DELETE SET NULL,
  -- One order per checkout attempt, however many times the request is retried.
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending_payment' CHECK (state IN
    ('pending_payment', 'awaiting_brief', 'new', 'in_progress', 'waiting_for_customer', 'delivered',
     'revision_requested', 'completed', 'cancelled', 'disputed', 'refunded', 'partially_refunded')),
  -- The agreement, copied at purchase so later listing edits never change it.
  listing_title TEXT NOT NULL,
  package_name TEXT NOT NULL,
  package_description TEXT,
  deliverables TEXT NOT NULL,
  exclusions TEXT,
  delivery_days INTEGER NOT NULL,
  revisions_included INTEGER NOT NULL,
  revisions_used INTEGER NOT NULL DEFAULT 0,
  brief_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  brief_json JSONB,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  gross_amount_minor INTEGER NOT NULL CHECK (gross_amount_minor >= 0),
  fee_bps INTEGER NOT NULL CHECK (fee_bps BETWEEN 0 AND 5000),
  marketplace_fee_minor INTEGER NOT NULL CHECK (marketplace_fee_minor >= 0),
  provider_net_minor INTEGER NOT NULL CHECK (provider_net_minor >= 0),
  -- Where a dispute was raised from, so it can be resumed.
  state_before_dispute TEXT,
  paid_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_user_id, idempotency_key),
  CHECK (marketplace_fee_minor + provider_net_minor = gross_amount_minor)
);
CREATE INDEX IF NOT EXISTS service_orders_customer_idx ON public.service_orders (customer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_orders_provider_idx ON public.service_orders (provider_id, state, created_at DESC);

-- Append-only history of everything that happened to an order.
CREATE TABLE IF NOT EXISTS public.service_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_order_events_order_idx ON public.service_order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.service_order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'provider', 'support')),
  -- 'message' | 'delivery' (a delivery note) | 'revision' (a revision request)
  kind TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'delivery', 'revision')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_order_messages_order_idx ON public.service_order_messages (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.service_order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  -- What the file is for: brief | message | delivery
  visibility TEXT NOT NULL CHECK (visibility IN ('brief', 'message', 'delivery')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_order_files_order_idx ON public.service_order_files (order_id, created_at);

CREATE TABLE IF NOT EXISTS public.service_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'payfast',
  provider_payment_ref TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'refund_due', 'partially_refunded', 'refunded')),
  gross_amount_minor INTEGER NOT NULL CHECK (gross_amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  marketplace_fee_minor INTEGER NOT NULL CHECK (marketplace_fee_minor >= 0),
  provider_net_minor INTEGER NOT NULL CHECK (provider_net_minor >= 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_minor >= 0),
  refund_ref TEXT,
  payout_ref TEXT,
  -- not_due (work not completed) → pending (owed to the provider) → paid | cancelled
  payout_status TEXT NOT NULL DEFAULT 'not_due' CHECK (payout_status IN ('not_due', 'pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (refunded_amount_minor <= gross_amount_minor)
);

CREATE TABLE IF NOT EXISTS public.service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.service_listings(id) ON DELETE SET NULL,
  customer_user_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.service_provider_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT CHECK (review_text IS NULL OR char_length(review_text) <= 2000),
  provider_response TEXT CHECK (provider_response IS NULL OR char_length(provider_response) <= 2000),
  moderation_status TEXT NOT NULL DEFAULT 'published' CHECK (moderation_status IN ('published', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_reviews_provider_idx ON public.service_reviews (provider_id, created_at DESC);

-- Who did what, and why: admin decisions, financial actions, support access, listing edits.
CREATE TABLE IF NOT EXISTS public.service_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_admin_audit_entity_idx ON public.service_admin_audit (entity_type, entity_id, created_at DESC);

-- One row. The commission applied to NEW orders; each order keeps the rate it was bought at.
CREATE TABLE IF NOT EXISTS public.service_marketplace_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  fee_bps INTEGER NOT NULL DEFAULT 1000 CHECK (fee_bps BETWEEN 0 AND 5000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.service_marketplace_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

INSERT INTO public.service_categories (name, slug, sort_order) VALUES
  ('Design & creative', 'design-creative', 1),
  ('Writing & translation', 'writing-translation', 2),
  ('Digital marketing', 'digital-marketing', 3),
  ('Web & tech', 'web-tech', 4),
  ('Photo & video', 'photo-video', 5),
  ('Business & admin', 'business-admin', 6),
  ('Home & local services', 'home-local', 7)
ON CONFLICT (slug) DO NOTHING;

-- Ratings are shown only once a provider has enough published reviews to mean something.
CREATE OR REPLACE VIEW public.service_provider_ratings WITH (security_invoker = true) AS
  SELECT provider_id, count(*)::integer AS review_count, round(avg(rating)::numeric, 1) AS average_rating
  FROM public.service_reviews
  WHERE moderation_status = 'published'
  GROUP BY provider_id
  HAVING count(*) >= 3;

-- A brief form is a short list of labelled questions with unique keys.
CREATE OR REPLACE FUNCTION public.service_valid_brief_schema(_schema jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(_schema) = 'array'
    AND jsonb_array_length(_schema) <= 12
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_schema) f
      WHERE jsonb_typeof(f) <> 'object'
         OR coalesce(f->>'key', '') !~ '^[a-z0-9_]{1,40}$'
         OR char_length(coalesce(f->>'label', '')) NOT BETWEEN 1 AND 120
         OR coalesce(f->>'type', 'text') NOT IN ('text', 'textarea'))
    AND (SELECT count(DISTINCT f->>'key') FROM jsonb_array_elements(_schema) f) = jsonb_array_length(_schema)
$$;
DO $$
BEGIN
  ALTER TABLE public.service_listings ADD CONSTRAINT service_listings_brief_schema_valid
    CHECK (public.service_valid_brief_schema(required_brief_schema));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Internal helpers ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_my_provider_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.service_provider_profiles WHERE user_id = auth.uid()
$$;

-- Is the caller the customer or the provider on this order?
CREATE OR REPLACE FUNCTION public.service_order_role(_order_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN o.customer_user_id = auth.uid() THEN 'customer'
    WHEN p.user_id = auth.uid() THEN 'provider'
  END
  FROM public.service_orders o JOIN public.service_provider_profiles p ON p.id = o.provider_id
  WHERE o.id = _order_id
$$;

-- Admins read private order content only after logging why (valid for one hour).
CREATE OR REPLACE FUNCTION public.service_support_access(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin() AND EXISTS (
    SELECT 1 FROM public.service_admin_audit
    WHERE actor_user_id = auth.uid() AND entity_type = 'order' AND entity_id = _order_id
      AND action = 'support_access' AND created_at > now() - interval '1 hour')
$$;

CREATE OR REPLACE FUNCTION public.service_internal()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('service.internal', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION public.service_notify(_user_id uuid, _title text, _message text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  -- Titles and links only: never brief contents, messages or file names.
  INSERT INTO public.user_notifications (user_id, type, title, message, data)
  VALUES (_user_id, 'service', _title, _message, jsonb_build_object('link', _link));
EXCEPTION WHEN OTHERS THEN
  NULL; -- a failed notification must never undo the order change it describes
END $$;

CREATE OR REPLACE FUNCTION public.service_audit(_entity_type text, _entity_id uuid, _action text, _reason text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.service_admin_audit (actor_user_id, entity_type, entity_id, action, reason, metadata_json)
  VALUES (auth.uid(), _entity_type, _entity_id, _action, nullif(trim(coalesce(_reason, '')), ''), coalesce(_metadata, '{}'::jsonb))
$$;

-- The one place an order changes state. Records the event and tells both sides.
CREATE OR REPLACE FUNCTION public.service_set_state(_order public.service_orders, _to text, _event text, _reason text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_provider_user uuid;
  v_link text := '/hire/orders/' || _order.id;
  v_title text;
BEGIN
  UPDATE public.service_orders SET
    state = _to,
    updated_at = now(),
    state_before_dispute = CASE WHEN _to = 'disputed' THEN _order.state ELSE state_before_dispute END,
    delivered_at = CASE WHEN _to = 'delivered' THEN now() ELSE delivered_at END,
    completed_at = CASE WHEN _to = 'completed' THEN now() ELSE completed_at END
  WHERE id = _order.id;

  INSERT INTO public.service_order_events (order_id, actor_user_id, event_type, from_state, to_state, reason, metadata_json)
  VALUES (_order.id, auth.uid(), _event, _order.state, _to, nullif(trim(coalesce(_reason, '')), ''), coalesce(_metadata, '{}'::jsonb));

  -- Completed work becomes payable to the provider; cancelled or refunded work does not.
  IF _to = 'completed' THEN
    UPDATE public.service_payments SET payout_status = 'pending', updated_at = now()
    WHERE order_id = _order.id AND payout_status = 'not_due' AND status = 'paid';
  END IF;

  SELECT user_id INTO v_provider_user FROM public.service_provider_profiles WHERE id = _order.provider_id;
  v_title := CASE _to
    WHEN 'awaiting_brief' THEN 'Payment confirmed — add your brief'
    WHEN 'new' THEN 'New order ready to start'
    WHEN 'in_progress' THEN 'Work has started'
    WHEN 'waiting_for_customer' THEN 'Your provider needs something from you'
    WHEN 'delivered' THEN 'Your order has been delivered'
    WHEN 'revision_requested' THEN 'A revision was requested'
    WHEN 'completed' THEN 'Order completed'
    WHEN 'cancelled' THEN 'Order cancelled'
    WHEN 'disputed' THEN 'An issue was raised on an order'
    WHEN 'refunded' THEN 'Order refunded'
    WHEN 'partially_refunded' THEN 'Order partially refunded'
    ELSE 'Order updated' END;
  -- Tell whoever did not make the change (both sides for system and admin changes).
  IF auth.uid() IS DISTINCT FROM _order.customer_user_id AND _to <> 'new' THEN
    PERFORM public.service_notify(_order.customer_user_id, v_title, _order.order_number || ' · ' || _order.listing_title, v_link);
  END IF;
  IF auth.uid() IS DISTINCT FROM v_provider_user AND _to NOT IN ('awaiting_brief', 'waiting_for_customer') THEN
    PERFORM public.service_notify(v_provider_user, v_title, _order.order_number || ' · ' || _order.listing_title, v_link);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.service_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ── Guards on tables providers may write directly ───────────────
-- A provider edits their own profile, but only an admin decision changes its status.
CREATE OR REPLACE FUNCTION public.service_provider_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF public.service_internal() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.onboarding_status := 'draft';
    NEW.approved_at := NULL; NEW.suspended_at := NULL; NEW.review_note := NULL;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.onboarding_status := OLD.onboarding_status;
    NEW.approved_at := OLD.approved_at; NEW.suspended_at := OLD.suspended_at; NEW.review_note := OLD.review_note;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS service_provider_guard ON public.service_provider_profiles;
CREATE TRIGGER service_provider_guard BEFORE INSERT OR UPDATE ON public.service_provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.service_provider_guard();

-- A provider edits their own listing, but never its status. Changing what is sold
-- on a live listing sends it back for review, and every edit is recorded.
CREATE OR REPLACE FUNCTION public.service_listing_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF public.service_internal() OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft'; NEW.published_at := NULL; NEW.review_note := NULL;
    RETURN NEW;
  END IF;
  NEW.provider_id := OLD.provider_id;
  NEW.status := OLD.status; NEW.published_at := OLD.published_at; NEW.review_note := OLD.review_note;
  IF OLD.status IN ('published', 'paused') AND (
       NEW.title IS DISTINCT FROM OLD.title OR NEW.summary IS DISTINCT FROM OLD.summary
       OR NEW.description IS DISTINCT FROM OLD.description OR NEW.exclusions IS DISTINCT FROM OLD.exclusions
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.required_brief_schema IS DISTINCT FROM OLD.required_brief_schema) THEN
    NEW.status := 'submitted';
    PERFORM public.service_audit('listing', OLD.id, 'listing_edited_resubmitted', NULL);
  ELSIF OLD.status IN ('published', 'paused') THEN
    PERFORM public.service_audit('listing', OLD.id, 'listing_edited', NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS service_listing_guard ON public.service_listings;
CREATE TRIGGER service_listing_guard BEFORE INSERT OR UPDATE ON public.service_listings
  FOR EACH ROW EXECUTE FUNCTION public.service_listing_guard();

-- Changing the packages of a live listing changes what is sold: back to review.
CREATE OR REPLACE FUNCTION public.service_package_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_listing uuid := coalesce(NEW.listing_id, OLD.listing_id);
BEGIN
  IF public.service_internal() OR auth.uid() IS NULL OR public.is_admin() THEN RETURN NULL; END IF;
  -- Re-saving a package without changing what is sold is not an edit.
  IF TG_OP = 'UPDATE' AND (NEW.name, NEW.description, NEW.price_minor, NEW.delivery_days, NEW.revisions_included, NEW.deliverables, NEW.is_active)
       IS NOT DISTINCT FROM (OLD.name, OLD.description, OLD.price_minor, OLD.delivery_days, OLD.revisions_included, OLD.deliverables, OLD.is_active) THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('service.internal', 'on', true);
  UPDATE public.service_listings SET status = 'submitted' WHERE id = v_listing AND status IN ('published', 'paused');
  IF FOUND THEN
    PERFORM public.service_audit('listing', v_listing, 'packages_edited_resubmitted', NULL);
  END IF;
  PERFORM set_config('service.internal', 'off', true);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS service_package_guard ON public.service_packages;
CREATE TRIGGER service_package_guard AFTER INSERT OR UPDATE OR DELETE ON public.service_packages
  FOR EACH ROW EXECUTE FUNCTION public.service_package_guard();

DROP TRIGGER IF EXISTS service_payments_touch ON public.service_payments;
CREATE TRIGGER service_payments_touch BEFORE UPDATE ON public.service_payments
  FOR EACH ROW EXECUTE FUNCTION public.service_touch_updated_at();
DROP TRIGGER IF EXISTS service_reviews_touch ON public.service_reviews;
CREATE TRIGGER service_reviews_touch BEFORE UPDATE ON public.service_reviews
  FOR EACH ROW EXECUTE FUNCTION public.service_touch_updated_at();

-- ── Row level security ──────────────────────────────────────────
ALTER TABLE public.service_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_provider_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_marketplace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved providers are public" ON public.service_provider_profiles;
CREATE POLICY "Approved providers are public" ON public.service_provider_profiles FOR SELECT
  USING (onboarding_status = 'approved' OR user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Users create their provider profile" ON public.service_provider_profiles;
CREATE POLICY "Users create their provider profile" ON public.service_provider_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Providers edit their profile" ON public.service_provider_profiles;
CREATE POLICY "Providers edit their profile" ON public.service_provider_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Provider private details: owner and admin" ON public.service_provider_private;
CREATE POLICY "Provider private details: owner and admin" ON public.service_provider_private FOR ALL TO authenticated
  USING (provider_id = public.service_my_provider_id() OR public.is_admin())
  WITH CHECK (provider_id = public.service_my_provider_id() OR public.is_admin());

DROP POLICY IF EXISTS "Active categories are public" ON public.service_categories;
CREATE POLICY "Active categories are public" ON public.service_categories FOR SELECT
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS "Admins manage categories" ON public.service_categories;
CREATE POLICY "Admins manage categories" ON public.service_categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Published listings are public" ON public.service_listings;
CREATE POLICY "Published listings are public" ON public.service_listings FOR SELECT
  USING (
    provider_id = public.service_my_provider_id() OR public.is_admin()
    OR (status = 'published' AND EXISTS (
          SELECT 1 FROM public.service_provider_profiles p WHERE p.id = provider_id AND p.onboarding_status = 'approved'))
  );
DROP POLICY IF EXISTS "Providers create listings" ON public.service_listings;
CREATE POLICY "Providers create listings" ON public.service_listings FOR INSERT TO authenticated
  WITH CHECK (provider_id = public.service_my_provider_id());
DROP POLICY IF EXISTS "Providers edit their listings" ON public.service_listings;
CREATE POLICY "Providers edit their listings" ON public.service_listings FOR UPDATE TO authenticated
  USING (provider_id = public.service_my_provider_id()) WITH CHECK (provider_id = public.service_my_provider_id());
DROP POLICY IF EXISTS "Providers delete draft listings" ON public.service_listings;
CREATE POLICY "Providers delete draft listings" ON public.service_listings FOR DELETE TO authenticated
  USING (provider_id = public.service_my_provider_id() AND status = 'draft');

DROP POLICY IF EXISTS "Packages follow the listing" ON public.service_packages;
CREATE POLICY "Packages follow the listing" ON public.service_packages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.service_listings l WHERE l.id = listing_id));
DROP POLICY IF EXISTS "Providers manage their packages" ON public.service_packages;
CREATE POLICY "Providers manage their packages" ON public.service_packages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_listings l WHERE l.id = listing_id AND l.provider_id = public.service_my_provider_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_listings l WHERE l.id = listing_id AND l.provider_id = public.service_my_provider_id()));

-- Orders and everything attached to them: read-only to the two participants and admins.
DROP POLICY IF EXISTS "Participants and admins read orders" ON public.service_orders;
CREATE POLICY "Participants and admins read orders" ON public.service_orders FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid() OR provider_id = public.service_my_provider_id() OR public.is_admin());

DROP POLICY IF EXISTS "Events follow the order" ON public.service_order_events;
CREATE POLICY "Events follow the order" ON public.service_order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_orders o WHERE o.id = order_id));

-- Private content: participants, or an admin who has logged a support reason.
DROP POLICY IF EXISTS "Participants read messages" ON public.service_order_messages;
CREATE POLICY "Participants read messages" ON public.service_order_messages FOR SELECT TO authenticated
  USING (public.service_order_role(order_id) IS NOT NULL OR public.service_support_access(order_id));
DROP POLICY IF EXISTS "Participants read files" ON public.service_order_files;
CREATE POLICY "Participants read files" ON public.service_order_files FOR SELECT TO authenticated
  USING (public.service_order_role(order_id) IS NOT NULL OR public.service_support_access(order_id));

-- Payment records: the provider (their earnings) and admins. Customers see their total on the order.
DROP POLICY IF EXISTS "Providers and admins read payments" ON public.service_payments;
CREATE POLICY "Providers and admins read payments" ON public.service_payments FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.service_orders o WHERE o.id = order_id AND o.provider_id = public.service_my_provider_id()));

DROP POLICY IF EXISTS "Published reviews are public" ON public.service_reviews;
CREATE POLICY "Published reviews are public" ON public.service_reviews FOR SELECT
  USING (moderation_status = 'published' OR customer_user_id = auth.uid()
         OR provider_id = public.service_my_provider_id() OR public.is_admin());

DROP POLICY IF EXISTS "Admins read the audit trail" ON public.service_admin_audit;
CREATE POLICY "Admins read the audit trail" ON public.service_admin_audit FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Settings are readable" ON public.service_marketplace_settings;
CREATE POLICY "Settings are readable" ON public.service_marketplace_settings FOR SELECT USING (true);

-- ── Provider actions ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_submit_provider_profile()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile public.service_provider_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.service_provider_profiles WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create your provider profile first'; END IF;
  IF v_profile.onboarding_status NOT IN ('draft', 'changes_requested') THEN
    RAISE EXCEPTION 'Your profile is % and cannot be submitted again', replace(v_profile.onboarding_status, '_', ' ');
  END IF;
  IF coalesce(trim(v_profile.bio), '') = '' THEN RAISE EXCEPTION 'Add a short bio before submitting'; END IF;
  IF jsonb_array_length(v_profile.portfolio) > 0 AND NOT v_profile.portfolio_rights_confirmed THEN
    RAISE EXCEPTION 'Confirm you have the right to show your portfolio samples';
  END IF;
  PERFORM set_config('service.internal', 'on', true);
  UPDATE public.service_provider_profiles SET onboarding_status = 'submitted', review_note = NULL WHERE id = v_profile.id;
  PERFORM set_config('service.internal', 'off', true);
  PERFORM public.service_audit('provider', v_profile.id, 'provider_submitted', NULL);
  PERFORM public.service_notify(auth.uid(), 'Provider application received', 'We''ll let you know once it has been reviewed.', '/hire/provider');
END $$;

-- submit | pause | resume | archive
CREATE OR REPLACE FUNCTION public.service_listing_action(p_listing_id uuid, p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_listing public.service_listings%ROWTYPE;
  v_provider public.service_provider_profiles%ROWTYPE;
  v_to text;
BEGIN
  SELECT * INTO v_listing FROM public.service_listings WHERE id = p_listing_id FOR UPDATE;
  SELECT * INTO v_provider FROM public.service_provider_profiles WHERE id = v_listing.provider_id;
  IF v_listing.id IS NULL OR v_provider.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Listing not found'; END IF;

  IF p_action = 'submit' AND v_listing.status IN ('draft', 'changes_requested') THEN
    IF v_provider.onboarding_status <> 'approved' THEN
      RAISE EXCEPTION 'Your provider profile must be approved before you can submit a listing';
    END IF;
    IF coalesce(trim(v_listing.summary), '') = '' OR coalesce(trim(v_listing.description), '') = '' OR v_listing.category_id IS NULL THEN
      RAISE EXCEPTION 'Add a summary, a description and a category before submitting';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_packages WHERE listing_id = v_listing.id AND is_active) THEN
      RAISE EXCEPTION 'Add at least one package with a price, delivery time and what is included';
    END IF;
    v_to := 'submitted';
  ELSIF p_action = 'pause' AND v_listing.status = 'published' THEN v_to := 'paused';
  ELSIF p_action = 'resume' AND v_listing.status = 'paused' THEN
    IF v_provider.onboarding_status <> 'approved' THEN RAISE EXCEPTION 'Your provider profile is not approved'; END IF;
    v_to := 'published';
  ELSIF p_action = 'archive' AND v_listing.status NOT IN ('archived') THEN v_to := 'archived';
  ELSE
    RAISE EXCEPTION 'A listing that is % cannot be %', replace(v_listing.status, '_', ' '),
      CASE p_action WHEN 'submit' THEN 'submitted' WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'resumed' ELSE 'archived' END;
  END IF;

  PERFORM set_config('service.internal', 'on', true);
  UPDATE public.service_listings SET status = v_to WHERE id = v_listing.id;
  PERFORM set_config('service.internal', 'off', true);
  PERFORM public.service_audit('listing', v_listing.id, 'listing_' || p_action, NULL, jsonb_build_object('from', v_listing.status, 'to', v_to));
END $$;

-- ── Ordering (customer) ─────────────────────────────────────────
-- Creates the order from the package as it is on the server right now. Calling it
-- again with the same key returns the same order instead of creating another.
CREATE OR REPLACE FUNCTION public.service_create_order(p_package_id uuid, p_idempotency_key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_package public.service_packages%ROWTYPE;
  v_listing public.service_listings%ROWTYPE;
  v_provider public.service_provider_profiles%ROWTYPE;
  v_fee_bps integer;
  v_fee integer;
  v_order public.service_orders%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in to order a service'; END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 80 THEN
    RAISE EXCEPTION 'Invalid request';
  END IF;

  SELECT * INTO v_order FROM public.service_orders WHERE customer_user_id = v_user AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_order.id; END IF;

  SELECT * INTO v_package FROM public.service_packages WHERE id = p_package_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'This package is no longer available'; END IF;
  SELECT * INTO v_listing FROM public.service_listings WHERE id = v_package.listing_id;
  SELECT * INTO v_provider FROM public.service_provider_profiles WHERE id = v_listing.provider_id;
  IF v_listing.status <> 'published' OR v_provider.onboarding_status <> 'approved' THEN
    RAISE EXCEPTION 'This service is not available right now';
  END IF;
  IF v_provider.user_id = v_user THEN RAISE EXCEPTION 'You cannot order your own service'; END IF;
  -- Brake on runaway checkouts.
  IF (SELECT count(*) FROM public.service_orders WHERE customer_user_id = v_user AND state = 'pending_payment'
        AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'You have several unpaid orders. Pay for or cancel one before starting another.';
  END IF;

  SELECT fee_bps INTO v_fee_bps FROM public.service_marketplace_settings;
  v_fee := round(v_package.price_minor::numeric * v_fee_bps / 10000)::integer;

  INSERT INTO public.service_orders (
    customer_user_id, provider_id, listing_id, package_id, idempotency_key, listing_title, package_name,
    package_description, deliverables, exclusions, delivery_days, revisions_included, brief_schema, currency,
    gross_amount_minor, fee_bps, marketplace_fee_minor, provider_net_minor)
  VALUES (
    v_user, v_provider.id, v_listing.id, v_package.id, p_idempotency_key, v_listing.title, v_package.name,
    v_package.description, v_package.deliverables, v_listing.exclusions, v_package.delivery_days,
    v_package.revisions_included, v_listing.required_brief_schema, v_package.currency,
    v_package.price_minor, v_fee_bps, v_fee, v_package.price_minor - v_fee)
  ON CONFLICT (customer_user_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_order;

  IF v_order.id IS NULL THEN -- a concurrent retry won the race
    SELECT * INTO v_order FROM public.service_orders WHERE customer_user_id = v_user AND idempotency_key = p_idempotency_key;
    RETURN v_order.id;
  END IF;

  INSERT INTO public.service_order_events (order_id, actor_user_id, event_type, to_state)
  VALUES (v_order.id, v_user, 'order_created', 'pending_payment');
  RETURN v_order.id;
END $$;

-- Does this order need anything from the customer before work can start?
CREATE OR REPLACE FUNCTION public.service_brief_missing(_schema jsonb, _brief jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(_schema, '[]'::jsonb)) f
    WHERE coalesce((f->>'required')::boolean, false)
      AND coalesce(trim(coalesce(_brief, '{}'::jsonb)->>(f->>'key')), '') = '')
$$;

CREATE OR REPLACE FUNCTION public.service_submit_brief(p_order_id uuid, p_brief jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_clean jsonb;
BEGIN
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id AND customer_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.state NOT IN ('awaiting_brief', 'new') THEN
    RAISE EXCEPTION 'The brief can no longer be changed here. Send the provider a message instead.';
  END IF;

  -- Keep only the fields the listing asked for, as trimmed text.
  SELECT coalesce(jsonb_object_agg(f->>'key', left(trim(coalesce(p_brief->>(f->>'key'), '')), 4000)), '{}'::jsonb)
  INTO v_clean FROM jsonb_array_elements(v_order.brief_schema) f;

  IF public.service_brief_missing(v_order.brief_schema, v_clean) THEN
    RAISE EXCEPTION 'Please fill in every required field';
  END IF;

  UPDATE public.service_orders SET brief_json = v_clean, updated_at = now(),
    due_at = CASE WHEN state = 'awaiting_brief' THEN now() + make_interval(days => delivery_days) ELSE due_at END
  WHERE id = p_order_id;

  IF v_order.state = 'awaiting_brief' THEN
    PERFORM public.service_set_state(v_order, 'new', 'brief_submitted');
  ELSE
    INSERT INTO public.service_order_events (order_id, actor_user_id, event_type) VALUES (p_order_id, auth.uid(), 'brief_updated');
  END IF;
END $$;

-- accept | request_revision | cancel | dispute
CREATE OR REPLACE FUNCTION public.service_customer_action(p_order_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id AND customer_user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_action = 'accept' AND v_order.state = 'delivered' THEN
    PERFORM public.service_set_state(v_order, 'completed', 'delivery_accepted');
  ELSIF p_action = 'request_revision' AND v_order.state = 'delivered' THEN
    IF v_order.revisions_used >= v_order.revisions_included THEN
      RAISE EXCEPTION 'This order has no included revisions left. Accept the delivery, or raise an issue if something is wrong.';
    END IF;
    IF v_reason IS NULL THEN RAISE EXCEPTION 'Tell the provider what needs to change'; END IF;
    UPDATE public.service_orders SET revisions_used = revisions_used + 1 WHERE id = p_order_id;
    INSERT INTO public.service_order_messages (order_id, sender_user_id, sender_role, kind, message)
    VALUES (p_order_id, auth.uid(), 'customer', 'revision', left(v_reason, 4000));
    PERFORM public.service_set_state(v_order, 'revision_requested', 'revision_requested', NULL,
      jsonb_build_object('revision', v_order.revisions_used + 1, 'included', v_order.revisions_included));
  ELSIF p_action = 'cancel' AND v_order.state = 'pending_payment' THEN
    PERFORM public.service_set_state(v_order, 'cancelled', 'cancelled_before_payment');
  ELSIF p_action = 'dispute' AND v_order.state IN
        ('awaiting_brief', 'new', 'in_progress', 'waiting_for_customer', 'delivered', 'revision_requested') THEN
    IF v_reason IS NULL THEN RAISE EXCEPTION 'Describe the issue so support can help'; END IF;
    PERFORM public.service_set_state(v_order, 'disputed', 'dispute_opened', v_reason, jsonb_build_object('raised_by', 'customer'));
  ELSE
    RAISE EXCEPTION 'That isn''t possible while the order is %', replace(v_order.state, '_', ' ');
  END IF;
END $$;

-- start | wait | resume | deliver | dispute
CREATE OR REPLACE FUNCTION public.service_provider_action(p_order_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
BEGIN
  SELECT * INTO v_order FROM public.service_orders
  WHERE id = p_order_id AND provider_id = public.service_my_provider_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_action = 'start' AND v_order.state IN ('new', 'revision_requested') THEN
    IF public.service_brief_missing(v_order.brief_schema, v_order.brief_json) THEN
      RAISE EXCEPTION 'The customer has not completed the brief yet';
    END IF;
    PERFORM public.service_set_state(v_order, 'in_progress', CASE v_order.state WHEN 'new' THEN 'order_acknowledged' ELSE 'revision_started' END);
  ELSIF p_action = 'wait' AND v_order.state = 'in_progress' THEN
    IF v_note IS NULL THEN RAISE EXCEPTION 'Tell the customer what you need'; END IF;
    INSERT INTO public.service_order_messages (order_id, sender_user_id, sender_role, message)
    VALUES (p_order_id, auth.uid(), 'provider', left(v_note, 4000));
    PERFORM public.service_set_state(v_order, 'waiting_for_customer', 'waiting_for_customer');
  ELSIF p_action = 'resume' AND v_order.state = 'waiting_for_customer' THEN
    PERFORM public.service_set_state(v_order, 'in_progress', 'work_resumed');
  ELSIF p_action = 'deliver' AND v_order.state IN ('in_progress', 'revision_requested') THEN
    IF v_note IS NULL THEN RAISE EXCEPTION 'Add a short delivery note'; END IF;
    INSERT INTO public.service_order_messages (order_id, sender_user_id, sender_role, kind, message)
    VALUES (p_order_id, auth.uid(), 'provider', 'delivery', left(v_note, 4000));
    PERFORM public.service_set_state(v_order, 'delivered', 'delivery_submitted', NULL,
      jsonb_build_object('version', v_order.revisions_used + 1));
  ELSIF p_action = 'dispute' AND v_order.state IN
        ('new', 'in_progress', 'waiting_for_customer', 'delivered', 'revision_requested') THEN
    IF v_note IS NULL THEN RAISE EXCEPTION 'Describe the issue so support can help'; END IF;
    PERFORM public.service_set_state(v_order, 'disputed', 'dispute_opened', v_note, jsonb_build_object('raised_by', 'provider'));
  ELSE
    RAISE EXCEPTION 'That isn''t possible while the order is %', replace(v_order.state, '_', ' ');
  END IF;
END $$;

-- ── Conversation and files ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_post_message(p_order_id uuid, p_message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_role text := public.service_order_role(p_order_id);
  v_text text := trim(coalesce(p_message, ''));
  v_provider_user uuid;
  v_id uuid;
BEGIN
  IF v_role IS NULL AND public.service_support_access(p_order_id) THEN v_role := 'support'; END IF;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.state = 'pending_payment' THEN RAISE EXCEPTION 'Messages open once the order is paid'; END IF;
  IF v_text = '' THEN RAISE EXCEPTION 'Write a message first'; END IF;
  IF (SELECT count(*) FROM public.service_order_messages
      WHERE sender_user_id = auth.uid() AND created_at > now() - interval '5 minutes') >= 30 THEN
    RAISE EXCEPTION 'You''re sending messages too quickly. Please wait a moment.';
  END IF;

  INSERT INTO public.service_order_messages (order_id, sender_user_id, sender_role, message)
  VALUES (p_order_id, auth.uid(), v_role, left(v_text, 4000)) RETURNING id INTO v_id;

  SELECT user_id INTO v_provider_user FROM public.service_provider_profiles WHERE id = v_order.provider_id;
  IF v_role <> 'customer' THEN
    PERFORM public.service_notify(v_order.customer_user_id, 'New message on your order', v_order.order_number || ' · ' || v_order.listing_title, '/hire/orders/' || p_order_id);
  END IF;
  IF v_role <> 'provider' THEN
    PERFORM public.service_notify(v_provider_user, 'New message on an order', v_order.order_number || ' · ' || v_order.listing_title, '/hire/orders/' || p_order_id);
  END IF;

  -- The customer answering is what a waiting order was waiting for.
  IF v_role = 'customer' AND v_order.state = 'waiting_for_customer' THEN
    PERFORM public.service_set_state(v_order, 'in_progress', 'customer_replied');
  END IF;
  RETURN v_id;
END $$;

-- Records a file that was uploaded to private storage under <order>/<uploader>/…
CREATE OR REPLACE FUNCTION public.service_register_file(
  p_order_id uuid, p_storage_key text, p_filename text, p_mime_type text, p_size_bytes bigint, p_visibility text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_role text := public.service_order_role(p_order_id);
  v_id uuid;
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id;
  IF v_order.state IN ('pending_payment', 'cancelled', 'refunded') THEN RAISE EXCEPTION 'Files can''t be added to this order'; END IF;
  IF p_storage_key NOT LIKE p_order_id::text || '/' || auth.uid()::text || '/%' OR p_storage_key LIKE '%..%' THEN
    RAISE EXCEPTION 'Invalid file location';
  END IF;
  IF p_visibility NOT IN ('brief', 'message', 'delivery')
     OR (p_visibility = 'delivery' AND v_role <> 'provider') OR (p_visibility = 'brief' AND v_role <> 'customer') THEN
    RAISE EXCEPTION 'Invalid file type for this order';
  END IF;
  IF p_mime_type NOT IN (
      'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv',
      'application/zip', 'application/x-zip-compressed', 'video/mp4', 'audio/mpeg',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
     OR lower(p_filename) ~ '\.(exe|msi|bat|cmd|com|scr|js|vbs|ps1|sh|jar|apk|dll|app|dmg|html?|svg)$' THEN
    RAISE EXCEPTION 'That file type isn''t allowed';
  END IF;
  IF p_size_bytes IS NULL OR p_size_bytes < 1 OR p_size_bytes > 26214400 THEN RAISE EXCEPTION 'Files can be up to 25 MB'; END IF;
  IF (SELECT count(*) FROM public.service_order_files WHERE order_id = p_order_id) >= 100 THEN
    RAISE EXCEPTION 'This order has reached its file limit';
  END IF;

  INSERT INTO public.service_order_files (order_id, uploader_user_id, storage_key, original_filename, mime_type, size_bytes, visibility)
  VALUES (p_order_id, auth.uid(), p_storage_key, left(p_filename, 200), p_mime_type, p_size_bytes, p_visibility)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── Reviews ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_submit_review(p_order_id uuid, p_rating integer, p_text text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_provider_user uuid;
BEGIN
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id AND customer_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.state <> 'completed' THEN RAISE EXCEPTION 'You can review an order once it is completed'; END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Choose a rating from 1 to 5'; END IF;
  IF EXISTS (SELECT 1 FROM public.service_reviews WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'You have already reviewed this order';
  END IF;
  INSERT INTO public.service_reviews (order_id, listing_id, customer_user_id, provider_id, rating, review_text)
  VALUES (p_order_id, v_order.listing_id, auth.uid(), v_order.provider_id, p_rating, nullif(left(trim(coalesce(p_text, '')), 2000), ''));
  INSERT INTO public.service_order_events (order_id, actor_user_id, event_type) VALUES (p_order_id, auth.uid(), 'review_submitted');
  SELECT user_id INTO v_provider_user FROM public.service_provider_profiles WHERE id = v_order.provider_id;
  PERFORM public.service_notify(v_provider_user, 'You received a review', v_order.order_number || ' · ' || v_order.listing_title, '/hire/orders/' || p_order_id);
END $$;

CREATE OR REPLACE FUNCTION public.service_respond_to_review(p_review_id uuid, p_response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.service_reviews SET provider_response = nullif(left(trim(coalesce(p_response, '')), 2000), '')
  WHERE id = p_review_id AND provider_id = public.service_my_provider_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
END $$;

-- ── Payment confirmation (payment webhook only) ─────────────────
-- Safe to call any number of times for the same payment.
CREATE OR REPLACE FUNCTION public.service_order_mark_paid(p_order_id uuid, p_payment_ref text, p_amount_minor integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_needs_brief boolean;
BEGIN
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.service_payments WHERE order_id = p_order_id) THEN RETURN 'already_paid'; END IF;
  IF p_amount_minor IS DISTINCT FROM v_order.gross_amount_minor THEN RETURN 'amount_mismatch'; END IF;

  -- Paid after the customer cancelled: keep it cancelled and flag the refund.
  IF v_order.state <> 'pending_payment' THEN
    INSERT INTO public.service_payments (order_id, provider_payment_ref, status, gross_amount_minor, currency,
      marketplace_fee_minor, provider_net_minor, payout_status)
    VALUES (p_order_id, p_payment_ref, 'refund_due', v_order.gross_amount_minor, v_order.currency,
      v_order.marketplace_fee_minor, v_order.provider_net_minor, 'cancelled');
    INSERT INTO public.service_order_events (order_id, event_type, reason, metadata_json)
    VALUES (p_order_id, 'payment_after_cancellation', 'Refund due', jsonb_build_object('payment_ref', p_payment_ref));
    RETURN 'refund_due';
  END IF;

  INSERT INTO public.service_payments (order_id, provider_payment_ref, status, gross_amount_minor, currency,
    marketplace_fee_minor, provider_net_minor)
  VALUES (p_order_id, p_payment_ref, 'paid', v_order.gross_amount_minor, v_order.currency,
    v_order.marketplace_fee_minor, v_order.provider_net_minor);

  v_needs_brief := public.service_brief_missing(v_order.brief_schema, v_order.brief_json);
  UPDATE public.service_orders SET paid_at = now(),
    due_at = CASE WHEN v_needs_brief THEN NULL ELSE now() + make_interval(days => delivery_days) END
  WHERE id = p_order_id;
  PERFORM public.service_set_state(v_order, CASE WHEN v_needs_brief THEN 'awaiting_brief' ELSE 'new' END,
    'payment_confirmed', NULL, jsonb_build_object('payment_ref', p_payment_ref));
  RETURN 'paid';
END $$;

-- ── Admin ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_require_admin(_reason text, _reason_required boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _reason_required AND coalesce(trim(_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;
END $$;

-- under_review | approved | changes_requested | rejected | suspended
CREATE OR REPLACE FUNCTION public.service_admin_review_provider(p_provider_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_profile public.service_provider_profiles%ROWTYPE;
BEGIN
  PERFORM public.service_require_admin(p_reason, p_status IN ('changes_requested', 'rejected', 'suspended'));
  IF p_status NOT IN ('under_review', 'approved', 'changes_requested', 'rejected', 'suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_profile FROM public.service_provider_profiles WHERE id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider not found'; END IF;
  IF v_profile.onboarding_status = 'draft' THEN RAISE EXCEPTION 'This provider has not submitted their profile yet'; END IF;

  PERFORM set_config('service.internal', 'on', true);
  UPDATE public.service_provider_profiles SET
    onboarding_status = p_status,
    review_note = nullif(trim(coalesce(p_reason, '')), ''),
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    suspended_at = CASE WHEN p_status = 'suspended' THEN now() ELSE NULL END
  WHERE id = p_provider_id;
  PERFORM set_config('service.internal', 'off', true);

  PERFORM public.service_audit('provider', p_provider_id, 'provider_' || p_status, p_reason, jsonb_build_object('from', v_profile.onboarding_status));
  IF p_status <> 'under_review' THEN
    PERFORM public.service_notify(v_profile.user_id,
      CASE p_status WHEN 'approved' THEN 'You''re approved to sell services on 1145'
        WHEN 'changes_requested' THEN 'Your provider application needs changes'
        WHEN 'rejected' THEN 'Your provider application was not approved'
        ELSE 'Your provider account has been suspended' END,
      'Open your provider dashboard for details.', '/hire/provider');
  END IF;
END $$;

-- published | changes_requested | rejected | paused
CREATE OR REPLACE FUNCTION public.service_admin_review_listing(p_listing_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_listing public.service_listings%ROWTYPE;
  v_provider public.service_provider_profiles%ROWTYPE;
BEGIN
  PERFORM public.service_require_admin(p_reason, p_status <> 'published');
  IF p_status NOT IN ('published', 'changes_requested', 'rejected', 'paused') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_listing FROM public.service_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  SELECT * INTO v_provider FROM public.service_provider_profiles WHERE id = v_listing.provider_id;
  IF v_listing.status IN ('draft', 'archived') THEN RAISE EXCEPTION 'This listing has not been submitted for review'; END IF;
  IF p_status = 'published' THEN
    IF v_provider.onboarding_status <> 'approved' THEN RAISE EXCEPTION 'The provider is not approved'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.service_packages WHERE listing_id = p_listing_id AND is_active) THEN
      RAISE EXCEPTION 'A listing needs at least one active package before it can be published';
    END IF;
  END IF;

  PERFORM set_config('service.internal', 'on', true);
  UPDATE public.service_listings SET status = p_status,
    review_note = nullif(trim(coalesce(p_reason, '')), ''),
    published_at = CASE WHEN p_status = 'published' THEN coalesce(published_at, now()) ELSE published_at END
  WHERE id = p_listing_id;
  PERFORM set_config('service.internal', 'off', true);

  PERFORM public.service_audit('listing', p_listing_id, 'listing_' || p_status, p_reason, jsonb_build_object('from', v_listing.status));
  PERFORM public.service_notify(v_provider.user_id,
    CASE p_status WHEN 'published' THEN 'Your listing is live' WHEN 'changes_requested' THEN 'Your listing needs changes'
      WHEN 'rejected' THEN 'Your listing was not approved' ELSE 'Your listing was paused by 1145' END,
    v_listing.title, '/hire/provider');
END $$;

-- Logs why an admin is opening an order's private messages and files (required to read them).
CREATE OR REPLACE FUNCTION public.service_admin_open_order(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.service_require_admin(p_reason);
  IF NOT EXISTS (SELECT 1 FROM public.service_orders WHERE id = p_order_id) THEN RAISE EXCEPTION 'Order not found'; END IF;
  PERFORM public.service_audit('order', p_order_id, 'support_access', p_reason);
END $$;

-- resume (back to where it was) | complete (in the provider's favour) | cancel (in the customer's favour; refund is recorded separately)
CREATE OR REPLACE FUNCTION public.service_admin_resolve_dispute(p_order_id uuid, p_outcome text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_to text;
BEGIN
  PERFORM public.service_require_admin(p_reason);
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.state <> 'disputed' THEN RAISE EXCEPTION 'This order is not in dispute'; END IF;
  v_to := CASE p_outcome
    WHEN 'resume' THEN coalesce(v_order.state_before_dispute, 'in_progress')
    WHEN 'complete' THEN 'completed'
    WHEN 'cancel' THEN 'cancelled' END;
  IF v_to IS NULL THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
  PERFORM public.service_set_state(v_order, v_to, 'dispute_resolved', p_reason, jsonb_build_object('outcome', p_outcome));
  IF v_to = 'cancelled' THEN
    UPDATE public.service_payments SET status = 'refund_due', payout_status = 'cancelled'
    WHERE order_id = p_order_id AND status = 'paid';
  END IF;
  PERFORM public.service_audit('order', p_order_id, 'dispute_' || p_outcome, p_reason);
END $$;

-- Records a refund the payment provider has already confirmed. p_reference is its reference.
CREATE OR REPLACE FUNCTION public.service_admin_record_refund(p_order_id uuid, p_amount_minor integer, p_reference text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_payment public.service_payments%ROWTYPE;
  v_total integer;
  v_full boolean;
BEGIN
  PERFORM public.service_require_admin(p_reason);
  IF coalesce(trim(p_reference), '') = '' THEN RAISE EXCEPTION 'Enter the payment provider''s refund reference'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_payment FROM public.service_payments WHERE order_id = p_order_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'This order has no payment to refund'; END IF;
  IF v_payment.payout_status = 'paid' THEN RAISE EXCEPTION 'The provider has already been paid out for this order'; END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero'; END IF;
  v_total := v_payment.refunded_amount_minor + p_amount_minor;
  IF v_total > v_payment.gross_amount_minor THEN RAISE EXCEPTION 'That is more than the customer paid'; END IF;
  v_full := v_total = v_payment.gross_amount_minor;

  UPDATE public.service_payments SET
    refunded_amount_minor = v_total,
    refund_ref = trim(p_reference),
    status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
    payout_status = CASE WHEN v_full THEN 'cancelled' ELSE payout_status END
  WHERE id = v_payment.id;

  PERFORM public.service_set_state(v_order, CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
    'refund_recorded', p_reason, jsonb_build_object('amount_minor', p_amount_minor, 'reference', trim(p_reference)));
  PERFORM public.service_audit('order', p_order_id, 'refund_recorded', p_reason,
    jsonb_build_object('amount_minor', p_amount_minor, 'total_refunded_minor', v_total, 'reference', trim(p_reference)));
END $$;

-- Records a payout already made to the provider. p_reference is the bank / payment provider reference.
CREATE OR REPLACE FUNCTION public.service_admin_record_payout(p_order_id uuid, p_reference text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order public.service_orders%ROWTYPE;
  v_payment public.service_payments%ROWTYPE;
  v_provider_user uuid;
BEGIN
  PERFORM public.service_require_admin(p_reason, false);
  IF coalesce(trim(p_reference), '') = '' THEN RAISE EXCEPTION 'Enter the payout reference'; END IF;
  SELECT * INTO v_order FROM public.service_orders WHERE id = p_order_id;
  SELECT * INTO v_payment FROM public.service_payments WHERE order_id = p_order_id FOR UPDATE;
  IF v_payment.id IS NULL OR v_payment.payout_status <> 'pending' THEN RAISE EXCEPTION 'No payout is pending for this order'; END IF;

  UPDATE public.service_payments SET payout_status = 'paid', payout_ref = trim(p_reference) WHERE id = v_payment.id;
  INSERT INTO public.service_order_events (order_id, actor_user_id, event_type, metadata_json)
  VALUES (p_order_id, auth.uid(), 'payout_recorded', jsonb_build_object('reference', trim(p_reference)));
  PERFORM public.service_audit('order', p_order_id, 'payout_recorded', p_reason,
    jsonb_build_object('reference', trim(p_reference), 'amount_minor', v_payment.provider_net_minor - v_payment.refunded_amount_minor));
  SELECT user_id INTO v_provider_user FROM public.service_provider_profiles WHERE id = v_order.provider_id;
  PERFORM public.service_notify(v_provider_user, 'Payout recorded', v_order.order_number || ' · ' || v_order.listing_title, '/hire/provider');
END $$;

CREATE OR REPLACE FUNCTION public.service_admin_set_fee(p_fee_bps integer, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_old integer;
BEGIN
  PERFORM public.service_require_admin(p_reason);
  IF p_fee_bps IS NULL OR p_fee_bps NOT BETWEEN 0 AND 5000 THEN RAISE EXCEPTION 'The fee must be between 0%% and 50%%'; END IF;
  SELECT fee_bps INTO v_old FROM public.service_marketplace_settings;
  UPDATE public.service_marketplace_settings SET fee_bps = p_fee_bps, updated_at = now();
  PERFORM public.service_audit('settings', NULL, 'fee_changed', p_reason, jsonb_build_object('from_bps', v_old, 'to_bps', p_fee_bps));
END $$;

-- published | removed
CREATE OR REPLACE FUNCTION public.service_admin_moderate_review(p_review_id uuid, p_status text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.service_require_admin(p_reason);
  IF p_status NOT IN ('published', 'removed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.service_reviews SET moderation_status = p_status WHERE id = p_review_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Review not found'; END IF;
  PERFORM public.service_audit('review', p_review_id, 'review_' || p_status, p_reason);
END $$;

-- ── Who may call what ───────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  -- Internal building blocks: not callable through the API.
  FOREACH f IN ARRAY ARRAY[
    'service_notify(uuid, text, text, text)', 'service_audit(text, uuid, text, text, jsonb)',
    'service_set_state(public.service_orders, text, text, text, jsonb)', 'service_require_admin(text, boolean)',
    'service_order_mark_paid(uuid, text, integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'service_submit_provider_profile()', 'service_listing_action(uuid, text)', 'service_create_order(uuid, text)',
    'service_submit_brief(uuid, jsonb)', 'service_customer_action(uuid, text, text)', 'service_provider_action(uuid, text, text)',
    'service_post_message(uuid, text)', 'service_register_file(uuid, text, text, text, bigint, text)',
    'service_submit_review(uuid, integer, text)', 'service_respond_to_review(uuid, text)',
    'service_admin_review_provider(uuid, text, text)', 'service_admin_review_listing(uuid, text, text)',
    'service_admin_open_order(uuid, text)', 'service_admin_resolve_dispute(uuid, text, text)',
    'service_admin_record_refund(uuid, integer, text, text)', 'service_admin_record_payout(uuid, text, text)',
    'service_admin_set_fee(integer, text)', 'service_admin_moderate_review(uuid, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.service_order_mark_paid(uuid, text, integer) TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ── Private file storage ────────────────────────────────────────
-- Files live at <order id>/<uploader id>/<file>. Only the two participants (and an
-- admin with a logged support reason) can read them, through short-lived signed links.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('service-order-files', 'service-order-files', false, 26214400)
  ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 26214400;
EXCEPTION WHEN undefined_column THEN
  INSERT INTO storage.buckets (id, name, public) VALUES ('service-order-files', 'service-order-files', false)
  ON CONFLICT (id) DO UPDATE SET public = false;
END $$;

CREATE OR REPLACE FUNCTION public.service_storage_order_id(_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(_name, '/', 1)::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

DROP POLICY IF EXISTS "Service order files: participants read" ON storage.objects;
CREATE POLICY "Service order files: participants read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'service-order-files' AND (
    public.service_order_role(public.service_storage_order_id(name)) IS NOT NULL
    OR public.service_support_access(public.service_storage_order_id(name))));

DROP POLICY IF EXISTS "Service order files: participants upload" ON storage.objects;
CREATE POLICY "Service order files: participants upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-order-files'
    AND public.service_order_role(public.service_storage_order_id(name)) IS NOT NULL
    AND split_part(name, '/', 2) = auth.uid()::text
    AND lower(name) !~ '\.(exe|msi|bat|cmd|com|scr|js|vbs|ps1|sh|jar|apk|dll|app|dmg|html?|svg)$');

-- Live updates in the order workspace.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.service_order_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
