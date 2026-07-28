// Scheduled + on-demand token refresh & revalidation.
//
// Modes:
//  - Cron/no-body: scan connections whose token expires within 24h OR whose
//    last_validation_at is older than 12h, and try to refresh / revalidate.
//  - { connectionId, force?: true } : revalidate a single connection.
//  - { connectionId, action: "revoke" | "disconnect", reason? } : admin/user
//    initiated teardown that wipes tokens and marks the connection.
//
// On any refresh or read-profile failure, the connection is moved to
// `token_expired` / `revoked` / `error` and a user notification is written
// to public.user_notifications so the influencer knows to reconnect.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  logConnectionEvent,
  updateConnection,
  serviceClient,
} from "../_shared/socialLifecycle.ts";
import { getProvider } from "../_shared/socialProviders/index.ts";
import { decryptToken, encryptToken, normaliseByteaToBase64 } from "../_shared/socialCrypto.ts";

const REFRESH_WINDOW_SECONDS = 24 * 60 * 60; // 24h
const REVALIDATION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

interface Body {
  connectionId?: string;
  force?: boolean;
  action?: "revoke" | "disconnect";
  reason?: string;
}

async function notify(client: ReturnType<typeof createClient>, userId: string, title: string, message: string) {
  await client.from("user_notifications").insert({
    user_id: userId,
    title,
    message,
    type: "social_connection",
  }).then(({ error }) => {
    if (error) console.warn("notify failed:", error.message);
  });
}

async function loadTokens(client: ReturnType<typeof createClient>, connectionId: string) {
  const { data, error } = await client
    .from("social_connection_tokens")
    .select("access_token_ct, access_token_iv, refresh_token_ct, refresh_token_iv, expires_at, scope, key_version")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw new Error(`loadTokens: ${error.message}`);
  return data;
}

function b64ToHex(b64: string): string {
  const bin = atob(b64);
  let out = "\\x";
  for (let i = 0; i < bin.length; i++) out += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return out;
}

async function saveTokens(
  client: ReturnType<typeof createClient>,
  connectionId: string,
  bundle: { accessToken: string; refreshToken?: string; expiresIn?: number; scope?: string; tokenType?: string },
) {
  const access = await encryptToken(bundle.accessToken);
  const refresh = bundle.refreshToken ? await encryptToken(bundle.refreshToken) : null;
  const expiresAt = bundle.expiresIn ? new Date(Date.now() + bundle.expiresIn * 1000).toISOString() : null;
  const { error } = await client.from("social_connection_tokens").upsert(
    {
      connection_id: connectionId,
      access_token_ct: b64ToHex(access.ciphertext),
      access_token_iv: b64ToHex(access.iv),
      refresh_token_ct: refresh ? b64ToHex(refresh.ciphertext) : null,
      refresh_token_iv: refresh ? b64ToHex(refresh.iv) : null,
      expires_at: expiresAt,
      scope: bundle.scope ?? null,
      token_type: bundle.tokenType ?? null,
      key_version: 1,
    },
    { onConflict: "connection_id" },
  );
  if (error) throw new Error(`saveTokens: ${error.message}`);
  return expiresAt;
}

async function revalidateOne(client: ReturnType<typeof createClient>, connectionId: string) {
  const { data: conn, error } = await client
    .from("social_connections")
    .select("id, user_id, provider, status, required_scopes, granted_scopes")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !conn) throw new Error(`connection not found: ${connectionId}`);

  const provider = getProvider(conn.provider);
  let tokens = await loadTokens(client, connectionId);
  if (!tokens) {
    await updateConnection(client, connectionId, { status: "revoked", error_message: "No token record" });
    await logConnectionEvent(client, { connectionId, userId: conn.user_id, provider: conn.provider, eventType: "connection_revoked", actor: "system", payload: { reason: "missing_tokens" } });
    await notify(client, conn.user_id, "Reconnect required", `Your ${conn.provider} connection is missing tokens and has been marked revoked.`);
    return { ok: false, reason: "missing_tokens" };
  }

  let accessToken = await decryptToken({
    ciphertext: normaliseByteaToBase64(tokens.access_token_ct),
    iv: normaliseByteaToBase64(tokens.access_token_iv),
  });

  const expiring = tokens.expires_at && new Date(tokens.expires_at).getTime() - Date.now() < REFRESH_WINDOW_SECONDS * 1000;
  if (expiring && tokens.refresh_token_ct && provider.refresh) {
    try {
      const refreshToken = await decryptToken({
        ciphertext: normaliseByteaToBase64(tokens.refresh_token_ct),
        iv: normaliseByteaToBase64(tokens.refresh_token_iv),
      });
      const bundle = await provider.refresh(refreshToken);
      await saveTokens(client, connectionId, bundle);
      accessToken = bundle.accessToken;
      await logConnectionEvent(client, { connectionId, userId: conn.user_id, provider: conn.provider, eventType: "token_refreshed", actor: "system" });
    } catch (e) {
      const msg = (e as Error).message;
      await updateConnection(client, connectionId, { status: "token_expired", error_message: `Refresh failed: ${msg}` });
      await logConnectionEvent(client, { connectionId, userId: conn.user_id, provider: conn.provider, eventType: "token_refresh_failed", actor: "system", payload: { message: msg } });
      await notify(client, conn.user_id, "Reconnect required", `Your ${conn.provider} token could not be refreshed. Please reconnect.`);
      return { ok: false, reason: "refresh_failed" };
    }
  }

  // Read-profile probe = authoritative liveness check.
  try {
    const profile = await provider.readProfile(accessToken);
    await updateConnection(client, connectionId, {
      status: "connected",
      last_validation_at: new Date().toISOString(),
      error_message: null,
      provider_account_id: profile.providerAccountId,
      username: profile.username ?? null,
      display_name: profile.displayName ?? null,
      avatar_url: profile.avatarUrl ?? null,
      account_type: profile.accountType ?? null,
    });
    await logConnectionEvent(client, { connectionId, userId: conn.user_id, provider: conn.provider, eventType: "connection_revalidated", actor: "system" });
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    const revoked = /401|403|invalid_token|revoked|unauthor/i.test(msg);
    await updateConnection(client, connectionId, {
      status: revoked ? "revoked" : "error",
      error_message: msg,
    });
    await logConnectionEvent(client, { connectionId, userId: conn.user_id, provider: conn.provider, eventType: revoked ? "connection_revoked" : "read_test_failed", actor: "system", payload: { message: msg } });
    await notify(client, conn.user_id, "Reconnect required", `Your ${conn.provider} connection is no longer active (${revoked ? "revoked" : "error"}). Please reconnect.`);
    return { ok: false, reason: revoked ? "revoked" : "error" };
  }
}

async function teardown(client: ReturnType<typeof createClient>, connectionId: string, action: "revoke" | "disconnect", reason?: string, actor = "admin") {
  const { data: conn } = await client.from("social_connections").select("id, user_id, provider").eq("id", connectionId).maybeSingle();
  if (!conn) throw new Error("connection not found");
  await client.from("social_connection_tokens").delete().eq("connection_id", connectionId);
  await updateConnection(client, connectionId, {
    status: action === "revoke" ? "revoked" : "disconnected",
    error_message: reason ?? null,
    token_expires_at: null,
  });
  await logConnectionEvent(client, {
    connectionId,
    userId: conn.user_id,
    provider: conn.provider,
    eventType: action === "revoke" ? "connection_revoked" : "connection_removed",
    actor,
    payload: { reason: reason ?? null },
  });
  await notify(client, conn.user_id, action === "revoke" ? "Connection revoked" : "Connection disconnected", `Your ${conn.provider} connection was ${action === "revoke" ? "revoked by an administrator" : "disconnected"}. Reconnect to resume posting.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const client = serviceClient();
    const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (body.connectionId && body.action) {
      await teardown(client, body.connectionId, body.action, body.reason);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.connectionId) {
      const result = await revalidateOne(client, body.connectionId);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Scheduled sweep.
    const expiryCut = new Date(Date.now() + REFRESH_WINDOW_SECONDS * 1000).toISOString();
    const staleCut = new Date(Date.now() - REVALIDATION_MAX_AGE_MS).toISOString();

    const { data: due } = await client
      .from("social_connections")
      .select("id, token_expires_at, last_validation_at, status")
      .in("status", ["connected", "token_expired", "permission_missing", "error", "suspended"])
      .or(`token_expires_at.lte.${expiryCut},last_validation_at.lte.${staleCut},last_validation_at.is.null`)
      .limit(200);

    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
    for (const row of due ?? []) {
      try {
        const r = await revalidateOne(client, row.id);
        results.push({ id: row.id, ...r });
      } catch (e) {
        results.push({ id: row.id, ok: false, reason: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("social-token-refresh error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
