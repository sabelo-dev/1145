// 1145 Logistics — recipient notifications.
//
// Called by the shipment_events trigger (pg_net) with { event_id }. The event
// is claimed atomically via notified_at before anything is sent, so the
// endpoint is safe to leave unauthenticated: a replayed or forged call can at
// most deliver a message that was already due, exactly once.
//
// Channels: SMS via Infobip (INFOBIP_*), email via Resend (RESEND_API_KEY).
// Either is skipped when unconfigured or when the shipment has no contact.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const INFOBIP_BASE = (Deno.env.get("INFOBIP_BASE_URL") || "").replace(/\/+$/, "");
const INFOBIP_KEY = Deno.env.get("INFOBIP_API_KEY") || "";
const SMS_SENDER = Deno.env.get("INFOBIP_SMS_SENDER") || "1145";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const TRACK_BASE = (Deno.env.get("LOGISTICS_TRACK_URL") || "https://logistics.1145.io/track").replace(/\/+$/, "");
const EMAIL_FROM = Deno.env.get("LOGISTICS_EMAIL_FROM") || "1145 Logistics <no-reply@1145.io>";

const NOTIFY_STATUSES = ["awaiting_pickup", "out_for_delivery", "delivered", "failed_attempt", "returning", "ready_for_collection"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function toE164(raw: string): string {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Shipment {
  id: string;
  tracking_number: string;
  status: string;
  sender_name: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  require_otp: boolean;
  delivery_otp: string | null;
  promised_by: string | null;
  last_failure_reason: string | null;
  attempt_count: number;
  max_attempts: number;
  notifications_enabled: boolean;
  collect_by?: string | null;
  point_name?: string | null;
  point_hours?: string | null;
}

function compose(status: string, s: Shipment) {
  const link = `${TRACK_BASE}/${s.tracking_number}`;
  const first = s.recipient_name.split(" ")[0];
  const from = s.sender_name;
  const otpLine = s.require_otp && s.delivery_otp ? ` Your delivery code is ${s.delivery_otp}. Only share it with the driver at handover.` : "";
  switch (status) {
    case "awaiting_pickup":
      return {
        subject: `A parcel from ${from} is on its way to you`,
        text: `1145: Hi ${first}, ${from} sent you a parcel (${s.tracking_number}). Track it: ${link}`,
      };
    case "out_for_delivery":
      return {
        subject: `Your parcel is out for delivery today`,
        text: `1145: Your parcel from ${from} is out for delivery.${otpLine} Track: ${link}`,
      };
    case "ready_for_collection": {
      const by = s.collect_by
        ? new Date(s.collect_by).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" })
        : null;
      return {
        subject: `Your parcel is ready to collect`,
        text: `1145: Your parcel from ${from} is ready at ${s.point_name ?? "your pickup point"}${s.point_hours ? ` (${s.point_hours})` : ""}. Collection code ${
          s.delivery_otp ?? "—"
        }${by ? `. Collect by ${by}` : ""}. ${link}`,
      };
    }
    case "delivered":
      return {
        subject: `Delivered: your parcel from ${from}`,
        text: `1145: Your parcel ${s.tracking_number} from ${from} was delivered. Thank you!`,
      };
    case "failed_attempt": {
      const left = Math.max(s.max_attempts - s.attempt_count, 0);
      return {
        subject: `We missed you, so we'll try again`,
        text: `1145: We couldn't deliver ${s.tracking_number}${s.last_failure_reason ? ` (${s.last_failure_reason})` : ""}. ${
          left ? `We'll try again (${left} attempt${left === 1 ? "" : "s"} left).` : ""
        } Details: ${link}`,
      };
    }
    case "returning":
      return {
        subject: `Your parcel is being returned to the sender`,
        text: `1145: After ${s.attempt_count} attempts, parcel ${s.tracking_number} is being returned to ${from}. ${link}`,
      };
    default:
      return null;
  }
}

async function sendSms(to: string, text: string) {
  const res = await fetch(`${INFOBIP_BASE}/sms/2/text/advanced`, {
    method: "POST",
    headers: { Authorization: `App ${INFOBIP_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ messages: [{ destinations: [{ to: toE164(to) }], from: SMS_SENDER, text }] }),
  });
  if (!res.ok) throw new Error(`Infobip [${res.status}]: ${await res.text()}`);
}

async function sendEmail(to: string, subject: string, text: string, s: Shipment) {
  const link = `${TRACK_BASE}/${s.tracking_number}`;
  const body = text.replace(/^1145: /, "");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#1e3a5f;color:#fff;padding:18px 24px;font-weight:600">1145 Logistics</td></tr>
  <tr><td style="padding:24px;color:#111;font-size:15px;line-height:1.5">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600">${esc(subject)}</p>
  <p style="margin:0 0 16px">${esc(body)}</p>
  <p style="margin:0 0 20px;font-family:ui-monospace,monospace;color:#555">Tracking: ${esc(s.tracking_number)}</p>
  <a href="${esc(link)}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Track parcel</a>
  </td></tr></table></td></tr></table></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text: body }),
  });
  if (!res.ok) throw new Error(`Resend [${res.status}]: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const { event_id } = await req.json().catch(() => ({}));
  if (typeof event_id !== "string" || !/^[0-9a-f-]{36}$/i.test(event_id)) return json({ error: "event_id_required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---- Webhooks (every status event) --------------------------------------
  const webhookResults = await deliverWebhooks(admin, event_id);

  // ---- Recipient SMS / email (selected statuses) ---------------------------
  // Claim: only the first caller for an event proceeds. Events older than a
  // day are never (re)sent.
  const { data: claimed } = await admin
    .from("shipment_events")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", event_id)
    .is("notified_at", null)
    .in("status", NOTIFY_STATUSES)
    .in("event_type", ["status_change", "created"])
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .select("id, status, shipment_id")
    .maybeSingle();
  if (!claimed) return json({ event_id, webhooks: webhookResults, skipped: "not_notifiable_or_already_sent" });

  const { data: shipment } = await admin
    .from("shipments")
    .select(
      "id, tracking_number, status, sender_name, recipient_name, recipient_phone, recipient_email, require_otp, delivery_otp, promised_by, last_failure_reason, attempt_count, max_attempts, notifications_enabled, collect_by, destination_hub_id",
    )
    .eq("id", claimed.shipment_id)
    .single();
  if (shipment?.destination_hub_id) {
    const { data: hub } = await admin.from("logistics_hubs").select("name, opening_hours_text").eq("id", shipment.destination_hub_id).maybeSingle();
    (shipment as Shipment).point_name = hub?.name ?? null;
    (shipment as Shipment).point_hours = hub?.opening_hours_text ?? null;
  }
  if (!shipment || !shipment.notifications_enabled) return json({ event_id, webhooks: webhookResults, skipped: "disabled" });

  const msg = compose(claimed.status, shipment as Shipment);
  if (!msg) return json({ event_id, webhooks: webhookResults, skipped: "no_template" });

  const results: Record<string, string> = {};
  if (shipment.recipient_phone && INFOBIP_BASE && INFOBIP_KEY) {
    try {
      await sendSms(shipment.recipient_phone, msg.text);
      results.sms = "sent";
    } catch (e) {
      results.sms = `failed: ${(e as Error).message}`;
    }
  } else {
    results.sms = "skipped";
  }
  if (shipment.recipient_email && RESEND_KEY) {
    try {
      await sendEmail(shipment.recipient_email, msg.subject, msg.text, shipment as Shipment);
      results.email = "sent";
    } catch (e) {
      results.email = `failed: ${(e as Error).message}`;
    }
  } else {
    results.email = "skipped";
  }

  if (Object.values(results).some((r) => r.startsWith("failed"))) console.error("logistics-notify", event_id, results);
  return json({ event_id, webhooks: webhookResults, ...results });
});

// ---------------------------------------------------------------------------
// Webhooks: Stripe-style signature  X-1145-Signature: t=<unix>,v1=<hex hmac>
// over "<t>.<raw body>" with the endpoint secret.
// ---------------------------------------------------------------------------
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];

/** Refuse endpoints that resolve to private/loopback/link-local space (DNS-rebinding guard). */
async function isSafeEndpoint(url: string): Promise<boolean> {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    host = u.hostname;
  } catch {
    return false;
  }
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host) || host.startsWith("[")) return false;
  try {
    // deno-lint-ignore no-explicit-any
    const resolve = (Deno as any).resolveDns as ((h: string, t: string) => Promise<string[]>) | undefined;
    if (!resolve) return true; // runtime without DNS API: rely on the DB constraint
    const [v4, v6] = await Promise.all([resolve(host, "A").catch(() => []), resolve(host, "AAAA").catch(() => [])]);
    if (v4.some((ip) => PRIVATE_V4.some((r) => r.test(ip)))) return false;
    if (v6.some((ip) => /^(::1|fc|fd|fe80)/i.test(ip))) return false;
    return true;
  } catch {
    return true;
  }
}

// deno-lint-ignore no-explicit-any
async function deliverWebhooks(admin: any, eventId: string): Promise<Record<string, string>> {
  const { data: event } = await admin
    .from("shipment_events")
    .select("id, shipment_id, status, event_type, hub_id, notes, created_at, webhooks_processed_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.webhooks_processed_at || !["status_change", "created", "hub_scan"].includes(event.event_type)) return {};
  if (Date.now() - new Date(event.created_at).getTime() > 86_400_000) return {};

  const { data: ship } = await admin
    .from("shipments")
    .select("id, tracking_number, reference, status, service_level, api_key_id, attempt_count, last_failure_reason, promised_by, picked_up_at, delivered_at, order_id")
    .eq("id", event.shipment_id)
    .single();
  if (!ship) return {};

  const { data: hooks } = await admin.from("logistics_webhooks").select("id, url, secret, events, api_key_id").eq("is_active", true);
  const targets = (hooks ?? []).filter(
    (h: { events: string[]; api_key_id: string | null }) =>
      (h.api_key_id === null || h.api_key_id === ship.api_key_id) && (h.events.includes("*") || h.events.includes(event.status)),
  );

  const results: Record<string, string> = {};
  const body = JSON.stringify({
    id: event.id,
    type: `shipment.${event.event_type === "hub_scan" ? "hub_scan" : event.status}`,
    created_at: event.created_at,
    data: {
      tracking_number: ship.tracking_number,
      reference: ship.reference,
      status: ship.status,
      event_status: event.status,
      service_level: ship.service_level,
      attempt_count: ship.attempt_count,
      failure_reason: event.status === "failed_attempt" ? ship.last_failure_reason : null,
      promised_by: ship.promised_by,
      picked_up_at: ship.picked_up_at,
      delivered_at: ship.delivered_at,
      tracking_url: `${TRACK_BASE}/${ship.tracking_number}`,
    },
  });

  for (const hook of targets) {
    // Claim (webhook, event) so concurrent calls never double-deliver.
    const { error: claimErr } = await admin.from("logistics_webhook_deliveries").insert({ webhook_id: hook.id, event_id: event.id });
    if (claimErr) {
      results[hook.id] = "already_delivered";
      continue;
    }
    if (!(await isSafeEndpoint(hook.url))) {
      await admin.from("logistics_webhook_deliveries").update({ error: "blocked: endpoint resolves to a private address" }).eq("webhook_id", hook.id).eq("event_id", event.id);
      results[hook.id] = "blocked";
      continue;
    }
    const t = Math.floor(Date.now() / 1000);
    const signature = `t=${t},v1=${await hmacHex(hook.secret, `${t}.${body}`)}`;
    let status: number | null = null;
    let error: string | null = null;
    const started = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-1145-Signature": signature, "X-1145-Event": event.id, "User-Agent": "1145-Logistics-Webhooks/1" },
          body,
          redirect: "manual", // never follow redirects (could point inside the network)
          signal: AbortSignal.timeout(8000),
        });
        status = res.status;
        error = res.ok ? null : (await res.text()).slice(0, 300);
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) break;
      } catch (e) {
        error = (e as Error).message.slice(0, 300);
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
    await admin
      .from("logistics_webhook_deliveries")
      .update({ status_code: status, error, duration_ms: Date.now() - started })
      .eq("webhook_id", hook.id)
      .eq("event_id", event.id);
    results[hook.id] = status && status < 300 ? "delivered" : `failed:${status ?? "network"}`;
  }

  await admin.from("shipment_events").update({ webhooks_processed_at: new Date().toISOString() }).eq("id", event.id);
  return results;
}
