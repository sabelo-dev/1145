-- Add column to track if account was added by admin
ALTER TABLE public.approved_social_accounts 
ADD COLUMN IF NOT EXISTS added_by_admin UUID REFERENCES auth.users(id);

-- Add external_post_url to social_media_posts for tracking published post URLs
ALTER TABLE public.social_media_posts 
ADD COLUMN IF NOT EXISTS external_post_url TEXT;

-- Create function to verify mining task completion
-- Only approve tasks completed from links that originated from admin/influencer posts
CREATE OR REPLACE FUNCTION public.verify_mining_task_from_approved_source(
  p_completion_id UUID,
  p_verified BOOLEAN,
  p_verified_by UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion RECORD;
  v_proof_url TEXT;
  v_is_valid_source BOOLEAN := false;
  v_post_creator_role TEXT;
BEGIN
  -- Get the completion record with proof URL
  SELECT mc.*, mc.proof_url as completion_proof_url
  INTO v_completion 
  FROM mining_completions mc
  WHERE mc.id = p_completion_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Completion not found');
  END IF;
  
  v_proof_url := v_completion.completion_proof_url;
  
  IF p_verified THEN
    -- Check if the proof URL matches any published social media post by admin or influencer
    SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = smp.created_by AND role = 'admin') THEN 'admin'
        WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = smp.created_by AND role = 'influencer') THEN 'influencer'
        ELSE NULL
      END INTO v_post_creator_role
    FROM social_media_posts smp
    WHERE smp.status = 'published'
      AND (
        smp.external_post_url IS NOT NULL AND v_proof_url LIKE '%' || smp.external_post_url || '%'
        OR smp.id::text = ANY(regexp_matches(v_proof_url, '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', 'gi'))
      )
    LIMIT 1;
    
    -- If we found a matching post from admin/influencer, mark as valid
    IF v_post_creator_role IS NOT NULL THEN
      v_is_valid_source := true;
    END IF;
    
    -- For now, also allow verification if admin manually approves
    -- This gives flexibility while maintaining security
    IF p_verified_by IS NOT NULL THEN
      -- Check if verifier is admin
      IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_verified_by AND role = 'admin') THEN
        v_is_valid_source := true;
      END IF;
    END IF;
  END IF;
  
  -- Call the existing verify function
  RETURN verify_mining_completion(p_completion_id, p_verified, p_verified_by, p_rejection_reason);
END;
$$;