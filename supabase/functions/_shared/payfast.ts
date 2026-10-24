// Shared PayFast helpers: config, request signing and ITN validation.
// Credentials come from env only; there are deliberately no fallbacks so a
// misconfigured deployment fails loudly instead of signing with sandbox keys.

export interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  processUrl: string;
  validateUrl: string;
  notifyUrl: string;
}

export function getPayFastConfig(): PayFastConfig | null {
  // Trimmed: a space or newline pasted with a secret breaks every signature.
  const merchantId = (Deno.env.get("PAYFAST_MERCHANT_ID") ?? "").trim();
  const merchantKey = (Deno.env.get("PAYFAST_MERCHANT_KEY") ?? "").trim();
  const passphrase = (Deno.env.get("PAYFAST_PASSPHRASE") ?? "").trim();
  if (!merchantId || !merchantKey || !passphrase) {
    console.error("PayFast is not configured: set PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE");
    return null;
  }
  const sandbox = Deno.env.get("PAYFAST_SANDBOX") === "true";
  const host = sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
  return {
    merchantId,
    merchantKey,
    passphrase,
    sandbox,
    processUrl: `${host}/eng/process`,
    validateUrl: `${host}/eng/query/validate`,
    notifyUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`,
  };
}

async function md5Hash(input: string): Promise<string> {
  const crypto = await import("node:crypto");
  return crypto.createHash("md5").update(input).digest("hex");
}

export function phpUrlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/~/g, "%7E")
    .replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase());
}

function paramString(entries: Array<[string, unknown]>, includeEmpty = false): string {
  return entries
    .filter(([key, value]) =>
      key !== "signature" && value !== null && value !== undefined && (includeEmpty || value !== ""))
    .map(([key, value]) => `${key}=${phpUrlencode(String(value).trim())}`)
    .join("&");
}

/**
 * Signature for the checkout (custom integration) form. PayFast signs the
 * non-blank fields in the order its docs list them (merchant, customer,
 * transaction, options, payment method, recurring) — NOT alphabetically; the
 * alphabetical form is only for the REST API (see cancelPayFastSubscription).
 * Callers build `data` in that documented order.
 */
export async function signPayFast(data: Record<string, unknown>, passphrase: string): Promise<string> {
  return md5Hash(`${paramString(Object.entries(data))}&passphrase=${phpUrlencode(passphrase)}`);
}

/**
 * Validates an ITN: signature (PayFast signs in received order; sorted order is
 * also accepted for compatibility), merchant id, and a server-to-server
 * confirmation with PayFast so a leaked passphrase alone cannot forge payments.
 */
export async function validateItn(
  entries: Array<[string, string]>,
  config: PayFastConfig,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const data = Object.fromEntries(entries);

  if (data.merchant_id !== config.merchantId) {
    return { ok: false, reason: "merchant_id mismatch" };
  }

  const received = String(data.signature ?? "");
  const suffix = `&passphrase=${phpUrlencode(config.passphrase)}`;
  const sortedEntries = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const candidates = await Promise.all([
    md5Hash(paramString(entries, true) + suffix), // PayFast reference implementation
    md5Hash(paramString(entries) + suffix),
    md5Hash(paramString(sortedEntries) + suffix),
  ]);
  if (!received || !candidates.includes(received)) {
    return { ok: false, reason: "invalid signature" };
  }

  try {
    const res = await fetch(config.validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: paramString(entries, true),
    });
    const text = (await res.text()).trim();
    if (text !== "VALID") {
      return { ok: false, reason: `PayFast validation returned "${text}"` };
    }
  } catch (err) {
    return { ok: false, reason: `PayFast validation request failed: ${err}` };
  }

  return { ok: true };
}

/** PayFast amounts are 2dp strings; compare in cents to avoid float noise. */
export function amountsMatch(paid: number, expected: number): boolean {
  return Math.round(paid * 100) === Math.round(expected * 100);
}

/**
 * Cancel a PayFast subscription (recurring billing) by its token.
 * PUT https://api.payfast.co.za/subscriptions/{token}/cancel, signed with an
 * MD5 of the alphabetised headers plus the passphrase.
 */
export async function cancelPayFastSubscription(
  token: string,
  config: PayFastConfig,
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const headers: Record<string, string> = {
    "merchant-id": config.merchantId,
    version: "v1",
    timestamp,
  };
  const signed = { ...headers, passphrase: config.passphrase };
  const signature = await md5Hash(
    Object.keys(signed)
      .sort()
      .map((key) => `${key}=${phpUrlencode(signed[key as keyof typeof signed])}`)
      .join("&"),
  );

  const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/cancel${config.sandbox ? "?testing=true" : ""}`;
  try {
    const res = await fetch(url, { method: "PUT", headers: { ...headers, signature } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.response === false) {
      return { ok: false, error: body?.data?.message || body?.message || `PayFast returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type TokenChargeResult =
  | { outcome: "succeeded"; reference: string | null }
  | { outcome: "failed"; error: string }
  | { outcome: "unknown"; error: string };

/**
 * Charges a saved card (a tokenization token, subscription_type 2) once:
 * POST https://api.payfast.co.za/subscriptions/{token}/adhoc with a JSON body.
 * As in PayFast's PHP SDK, the signature is the MD5 of the merchant-id,
 * version and timestamp headers plus every body field and the passphrase,
 * sorted by name and URL-encoded; the testing flag is a query parameter and
 * is not signed. The amount is in cents.
 *
 * "unknown" means PayFast gave no clear answer (timeout, network error, 5xx):
 * the card may or may not have been charged, so callers must not retry
 * automatically.
 */
export async function chargePayFastToken(
  token: string,
  amountCents: number,
  itemName: string,
  config: PayFastConfig,
): Promise<TokenChargeResult> {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const headers: Record<string, string> = { "merchant-id": config.merchantId, version: "v1", timestamp };
  const body: Record<string, string | number> = { amount: amountCents, item_name: itemName.slice(0, 100) };
  const signed: Record<string, string> = { ...headers, passphrase: config.passphrase };
  for (const [key, value] of Object.entries(body)) signed[key] = String(value);
  const signature = await md5Hash(
    Object.keys(signed).sort().map((key) => `${key}=${phpUrlencode(signed[key])}`).join("&"),
  );

  const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(token)}/adhoc${config.sandbox ? "?testing=true" : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, signature, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }

    if (res.status >= 500 || !parsed) {
      return { outcome: "unknown", error: `PayFast returned ${res.status}` };
    }
    if (res.ok && parsed.status === "success") {
      const data = parsed.data ?? {};
      const reference = data.pf_payment_id ?? data.response?.pf_payment_id ?? null;
      // Some responses carry the result in data.response (true / false).
      if (data.response === false) {
        return { outcome: "failed", error: String(data.message ?? "The card was declined") };
      }
      return { outcome: "succeeded", reference: reference ? String(reference) : null };
    }
    return { outcome: "failed", error: String(parsed.data?.message ?? parsed.message ?? "The card was declined") };
  } catch (e) {
    return { outcome: "unknown", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Origins of the iOS / Android app's web view (Capacitor). */
const NATIVE_APP_ORIGINS = ["https://localhost", "capacitor://localhost"];

/**
 * PayFast return / cancel address for a path in the app. Requests from the
 * native apps come from localhost, which the user's browser cannot reach:
 * send them to 1145.io/app-return, which reopens the app on that path.
 */
export function payfastReturnUrl(origin: string | null | undefined, path: string): string {
  const site = (Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/$/, "");
  if (!origin || NATIVE_APP_ORIGINS.includes(origin)) {
    return origin ? `${site}/app-return?to=${encodeURIComponent(path)}` : `${site}${path}`;
  }
  return `${origin.replace(/\/$/, "")}${path}`;
}

/** Origins PayFast may send the payer back to; anything else goes to SITE_URL. */
export function allowedReturnOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  const site = (Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/$/, "");
  const allowed = new Set([
    site,
    "https://1145.io",
    "https://www.1145.io",
    ...NATIVE_APP_ORIGINS,
    ...(Deno.env.get("PAYMENT_RETURN_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean),
  ]);
  return allowed.has(origin) ? origin : null;
}

/**
 * A return / cancel URL sent by the client, kept only if it points at an
 * allowed origin. Otherwise its path is moved onto SITE_URL, so an unlisted
 * host still lands the payer on the right page and the URL cannot be used as
 * an open redirect.
 */
export function safeReturnUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (allowedReturnOrigin(url.origin)) return url.toString();
  const site = (Deno.env.get("SITE_URL") || "https://1145.io").replace(/\/$/, "");
  return `${site}${url.pathname}${url.search}`;
}
