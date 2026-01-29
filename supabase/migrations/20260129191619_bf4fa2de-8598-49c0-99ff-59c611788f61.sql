-- Create CMS pages table
CREATE TABLE public.cms_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create CMS banners table
CREATE TABLE public.cms_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT,
  position TEXT NOT NULL DEFAULT 'hero' CHECK (position IN ('hero', 'promo', 'sidebar')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_banners ENABLE ROW LEVEL SECURITY;

-- RLS policies for cms_pages (admin only)
CREATE POLICY "Admins can manage cms_pages"
ON public.cms_pages
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Published pages are publicly readable"
ON public.cms_pages
FOR SELECT
USING (status = 'published');

-- RLS policies for cms_banners (admin only for management, public for reading active)
CREATE POLICY "Admins can manage cms_banners"
ON public.cms_banners
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Active banners are publicly readable"
ON public.cms_banners
FOR SELECT
USING (is_active = true);

-- Create updated_at trigger for cms_pages
CREATE TRIGGER update_cms_pages_updated_at
BEFORE UPDATE ON public.cms_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for cms_banners
CREATE TRIGGER update_cms_banners_updated_at
BEFORE UPDATE ON public.cms_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();