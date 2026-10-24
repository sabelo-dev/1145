// Signature check for Svix / Standard Webhooks requests: HMAC-SHA256 of
// "{id}.{timestamp}.{body}" with the base64 secret after "whsec_".
// Resend sends svix-* headers; Supabase Auth hooks send webhook-* headers.

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns null when the request is authentic, otherwise the reason it was rejected. */
export async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  body: string,
  prefix: "svix" | "webhook",
): Promise<string | null> {
  const id = headers.get(`${prefix}-id`);
  const timestamp = headers.get(`${prefix}-timestamp`);
  const signatures = headers.get(`${prefix}-signature`);
  if (!id || !timestamp || !signatures) return "missing signature headers";

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return "stale timestamp";

  // Supabase shows hook secrets as "v1,whsec_<base64>"; Resend as "whsec_<base64>".
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^v1,/, "").replace(/^whsec_/, "")).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header holds space-separated "v1,<base64>" entries (several during key rotation).
  const match = signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && sig !== undefined && sameString(sig, expected);
  });
  return match ? null : "signature mismatch";
}
