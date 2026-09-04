// TEMPORARY maintenance function: imports and approves a real supplier product.
// Guarded by a one-time token; delete after use.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, getAdapter, getFxRate, getSupplier } from "../_shared/dropship/core.ts";
import { calculatePrice } from "../_shared/dropship/pricing.ts";

const TOKEN = "seed-9f3c2a7b41";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.token !== TOKEN) return json({ error: "Forbidden" }, 403);

    const db = adminClient();
    const supplier = await getSupplier(db, "cjdropshipping");
    const adapter = getAdapter(db, supplier);
    const fx = await getFxRate(db, supplier.base_currency, "ZAR");

    if (body.mode === "discover") {
      const { items, total } = await adapter.discover({
        query: body.query, page: 1, pageSize: Number(body.page_size || 5),
      });
      return json({
        total,
        items: items.map((p) => ({
          supplierProductId: p.supplierProductId,
          name: p.name,
          cost: p.cost,
          stock: p.stock,
          images: (p.images || []).slice(0, 1),
        })),
      });
    }

    const ids: string[] = body.supplier_product_ids || [];
    const results: unknown[] = [];
    for (const pid of ids) {
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
          status: "approved",
          approved_at: new Date().toISOString(),
          sync_status: "ok",
          sync_error: null,
          last_synced_at: new Date().toISOString(),
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
      results.push({ id: row.id, name: row.name, price: row.recommended_price_zar, variants: p.variants.length });
    }
    return json({ ok: true, results });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
