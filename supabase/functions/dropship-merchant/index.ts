// Merchant-facing dropshipping actions. Supplier credentials, supplier order
// details and raw supplier costs beyond the merchant's own cost view are never
// returned here.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient, audit, getCaller, getFxRate, getSupplier, rateLimit } from "../_shared/dropship/core.ts";
import { calculatePrice } from "../_shared/dropship/pricing.ts";
import { syncFulfillment } from "../_shared/dropship/tracking.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function slugify(name: string, suffix: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${suffix}`;
}

export interface MerchantFxSettings {
  fx_mode: "live" | "manual";
  manual_fx_rate: number | null;
  fx_margin_pct: number;
  auto_fulfill: boolean;
}

const DEFAULT_SETTINGS: MerchantFxSettings = {
  fx_mode: "live",
  manual_fx_rate: null,
  fx_margin_pct: 0,
  auto_fulfill: true,
};

async function getSettings(db: ReturnType<typeof adminClient>, vendorId: string): Promise<MerchantFxSettings> {
  const { data } = await db
    .from("dropship_merchant_settings")
    .select("fx_mode, manual_fx_rate, fx_margin_pct, auto_fulfill")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    fx_mode: (data.fx_mode as "live" | "manual") || "live",
    manual_fx_rate: data.manual_fx_rate === null ? null : Number(data.manual_fx_rate),
    fx_margin_pct: Number(data.fx_margin_pct || 0),
    auto_fulfill: !!data.auto_fulfill,
  };
}

/** The rate this merchant prices with: live feed or their own rate, plus margin. */
function applySettings(liveRate: number, s: MerchantFxSettings): number {
  const base = s.fx_mode === "manual" && Number(s.manual_fx_rate) > 0 ? Number(s.manual_fx_rate) : liveRate;
  return Math.round(base * (1 + Number(s.fx_margin_pct || 0) / 100) * 10000) / 10000;
}

function isDefaultFx(s: MerchantFxSettings) {
  return s.fx_mode === "live" && Number(s.fx_margin_pct || 0) === 0;
}

/**
 * Converts the supplier's own currency (USD for CJ) into ZAR at the merchant's
 * effective rate and refreshes the stored landed cost / recommended price
 * before the product is imported or published.
 */
async function repriceToZar(
  db: ReturnType<typeof adminClient>,
  product: Record<string, any>,
  settings: MerchantFxSettings = DEFAULT_SETTINGS,
) {
  try {
    const supplier = await getSupplier(db, product.supplier_id);
    const currency = product.supplier_currency || supplier.base_currency || "USD";
    const live = await getFxRate(db, currency, "ZAR");
    const fx = applySettings(live, settings);
    const breakdown = calculatePrice(
      Number(product.supplier_cost || 0),
      Number(product.supplier_shipping_cost || 0),
      fx,
      supplier.pricing_rule as never,
    );
    // Only the shared platform rate is written back to the catalogue row; a
    // merchant's own rate stays private to their listings.
    if (
      isDefaultFx(settings) &&
      (breakdown.landedCostZar !== Number(product.landed_cost_zar) ||
        breakdown.recommendedPriceZar !== Number(product.recommended_price_zar))
    ) {
      await db.from("dropship_products").update({
        landed_cost_zar: breakdown.landedCostZar,
        recommended_price_zar: breakdown.recommendedPriceZar,
      }).eq("id", product.id);
    }
    return {
      ...product,
      landed_cost_zar: breakdown.landedCostZar,
      recommended_price_zar: breakdown.recommendedPriceZar,
      fx_rate: fx,
      live_fx_rate: live,
      fx_currency: currency,
    };
  } catch (_err) {
    return { ...product, fx_rate: null, fx_currency: product.supplier_currency || "USD" };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "Unauthorized" }, 401);
    if (!rateLimit(`merchant:${caller.id}`, 120)) return json({ error: "Too many requests" }, 429);

    const db = adminClient();
    const { data: vendor } = await db
      .from("vendors")
      .select("id, status, business_name")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!vendor || vendor.status !== "approved") return json({ error: "Approved merchant account required" }, 403);

    const { data: store } = await db.from("stores").select("id, name").eq("vendor_id", vendor.id).maybeSingle();
    const settings = await getSettings(db, vendor.id);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");


    switch (action) {
      case "listing.create": {
        if (!store) return json({ error: "Create your store first" }, 400);
        const { data: product } = await db
          .from("dropship_products")
          .select("*")
          .eq("id", body.dropship_product_id)
          .in("status", ["approved", "published"])
          .maybeSingle();
        if (!product) return json({ error: "Product is not available" }, 404);

        const { data: existing } = await db
          .from("dropship_listings")
          .select("id")
          .eq("vendor_id", vendor.id)
          .eq("dropship_product_id", product.id)
          .maybeSingle();
        if (existing) return json({ error: "You have already imported this product", listing_id: existing.id }, 409);

        const priced = await repriceToZar(db, product, settings);
        const price = Number(body.selling_price || priced.recommended_price_zar);

        const { data: listing, error } = await db.from("dropship_listings").insert({
          vendor_id: vendor.id,
          store_id: store.id,
          dropship_product_id: product.id,
          selling_price: price,
          status: "draft",
          auto_price_update: body.auto_price_update ?? true,
        }).select().single();
        if (error) throw error;

        await audit(db, {
          actor_id: caller.id, actor_role: "merchant", action: "listing.created",
          entity_type: "listing", entity_id: listing.id,
          new_state: { product: product.name, price },
        });
        await db.from("user_notifications").insert({
          user_id: caller.id, type: "dropship_product_imported",
          title: "Product added", message: `${product.name} was added to your store as a draft.`,
        });
        return json({ listing });
      }

      case "listing.update": {
        const { data: listing } = await db
          .from("dropship_listings")
          .select("*, dropship_products(id, name, recommended_price_zar, landed_cost_zar, stock, status)")
          .eq("id", body.listing_id)
          .eq("vendor_id", vendor.id)
          .maybeSingle();
        if (!listing) return json({ error: "Listing not found" }, 404);

        const update: Record<string, unknown> = {};
        if (body.selling_price !== undefined) {
          const price = Number(body.selling_price);
          const floor = Number((listing as any).dropship_products?.landed_cost_zar || 0);
          if (price < floor) return json({ error: `Price must be at least R${floor.toFixed(2)}` }, 400);
          update.selling_price = price;
          update.price_change_flag = false;
        }
        if (body.auto_price_update !== undefined) update.auto_price_update = !!body.auto_price_update;

        await db.from("dropship_listings").update(update).eq("id", listing.id);
        if (listing.product_id && update.selling_price !== undefined) {
          await db.from("products").update({ price: update.selling_price }).eq("id", listing.product_id);
        }
        await audit(db, {
          actor_id: caller.id, actor_role: "merchant", action: "listing.updated",
          entity_type: "listing", entity_id: listing.id,
          previous_state: { selling_price: listing.selling_price }, new_state: update,
        });
        return json({ success: true });
      }

      case "listing.publish": {
        const { data: listing } = await db
          .from("dropship_listings")
          .select("*, dropship_products(*)")
          .eq("id", body.listing_id)
          .eq("vendor_id", vendor.id)
          .maybeSingle();
        if (!listing) return json({ error: "Listing not found" }, 404);
        let dp: any = listing.dropship_products;
        if (!dp || !["approved", "published"].includes(dp.status)) {
          return json({ error: "This product is not approved for the marketplace" }, 400);
        }
        if (!store) return json({ error: "Create your store first" }, 400);

        // Refresh the ZAR conversion right before the product goes live.
        dp = await repriceToZar(db, dp, settings);
        if (Number(listing.selling_price) < Number(dp.landed_cost_zar || 0)) {
          listing.selling_price = Number(dp.recommended_price_zar);
          await db.from("dropship_listings")
            .update({ selling_price: listing.selling_price, price_change_flag: false })
            .eq("id", listing.id);
        }

        let productId = listing.product_id;
        const images: string[] = Array.isArray(dp.images) ? dp.images : [];
        if (!productId) {
          const { data: created, error } = await db.from("products").insert({
            store_id: store.id,
            name: dp.name,
            slug: slugify(dp.name, listing.id.slice(0, 8)),
            description: dp.description,
            price: listing.selling_price,
            quantity: Math.max(0, (dp.stock || 0) - 2),
            category: dp.category || "general",
            sku: dp.supplier_sku || null,
            status: "active",
            external_source: "dropship",
            external_id: listing.id,
            product_type: "simple",
          }).select().single();
          if (error) throw error;
          productId = created.id;
          if (images.length) {
            await db.from("product_images").insert(
              images.slice(0, 8).map((url) => ({ product_id: productId, image_url: url })),
            );
          }
        } else {
          await db.from("products").update({
            status: "active",
            price: listing.selling_price,
            quantity: Math.max(0, (dp.stock || 0) - 2),
          }).eq("id", productId);
        }

        await db.from("dropship_listings").update({ status: "published", product_id: productId }).eq("id", listing.id);
        await audit(db, {
          actor_id: caller.id, actor_role: "merchant", action: "listing.published",
          entity_type: "listing", entity_id: listing.id, new_state: { product_id: productId },
        });
        return json({ success: true, product_id: productId });
      }

      case "listing.unpublish": {
        const { data: listing } = await db
          .from("dropship_listings").select("*").eq("id", body.listing_id).eq("vendor_id", vendor.id).maybeSingle();
        if (!listing) return json({ error: "Listing not found" }, 404);
        if (listing.product_id) await db.from("products").update({ status: "inactive" }).eq("id", listing.product_id);
        await db.from("dropship_listings").update({ status: "unpublished" }).eq("id", listing.id);
        await audit(db, {
          actor_id: caller.id, actor_role: "merchant", action: "listing.unpublished",
          entity_type: "listing", entity_id: listing.id,
        });
        return json({ success: true });
      }

      case "listing.delete": {
        const { data: listing } = await db
          .from("dropship_listings").select("*").eq("id", body.listing_id).eq("vendor_id", vendor.id).maybeSingle();
        if (!listing) return json({ error: "Listing not found" }, 404);
        if (listing.product_id) await db.from("products").update({ status: "inactive" }).eq("id", listing.product_id);
        await db.from("dropship_listings").delete().eq("id", listing.id);
        await audit(db, {
          actor_id: caller.id, actor_role: "merchant", action: "listing.deleted",
          entity_type: "listing", entity_id: listing.id, previous_state: listing,
        });
        return json({ success: true });
      }

      case "summary": {
        const [listings, fulfillments] = await Promise.all([
          db.from("dropship_listings")
            .select("id, status, units_sold, revenue_zar, profit_zar, price_change_flag, dropship_products(stock, status)")
            .eq("vendor_id", vendor.id),
          db.from("dropship_fulfillments").select("id, status, created_at").eq("vendor_id", vendor.id),
        ]);
        const l = listings.data || [];
        const f = fulfillments.data || [];
        return json({
          products: {
            total: l.length,
            published: l.filter((x) => x.status === "published").length,
            drafts: l.filter((x) => x.status === "draft").length,
            price_alerts: l.filter((x) => x.price_change_flag).length,
            out_of_stock: l.filter((x) => ((x as any).dropship_products?.stock ?? 0) <= 0).length,
          },
          sales: {
            units: l.reduce((s, x) => s + Number(x.units_sold || 0), 0),
            revenue: l.reduce((s, x) => s + Number(x.revenue_zar || 0), 0),
            profit: l.reduce((s, x) => s + Number(x.profit_zar || 0), 0),
          },
          orders: {
            total: f.length,
            in_progress: f.filter((x) => !["delivered", "cancelled", "refunded"].includes(x.status)).length,
            delivered: f.filter((x) => x.status === "delivered").length,
          },
        });
      }

      case "fx.rate": {
        const rate = await getFxRate(db, String(body.from || "USD"), "ZAR");
        const { data: row } = await db
          .from("currency_rates").select("updated_at").eq("currency_code", "ZAR").maybeSingle();
        return json({ from: body.from || "USD", to: "ZAR", rate, updated_at: row?.updated_at ?? null });
      }

      case "store.info": {
        if (!store) return json({ store: null });
        const { data: full } = await db
          .from("stores").select("id, name, slug, logo_url, description").eq("id", store.id).maybeSingle();
        return json({ store: full, vendor: { id: vendor.id, name: vendor.business_name } });
      }

      default:
        return json({ error: `Unknown action "${action}"` }, 400);
    }
  } catch (err) {
    console.error("dropship-merchant error", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
