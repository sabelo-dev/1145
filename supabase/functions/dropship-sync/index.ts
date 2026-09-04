// Scheduled synchronisation: supplier health, inventory, prices, order status
// and tracking. Designed to be safe when a supplier API is temporarily down —
// a failed sync never blanks out stock or corrupts customer orders.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  audit,
  getAdapter,
  getFxRate,
  notifyAdmins,
  recordHealth,
  type SupplierRow,
} from "../_shared/dropship/core.ts";
import { calculatePrice } from "../_shared/dropship/pricing.ts";
import { ensureDeliveryJob } from "../_shared/dropship/lastmile.ts";
import { normalizeSupplierStatus } from "../_shared/dropship/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PRICE_ALERT_PCT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = adminClient();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") || "";
  const cronSecret = req.headers.get("x-cron-secret");
  const authorized = auth === `Bearer ${serviceKey}` || (cronSecret && cronSecret === Deno.env.get("CRON_SECRET"));
  if (!authorized) return json({ error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const jobType = String(body.job_type || "all");

  const query = db.from("dropship_suppliers").select("*").eq("status", "active");
  if (body.supplier_id) query.eq("id", body.supplier_id);
  const { data: suppliers } = await query;

  const summary: Record<string, unknown>[] = [];

  for (const row of suppliers || []) {
    const supplier = row as SupplierRow;
    const { data: job } = await db.from("dropship_sync_jobs").insert({
      supplier_id: supplier.id, job_type: jobType, status: "running", started_at: new Date().toISOString(),
    }).select().single();

    let processed = 0, succeeded = 0, failed = 0;
    const stats: Record<string, unknown> = {};

    try {
      const adapter = getAdapter(db, supplier);

      /* ---- HEALTH ---- */
      const health = await adapter.health();
      await recordHealth(db, supplier, health.ok, health.message);
      if (!health.ok) throw new Error(health.message || "Supplier unreachable");

      const fx = await getFxRate(db, supplier.base_currency, "ZAR");

      /* ---- INVENTORY + PRICES ---- */
      if (jobType === "all" || jobType === "inventory" || jobType === "products") {
        const { data: products } = await db
          .from("dropship_products")
          .select("id, supplier_product_id, supplier_cost, supplier_shipping_cost, recommended_price_zar, stock, status")
          .eq("supplier_id", supplier.id)
          .in("status", ["pending_approval", "approved", "published"])
          .limit(300);

        let priceChanges = 0, stockChanges = 0, outOfStock = 0;
        for (const p of products || []) {
          processed++;
          try {
            const fresh = await adapter.getProduct(p.supplier_product_id);
            const pricing = calculatePrice(fresh.cost, fresh.shippingCost || 0, fx, supplier.pricing_rule);
            const costChanged = Number(fresh.cost) !== Number(p.supplier_cost);
            const changePct = Number(p.supplier_cost)
              ? ((Number(fresh.cost) - Number(p.supplier_cost)) / Number(p.supplier_cost)) * 100
              : 0;

            const update: Record<string, unknown> = {
              stock: fresh.stock,
              supplier_cost: fresh.cost,
              supplier_shipping_cost: fresh.shippingCost ?? 0,
              landed_cost_zar: pricing.landedCostZar,
              recommended_price_zar: pricing.recommendedPriceZar,
              fx_rate: fx,
              sync_status: "ok",
              sync_error: null,
              last_synced_at: new Date().toISOString(),
            };
            await db.from("dropship_products").update(update).eq("id", p.id);

            for (const v of fresh.variants) {
              await db.from("dropship_variants").upsert({
                dropship_product_id: p.id,
                supplier_variant_id: v.supplierVariantId,
                sku: v.sku ?? null,
                name: v.name ?? null,
                attributes: v.attributes,
                image_url: v.imageUrl ?? null,
                supplier_cost: v.cost,
                supplier_shipping_cost: v.shippingCost ?? 0,
                recommended_price_zar: calculatePrice(v.cost, v.shippingCost || 0, fx, supplier.pricing_rule).recommendedPriceZar,
                stock: v.stock,
                weight_grams: v.weightGrams ?? null,
              }, { onConflict: "dropship_product_id,supplier_variant_id" });
            }

            if (fresh.stock !== p.stock) stockChanges++;
            if (fresh.stock <= supplier.safety_stock) outOfStock++;

            if (costChanged) {
              priceChanges++;
              await db.from("dropship_price_history").insert({
                dropship_product_id: p.id,
                old_supplier_cost: p.supplier_cost,
                new_supplier_cost: fresh.cost,
                old_recommended_price: p.recommended_price_zar,
                new_recommended_price: pricing.recommendedPriceZar,
                change_pct: Math.round(changePct * 100) / 100,
                source: "sync",
              });

              const { data: affected } = await db
                .from("dropship_listings")
                .select("id, vendor_id, auto_price_update, product_id, vendors(user_id)")
                .eq("dropship_product_id", p.id);

              for (const listing of affected || []) {
                const significant = Math.abs(changePct) >= PRICE_ALERT_PCT;
                if (listing.auto_price_update && supplier.auto_price_update) {
                  await db.from("dropship_listings").update({
                    selling_price: pricing.recommendedPriceZar, price_change_flag: significant,
                  }).eq("id", listing.id);
                  if (listing.product_id) {
                    await db.from("products").update({ price: pricing.recommendedPriceZar }).eq("id", listing.product_id);
                  }
                } else if (significant) {
                  await db.from("dropship_listings").update({ price_change_flag: true }).eq("id", listing.id);
                }
                const userId = (listing as any).vendors?.user_id;
                if (userId && significant) {
                  await db.from("user_notifications").insert({
                    user_id: userId, type: "dropship_price_change",
                    title: "Supplier price changed",
                    message: `A supplier price moved ${changePct.toFixed(1)}%. Recommended price is now R${pricing.recommendedPriceZar.toFixed(2)}.`,
                  });
                }
              }
            }
            succeeded++;
          } catch (err) {
            failed++;
            await db.from("dropship_products").update({
              sync_status: "error",
              sync_error: err instanceof Error ? err.message : String(err),
            }).eq("id", p.id);
          }
        }
        stats.price_changes = priceChanges;
        stats.stock_changes = stockChanges;
        stats.low_or_out_of_stock = outOfStock;
        await db.from("dropship_suppliers").update({
          last_inventory_sync_at: new Date().toISOString(),
          last_products_sync_at: new Date().toISOString(),
        }).eq("id", supplier.id);
      }

      /* ---- ORDER STATUS + TRACKING ---- */
      if (jobType === "all" || jobType === "orders" || jobType === "tracking") {
        const { data: fulfillments } = await db
          .from("dropship_fulfillments")
          .select("*")
          .eq("supplier_id", supplier.id)
          .not("supplier_order_number", "is", null)
          .not("status", "in", "(delivered,cancelled,refunded)")
          .limit(200);

        for (const f of fulfillments || []) {
          processed++;
          try {
            const remote = await adapter.getOrder(f.supplier_order_number!);
            if (!remote) { failed++; continue; }
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

            // Local last-mile: a shipped parcel becomes a driver job.
            if (["shipped", "in_transit", "out_for_delivery", "delivered"].includes(status)) {
              await ensureDeliveryJob(db, { ...f, ...update } as never);
            }

            const trackingNumber = remote.trackingNumber || f.tracking_number;
            if (trackingNumber) {
              const tracking = await adapter.getTracking(trackingNumber);
              if (tracking) {
                for (const e of tracking.events) {
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
                courier_company: remote.carrier ?? null,
                status: status === "delivered" ? "delivered" : status === "shipped" || status === "in_transit" ? "shipped" : undefined,
              }).eq("id", f.order_id);
            }

            if (status !== f.status) {
              const { data: order } = await db.from("orders").select("user_id").eq("id", f.order_id).maybeSingle();
              if (order?.user_id) {
                const messages: Record<string, [string, string]> = {
                  shipped: ["Your order has shipped", "Tracking is now available in your 1145 orders."],
                  in_transit: ["Your order is on its way", "Your parcel is in transit."],
                  out_for_delivery: ["Out for delivery", "Your parcel is out for delivery today."],
                  delivered: ["Delivered", "Your 1145 order has been delivered. Enjoy!"],
                  cancelled: ["Order cancelled", "Your order was cancelled. Any payment will be refunded."],
                };
                const msg = messages[status];
                if (msg) {
                  await db.from("user_notifications").insert({
                    user_id: order.user_id, type: `order_${status}`, title: msg[0], message: msg[1],
                  });
                }
              }
            }
            succeeded++;
          } catch {
            failed++;
          }
        }
        await db.from("dropship_suppliers").update({ last_orders_sync_at: new Date().toISOString() }).eq("id", supplier.id);
      }

      await db.from("dropship_sync_jobs").update({
        status: "completed", processed, succeeded, failed, stats, finished_at: new Date().toISOString(),
      }).eq("id", job.id);
      summary.push({ supplier: supplier.code, processed, succeeded, failed, ...stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.from("dropship_sync_jobs").update({
        status: "failed", processed, succeeded, failed, stats, error: message, finished_at: new Date().toISOString(),
      }).eq("id", job?.id);
      await notifyAdmins(db, "dropship_sync_failed", "Synchronisation failed",
        `${supplier.name}: ${message}`);
      await audit(db, {
        action: "sync.failed", entity_type: "supplier", entity_id: supplier.id, new_state: { error: message },
      });
      summary.push({ supplier: supplier.code, error: message });
    }
  }

  return json({ success: true, jobs: summary });
});
