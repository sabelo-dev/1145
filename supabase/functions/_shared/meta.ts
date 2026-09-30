// Shared Meta (Facebook / Instagram) + OAuth helpers for the social functions.

// One version for every Graph call. v18.0 expired in 2026; keep this
// configurable so a Meta deprecation does not require a code change.
export const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v26.0";
export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

// Scopes for Facebook Login, which also covers Instagram professional
// accounts linked to a Page. business_management is needed to see Pages owned
// through a Business portfolio in /me/accounts; the comment scopes feed the
// inbox. Every scope must be approved in the Meta app (App Review) for
// non-tester users — override with META_OAUTH_SCOPES if the app has fewer.
export const META_SCOPES = (Deno.env.get("META_OAUTH_SCOPES") || [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
].join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Instagram API with Instagram Login: the user logs in on instagram.com
// directly (Business/Creator accounts, no Facebook Page needed). It has its own
// app ID/secret under App Dashboard > Instagram > API setup with Instagram login.
export const INSTAGRAM_GRAPH = `https://graph.instagram.com/${META_GRAPH_VERSION}`;
export const INSTAGRAM_OAUTH_URL = "https://www.instagram.com/oauth/authorize";
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
];

export function instagramAppCredentials(): { appId: string; appSecret: string } {
  return {
    appId: Deno.env.get("INSTAGRAM_APP_ID") || "",
    appSecret: Deno.env.get("INSTAGRAM_APP_SECRET") || "",
  };
}

export function metaAppCredentials(): { appId: string; appSecret: string } {
  return {
    appId: Deno.env.get("FACEBOOK_APP_ID") || Deno.env.get("META_APP_ID") || "",
    appSecret: Deno.env.get("FACEBOOK_APP_SECRET") || Deno.env.get("META_APP_SECRET") || "",
  };
}

/* -------------------------------------------------------------------------- */
/* Signed OAuth state                                                         */
/* -------------------------------------------------------------------------- */

// The state round-trips through the provider, so it must be tamper-proof:
// otherwise anyone could forge a state carrying another user's id and attach
// their own social account (or redirect) to that user.

const STATE_TTL_MS = 15 * 60 * 1000;

export interface OAuthState {
  userId: string;
  platform: string;
  appUrl: string;
  /** In-app path to return to after the provider (defaults to Accounts). */
  returnPath?: string;
  /** "instagram" when the user logs in on instagram.com instead of Facebook. */
  via?: "instagram";
  codeVerifier?: string;
  exp?: number;
}

/** Only same-site paths ("/x", never "//host" or absolute URLs). */
export function safeReturnPath(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  return value.slice(0, 300);
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function stateKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SOCIAL_OAUTH_STATE_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("OAuth state secret is not configured");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signState(state: OAuthState): Promise<string> {
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ ...state, exp: Date.now() + STATE_TTL_MS })),
  );
  const sig = await crypto.subtle.sign("HMAC", await stateKey(), new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyState(token: string): Promise<OAuthState> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("invalid_state");
  const ok = await crypto.subtle.verify(
    "HMAC",
    await stateKey(),
    b64urlDecode(sig).buffer as ArrayBuffer,
    new TextEncoder().encode(payload),
  );
  if (!ok) throw new Error("invalid_state");
  const state = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as OAuthState;
  if (!state.userId || !state.platform || !state.exp || state.exp < Date.now()) {
    throw new Error("expired_state");
  }
  return state;
}

/** Only redirect back to our own app (or local dev). */
export function safeAppUrl(value: string | null | undefined): string {
  const fallback = Deno.env.get("SITE_URL") || "https://1145.io";
  if (!value) return fallback;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "1145.io" || host.endsWith(".1145.io") ||
      host === "localhost" || host === "127.0.0.1" ||
      host.endsWith(".app.github.dev") ||
      (Deno.env.get("SITE_URL") && host === new URL(Deno.env.get("SITE_URL")!).hostname);
    if (!allowed) return fallback;
    if (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1") return fallback;
    return `${url.protocol}//${url.host}`;
  } catch {
    return fallback;
  }
}
