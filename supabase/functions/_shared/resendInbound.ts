// Shared by resend-webhook (live) and resend-inbox-sync (backfill): fetch a
// received email from Resend and store it in inbound_emails once.
// deno-lint-ignore-file no-explicit-any

export const ACCEPTED_DOMAINS = ["1145.io"];

const RESEND_API = "https://api.resend.com";

function apiKey(): string | null {
  return Deno.env.get("RESEND_API_KEY") ?? null;
}

/** Full message (body, headers, attachment list) for a received email. */
export async function fetchReceivedEmail(emailId: string): Promise<Record<string, any> | null> {
  const key = apiKey();
  if (!key) {
    console.error("RESEND_API_KEY is not set; cannot read email bodies.");
    return null;
  }
  const res = await fetch(`${RESEND_API}/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`Resend receiving API returned ${res.status}:`, await res.text().catch(() => ""));
    return null;
  }
  return await res.json();
}

/** One page of received emails, newest first. */
export async function listReceivedEmails(after?: string): Promise<{ data: Record<string, any>[]; has_more: boolean }> {
  const key = apiKey();
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const params = new URLSearchParams({ limit: "100" });
  if (after) params.set("after", after);
  const res = await fetch(`${RESEND_API}/emails/receiving?${params.toString()}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `Resend returned ${res.status}`);
  return { data: Array.isArray(body?.data) ? body.data : [], has_more: !!body?.has_more };
}

export const isForOurDomain = (recipients: string[]) =>
  recipients.some((r) => ACCEPTED_DOMAINS.some((d) => String(r).toLowerCase().endsWith(`@${d}`)));

export async function isStored(supabase: any, emailId: string): Promise<boolean> {
  const { data } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("raw_payload->>email_id", emailId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Store a received email (metadata from the webhook or the list API; the
 * body is fetched). Returns "stored", "duplicate", "ignored" or throws.
 */
export async function storeReceivedEmail(
  supabase: any,
  meta: Record<string, any>,
  receivedAt?: string,
): Promise<"stored" | "duplicate" | "ignored"> {
  const emailId: string | null = meta.email_id ?? meta.id ?? null;
  if (emailId && (await isStored(supabase, emailId))) return "duplicate";

  const full = emailId ? await fetchReceivedEmail(emailId) : null;
  const recipients: string[] = (full?.to ?? meta.to ?? meta.recipients ?? []) as string[];
  if (!isForOurDomain(recipients)) return "ignored";

  const attachments = (full?.attachments ?? meta.attachments ?? []) as unknown[];
  const { error } = await supabase.from("inbound_emails").insert({
    from_address: full?.from ?? meta.from ?? meta.sender ?? "unknown",
    to_addresses: recipients,
    subject: full?.subject ?? meta.subject ?? "(No Subject)",
    body_text: full?.text ?? meta.text ?? null,
    body_html: full?.html ?? meta.html ?? null,
    has_attachments: attachments.length > 0,
    attachment_count: attachments.length,
    raw_payload: { ...meta, email_id: emailId, headers: full?.headers ?? null },
    received_at: full?.created_at ?? meta.created_at ?? receivedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Could not store email: ${error.message}`);
  return "stored";
}
