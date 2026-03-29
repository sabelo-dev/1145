
-- ================================================
-- INFLUENCER MODULE UPGRADE: Normalized Data Schema
-- ================================================

-- 1. Normalized social posts (ingested from platforms)
CREATE TABLE public.influencer_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image',
  media_url TEXT,
  media_urls TEXT[] DEFAULT '{}',
  caption TEXT,
  permalink TEXT,
  posted_at TIMESTAMPTZ,
  metrics JSONB DEFAULT '{}',
  raw_data JSONB DEFAULT '{}',
  linked_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  is_synced BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_post_id)
);

-- 2. Normalized comments inbox
CREATE TABLE public.influencer_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.influencer_social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_comment_id TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.influencer_comments(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_avatar_url TEXT,
  text TEXT NOT NULL,
  sentiment TEXT DEFAULT 'neutral',
  is_replied BOOLEAN DEFAULT false,
  is_handled BOOLEAN DEFAULT false,
  is_spam BOOLEAN DEFAULT false,
  is_high_value BOOLEAN DEFAULT false,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ NOT NULL,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform, platform_comment_id)
);

-- 3. Engagement metrics (time-series)
CREATE TABLE public.influencer_engagement_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.influencer_social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Commerce conversion tracking (Post → Click → Sale)
CREATE TABLE public.influencer_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.influencer_social_posts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'click',
  attribution_window_hours INTEGER DEFAULT 72,
  revenue NUMERIC(12,2) DEFAULT 0,
  commission NUMERIC(12,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. AI suggestion log
CREATE TABLE public.influencer_ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.influencer_comments(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL DEFAULT 'reply',
  suggested_text TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Platform sync status
CREATE TABLE public.influencer_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  posts_synced INTEGER DEFAULT 0,
  comments_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id, platform)
);

-- 7. Revenue analytics (aggregated Money View)
CREATE TABLE public.influencer_revenue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  platform TEXT,
  total_posts INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_commission NUMERIC(12,2) DEFAULT 0,
  avg_engagement_rate NUMERIC(5,2) DEFAULT 0,
  top_performing_post_id UUID REFERENCES public.influencer_social_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(influencer_id, period_start, period_end, platform)
);

-- Enable RLS on all new tables
ALTER TABLE public.influencer_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_revenue_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Influencers can see their own data
CREATE POLICY "Influencers can view own posts" ON public.influencer_social_posts
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can manage own posts" ON public.influencer_social_posts
  FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can view own comments" ON public.influencer_comments
  FOR SELECT TO authenticated
  USING (post_id IN (SELECT id FROM influencer_social_posts WHERE influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Influencers can manage own comments" ON public.influencer_comments
  FOR ALL TO authenticated
  USING (post_id IN (SELECT id FROM influencer_social_posts WHERE influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Influencers can view own metrics" ON public.influencer_engagement_metrics
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can view own conversions" ON public.influencer_conversions
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can view own suggestions" ON public.influencer_ai_suggestions
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can manage own suggestions" ON public.influencer_ai_suggestions
  FOR ALL TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can view own sync status" ON public.influencer_sync_status
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can view own revenue" ON public.influencer_revenue_analytics
  FOR SELECT TO authenticated
  USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = auth.uid()));

-- Admin can see everything
CREATE POLICY "Admins can view all social posts" ON public.influencer_social_posts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all comments" ON public.influencer_comments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all metrics" ON public.influencer_engagement_metrics
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all conversions" ON public.influencer_conversions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all suggestions" ON public.influencer_ai_suggestions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage sync status" ON public.influencer_sync_status
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all revenue" ON public.influencer_revenue_analytics
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_social_posts_influencer ON public.influencer_social_posts(influencer_id);
CREATE INDEX idx_social_posts_platform ON public.influencer_social_posts(platform);
CREATE INDEX idx_social_posts_product ON public.influencer_social_posts(linked_product_id);
CREATE INDEX idx_comments_post ON public.influencer_comments(post_id);
CREATE INDEX idx_comments_handled ON public.influencer_comments(is_handled, is_replied);
CREATE INDEX idx_comments_sentiment ON public.influencer_comments(sentiment);
CREATE INDEX idx_metrics_influencer_date ON public.influencer_engagement_metrics(influencer_id, metric_date);
CREATE INDEX idx_conversions_influencer ON public.influencer_conversions(influencer_id);
CREATE INDEX idx_conversions_post ON public.influencer_conversions(post_id);
CREATE INDEX idx_sync_status_influencer ON public.influencer_sync_status(influencer_id, platform);
