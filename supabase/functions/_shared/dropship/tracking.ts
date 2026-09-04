// Shared supplier-status refresh used by both the admin and merchant surfaces.
// Never returns supplier credentials or raw supplier costs to the caller.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdapter, getSupplier } from "./core.ts";
import { ensureDeliveryJob } from "./lastmile.ts";
import { normalizeSupplierStatus } from "./types.ts";

export interface SyncResult {
  success: boolean;
  reason?: string;
  status?: string;
  tracking_number?: string | null;
  carrier?: string | null;
}

/** Pulls the latest supplier order status + tracking events for one fulfilment. */
export async function syncFulfillment(db: SupabaseClient, fulfillmentId: string): Promise<SyncResult> {
  const { data: f } = await db
    .from("dropship_fulfillments")
    .select("*")
    .eq("id", fulfillmentId)
    .maybeSingle();
  if (!f) return { success: false, reason: "Fulfilment not found" };
  if (!f.supplier_order_number) return { success: false, reason: "This order has not been sent to the supplier yet" };

  const supplier = await getSupplier(db, f.supplier_id);
  const adapter = getAdapter(db, supplier);
  const remote = await adapter.getOrder(f.supplier_order_number);
  if (!remote) return { success: false, reason: "The supplier has no record of this order yet" };

  const status = normalizeSupplierStatus(remote.status);
  const update: Record<string, unknown> = {
    status,
    supplier_status: remote.status,
    carrier: remote.carrier ?? f.carrier,
    tracking_number: remote.trackingNumber ?? f.tracking_number,
  };
  if (status === "shipped" && !f.shipped_at) update.shipped_at = new Date().toISOString();
  if (status === "delivered" && !f.delivered_at) update.delivered_at = new Date().toISOString();
  await db.from("dropship_fulfillments").update(update).eq("id", f.id);

  const trackingNumber = (update.tracking_number as string) || null;
  if (trackingNumber) {
    const tracking = await adapter.getTracking(trackingNumber);
    for (const e of tracking?.events || []) {
      await db.from("dropship_tracking_events").upsert({
        fulfillment_id: f.id,
        status: e.status,
        description: e.description ?? null,
        location: e.location ?? null,
        occurred_at: new Date(e.occurredAt).toISOString(),
      }, { onConflict: "fulfillment_id,status,occurred_at" });
    }
  }

  await db.from("orders").update({
    tracking_number: trackingNumber,
    courier_company: (update.carrier as string) ?? null,
    ...(status === "delivered"
      ? { status: "delivered" }
      : ["shipped", "in_transit", "out_for_delivery"].includes(status)
        ? { status: "shipped" }
        : {}),
  }).eq("id", f.order_id);

  if (["shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
    await ensureDeliveryJob(db, { ...f, ...update } as never);
  }

  return {
    success: true,
    status,
    tracking_number: trackingNumber,
    carrier: (update.carrier as string) ?? null,
  };
}
