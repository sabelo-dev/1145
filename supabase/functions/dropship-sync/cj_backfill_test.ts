// One-off maintenance run: refresh real CJ stock for every imported product.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CJAdapter } from "../_shared/dropship/cj.ts";

Deno.test("backfill CJ stock", async () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  assert(url && key, "service credentials unavailable");
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const cj = new CJAdapter(Deno.env.get("CJ_EMAIL")!, Deno.env.get("CJ_API_KEY")!);

  const { data: products } = await db
    .from("dropship_products")
    .select("id, supplier_product_id, name, stock")
    .in("status", ["pending_approval", "approved", "published"])
    .limit(25);

  for (const p of products || []) {
    try {
      const fresh = await cj.getProduct(p.supplier_product_id);
      await db.from("dropship_products").update({
        stock: fresh.stock,
        sync_status: "ok",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
      }).eq("id", p.id);
      for (const v of fresh.variants) {
        await db.from("dropship_variants")
          .update({ stock: v.stock })
          .eq("dropship_product_id", p.id)
          .eq("supplier_variant_id", v.supplierVariantId);
      }
      console.log(`${p.name?.slice(0, 40)}: ${p.stock} -> ${fresh.stock}`);
    } catch (err) {
      console.log(`FAILED ${p.supplier_product_id}: ${err instanceof Error ? err.message : err}`);
    }
  }
});
