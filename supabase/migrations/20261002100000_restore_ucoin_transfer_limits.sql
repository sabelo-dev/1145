-- Restore the UCoin transfer limits.
--
-- The data reset of 2026-01-20 emptied ucoin_transfer_limits (configuration,
-- not user data) and nothing put the tiers back. With no tier row,
-- get_user_transfer_limits() returns a remaining allowance of 0, so every
-- transfer failed with "Daily transfer limit exceeded. Remaining: 0 UCoin".
-- Same values as the original seed; existing rows are left alone.

INSERT INTO public.ucoin_transfer_limits
  (user_tier, daily_limit_mg, monthly_limit_mg, single_transfer_max_mg, min_transfer_mg, requires_2fa_above_mg)
SELECT t.user_tier, t.daily_limit_mg, t.monthly_limit_mg, t.single_transfer_max_mg, t.min_transfer_mg, t.requires_2fa_above_mg
  FROM (VALUES
    ('standard', 10000, 100000, 5000, 1, 1000),
    ('premium', 50000, 500000, 25000, 1, 5000),
    ('verified', 100000, 1000000, 50000, 1, 10000)
  ) AS t(user_tier, daily_limit_mg, monthly_limit_mg, single_transfer_max_mg, min_transfer_mg, requires_2fa_above_mg)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.ucoin_transfer_limits l WHERE l.user_tier = t.user_tier
 );
