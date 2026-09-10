// Exercises the CJdropshipping endpoints the platform depends on:
// product search, product detail (variants) and stock lookup.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CJAdapter } from "../_shared/dropship/cj.ts";

const adapter = () =>
  new CJAdapter(Deno.env.get("CJ_EMAIL")!, Deno.env.get("CJ_API_KEY")!);

Deno.test("CJ product search returns items", async () => {
  const cj = adapter();
  const { items, total } = await cj.discover({ query: "watch", page: 1, pageSize: 5 });
  console.log("search total:", total, "items:", items.length, items[0]?.name);
  assert(items.length > 0, "no products returned from CJ search");
});

Deno.test("CJ product detail returns variants", async () => {
  const cj = adapter();
  const { items } = await cj.discover({ page: 1, pageSize: 3 });
  const pid = items[0]?.supplierProductId;
  assert(pid, "no product id from search");
  const detail = await cj.getProduct(pid);
  console.log("detail:", detail.name, "variants:", detail.variants.length, "cost:", detail.cost, "stock:", detail.stock);
  assert(detail.name, "product detail missing name");
  const vid = detail.variants[0]?.supplierVariantId;
  if (vid) {
    const stock = await cj.getStock([vid]);
    console.log("stock rows:", JSON.stringify(stock));
  }
});
