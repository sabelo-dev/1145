
-- Storefront customization table for tier-based store features
CREATE TABLE public.storefront_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  
  -- Layout & Theme (Bronze+)
  accent_color TEXT DEFAULT '#6366f1',
  secondary_color TEXT DEFAULT '#8b5cf6',
  layout_type TEXT DEFAULT 'grid' CHECK (layout_type IN ('grid', 'modern', 'minimal')),
  
  -- Content sections (Bronze+)
  about_us TEXT,
  social_links JSONB DEFAULT '{}',
  
  -- Silver+ features
  cta_button_text TEXT DEFAULT 'Shop Now',
  cta_button_url TEXT,
  video_banner_url TEXT,
  testimonials JSONB DEFAULT '[]',
  faq_items JSONB DEFAULT '[]',
  announcement_bar_text TEXT,
  announcement_bar_active BOOLEAN DEFAULT false,
  email_capture_enabled BOOLEAN DEFAULT false,
  email_capture_title TEXT DEFAULT 'Subscribe to our newsletter',
  
  -- Gold features
  custom_font TEXT,
  custom_css TEXT,
  custom_meta_title TEXT,
  custom_meta_description TEXT,
  homepage_sections JSONB DEFAULT '["hero","featured","products","testimonials","faq"]',
  mega_menu_config JSONB DEFAULT '{}',
  custom_domain TEXT,
  white_label BOOLEAN DEFAULT false,
  ga_tracking_id TEXT,
  meta_pixel_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.storefront_customizations ENABLE ROW LEVEL SECURITY;

-- Public read access (storefronts are public)
CREATE POLICY "Storefront customizations are publicly readable"
ON public.storefront_customizations FOR SELECT
USING (true);

-- Vendors can manage their own store customizations
CREATE POLICY "Vendors can insert their store customizations"
ON public.storefront_customizations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);

CREATE POLICY "Vendors can update their store customizations"
ON public.storefront_customizations FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);

-- Featured products table for manual selection (Bronze+)
CREATE TABLE public.store_featured_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);

ALTER TABLE public.store_featured_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Featured products are publicly readable"
ON public.store_featured_products FOR SELECT
USING (true);

CREATE POLICY "Vendors can manage their featured products"
ON public.store_featured_products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    JOIN public.vendors v ON v.id = s.vendor_id
    WHERE s.id = store_id AND v.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_storefront_customizations_updated_at
BEFORE UPDATE ON public.storefront_customizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
