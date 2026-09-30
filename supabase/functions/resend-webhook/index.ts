// Resend webhook: stores inbound mail for @1145.io in inbound_emails (the
// admin Email Inbox) and logs delivery events.
//
// Resend's email.received webhook carries only metadata ("Webhooks do not
// include the email body, headers, or attachments"), so the full message is
// fetched from GET https://api.resend.com/emails/receiving/{email_id}.
//
// Requests are verified with the webhook's signing secret (Svix scheme) when
// RESEND_WEBHOOK_SECRET is set — set it, or anyone could post fake emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

const ACCEPTED_DOMAINS = ["1145.io"];
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<Record<string, unknown>>;
    sender?: string;
    recipients?: string[];
    [key: string]: unknown;
  };
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Svix signature check: HMAC-SHA256 of "{id}.{timestamp}.{body}". */
async function verifySignature(secret: string, headers: Headers, body: string): Promise<string | null> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return "missing signature headers";

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return "stale timestamp";

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Header holds space-separated "v1,<base64>" entries (several during key rotation).
  const match = signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && sig === expected;
  });
  return match ? null : "signature mismatch";
}

/** Full message (body, headers, attachment list) for a received email. */
async function fetchReceivedEmail(emailId: string): Promise<Record<string, any> | null> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set; storing the email without its body.");
    return null;
  }
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error(`Resend receiving API returned ${res.status}:`, await res.text().catch(() => ""));
    return null;
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const body = await req.text();

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (secret) {
    const problem = await verifySignature(secret, req.headers, body);
    if (problem) {
      console.error("Rejected webhook:", problem);
      return respond({ error: "Invalid signature" }, 401);
    }
  } else {
    console.warn("RESEND_WEBHOOK_SECRET is not set; webhook requests are not verified.");
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  if (event.type !== "email.received") {
    console.log(`Resend event ${event.type}:`, event.data?.email_id ?? "");
    return respond({ success: true, type: event.type });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const meta = event.data ?? {};
  const emailId = meta.email_id ?? null;

  // Resend retries deliveries; store each email once.
  if (emailId) {
    const { data: existing } = await supabase
      .from("inbound_emails")
      .select("id")
      .eq("raw_payload->>email_id", emailId)
      .limit(1)
      .maybeSingle();
    if (existing) return respond({ success: true, duplicate: true });
  }

  const full = emailId ? await fetchReceivedEmail(emailId) : null;

  const recipients: string[] = (full?.to ?? meta.to ?? meta.recipients ?? []) as string[];
  if (!recipients.some((r) => ACCEPTED_DOMAINS.some((d) => r.toLowerCase().endsWith(`@${d}`)))) {
    console.log(`Ignoring email not addressed to ${ACCEPTED_DOMAINS.join(", ")}: ${recipients.join(", ")}`);
    return respond({ success: true, ignored: "wrong domain" });
  }

  const attachments = (full?.attachments ?? meta.attachments ?? []) as unknown[];
  const { data: inserted, error } = await supabase
    .from("inbound_emails")
    .insert({
      from_address: full?.from ?? meta.from ?? meta.sender ?? "unknown",
      to_addresses: recipients,
      subject: full?.subject ?? meta.subject ?? "(No Subject)",
      body_text: full?.text ?? meta.text ?? null,
      body_html: full?.html ?? meta.html ?? null,
      has_attachments: attachments.length > 0,
      attachment_count: attachments.length,
      raw_payload: { ...meta, email_id: emailId, headers: full?.headers ?? null },
      received_at: full?.created_at ?? event.created_at,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error storing inbound email:", error);
    // 500 so Resend retries later.
    return respond({ error: "Could not store email" }, 500);
  }

  console.log(`Stored inbound email ${inserted?.id} (${emailId})`);
  return respond({ success: true, id: inserted?.id });
});
