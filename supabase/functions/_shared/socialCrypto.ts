// AES-GCM encryption for social OAuth tokens.
// The key comes from the SOCIAL_TOKEN_ENC_KEY edge-function secret and never
// leaves the server. The database only ever sees ciphertext + IV, so a full
// DB dump does not leak provider tokens.

const KEY_ENV = "SOCIAL_TOKEN_ENC_KEY";

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = Deno.env.get(KEY_ENV);
  if (!raw) {
    throw new Error(
      `${KEY_ENV} is not configured. Generate a 64-char secret and add it via the secrets tool.`,
    );
  }
  // Accept either hex, base64, or plain text — normalise to 32 bytes via SHA-256.
  const material = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", material);
  cachedKey = await crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return cachedKey;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < view.byteLength; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface EncryptedField {
  /** base64 ciphertext, ready to send to Postgres as `decode(..., 'base64')` for bytea. */
  ciphertext: string;
  /** base64 12-byte IV. */
  iv: string;
}

export async function encryptToken(plaintext: string): Promise<EncryptedField> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: toBase64(buf), iv: toBase64(iv) };
}

export async function decryptToken(field: EncryptedField): Promise<string> {
  const key = await getKey();
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(field.iv) },
    key,
    fromBase64(field.ciphertext),
  );
  return new TextDecoder().decode(buf);
}

/**
 * Convert a Supabase bytea response (usually a `\x…` hex string or a base64
 * string, depending on client version) into an EncryptedField.
 */
export function normaliseByteaToBase64(value: unknown): string {
  if (value == null) throw new Error("token bytea is null");
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      // hex -> bytes -> base64
      const hex = value.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return toBase64(bytes);
    }
    // already base64
    return value;
  }
  throw new Error("Unsupported bytea representation");
}

/** Generates a cryptographically random URL-safe string (for OAuth state / PKCE verifier). */
export function randomUrlSafe(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** PKCE S256 code challenge from a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64(digest)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
