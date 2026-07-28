-- =====================================================================
-- INFLUENCER SOCIAL MEDIA INTEGRATION — PHASE 1 FOUNDATION
-- =====================================================================

-- ---------- social_connections ----------
CREATE TABLE public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text,
  username text,
  display_name text,
  avatar_url text,
  account_type text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending','authenticating','awaiting_permissions','validating',
      'connected','permission_missing','token_expired',
      'disconnected','revoked','suspended','error'
    )),
  granted_scopes text[] NOT NULL DEFAULT '{}',
  required_scopes text[] NOT NULL DEFAULT '{}',
  missing_scopes text[] NOT NULL DEFAULT '{}',
  token_expires_at timestamptz,
  last_validation_at timestamptz,
  last_sync_at timestamptz,
  oauth_state text,
  oauth_code_verifier text,
  oauth_state_expires_at timestamptz,
  oauth_redirect_uri text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent the same platform account from being linked twice while active.
CREATE UNIQUE INDEX social_connections_provider_account_unique
  ON public.social_connections (provider, provider_account_id)
  WHERE provider_account_id IS NOT NULL
    AND status NOT IN ('disconnected','revoked','error');

CREATE INDEX social_connections_user_provider_idx
  ON public.social_connections (user_id, provider);
CREATE INDEX social_connections_status_idx
  ON public.social_connections (status);
CREATE INDEX social_connections_oauth_state_idx
  ON public.social_connections (oauth_state)
  WHERE oauth_state IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
GRANT ALL ON public.social_connections TO service_role;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_connections_owner_select"
  ON public.social_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "social_connections_owner_insert"
  ON public.social_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "social_connections_owner_update"
  ON public.social_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "social_connections_owner_delete"
  ON public.social_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TRIGGER social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- social_connection_tokens ----------
-- Ciphertext only. Never readable from client code. Even the connection
-- owner cannot read tokens — they are used exclusively by backend code.
CREATE TABLE public.social_connection_tokens (
  connection_id uuid PRIMARY KEY REFERENCES public.social_connections(id) ON DELETE CASCADE,
  access_token_ct  bytea NOT NULL,
  access_token_iv  bytea NOT NULL,
  refresh_token_ct bytea,
  refresh_token_iv bytea,
  token_type text DEFAULT 'bearer',
  scope text,
  expires_at timestamptz,
  key_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon / authenticated. Service role only.
GRANT ALL ON public.social_connection_tokens TO service_role;

ALTER TABLE public.social_connection_tokens ENABLE ROW LEVEL SECURITY;

-- Explicit deny: no policies for anon/authenticated. Only service_role can read/write.
CREATE POLICY "social_connection_tokens_service_only"
  ON public.social_connection_tokens FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER social_connection_tokens_updated_at
  BEFORE UPDATE ON public.social_connection_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- social_connection_events (immutable audit log) ----------
CREATE TABLE public.social_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  user_id uuid,
  provider text,
  event_type text NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_connection_events_connection_idx
  ON public.social_connection_events (connection_id, created_at DESC);
CREATE INDEX social_connection_events_user_idx
  ON public.social_connection_events (user_id, created_at DESC);
CREATE INDEX social_connection_events_type_idx
  ON public.social_connection_events (event_type, created_at DESC);

GRANT SELECT ON public.social_connection_events TO authenticated;
GRANT ALL ON public.social_connection_events TO service_role;

ALTER TABLE public.social_connection_events ENABLE ROW LEVEL SECURITY;

-- Read only for owner or admin. No client-side inserts or updates
-- (edge functions write via service_role, which bypasses RLS).
CREATE POLICY "social_connection_events_owner_read"
  ON public.social_connection_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ---------- social_webhook_events (inbound events + dedupe) ----------
CREATE TABLE public.social_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text,
  event_type text,
  connection_id uuid REFERENCES public.social_connections(id) ON DELETE SET NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE UNIQUE INDEX social_webhook_events_dedupe_idx
  ON public.social_webhook_events (provider, event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX social_webhook_events_provider_received_idx
  ON public.social_webhook_events (provider, received_at DESC);
CREATE INDEX social_webhook_events_unprocessed_idx
  ON public.social_webhook_events (processed, received_at)
  WHERE processed = false;

GRANT ALL ON public.social_webhook_events TO service_role;
-- Admins may read for diagnostics; owners see nothing directly here.
GRANT SELECT ON public.social_webhook_events TO authenticated;

ALTER TABLE public.social_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_webhook_events_admin_read"
  ON public.social_webhook_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------- social_post_queue (outbound publish jobs) ----------
CREATE TABLE public.social_post_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.social_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  post_ref_id uuid, -- optional link to social_media_posts / draft record
  content jsonb NOT NULL DEFAULT '{}'::jsonb, -- caption, media_urls, hashtags, etc.
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','validating','publishing','published','failed','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz,
  provider_post_id text,
  provider_response jsonb,
  error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX social_post_queue_user_idx
  ON public.social_post_queue (user_id, created_at DESC);
CREATE INDEX social_post_queue_worker_idx
  ON public.social_post_queue (status, next_run_at)
  WHERE status IN ('queued','validating','publishing');

GRANT SELECT, INSERT ON public.social_post_queue TO authenticated;
GRANT ALL ON public.social_post_queue TO service_role;

ALTER TABLE public.social_post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_post_queue_owner_read"
  ON public.social_post_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "social_post_queue_owner_insert"
  ON public.social_post_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.social_connections sc
      WHERE sc.id = connection_id
        AND sc.user_id = auth.uid()
        AND sc.status = 'connected'
    )
  );

CREATE TRIGGER social_post_queue_updated_at
  BEFORE UPDATE ON public.social_post_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();