// Supplier webhook receiver. Every event is verified, de-duplicated and logged
// before it is allowed to touch 1145 data.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, audit, getAdapter, getSupplier, notifyAdmins } from "../_shared/dropship/core.ts";
import { normalizeSupplierStatus } from "../_shared/dropship/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = adminClient();
  const url = new URL(req.url);
  const supplierCode = url.searchParams.get("supplier") || "cjdropshipping";
  const rawBody = await req.text();

  let supplier;
  try {
    supplier = await getSupplier(db, supplierCode);
  } catch {
    return json({ error: "Unknown supplier" }, 404);
  }

  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid payload" }, 400);
  }

  const externalEventId = String(payload.eventId || payload.id || payload.messageId || crypto.randomUUID());
  const eventType = String(payload.type || payload.eventType || "unknown");

  // Signature verification
  let valid = false;
  try {
    valid = await getAdapter(db, supplier).verifyWebhook(req, rawBody);
  } catch { /* adapter unavailable */ }

  const { data: event, error: insertError } = await db.from("dropship_webhook_events").insert({
    supplier_id: supplier.id,
    external_event_id: externalEventId,
    event_type: eventType,
    signature_valid: valid,
    payload,
  }).select().maybeSingle();

  if (insertError) {
    // Unique violation = duplicate event, safely ignored.
    return json({ received: true, duplicate: true });
  }

  if (!valid) {
    await notifyAdmins(db, "dropship_webhook_invalid", "Rejected supplier webhook",
      `An unverified webhook from ${supplier.name} was rejected.`);
    return json({ error: "Invalid signature" }, 401);
  }

  try {
    const orderNumber = String(payload.orderId || payload.orderNum || payload.data?.orderId || "");
    if (orderNumber) {
      const { data: f } = await db
        .from("dropship_fulfillments")
        .select("*")
        .or(`supplier_order_number.eq.${orderNumber},idempotency_key.eq.${orderNumber}`)
        .maybeSingle();

      if (f) {
        const rawStatus = String(payload.orderStatus || payload.status || payload.data?.orderStatus || "");
        const status = normalizeSupplierStatus(rawStatus);
        const trackingNumber = payload.trackNumber || payload.trackingNumber || payload.data?.trackNumber || null;
        const carrier = payload.logisticName || payload.carrier || null;

        const update: Record<string, unknown> = { status, supplier_status: rawStatus };
        if (trackingNumber) update.tracking_number = trackingNumber;
        if (carrier) update.carrier = carrier;
        if (status === "shipped" && !f.shipped_at) update.shipped_at = new Date().toISOString();
        if (status === "delivered" && !f.delivered_at) update.delivered_at = new Date().toISOString();
        await db.from("dropship_fulfillments").update(update).eq("id", f.id);

        if (trackingNumber) {
          await db.from("dropship_tracking_events").upsert({
            fulfillment_id: f.id,
            status: rawStatus || status,
            description: payload.description || null,
            location: payload.location || null,
            occurred_at: new Date().toISOString(),
            raw: payload,
          }, { onConflict: "fulfillment_id,status,occurred_at" });
          await db.from("orders").update({ tracking_number: trackingNumber, courier_company: carrier }).eq("id", f.order_id);
        }

        await audit(db, {
          action: "webhook.applied", entity_type: "fulfillment", entity_id: f.id,
          new_state: { status, event_type: eventType },
        });
      }
    }

    await db.from("dropship_webhook_events").update({ processed: true }).eq("id", event!.id);
    return json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.from("dropship_webhook_events").update({ process_error: message }).eq("id", event!.id);
    await notifyAdmins(db, "dropship_webhook_failed", "Webhook processing failed", message);
    return json({ error: message }, 500);
  }
});
