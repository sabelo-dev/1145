-- Rewire award_ucoin to emit into the mining pipeline instead of crediting directly.
-- All existing callers (order/review/delivery triggers, badge awards, social mining,
-- referral bonuses) will now create pending mining_requests that are validated and
-- credited asynchronously by the ucoin-mining worker.

CREATE OR REPLACE FUNCTION public.award_ucoin(
  p_user_id UUID,
  p_category TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_code TEXT;
  v_idem TEXT;
  v_request_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Map legacy award categories to Proof-of-Action activity codes.
  v_activity_code := CASE p_category
    WHEN 'order_completed'         THEN 'purchase'
    WHEN 'review_submitted'        THEN 'review'
    WHEN 'delivery_completed'      THEN 'delivery'
    WHEN 'ontime_delivery'         THEN 'delivery'
    WHEN 'social_mining'           THEN 'social_share'
    WHEN 'referral_mining_bonus'   THEN 'referral'
    WHEN 'referral'                THEN 'referral'
    WHEN 'daily_login'             THEN 'daily_login'
    WHEN 'kyc_complete'            THEN 'kyc_complete'
    WHEN 'video_watch'             THEN 'video_watch'
    WHEN 'badge_earned'            THEN NULL  -- badges are not part of PoA yet
    ELSE p_category                            -- pass-through: matches if a same-named activity exists
  END;

  IF v_activity_code IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Ensure the activity exists and is active; otherwise no-op quietly so triggers don't fail.
  IF NOT EXISTS (
    SELECT 1 FROM public.mining_activities
    WHERE code = v_activity_code AND is_active = true
  ) THEN
    RETURN FALSE;
  END IF;

  v_idem := 'award_ucoin:' || v_activity_code
    || ':' || COALESCE(p_reference_type, 'none')
    || ':' || COALESCE(p_reference_id::text, 'none')
    || ':' || p_user_id::text
    -- distinguish ontime bonus from base delivery on same reference
    || CASE WHEN p_category = 'ontime_delivery' THEN ':ontime' ELSE '' END;

  BEGIN
    v_request_id := public.mining_emit_action(
      p_user_id        => p_user_id,
      p_activity_code  => v_activity_code,
      p_idempotency_key=> v_idem,
      p_evidence       => jsonb_build_object(
                            'legacy_category', p_category,
                            'source', 'award_ucoin'
                          ),
      p_reference_type => p_reference_type,
      p_reference_id   => p_reference_id::text,
      p_metadata       => jsonb_build_object('legacy_category', p_category)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a mining emission failure break the originating write.
    RAISE WARNING 'award_ucoin -> mining_emit_action failed for user % category %: %',
      p_user_id, p_category, SQLERRM;
    RETURN FALSE;
  END;

  RETURN v_request_id IS NOT NULL;
END;
$$;

-- Keep prior lockdown: no direct execute from clients; triggers run as definer.
REVOKE ALL ON FUNCTION public.award_ucoin(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_ucoin(UUID, TEXT, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_ucoin(UUID, TEXT, UUID, TEXT) TO service_role;