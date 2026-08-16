// Connection lifecycle helpers + immutable event logging.
// All state transitions in the social integration flow through here so the
// audit trail in social_connection_events stays complete.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type ConnectionStatus =
  | "pending"
  | "authenticating"
  | "awaiting_permissions"
  | "validating"
  | "connected"
  | "permission_missing"
  | "token_expired"
  | "disconnected"
  | "revoked"
  | "suspended"
  | "error";

export type ConnectionEventType =
  | "authentication_started"
  | "authentication_completed"
  | "authentication_failed"
  | "permission_granted"
  | "permission_missing"
  | "permission_revoked"
  | "ownership_verified"
  | "ownership_mismatch"
  | "read_test_passed"
  | "read_test_failed"
  | "publish_capability_confirmed"
  | "publish_capability_missing"
  | "token_refreshed"
  | "token_refresh_failed"
  | "connection_activated"
  | "connection_revalidated"
  | "connection_revoked"
  | "connection_removed"
  | "post_queued"
  | "post_published"
  | "post_failed"
  | "webhook_received"
  | "webhook_rejected"
  | "analytics_updated";

export interface ServiceClientOptions {
  url?: string;
  serviceRoleKey?: string;
}

export function serviceClient(opts: ServiceClientOptions = {}): SupabaseClient {
  const url = opts.url ?? Deno.env.get("SUPABASE_URL");
  const key = opts.serviceRoleKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface LogEventInput {
  connectionId: string | null;
  userId?: string | null;
  provider?: string | null;
  eventType: ConnectionEventType | string;
  actor?: string;
  payload?: Record<string, unknown>;
}

export async function logConnectionEvent(
  client: SupabaseClient,
  input: LogEventInput,
): Promise<void> {
  const { error } = await client.from("social_connection_events").insert({
    connection_id: input.connectionId,
    user_id: input.userId ?? null,
    provider: input.provider ?? null,
    event_type: input.eventType,
    actor: input.actor ?? "system",
    payload: input.payload ?? {},
  });
  if (error) {
    // Never let audit logging break the caller — surface as console warning.
    console.error("logConnectionEvent failed:", error);
  }
}

export interface UpdateConnectionInput {
  status?: ConnectionStatus;
  granted_scopes?: string[];
  missing_scopes?: string[];
  provider_account_id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  account_type?: string;
  token_expires_at?: string | null;
  last_validation_at?: string | null;
  last_sync_at?: string | null;
  metadata?: Record<string, unknown>;
  error_message?: string | null;
  oauth_state?: string | null;
  oauth_code_verifier?: string | null;
  oauth_state_expires_at?: string | null;
  oauth_redirect_uri?: string | null;
}

export async function updateConnection(
  client: SupabaseClient,
  connectionId: string,
  patch: UpdateConnectionInput,
): Promise<void> {
  const { error } = await client
    .from("social_connections")
    .update(patch)
    .eq("id", connectionId);
  if (error) throw new Error(`updateConnection failed: ${error.message}`);
}

/** Legal transitions — enforced in code, not in the DB check constraint. */
const TRANSITIONS: Record<ConnectionStatus, ConnectionStatus[]> = {
  pending:               ["authenticating", "error", "disconnected"],
  authenticating:        ["awaiting_permissions", "validating", "error", "disconnected"],
  awaiting_permissions:  ["validating", "permission_missing", "error", "disconnected"],
  validating:            ["connected", "permission_missing", "error", "disconnected"],
  connected:             ["token_expired", "permission_missing", "revoked", "suspended", "disconnected", "validating", "error"],
  permission_missing:    ["validating", "authenticating", "disconnected", "error"],
  token_expired:         ["validating", "authenticating", "connected", "disconnected", "error"],
  suspended:             ["validating", "disconnected", "error"],
  revoked:               ["authenticating", "disconnected"],
  disconnected:          ["authenticating"],
  error:                 ["authenticating", "validating", "disconnected"],
};

export function canTransition(from: ConnectionStatus, to: ConnectionStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}
