// One-off maintenance run: read real CJ stock for the imported catalogue and
// print it so it can be written back to the platform database.
import { CJAdapter } from "../_shared/dropship/cj.ts";

const PIDS = [
  "2609070847031624000","2609070848441632500","2609070850091636700","2609070854131612700",
  "2609070915571620800","2609070918271619300","2609070922361628400","2609070927331612400",
  "2609070927461613600","2609070933571630500","2609070942041638900","2609070950211612200",
  "2609071007351635300","2609071008451607500","2609071029291631900","2609071044161631300",
  "2609071131291619600","2609071219441629800","2609071228231606400","2609071322371632000",
  "2609071343121630000","2609071403041612700","2609040938031625500","2609041147221629700",
  "2609040951381616200","2609041106391621800","2609031522591614400",
];

Deno.test("read CJ stock for catalogue", async () => {
  const cj = new CJAdapter(Deno.env.get("CJ_EMAIL")!, Deno.env.get("CJ_API_KEY")!);
  const product: string[] = [];
  const variant: string[] = [];
  for (const pid of PIDS) {
    try {
      const fresh = await cj.getProduct(pid);
      product.push(`('${pid}',${fresh.stock})`);
      for (const v of fresh.variants) variant.push(`('${v.supplierVariantId}',${v.stock})`);
    } catch (err) {
      console.log(`FAILED ${pid}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("PRODUCTS::" + product.join(","));
  console.log("VARIANTS::" + variant.join(","));
});
