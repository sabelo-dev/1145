// Submits paid 1145 orders to the correct supplier(s).
// Hard guarantees:
//   * never submits before payment is confirmed
//   * never creates a duplicate supplier order (idempotency key + pre-retry lookup)
//   * supplier failures never corrupt the customer order
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient,
  audit,
  getAdapter,
  getCaller,
  getFxRate,
  isAdmin,
  notify,
  notifyAdmins,
  recordHealth,
  type SupplierRow,
} from "../_shared/dropship/core.ts";
import { normalizeSupplierStatus } from "../_shared/dropship/types.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const db = adminClient();
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.order_id || "");
    if (!orderId) return json({ error: "order_id is required" }, 400);

    // Caller must be the platform itself (payment webhook / cron) or an admin.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization") || "";
    let authorized = serviceKey ? authHeader === `Bearer ${serviceKey}` : false;
    if (!authorized) {
      const caller = await getCaller(req);
      authorized = !!caller && (await isAdmin(db, caller.id));
    }
    if (!authorized) return json({ error: "Forbidden" }, 403);

    /* 1. Payment gate — nothing goes to a supplier before money is confirmed. */
    const { data: order } = await db
      .from("orders")
      .select("id, user_id, payment_status, status, shipping_address, shipping_method, total")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return json({ error: "Order not found" }, 404);
    if (order.payment_status !== "paid") {
      return json({ skipped: true, reason: "Payment not confirmed" }, 200);
    }

    /* 2. Find dropshipping items on this order, grouped per supplier. */
    const { data: items } = await db
      .from("order_items")
      .select("id, product_id, variation_id, quantity, price, store_id")
      .eq("order_id", orderId);
    if (!items?.length) return json({ skipped: true, reason: "No order items" });

    const productIds = items.map((i) => i.product_id).filter(Boolean);
    const { data: listings } = await db
      .from("dropship_listings")
      .select("id, vendor_id, product_id, dropship_product_id, selling_price, dropship_products(id, supplier_id, supplier_cost, supplier_shipping_cost, supplier_currency, stock, name)")
      .in("product_id", productIds);
    if (!listings?.length) return json({ skipped: true, reason: "No dropshipping items on this order" });

    const groups = new Map<string, { vendorId: string | null; lines: any[] }>();
    for (const item of items) {
      const listing = listings.find((l) => l.product_id === item.product_id);
      if (!listing) continue;
      const dp: any = listing.dropship_products;
      if (!dp) continue;
      const key = dp.supplier_id;
      if (!groups.has(key)) groups.set(key, { vendorId: listing.vendor_id, lines: [] });
      groups.get(key)!.lines.push({ item, listing, dp });
    }

    const results: unknown[] = [];

    for (const [supplierId, group] of groups) {
      const { data: supplierRow } = await db.from("dropship_suppliers").select("*").eq("id", supplierId).maybeSingle();
      if (!supplierRow) continue;
      const supplier = supplierRow as SupplierRow;
      const idempotencyKey = `1145-${orderId}-${supplier.code}`;

      /* 3. Duplicate protection — one fulfilment row per order+supplier. */
      const { data: existing } = await db
        .from("dropship_fulfillments")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing && existing.supplier_order_number) {
        results.push({ supplier: supplier.code, skipped: "already submitted", fulfillment_id: existing.id });
        continue;
      }

      const fx = await getFxRate(db, supplier.base_currency, "ZAR");
      let fulfillment = existing;
      if (!fulfillment) {
        const costTotal = group.lines.reduce(
          (s, l) => s + Number(l.dp.supplier_cost || 0) * Number(l.item.quantity || 1), 0,
        );
        const shipTotal = group.lines.reduce(
          (s, l) => s + Number(l.dp.supplier_shipping_cost || 0) * Number(l.item.quantity || 1), 0,
        );
        const { data: created, error } = await db.from("dropship_fulfillments").insert({
          order_id: orderId,
          supplier_id: supplier.id,
          vendor_id: group.vendorId,
          idempotency_key: idempotencyKey,
          status: "submitting",
          supplier_cost_total: costTotal,
          supplier_shipping_total: shipTotal,
          supplier_currency: supplier.base_currency,
          fx_rate: fx,
          cost_total_zar: Math.round((costTotal + shipTotal) * fx * 100) / 100,
          shipping_address: order.shipping_address || {},
        }).select().single();
        if (error) {
          // Unique-key race: another invocation already created it.
          const { data: raced } = await db.from("dropship_fulfillments").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
          if (!raced) throw error;
          fulfillment = raced;
        } else {
          fulfillment = created;
          for (const l of group.lines) {
            const { data: variant } = l.item.variation_id
              ? await db.from("dropship_variants").select("id, supplier_variant_id, supplier_cost").eq("dropship_product_id", l.dp.id).limit(1).maybeSingle()
              : await db.from("dropship_variants").select("id, supplier_variant_id, supplier_cost").eq("dropship_product_id", l.dp.id).limit(1).maybeSingle();
            await db.from("dropship_fulfillment_items").insert({
              fulfillment_id: created.id,
              order_item_id: l.item.id,
              dropship_product_id: l.dp.id,
              dropship_variant_id: variant?.id ?? null,
              supplier_variant_id: variant?.supplier_variant_id ?? l.dp.id,
              quantity: l.item.quantity,
              unit_cost: variant?.supplier_cost ?? l.dp.supplier_cost,
              unit_price_zar: l.item.price,
            });
          }
        }
      }

      if (supplier.status !== "active" || supplier.health === "offline") {
        await db.from("dropship_fulfillments").update({
          status: "awaiting_supplier_action",
          last_error: "Supplier unavailable — queued for retry",
        }).eq("id", fulfillment!.id);
        await notifyAdmins(db, "dropship_supplier_unavailable", "Supplier unavailable",
          `Order ${orderId} is queued: ${supplier.name} is not currently available.`);
        results.push({ supplier: supplier.code, queued: true });
        continue;
      }

      /* 4. Submit (with pre-retry existence check so nothing is sent twice). */
      try {
        const adapter = getAdapter(db, supplier);

        const alreadyThere = await adapter.findOrderByExternalNumber(idempotencyKey);
        let result = alreadyThere
          ? { supplierOrderNumber: alreadyThere.supplierOrderNumber, status: alreadyThere.status, cost: alreadyThere.cost, shippingCost: alreadyThere.shippingCost }
          : null;

        if (!result) {
          const { data: fitems } = await db
            .from("dropship_fulfillment_items")
            .select("supplier_variant_id, quantity")
            .eq("fulfillment_id", fulfillment!.id);
          const addr: any = order.shipping_address || {};
          result = await adapter.createOrder({
            externalOrderNumber: idempotencyKey,
            lines: (fitems || []).map((i) => ({ supplierVariantId: i.supplier_variant_id!, quantity: i.quantity })),
            shipping: {
              name: addr.name || addr.full_name || "1145 Customer",
              phone: addr.phone,
              email: addr.email,
              street: addr.street || addr.address_line1 || "",
              city: addr.city || "",
              province: addr.province || addr.state,
              postalCode: addr.postal_code || addr.zip,
              country: addr.country || "South Africa",
              countryCode: addr.country_code || "ZA",
            },
            shippingMethod: order.shipping_method || undefined,
            remark: `1145 order ${orderId}`,
          });
        }

        await db.from("dropship_fulfillments").update({
          status: "supplier_created",
          supplier_order_number: result.supplierOrderNumber,
          supplier_status: result.status,
          submitted_at: new Date().toISOString(),
          attempts: (fulfillment!.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: null,
          supplier_cost_total: result.cost ?? fulfillment!.supplier_cost_total,
          supplier_shipping_total: result.shippingCost ?? fulfillment!.supplier_shipping_total,
        }).eq("id", fulfillment!.id);

        await recordHealth(db, supplier, true);
        await audit(db, {
          action: "supplier_order.created",
          entity_type: "fulfillment",
          entity_id: fulfillment!.id,
          new_state: { supplier_order_number: result.supplierOrderNumber, order_id: orderId },
        });
        await notify(db, order.user_id, "order_processing", "Your order is being prepared",
          "We've started processing your 1145 order. You'll get tracking as soon as it ships.");

        // Merchant sales counters
        for (const l of group.lines) {
          const profit = (Number(l.item.price) - Number(l.dp.supplier_cost || 0) * fx) * Number(l.item.quantity || 1);
          await db.from("dropship_listings").update({
            units_sold: (l.listing.units_sold || 0) + Number(l.item.quantity || 1),
            revenue_zar: Number(l.listing.revenue_zar || 0) + Number(l.item.price) * Number(l.item.quantity || 1),
            profit_zar: Number(l.listing.profit_zar || 0) + Math.max(0, profit),
          }).eq("id", l.listing.id);
        }

        results.push({ supplier: supplier.code, supplier_order_number: result.supplierOrderNumber, status: normalizeSupplierStatus(result.status) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.from("dropship_fulfillments").update({
          status: "awaiting_supplier_action",
          attempts: (fulfillment!.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: message,
        }).eq("id", fulfillment!.id);
        await recordHealth(db, supplier, false, message);
        await notifyAdmins(db, "dropship_order_failed", "Supplier order failed",
          `Order ${orderId} could not be sent to ${supplier.name}: ${message}`);
        await audit(db, {
          action: "supplier_order.failed", entity_type: "fulfillment",
          entity_id: fulfillment!.id, new_state: { error: message },
        });
        results.push({ supplier: supplier.code, error: message });
      }
    }

    return json({ success: true, results });
  } catch (err) {
    console.error("dropship-fulfill error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
