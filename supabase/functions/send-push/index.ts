// Send a push notification to a user's devices.
//   POST { user_id, title, body, data? }
// Called by the push_user_notification trigger (header x-push-secret) or by
// server code with the service role key.
//
// Android: Firebase Cloud Messaging HTTP v1 (FIREBASE_SERVICE_ACCOUNT = the
//          service-account JSON from Firebase > Project settings).
// iOS:     Apple Push Notification service directly with a token key
//          (APNS_KEY_P8 contents, APNS_KEY_ID, APNS_TEAM_ID; APNS_PRODUCTION
//          "true" for App Store / TestFlight builds).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const BUNDLE_ID = "io.lifestyle1145.app";

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const b64url = (bytes: Uint8Array | string) => {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  for (const b of data) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function signJwt(header: Record<string, unknown>, claims: Record<string, unknown>, key: CryptoKey, alg: AlgorithmIdentifier | EcdsaParams) {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = new Uint8Array(await crypto.subtle.sign(alg, key, new TextEncoder().encode(input)));
  return `${input}.${b64url(sig)}`;
}

// ---------------------------------------------------------------- FCM (Android)
let fcmCache: { token: string; expires: number; projectId: string } | null = null;

async function fcmAccess(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  if (fcmCache && fcmCache.expires > Date.now() + 60_000) return fcmCache;
  const sa = JSON.parse(raw);
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({ alg: "RS256", typ: "JWT" }, {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }, key, { name: "RSASSA-PKCS1-v1_5" });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error(`Google token: ${JSON.stringify(body)}`);
  fcmCache = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000, projectId: sa.project_id };
  return fcmCache;
}

/** true = delivered, false = token is dead, throws = try again later. */
async function sendFcm(token: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const access = await fcmAccess();
  if (!access) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${access.projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: "HIGH", notification: { sound: "default" } },
      },
    }),
  });
  if (res.ok) return true;
  const err = await res.json().catch(() => ({}));
  const code = err?.error?.details?.find((d: any) => d.errorCode)?.errorCode ?? err?.error?.status;
  if (res.status === 404 || code === "UNREGISTERED") return false;
  throw new Error(`FCM ${res.status}: ${JSON.stringify(err)}`);
}

// ---------------------------------------------------------------- APNs (iOS)
let apnsCache: { jwt: string; issued: number } | null = null;

async function apnsJwt(): Promise<string | null> {
  const p8 = Deno.env.get("APNS_KEY_P8"), keyId = Deno.env.get("APNS_KEY_ID"), teamId = Deno.env.get("APNS_TEAM_ID");
  if (!p8 || !keyId || !teamId) return null;
  // Apple accepts a provider token for up to an hour; refresh every 45 min.
  if (apnsCache && Date.now() - apnsCache.issued < 45 * 60_000) return apnsCache.jwt;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(p8), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const jwt = await signJwt({ alg: "ES256", kid: keyId }, { iss: teamId, iat: Math.floor(Date.now() / 1000) }, key,
    { name: "ECDSA", hash: "SHA-256" });
  apnsCache = { jwt, issued: Date.now() };
  return jwt;
}

async function sendApns(token: string, title: string, body: string, data: Record<string, string>): Promise<boolean> {
  const jwt = await apnsJwt();
  if (!jwt) throw new Error("APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID are not set");
  const host = Deno.env.get("APNS_PRODUCTION") === "true" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, ...data }),
  });
  if (res.ok) return true;
  const err = await res.json().catch(() => ({}));
  if (res.status === 410 || ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"].includes(err?.reason)) return false;
  throw new Error(`APNs ${res.status}: ${JSON.stringify(err)}`);
}

// ---------------------------------------------------------------- handler
const DEFAULT_LINKS: Record<string, string> = { ucoin_credit: "/wallet" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const trusted = (secret && req.headers.get("x-push-secret") === secret) || bearer === serviceKey;
  if (!trusted) return respond({ error: "Unauthorized" }, 401);

  const input = await req.json().catch(() => null);
  const userId = input?.user_id;
  const title = String(input?.title ?? "").slice(0, 120);
  const text = String(input?.body ?? "").slice(0, 500);
  if (!userId || !title) return respond({ error: "user_id and title are required" }, 400);

  // Push data values must be strings; "url" is where a tap opens the app.
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(input?.data ?? {})) data[k] = typeof v === "string" ? v : JSON.stringify(v);
  if (!data.url) data.url = DEFAULT_LINKS[data.type] ?? "/dashboard";

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const { data: tokens } = await supabase.from("push_tokens").select("id, token, platform").eq("user_id", userId);

  const result = { sent: 0, removed: 0, failed: 0 };
  for (const t of tokens ?? []) {
    try {
      const ok = t.platform === "ios"
        ? await sendApns(t.token, title, text, data)
        : await sendFcm(t.token, title, text, data);
      if (ok) {
        result.sent++;
      } else {
        await supabase.from("push_tokens").delete().eq("id", t.id); // app uninstalled / token rotated
        result.removed++;
      }
    } catch (e) {
      console.error(`Push to ${t.platform} token ${t.id} failed:`, e);
      result.failed++;
    }
  }
  return respond({ success: true, ...result });
});
