-- Add username column to influencer_profiles for user tagging
ALTER TABLE public.influencer_profiles 
ADD COLUMN username text UNIQUE;

-- Add index for faster username lookups
CREATE INDEX idx_influencer_profiles_username ON public.influencer_profiles(username);

-- Add a check constraint to ensure username follows a valid format (alphanumeric, underscores, and dashes)
ALTER TABLE public.influencer_profiles 
ADD CONSTRAINT username_format_check 
CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]+$');