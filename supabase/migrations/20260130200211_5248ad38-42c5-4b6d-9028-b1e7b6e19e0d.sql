-- Create table for storing OAuth tokens securely
CREATE TABLE public.social_oauth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL,
  account_id VARCHAR(255),
  account_handle VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT[],
  page_id VARCHAR(255),
  page_name VARCHAR(255),
  page_access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform, account_id)
);

-- Enable RLS
ALTER TABLE public.social_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tokens
CREATE POLICY "Users can view own tokens"
ON public.social_oauth_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
ON public.social_oauth_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own tokens"
ON public.social_oauth_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own tokens"
ON public.social_oauth_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_social_oauth_tokens_user_platform ON public.social_oauth_tokens(user_id, platform);
CREATE INDEX idx_social_oauth_tokens_active ON public.social_oauth_tokens(user_id, is_active) WHERE is_active = true;

-- Add trigger for updated_at
CREATE TRIGGER update_social_oauth_tokens_updated_at
BEFORE UPDATE ON public.social_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add post_metrics table for storing engagement analytics
CREATE TABLE public.social_post_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_media_posts(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  external_post_id VARCHAR(255),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4),
  raw_data JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, platform, fetched_at)
);

-- Enable RLS on metrics
ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view metrics for their own posts
CREATE POLICY "Users can view own post metrics"
ON public.social_post_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.social_media_posts
    WHERE social_media_posts.id = social_post_metrics.post_id
    AND social_media_posts.created_by = auth.uid()
  )
);

-- Policy: Service role can insert metrics (from edge functions)
CREATE POLICY "Service role can insert metrics"
ON public.social_post_metrics
FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_social_post_metrics_post ON public.social_post_metrics(post_id);
CREATE INDEX idx_social_post_metrics_platform ON public.social_post_metrics(platform);

-- Add external_post_ids column to social_media_posts if not exists (for storing platform-specific post IDs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_media_posts' AND column_name = 'external_post_ids'
  ) THEN
    ALTER TABLE public.social_media_posts ADD COLUMN external_post_ids JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;