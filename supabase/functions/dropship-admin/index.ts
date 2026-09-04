// Admin control plane for the 1145 dropshipping platform.
// Every action requires an authenticated administrator.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  audit,
  getAdapter,
  getCaller,
  getFxRate,
  getSupplier,
  isAdmin,
  notifyAdmins,
  rateLimit,
  recordHealth,
} from "../_shared/dropship/core.ts";
import { ensureDeliveryJob } from "../_shared/dropship/lastmile.ts";
import { calculatePrice } from "../_shared/dropship/pricing.ts";
import { normalizeSupplierStatus } from "../_shared/dropship/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });


function slugify(name: string, suffix: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${suffix}`;
}

/** The official 1145 store that fronts admin-curated dropshipping products. */
async function ensurePlatformStore(db: any, callerId: string): Promise<{ id: string; vendor_id: string }> {
  const { data: store } = await db
    .from("stores")
    .select("id, vendor_id")
    .eq("slug", "1145-marketplace")
    .maybeSingle();
  if (store) return store;

  let { data: vendor } = await db
    .from("vendors")
    .select("id")
    .eq("business_name", "1145 Marketplace")
    .maybeSingle();

  if (!vendor) {
    const { data: createdVendor, error: vendorError } = await db
      .from("vendors")
      .insert({
        user_id: callerId,
        business_name: "1145 Marketplace",
        legal_business_name: "1145 Lifestyle",
        description: "Official 1145 Lifestyle marketplace store",
        status: "approved",
        onboarding_status: "active",
      })
      .select("id")
      .single();
    if (vendorError) throw vendorError;
    vendor = createdVendor;
  }

  const { data: createdStore, error: storeError } = await db
    .from("stores")
    .insert({
      vendor_id: vendor.id,
      name: "1145 Marketplace",
      slug: "1145-marketplace",
      description: "Curated products sourced and fulfilled through 1145 Lifestyle",
    })
    .select("id, vendor_id")
    .single();
  if (storeError) throw storeError;
  return createdStore;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);
    if (!rateLimit(`admin:${caller.id}`, 120)) return json({ error: "Too many requests" }, 429);

    const db = adminClient();
    if (!(await isAdmin(db, caller.id))) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    switch (action) {
      /* ---------------- SUPPLIERS ---------------- */
      case "supplier.test": {
        const supplier = await getSupplier(db, String(body.supplier_id));
        let ok = false;
        let message: string | undefined;
        try {
          const adapter = getAdapter(db, supplier);
          const res = await adapter.health();
          ok = res.ok;
          message = res.message;
        } catch (err) {
          message = err instanceof Error ? err.message : String(err);
        }
        const health = await recordHealth(db, supplier, ok, message);
        await audit(db, {
          actor_id: caller.id,
          actor_role: "admin",
          action: "supplier.tested",
          entity_type: "supplier",
          entity_id: supplier.id,
          new_state: { health },
        });
        return json({ ok, health, message });
      }

      case "supplier.update": {
        const { supplier_id, patch } = body;
        const supplier = await getSupplier(db, String(supplier_id));
        const allowed = [
          "name", "status", "safety_stock", "pricing_rule", "shipping_rule",
          "sync_intervals", "auto_price_update", "country", "base_currency", "config", "logo_url",
        ];
        const update: Record<string, unknown> = {};
        for (const k of allowed) if (k in (patch || {})) update[k] = patch[k];
        const { error } = await db.from("dropship_suppliers").update(update).eq("id", supplier.id);
        if (error) throw error;
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "supplier.updated",
          entity_type: "supplier", entity_id: supplier.id,
          previous_state: supplier, new_state: update,
        });
        return json({ success: true });
      }

      case "supplier.create": {
        const { code, name, adapter, country, base_currency } = body;
        const { data, error } = await db
          .from("dropship_suppliers")
          .insert({ code, name, adapter: adapter || "cjdropshipping", country, base_currency: base_currency || "USD" })
          .select()
          .single();
        if (error) throw error;
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "supplier.connected",
          entity_type: "supplier", entity_id: data.id, new_state: data,
        });
        return json({ supplier: data });
      }

      /* ---------------- DISCOVERY ---------------- */
      case "discover": {
        const supplier = await getSupplier(db, String(body.supplier_id));
        const adapter = getAdapter(db, supplier);
        const fx = await getFxRate(db, supplier.base_currency, "ZAR");
        try {
          const { items, total } = await adapter.discover({
            query: body.query,
            category: body.category,
            page: Number(body.page || 1),
            pageSize: Number(body.page_size || 20),
          });
          await recordHealth(db, supplier, true);
          const enriched = items.map((p) => ({
            ...p,
            pricing: calculatePrice(p.cost, p.shippingCost || 0, fx, supplier.pricing_rule),
          }));
          return json({ items: enriched, total, fx_rate: fx });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await recordHealth(db, supplier, false, message);
          return json({ error: message }, 502);
        }
      }

      /* ---------------- IMPORT ---------------- */
      case "import": {
        const supplier = await getSupplier(db, String(body.supplier_id));
        const adapter = getAdapter(db, supplier);
        const fx = await getFxRate(db, supplier.base_currency, "ZAR");
        const ids: string[] = body.supplier_product_ids || [];
        const imported: string[] = [];
        const failures: { id: string; error: string }[] = [];

        for (const pid of ids) {
          try {
            const p = await adapter.getProduct(pid);
            const pricing = calculatePrice(p.cost, p.shippingCost || 0, fx, supplier.pricing_rule);
            const { data: row, error } = await db
              .from("dropship_products")
              .upsert({
                supplier_id: supplier.id,
                supplier_product_id: p.supplierProductId,
                supplier_sku: p.sku ?? null,
                name: p.name,
                description: p.description ?? null,
                images: p.images,
                category: p.category ?? null,
                supplier_category: p.category ?? null,
                supplier_cost: pricing.supplierCost,
                supplier_currency: p.currency,
                supplier_shipping_cost: pricing.supplierShipping,
                weight_grams: p.weightGrams ?? null,
                stock: p.stock,
                warehouse: p.warehouse ?? null,
                landed_cost_zar: pricing.landedCostZar,
                recommended_price_zar: pricing.recommendedPriceZar,
                fx_rate: fx,
                status: "pending_approval",
                sync_status: "ok",
                sync_error: null,
                last_synced_at: new Date().toISOString(),
                imported_by: caller.id,
                raw: p.raw ?? {},
              }, { onConflict: "supplier_id,supplier_product_id" })
              .select()
              .single();
            if (error) throw error;

            if (p.variants.length) {
              await db.from("dropship_variants").upsert(
                p.variants.map((v) => ({
                  dropship_product_id: row.id,
                  supplier_variant_id: v.supplierVariantId,
                  sku: v.sku ?? null,
                  name: v.name ?? null,
                  attributes: v.attributes,
                  image_url: v.imageUrl ?? null,
                  supplier_cost: v.cost,
                  supplier_shipping_cost: v.shippingCost ?? 0,
                  recommended_price_zar: calculatePrice(v.cost, v.shippingCost || 0, fx, supplier.pricing_rule)
                    .recommendedPriceZar,
                  stock: v.stock,
                  weight_grams: v.weightGrams ?? null,
                })),
                { onConflict: "dropship_product_id,supplier_variant_id" },
              );
            }
            imported.push(row.id);
            await audit(db, {
              actor_id: caller.id, actor_role: "admin", action: "product.imported",
              entity_type: "dropship_product", entity_id: row.id,
              new_state: { name: p.name, supplier_product_id: p.supplierProductId },
            });
          } catch (err) {
            failures.push({ id: pid, error: err instanceof Error ? err.message : String(err) });
          }
        }
        return json({ imported: imported.length, failures });
      }

      /* ---------------- APPROVAL LIFECYCLE ---------------- */
      case "product.decide": {
        const { product_ids, decision, reason } = body;
        const map: Record<string, string> = {
          approve: "approved",
          reject: "rejected",
          publish: "published",
          suspend: "suspended",
          remove: "removed",
          unsuspend: "approved",
        };
        const status = map[String(decision)];
        if (!status) return json({ error: "Unknown decision" }, 400);

        const update: Record<string, unknown> = { status };
        if (decision === "approve" || decision === "publish") {
          update.approved_by = caller.id;
          update.approved_at = new Date().toISOString();
          update.rejection_reason = null;
          update.suspension_reason = null;
        }
        if (decision === "reject") update.rejection_reason = reason ?? null;
        if (decision === "suspend") update.suspension_reason = reason ?? null;

        const { error } = await db.from("dropship_products").update(update).in("id", product_ids);
        if (error) throw error;

        if (["suspend", "remove", "reject"].includes(String(decision))) {
          await db.from("dropship_listings").update({ status: "unpublished" }).in("dropship_product_id", product_ids);
        }
        for (const id of product_ids) {
          await audit(db, {
            actor_id: caller.id, actor_role: "admin", action: `product.${decision}`,
            entity_type: "dropship_product", entity_id: id, new_state: { status, reason: reason ?? null },
          });
        }
        return json({ success: true, updated: product_ids.length });
      }

      /* ---------------- PRICING ---------------- */
      case "product.reprice": {
        const supplier = await getSupplier(db, String(body.supplier_id));
        const fx = await getFxRate(db, supplier.base_currency, "ZAR");
        const { data: products } = await db
          .from("dropship_products")
          .select("id, supplier_cost, supplier_shipping_cost, recommended_price_zar")
          .eq("supplier_id", supplier.id);
        let updated = 0;
        for (const p of products || []) {
          const pricing = calculatePrice(p.supplier_cost, p.supplier_shipping_cost, fx, supplier.pricing_rule);
          if (pricing.recommendedPriceZar === Number(p.recommended_price_zar)) continue;
          await db.from("dropship_products").update({
            landed_cost_zar: pricing.landedCostZar,
            recommended_price_zar: pricing.recommendedPriceZar,
            fx_rate: fx,
          }).eq("id", p.id);
          await db.from("dropship_price_history").insert({
            dropship_product_id: p.id,
            old_recommended_price: p.recommended_price_zar,
            new_recommended_price: pricing.recommendedPriceZar,
            source: "admin_reprice",
          });
          updated++;
        }
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "pricing.recalculated",
          entity_type: "supplier", entity_id: supplier.id, new_state: { updated, fx },
        });
        return json({ updated, fx_rate: fx });
      }

      case "pricing.preview": {
        const supplier = await getSupplier(db, String(body.supplier_id));
        const fx = await getFxRate(db, supplier.base_currency, "ZAR");
        return json({
          breakdown: calculatePrice(
            Number(body.cost || 0),
            Number(body.shipping || 0),
            fx,
            body.pricing_rule || supplier.pricing_rule,
          ),
          fx_rate: fx,
        });
      }

      /* ---------------- FULFILMENT ---------------- */
      case "fulfillment.retry": {
        const { data: f } = await db.from("dropship_fulfillments").select("*").eq("id", body.fulfillment_id).maybeSingle();
        if (!f) return json({ error: "Fulfilment not found" }, 404);
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/dropship-fulfill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ order_id: f.order_id, internal_key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") }),
        });
        const out = await res.json().catch(() => ({}));
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "fulfillment.retried",
          entity_type: "fulfillment", entity_id: f.id, new_state: out,
        });
        return json(out, res.status);
      }

      /* Paid marketplace orders that still need to be sent to a supplier. */
      case "fulfillment.queue": {
        const { data: orders } = await db
          .from("orders")
          .select("id, order_number, user_id, total, status, payment_status, created_at, shipping_address")
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false })
          .limit(100);

        const orderIds = (orders || []).map((o: any) => o.id);
        if (!orderIds.length) return json({ orders: [] });

        const [{ data: items }, { data: fulfillments }, { data: jobs }] = await Promise.all([
          db.from("order_items").select("order_id, product_id, quantity, price").in("order_id", orderIds),
          db.from("dropship_fulfillments").select("*").in("order_id", orderIds),
          db.from("delivery_jobs").select("id, order_id, status, driver_id").in("order_id", orderIds),
        ]);

        const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))];
        const { data: listings } = productIds.length
          ? await db.from("dropship_listings").select("product_id, dropship_product_id, dropship_products(name, supplier_id)").in("product_id", productIds)
          : { data: [] as any[] };

        const rows = (orders || []).map((o: any) => {
          const lines = (items || []).filter((i: any) => i.order_id === o.id)
            .map((i: any) => ({ ...i, listing: (listings || []).find((l: any) => l.product_id === i.product_id) }))
            .filter((i: any) => !!i.listing);
          if (!lines.length) return null;
          return {
            order: o,
            lines: lines.map((l: any) => ({
              product_id: l.product_id,
              quantity: l.quantity,
              price: l.price,
              name: l.listing?.dropship_products?.name || "Product",
            })),
            fulfillments: (fulfillments || []).filter((f: any) => f.order_id === o.id),
            delivery_job: (jobs || []).find((j: any) => j.order_id === o.id) || null,
          };
        }).filter(Boolean);

        return json({ orders: rows });
      }

      /* Send a paid order to its supplier(s) now. */
      case "fulfillment.submit": {
        const orderId = String(body.order_id || "");
        if (!orderId) return json({ error: "order_id is required" }, 400);
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/dropship-fulfill`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ order_id: orderId }),
        });
        const out = await res.json().catch(() => ({}));
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "fulfillment.submitted",
          entity_type: "order", entity_id: orderId, new_state: out,
        });
        return json(out, res.status);
      }

      /* Refresh a single supplier order's status + tracking on demand. */
      case "fulfillment.track": {
        const { data: f } = await db.from("dropship_fulfillments").select("*").eq("id", body.fulfillment_id).maybeSingle();
        if (!f) return json({ error: "Fulfilment not found" }, 404);
        if (!f.supplier_order_number) return json({ error: "This order has not been sent to the supplier yet" }, 400);
        const supplier = await getSupplier(db, f.supplier_id);
        const adapter = getAdapter(db, supplier);
        const remote = await adapter.getOrder(f.supplier_order_number);
        if (!remote) return json({ error: "Supplier has no record of this order yet" }, 404);
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

        return json({ success: true, status, tracking_number: trackingNumber, carrier: update.carrier });
      }

      /* Manually hand a shipment to the 1145 driver network. */
      case "delivery.dispatch": {
        const { data: f } = await db.from("dropship_fulfillments").select("*").eq("id", body.fulfillment_id).maybeSingle();
        if (!f) return json({ error: "Fulfilment not found" }, 404);
        const out = await ensureDeliveryJob(db, f as never);
        if (!out.job_id) return json({ error: out.reason || "Could not create a driver job" }, 400);
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "delivery.dispatched",
          entity_type: "fulfillment", entity_id: f.id, new_state: out,
        });
        return json({ success: true, ...out });
      }

      case "fulfillment.update_status": {
        const { fulfillment_id, status, note } = body;
        const { data: prev } = await db.from("dropship_fulfillments").select("*").eq("id", fulfillment_id).maybeSingle();
        const { error } = await db.from("dropship_fulfillments").update({ status, last_error: note ?? null }).eq("id", fulfillment_id);
        if (error) throw error;
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "fulfillment.override",
          entity_type: "fulfillment", entity_id: fulfillment_id,
          previous_state: { status: prev?.status }, new_state: { status, note },
        });
        return json({ success: true });
      }

      /* ---------------- RETURNS & REFUNDS ---------------- */
      case "return.decide": {
        const { return_id, decision, resolution, refund_amount } = body;
        const { data: ret } = await db.from("dropship_returns").select("*").eq("id", return_id).maybeSingle();
        if (!ret) return json({ error: "Return not found" }, 404);
        const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : String(decision);
        await db.from("dropship_returns").update({
          status,
          resolution: resolution ?? null,
          refund_amount: refund_amount ?? null,
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
        }).eq("id", return_id);
        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: `return.${status}`,
          entity_type: "return", entity_id: return_id,
          previous_state: { status: ret.status }, new_state: { status, resolution },
        });
        await db.from("user_notifications").insert({
          user_id: ret.user_id,
          type: "return_update",
          title: `Return ${status}`,
          message: resolution || `Your return request has been ${status}.`,
        });
        return json({ success: true });
      }

      case "refund.process": {
        const { order_id, return_id, amount, method } = body;
        const idempotency_key = `REFUND-${order_id}-${return_id || "direct"}`;
        const { data: order } = await db.from("orders").select("id, user_id, payment_status, total").eq("id", order_id).maybeSingle();
        if (!order) return json({ error: "Order not found" }, 404);
        if (order.payment_status !== "paid") return json({ error: "Order was never paid" }, 400);
        const value = Number(amount || 0);
        if (value <= 0 || value > Number(order.total)) return json({ error: "Invalid refund amount" }, 400);

        const { data: existing } = await db.from("dropship_refunds").select("id, status").eq("idempotency_key", idempotency_key).maybeSingle();
        if (existing) return json({ success: true, duplicate: true, refund_id: existing.id });

        const { data: refund, error } = await db.from("dropship_refunds").insert({
          order_id, return_id: return_id ?? null, user_id: order.user_id,
          amount: value, method: method || "wallet", status: "processing",
          idempotency_key, processed_by: caller.id,
        }).select().single();
        if (error) throw error;

        try {
          await db.rpc("credit_wallet", {
            p_user_id: order.user_id,
            p_bucket: "available",
            p_amount: value,
            p_type: "refund",
            p_provider: "1145",
            p_provider_reference: idempotency_key,
            p_related_type: "order",
            p_related_id: order_id,
            p_metadata: { return_id: return_id ?? null },
          });
          await db.from("dropship_refunds").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", refund.id);
          if (return_id) await db.from("dropship_returns").update({ status: "refunded" }).eq("id", return_id);
          await db.from("orders").update({ refund_status: "refunded", refund_amount: value }).eq("id", order_id);
          await db.from("user_notifications").insert({
            user_id: order.user_id, type: "refund_processed",
            title: "Refund processed", message: `R${value.toFixed(2)} has been returned to your 1145 Wallet.`,
          });
        } catch (err) {
          await db.from("dropship_refunds").update({
            status: "failed", notes: err instanceof Error ? err.message : String(err),
          }).eq("id", refund.id);
          return json({ error: "Refund failed" }, 500);
        }

        await audit(db, {
          actor_id: caller.id, actor_role: "admin", action: "refund.processed",
          entity_type: "refund", entity_id: refund.id, new_state: { amount: value, order_id },
        });
        return json({ success: true, refund_id: refund.id });
      }

      /* ---------------- ANALYTICS ---------------- */
      case "analytics": {
        const [suppliers, products, listings, fulfillments, returns, errors] = await Promise.all([
          db.from("dropship_suppliers").select("id, name, status, health"),
          db.from("dropship_products").select("id, status, stock, supplier_id"),
          db.from("dropship_listings").select("id, status, units_sold, revenue_zar, profit_zar"),
          db.from("dropship_fulfillments").select("id, status, cost_total_zar, created_at, submitted_at, shipped_at, delivered_at, supplier_id"),
          db.from("dropship_returns").select("id, status"),
          db.from("dropship_api_logs").select("id, success, error_type, created_at").eq("success", false).order("created_at", { ascending: false }).limit(200),
        ]);

        const f = fulfillments.data || [];
        const l = listings.data || [];
        const p = products.data || [];
        const count = (rows: { status: string }[], s: string) => rows.filter((r) => r.status === s).length;
        const fulfilTimes = f
          .filter((x) => x.submitted_at && x.shipped_at)
          .map((x) => (new Date(x.shipped_at!).getTime() - new Date(x.submitted_at!).getTime()) / 3600000);

        return json({
          suppliers: suppliers.data || [],
          products: {
            total: p.length,
            pending: count(p as never, "pending_approval"),
            approved: count(p as never, "approved"),
            published: count(p as never, "published"),
            rejected: count(p as never, "rejected"),
            suspended: count(p as never, "suspended"),
            out_of_stock: p.filter((x) => (x.stock ?? 0) <= 0).length,
            low_stock: p.filter((x) => (x.stock ?? 0) > 0 && (x.stock ?? 0) <= 5).length,
          },
          orders: {
            total: f.length,
            pending: f.filter((x) => ["paid", "submitting", "awaiting_supplier_action"].includes(x.status)).length,
            processing: f.filter((x) => ["supplier_created", "processing"].includes(x.status)).length,
            shipped: f.filter((x) => ["shipped", "in_transit", "out_for_delivery"].includes(x.status)).length,
            delivered: count(f as never, "delivered"),
            failed: count(f as never, "supplier_failure"),
            cancelled: count(f as never, "cancelled"),
          },
          returns: {
            total: (returns.data || []).length,
            requested: count((returns.data || []) as never, "requested"),
            approved: count((returns.data || []) as never, "approved"),
            rejected: count((returns.data || []) as never, "rejected"),
            refunded: count((returns.data || []) as never, "refunded"),
          },
          financials: {
            gmv: l.reduce((s, x) => s + Number(x.revenue_zar || 0), 0),
            merchant_profit: l.reduce((s, x) => s + Number(x.profit_zar || 0), 0),
            supplier_cost: f.reduce((s, x) => s + Number(x.cost_total_zar || 0), 0),
            units_sold: l.reduce((s, x) => s + Number(x.units_sold || 0), 0),
          },
          performance: {
            avg_fulfillment_hours: fulfilTimes.length
              ? Math.round((fulfilTimes.reduce((a, b) => a + b, 0) / fulfilTimes.length) * 10) / 10
              : null,
            recent_errors: (errors.data || []).length,
          },
        });
      }

      /* ------------- PUBLIC MARKETPLACE ------------- */
      case "marketplace.publish": {
        const ids: string[] = Array.isArray(body.product_ids) ? body.product_ids.map(String) : [];
        if (!ids.length) return json({ error: "product_ids is required" }, 400);

        const store = await ensurePlatformStore(db, caller.id);
        const published: Record<string, string> = {};

        for (const dropshipProductId of ids) {
          const { data: dp } = await db
            .from("dropship_products")
            .select("*")
            .eq("id", dropshipProductId)
            .maybeSingle();
          if (!dp) continue;
          if (!["approved", "published"].includes(String(dp.status))) continue;

          const sellingPrice = Number(dp.recommended_price_zar || 0);
          const quantity = Math.max(0, Number(dp.stock || 0) - 2);
          const images: string[] = Array.isArray(dp.images) ? dp.images.filter((i: unknown) => typeof i === "string") : [];

          let { data: listing } = await db
            .from("dropship_listings")
            .select("*")
            .eq("dropship_product_id", dropshipProductId)
            .eq("vendor_id", store.vendor_id)
            .maybeSingle();

          if (!listing) {
            const { data: createdListing, error: listingError } = await db
              .from("dropship_listings")
              .insert({
                vendor_id: store.vendor_id,
                store_id: store.id,
                dropship_product_id: dropshipProductId,
                selling_price: sellingPrice,
                status: "draft",
              })
              .select()
              .single();
            if (listingError) throw listingError;
            listing = createdListing;
          }

          let productId: string | null = listing.product_id;
          if (productId) {
            await db.from("products").update({
              status: "approved",
              name: dp.name,
              description: dp.description,
              price: sellingPrice,
              quantity,
            }).eq("id", productId);
          } else {
            const { data: createdProduct, error: productError } = await db.from("products").insert({
              store_id: store.id,
              name: dp.name,
              slug: slugify(String(dp.name || "product"), String(listing.id).slice(0, 8)),
              description: dp.description,
              price: sellingPrice,
              quantity,
              category: dp.category || "general",
              sku: dp.supplier_sku || null,
              status: "approved",
              external_source: "dropship",
              external_id: listing.id,
              product_type: "simple",
            }).select("id").single();
            if (productError) throw productError;
            productId = createdProduct.id;
            if (images.length) {
              await db.from("product_images").insert(
                images.slice(0, 8).map((url, position) => ({ product_id: productId, image_url: url, position })),
              );
            }
          }

          await db.from("dropship_listings").update({
            status: "published",
            product_id: productId,
            selling_price: sellingPrice,
            store_id: store.id,
          }).eq("id", listing.id);

          await db.from("dropship_products").update({ status: "published" }).eq("id", dropshipProductId);

          await audit(db, {
            actor_id: caller.id, actor_role: "admin", action: "marketplace.published",
            entity_type: "dropship_product", entity_id: dropshipProductId,
            new_state: { product_id: productId, listing_id: listing.id },
          });
          published[dropshipProductId] = productId as string;
        }

        return json({ success: true, published, store_slug: "1145-marketplace" });
      }

      case "marketplace.unpublish": {
        const ids: string[] = Array.isArray(body.product_ids) ? body.product_ids.map(String) : [];
        if (!ids.length) return json({ error: "product_ids is required" }, 400);

        const { data: listings } = await db
          .from("dropship_listings")
          .select("id, product_id, dropship_product_id")
          .in("dropship_product_id", ids);

        for (const l of listings || []) {
          if (l.product_id) await db.from("products").update({ status: "inactive" }).eq("id", l.product_id);
          await db.from("dropship_listings").update({ status: "unpublished" }).eq("id", l.id);
          await audit(db, {
            actor_id: caller.id, actor_role: "admin", action: "marketplace.unpublished",
            entity_type: "dropship_product", entity_id: l.dropship_product_id,
          });
        }
        await db.from("dropship_products").update({ status: "approved" }).in("id", ids);
        return json({ success: true, updated: (listings || []).length });
      }

      case "sync.run": {

        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/dropship-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ job_type: body.job_type || "all", supplier_id: body.supplier_id }),
        });
        return json(await res.json().catch(() => ({})), res.status);
      }

      default:
        return json({ error: `Unknown action "${action}"` }, 400);
    }
  } catch (err) {
    console.error("dropship-admin error", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    try {
      await notifyAdmins(adminClient(), "dropship_error", "Dropshipping error", message);
    } catch { /* ignore */ }
    return json({ error: message }, 500);
  }
});
