# 1145 Influencer Social Media Integration — Build Plan

Custom OAuth per provider. Facebook, Instagram (via Meta Graph), and TikTok fully wired for connect + read + publish. Foundation supports adding YouTube, X, LinkedIn, Pinterest, Snapchat, Threads later without core changes.

## What already exists (reused, not rebuilt)
- `social_accounts`, `social_oauth_tokens`, `social_media_posts`, `social_post_platforms`, `social_post_metrics`, `approved_social_accounts`, `influencer_profiles`.
- Some TikTok/LinkedIn/X OAuth edge functions in prior work.

Gap: no unified lifecycle state machine, no encrypted-at-rest token layer, no publish queue, no webhook dedupe, no admin/influencer connection-health dashboards, no end-to-end validation step, no Meta (FB/IG) OAuth wired.

## Phase 1 — Foundation (single migration + shared helpers)

New tables (RLS: owner + admin):
- `social_connections` — one row per (user, provider, provider_account_id). Fields: `status` (Pending/Authenticating/AwaitingPermissions/Validating/Connected/PermissionMissing/TokenExpired/Disconnected/Revoked/Suspended/Error), `granted_scopes text[]`, `required_scopes text[]`, `missing_scopes text[]`, `account_type`, `username`, `display_name`, `avatar_url`, `token_expires_at`, `last_validation_at`, `last_sync_at`, `metadata jsonb`. Unique `(provider, provider_account_id)` prevents duplicate linking.
- `social_connection_tokens` — encrypted `access_token_ct bytea`, `refresh_token_ct bytea`, `token_type`, `expires_at`. Encrypted with `pgcrypto` using `SOCIAL_TOKEN_ENC_KEY` (server-only, read via `current_setting`). No client access — locked behind SECURITY DEFINER accessors.
- `social_connection_events` — immutable audit trail (`event_type`, `payload jsonb`, `actor`).
- `social_webhook_events` — inbound event dedupe + signature verification results.
- `social_post_queue` — publish jobs (`status`, `attempts`, `next_run_at`, `error`, `provider_response`).

Shared code:
- `supabase/functions/_shared/socialCrypto.ts` — encrypt/decrypt via Deno's `crypto.subtle` (AES-GCM) with `SOCIAL_TOKEN_ENC_KEY`.
- `supabase/functions/_shared/socialLifecycle.ts` — status transitions + `logConnectionEvent`.
- `supabase/functions/_shared/socialProviders/` — one file per provider exporting `{ authUrl, exchangeCode, refresh, verifyOwnership, checkScopes, readProfile, publish, verifyWebhook }`. Meta, Instagram (Graph), TikTok in this phase; stub interfaces for the rest.

## Phase 2 — OAuth start / callback / validation

Edge functions:
- `social-oauth-start` — takes `provider`, generates CSRF `state` + PKCE `code_verifier`, stores in `social_connections` with status `Pending`, returns provider auth URL.
- `social-oauth-callback` — verifies `state`, exchanges code, encrypts and stores tokens, runs the End-to-End Validation Workflow:
  1. token valid
  2. required scopes granted (else `PermissionMissing` + list missing)
  3. ownership matches (compare provider user id to authenticated 1145 user)
  4. read-test: fetch profile (proves API reachable + token works)
  5. publish capability probe (dry run / capability endpoint, no public content)
- Marks `Connected` only if every step passes. Every step writes to `social_connection_events`.
- `social-connection-revalidate` — admin-triggered force revalidation.
- `social-token-refresh` — cron every 15 min, refreshes tokens < 30 min from expiry, flips status on failure.

## Phase 3 — Publish + engagement pipeline

- `social-post-publish` — validates media/caption per provider limits, checks capability, enqueues to `social_post_queue`, publishes via provider API, stores provider post id + timestamp + raw response. Never marks published without provider confirmation.
- `social-post-worker` — cron drains queue with exponential backoff.
- `social-webhook` — one endpoint, dispatches to provider handler, verifies signature + timestamp, dedupes by event id, stores in `social_webhook_events`, updates `social_post_metrics` and comments.

## Phase 4 — Dashboards

- Influencer `/influencer/connections`: connect cards per provider, connection health, granted scopes, token expiry warning, revalidate button, publish history, recent engagement, diagnostics.
- Admin `/admin/social-integrations`: all active connections, health filter, failed auths, granted scopes, force revalidate, revoke, audit log export.

## Secrets required (I'll request when Phase 2 lands)

- `SOCIAL_TOKEN_ENC_KEY` (generated 64-char)
- `META_APP_ID` / `META_APP_SECRET` (Facebook + Instagram share the Meta app)
- `META_WEBHOOK_VERIFY_TOKEN`
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (already partially present — will reuse)

## Out of scope this pass

- YouTube, X, LinkedIn, Pinterest, Snapchat, Threads wiring (framework will accept them; each needs its own developer-portal app + a ~150-line provider file when you're ready).
- Content moderation beyond format/length/hashtag limits.
- Cross-provider analytics rollups (metrics stored per-provider first).

## Technical notes

- Token encryption: AES-GCM in edge functions; DB stores ciphertext only. Even a full DB dump does not leak tokens without `SOCIAL_TOKEN_ENC_KEY`.
- RLS: influencers see only their own `social_connections`; admins see all via `is_admin()`; `social_connection_tokens` has zero client-side read policies — accessed only through SECURITY DEFINER RPCs called by edge functions using service role.
- Duplicate-account guard enforced by unique index + explicit check in callback.
- Every state transition and every provider call writes one row to `social_connection_events` for compliance.

## Delivery order

I'll ship Phase 1 first (one migration + shared modules), then pause for you to confirm before Phase 2 requests the Meta secrets and wires OAuth. Phases 3 and 4 follow the same pattern.
