// Checks that CJ stock can be fetched for several variants in one call.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CJAdapter } from "../_shared/dropship/cj.ts";

Deno.test("CJ bulk stock lookup", async () => {
  const cj = new CJAdapter(Deno.env.get("CJ_EMAIL")!, Deno.env.get("CJ_API_KEY")!);
  const { items } = await cj.discover({ page: 1, pageSize: 3 });
  const detail = await cj.getProduct(items[0].supplierProductId);
  console.log("variant stocks after detail:", detail.variants.map((v) => v.stock).join(","), "total:", detail.stock);
  const vids = detail.variants.map((v) => v.supplierVariantId);
  const stock = await cj.getStock(vids);
  console.log("bulk stock:", JSON.stringify(stock));
  assert(vids.length > 0);
});
