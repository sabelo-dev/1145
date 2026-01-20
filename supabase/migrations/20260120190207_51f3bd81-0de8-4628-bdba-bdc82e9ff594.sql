-- Fix signup 500 caused by orphaned auth rows left after manual deletion
-- Clean up any auth.* records referencing non-existent users.

BEGIN;

-- Orphan identities (primary cause of "unable to find user from email identity")
DELETE FROM auth.identities i
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = i.user_id
);

-- Orphan sessions
DELETE FROM auth.sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = s.user_id
);

-- Orphan refresh tokens (user_id is varchar)
DELETE FROM auth.refresh_tokens rt
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id::text = rt.user_id
);

-- Orphan one-time tokens
DELETE FROM auth.one_time_tokens ott
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = ott.user_id
);

-- Orphan MFA factors
DELETE FROM auth.mfa_factors f
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = f.user_id
);

-- Orphan MFA challenges (linked to factors)
DELETE FROM auth.mfa_challenges c
WHERE NOT EXISTS (
  SELECT 1 FROM auth.mfa_factors f WHERE f.id = c.factor_id
);

-- Orphan AMR claims (linked to sessions)
DELETE FROM auth.mfa_amr_claims a
WHERE NOT EXISTS (
  SELECT 1 FROM auth.sessions s WHERE s.id = a.session_id
);

COMMIT;