import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Channel = "sms" | "whatsapp" | "email";

const INFOBIP_BASE = (Deno.env.get("INFOBIP_BASE_URL") || "").replace(/\/+$/, "");
const INFOBIP_KEY = Deno.env.get("INFOBIP_API_KEY") || "";
const SMS_SENDER = Deno.env.get("INFOBIP_SMS_SENDER") || "1145";
const WA_SENDER = Deno.env.get("INFOBIP_WHATSAPP_SENDER") || "";

function toE164(raw: string): string {
  const digits = (raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `27${digits.slice(1)}`;
  return digits;
}

function messageFor(event: string, order: any, appUrl: string): string {
  const ref = String(order.id).slice(0, 8).toUpperCase();
  const link = `${appUrl}/orders/${order.id}/tracking`;
  const total = `R${Number(order.total || 0).toFixed(2)}`;
  switch (event) {
    case "order_placed":
      return `1145: Order ${ref} received (${total}). Track it here: ${link}`;
    case "payment_paid":
      return `1145: Payment confirmed for order ${ref}. We are preparing your parcel. ${link}`;
    case "payment_failed":
      return `1145: Payment for order ${ref} did not go through. You can retry at ${link}`;
    case "shipped":
      return `1145: Order ${ref} is on the way${order.tracking_number ? ` (tracking ${order.tracking_number})` : ""}. ${link}`;
    case "out_for_delivery":
      return `1145: Your driver is on the way with order ${ref}. ${link}`;
    case "delivered":
      return `1145: Order ${ref} was delivered. Enjoy! Rate it at ${link}`;
    case "cancelled":
      return `1145: Order ${ref} was cancelled. Any payment will be refunded.`;
    default:
      return `1145: Update on order ${ref}: ${String(order.status || "updated").replace(/_/g, " ")}. ${link}`;
  }
}

async function sendInfobip(channel: Channel, to: string, text: string) {
  if (!INFOBIP_BASE || !INFOBIP_KEY) {
    throw new Error("Infobip is not configured (INFOBIP_BASE_URL / INFOBIP_API_KEY)");
  }
  const path = channel === "sms" ? "/sms/2/text/advanced" : "/whatsapp/1/message/text";
  const body =
    channel === "sms"
      ? { messages: [{ destinations: [{ to }], from: SMS_SENDER, text }] }
      : { from: WA_SENDER, to, content: { text } };

  const res = await fetch(`${INFOBIP_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `App ${INFOBIP_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Infobip ${channel} [${res.status}]: ${raw}`);
  let messageId: string | null = null;
  try {
    const parsed = JSON.parse(raw);
    messageId = parsed?.messages?.[0]?.messageId ?? parsed?.messageId ?? null;
  } catch (_) {
    /* provider returned non-JSON */
  }
  return messageId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const orderId: string | undefined = payload.orderId;
    const event: string = payload.event || "order_update";
    const channels: Channel[] = Array.isArray(payload.channels) && payload.channels.length
      ? payload.channels
      : ["sms", "whatsapp"];

    if (!orderId || typeof orderId !== "string") return json({ error: "orderId is required" }, 400);

    const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: user.id });
    if (order.user_id !== user.id && !isAdmin) return json({ error: "Forbidden" }, 403);

    const { data: profile } = await admin
      .from("profiles").select("phone, email, name").eq("id", order.user_id).maybeSingle();

    const shipping = (order.shipping_address || {}) as Record<string, string>;
    const phone = toE164(shipping.phone || profile?.phone || "");
    const appUrl = payload.appUrl || Deno.env.get("APP_URL") || "https://lifestyle1145.lovable.app";
    const text = messageFor(event, order, appUrl);

    const results: Array<Record<string, unknown>> = [];

    for (const channel of channels) {
      if (channel !== "email" && !phone) {
        results.push({ channel, status: "skipped", error: "No phone number on this order" });
        continue;
      }
      if (channel === "whatsapp" && !WA_SENDER) {
        results.push({ channel, status: "skipped", error: "WhatsApp sender not configured" });
        continue;
      }

      const recipient = channel === "email" ? (profile?.email || "") : phone;
      const { data: logRow } = await admin
        .from("notification_log")
        .insert({
          user_id: order.user_id,
          order_id: order.id,
          channel,
          recipient,
          template: event,
          body: text,
          status: "queued",
        })
        .select("id")
        .single();

      try {
        if (channel === "email") {
          results.push({ channel, status: "skipped", error: "Email is sent by the order email flow" });
          await admin.from("notification_log").update({ status: "skipped" }).eq("id", logRow?.id);
          continue;
        }
        const messageId = await sendInfobip(channel, recipient, text);
        await admin.from("notification_log")
          .update({ status: "sent", provider_message_id: messageId, sent_at: new Date().toISOString() })
          .eq("id", logRow?.id);
        results.push({ channel, status: "sent", messageId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Notification failed on ${channel}:`, message);
        await admin.from("notification_log").update({ status: "failed", error: message }).eq("id", logRow?.id);
        results.push({ channel, status: "failed", error: message });
      }
    }

    await admin.from("order_events").insert({
      order_id: order.id,
      event_type: "notification_sent",
      status: order.status,
      title: "Customer notified",
      description: `Update sent by ${results.filter((r) => r.status === "sent").map((r) => r.channel).join(", ") || "no channel"}.`,
      metadata: { event, results },
    });

    return json({ success: results.some((r) => r.status === "sent"), results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification failed";
    console.error("order-notify error:", message);
    return json({ error: message }, 500);
  }
});
