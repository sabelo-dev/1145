-- Create social media posts table for admin/influencer created content
CREATE TABLE public.social_media_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'plain' CHECK (content_type IN ('plain', 'product', 'news', 'promo', 'announcement')),
  product_id UUID REFERENCES public.products(id),
  media_urls TEXT[] DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  external_post_ids JSONB DEFAULT '{}',
  engagement_stats JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for approved social media accounts that can be used for verification
CREATE TABLE public.approved_social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  platform TEXT NOT NULL,
  account_handle TEXT NOT NULL,
  account_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, account_handle)
);

-- Create table for tracking post publishing to platforms
CREATE TABLE public.social_post_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_post_id TEXT,
  external_post_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  error_message TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for influencer assignments and permissions
CREATE TABLE public.influencer_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  display_name TEXT,
  bio TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  can_post BOOLEAN DEFAULT true,
  can_schedule BOOLEAN DEFAULT true,
  can_manage_accounts BOOLEAN DEFAULT false,
  platforms_access TEXT[] DEFAULT ARRAY['instagram', 'facebook', 'twitter', 'tiktok', 'youtube'],
  performance_stats JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for social_media_posts
CREATE POLICY "Admins can manage all posts" ON public.social_media_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Influencers can manage their own posts" ON public.social_media_posts
  FOR ALL USING (
    created_by = auth.uid() AND 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'influencer')
  );

CREATE POLICY "Users can view published posts" ON public.social_media_posts
  FOR SELECT USING (status = 'published');

-- Policies for approved_social_accounts
CREATE POLICY "Users can view their own approved accounts" ON public.approved_social_accounts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all approved accounts" ON public.approved_social_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Influencers can manage approved accounts" ON public.approved_social_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'influencer')
  );

-- Policies for social_post_platforms
CREATE POLICY "Admins can manage all post platforms" ON public.social_post_platforms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Influencers can view post platforms for their posts" ON public.social_post_platforms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.social_media_posts smp 
      WHERE smp.id = post_id AND smp.created_by = auth.uid()
    )
  );

-- Policies for influencer_profiles
CREATE POLICY "Admins can manage all influencer profiles" ON public.influencer_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Influencers can view their own profile" ON public.influencer_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Influencers can update their own profile" ON public.influencer_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_social_media_posts_updated_at
  BEFORE UPDATE ON public.social_media_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approved_social_accounts_updated_at
  BEFORE UPDATE ON public.approved_social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_influencer_profiles_updated_at
  BEFORE UPDATE ON public.influencer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();