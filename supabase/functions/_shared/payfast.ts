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
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") ?? "";
  const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") ?? "";
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
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

/** Signature for an outgoing payment form (keys sorted, as all callers already use). */
export async function signPayFast(data: Record<string, unknown>, passphrase: string): Promise<string> {
  const sorted = Object.keys(data).sort().map((key) => [key, data[key]] as [string, unknown]);
  return md5Hash(`${paramString(sorted)}&passphrase=${phpUrlencode(passphrase)}`);
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
