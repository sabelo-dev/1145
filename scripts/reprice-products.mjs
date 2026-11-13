#!/usr/bin/env node
// Re-prices existing products and variations with the new "markup, then round up
// to a clean price" rule from src/utils/pricingMarkup.ts.
//
// The database only stores the final listed price, so the vendor's price is worked
// backwards:  vendor ≈ current price / (1 + merchant markup %).
// That estimate is wrong for products that were edited (markup added twice),
// products whose merchant's markup changed after listing, and products that never
// had a markup (e.g. the seeded "marketplace" store). Rows that don't look like a
// single clean markup are flagged "CHECK" and skipped unless you include them.
//
// Usage (PowerShell, from the project folder):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
//   node scripts/reprice-products.mjs                 # preview only, writes reprice-preview.csv
//   node scripts/reprice-products.mjs --apply         # back up, then update the OK rows
//
// Options:
//   --apply                 write the new prices (a JSON backup is saved first)
//   --include-flagged       also update rows marked CHECK
//   --include-marketplace   also re-price the seeded "marketplace" store (no markup by default)
//   --exclude=<id>,<id>     product or variation ids to leave alone
//   --restore=<backup.json> put the prices from a backup file back
//
// Nothing changes without --apply or --restore.

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const APPLY = flag("apply");
const INCLUDE_FLAGGED = flag("include-flagged");
const INCLUDE_MARKETPLACE = flag("include-marketplace");
const EXCLUDE = new Set((opt("exclude") || "").split(",").map((s) => s.trim()).filter(Boolean));
const RESTORE = opt("restore");

// ---- Pricing rule: keep in step with src/utils/pricingMarkup.ts ----
const DEFAULT_PLATFORM_MARKUP_PERCENTAGE = 5;
const ROUNDING_TIERS = [
  { minPrice: 1000, step: 100 },
  { minPrice: 100, step: 10 },
  { minPrice: 0, step: 5 },
];
const roundToCleanPrice = (price) => {
  if (price == null || isNaN(price) || price <= 0) return 0;
  const { step } = ROUNDING_TIERS.find((t) => price >= t.minPrice) ?? ROUNDING_TIERS[ROUNDING_TIERS.length - 1];
  const cents = Math.round(price * 100);
  const stepCents = step * 100;
  return (Math.ceil((cents - 1e-6) / stepCents) * stepCents) / 100;
};
const applyPlatformMarkup = (merchantPrice, customMarkup) => {
  if (merchantPrice == null || isNaN(merchantPrice)) return 0;
  const markup = customMarkup ?? DEFAULT_PLATFORM_MARKUP_PERCENTAGE;
  if (markup === 0) return merchantPrice;
  return roundToCleanPrice(merchantPrice * (1 + markup / 100));
};
const round2 = (n) => Math.round(n * 100) / 100;

// Works out the vendor price and the new price for one stored price.
function reprice(current, markup) {
  const price = Number(current);
  if (!price || price <= 0) return null;
  if (markup === 0) return { vendor: price, next: price, status: "OK", note: "0% markup: unchanged" };
  const factor = 1 + markup / 100;
  const vendor = round2(price / factor);
  const consistent = round2(vendor * factor) === round2(price);
  const next = applyPlatformMarkup(vendor, markup);
  return {
    vendor,
    next,
    status: consistent ? "OK" : "CHECK",
    note: consistent ? "" : `price isn't vendor + ${markup}% exactly (edited, markup changed, or no markup)`,
  };
}

// ---- Supabase ----
const url = process.env.SUPABASE_URL || "https://hipomusjocacncjsvgfa.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Set $env:SUPABASE_SERVICE_ROLE_KEY first (Supabase dashboard → Project Settings → API).');
  process.exit(1);
}
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let data, error;
    for (let attempt = 1; attempt <= 5; attempt++) {
      ({ data, error } = await db.from(table).select(columns).range(from, from + 999));
      if (!error) break;
      console.warn(`  ${table}: ${error.message} (attempt ${attempt}/5)`);
      if (attempt < 5) await new Promise((r) => setTimeout(r, attempt * 5000));
    }
    if (error) throw new Error(`${table}: ${error.message}. The database isn't answering: check the project in the Supabase dashboard.`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// ---- Restore from a backup ----
if (RESTORE) {
  const backup = JSON.parse(readFileSync(RESTORE, "utf8"));
  let n = 0;
  for (const p of backup.products) {
    const { error } = await db.from("products").update({ price: p.price, compare_at_price: p.compare_at_price }).eq("id", p.id);
    if (error) console.error(`  ✗ product ${p.id}: ${error.message}`); else n++;
  }
  for (const v of backup.variations) {
    const { error } = await db.from("product_variations").update({ price: v.price }).eq("id", v.id);
    if (error) console.error(`  ✗ variation ${v.id}: ${error.message}`); else n++;
  }
  console.log(`Restored ${n} rows from ${RESTORE}.`);
  process.exit(0);
}

// ---- Load ----
console.log("Reading merchants, stores, products and variations…");
// One table at a time, so a struggling database isn't hit with four queries at once.
const merchants = await fetchAll("merchants", "id, business_name, custom_markup_percentage");
const stores = await fetchAll("stores", "id, merchant_id, name, slug");
const products = await fetchAll("products", "id, store_id, name, status, price, compare_at_price, price_mg_gold");
const variations = await fetchAll("product_variations", "id, product_id, sku, attributes, price");
const merchantById = new Map(merchants.map((m) => [m.id, m]));
const storeById = new Map(stores.map((s) => [s.id, s]));
const productById = new Map(products.map((p) => [p.id, p]));

const contextFor = (product) => {
  const store = storeById.get(product.store_id);
  const merchant = store && merchantById.get(store.merchant_id);
  const markup = merchant?.custom_markup_percentage ?? DEFAULT_PLATFORM_MARKUP_PERCENTAGE;
  const isMarketplace = (store?.slug || "").toLowerCase() === "marketplace";
  return { store, merchant, markup: Number(markup), isMarketplace };
};

// ---- Plan ----
const plan = []; // one entry per price field to change
const rows = [];
const header = ["type", "id", "store", "product", "variation", "status", "markup_%", "field", "current", "est_vendor", "new", "change", "will_update", "note"];

function consider({ type, id, ctx, productName, variationLabel, field, current, productStatus }) {
  if (current == null) return;
  let r = reprice(current, ctx.markup);
  if (!r) return;
  let note = r.note;
  let status = r.status;
  if (ctx.isMarketplace) {
    status = "CHECK";
    note = "seeded marketplace store: prices were set without markup";
  }
  const changes = round2(r.next) !== round2(Number(current));
  const willUpdate =
    changes && !EXCLUDE.has(id) && (status === "OK" || INCLUDE_FLAGGED || (ctx.isMarketplace && INCLUDE_MARKETPLACE));
  rows.push([
    type, id, ctx.store?.name ?? "?", productName, variationLabel, productStatus,
    ctx.markup, field, Number(current).toFixed(2), r.vendor.toFixed(2), r.next.toFixed(2),
    (r.next - Number(current)).toFixed(2), willUpdate ? "yes" : "no", note,
  ]);
  if (willUpdate) plan.push({ type, id, field, from: Number(current), to: r.next });
}

for (const p of products) {
  const ctx = contextFor(p);
  consider({ type: "product", id: p.id, ctx, productName: p.name, variationLabel: "", field: "price", current: p.price, productStatus: p.status });
  consider({ type: "product", id: p.id, ctx, productName: p.name, variationLabel: "", field: "compare_at_price", current: p.compare_at_price, productStatus: p.status });
}
for (const v of variations) {
  const p = productById.get(v.product_id);
  if (!p) continue;
  const ctx = contextFor(p);
  const label = v.sku || (v.attributes && typeof v.attributes === "object" ? Object.values(v.attributes).join(" / ") : "");
  consider({ type: "variation", id: v.id, ctx, productName: p.name, variationLabel: label, field: "price", current: v.price, productStatus: p.status });
}

const previewPath = join(ROOT, `reprice-preview-${stamp()}.csv`);
writeFileSync(previewPath, [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"));

const gold = products.filter((p) => p.price_mg_gold != null).length;
console.log(`\n${products.length} products, ${variations.length} variations read.`);
console.log(`${rows.length} prices looked at, ${plan.length} would be updated, ${rows.filter((r) => r[13]).length} flagged CHECK or unchanged-with-note.`);
if (gold) console.log(`Note: ${gold} products have price_mg_gold set. This script doesn't change it; check whether it needs recalculating.`);
console.log(`Preview: ${previewPath}`);

if (!APPLY) {
  console.log("\nPreview only. Nothing was changed. Re-run with --apply to update the rows marked will_update = yes.");
  process.exit(0);
}

// ---- Back up, then apply ----
const touchedProducts = new Set(plan.filter((x) => x.type === "product").map((x) => x.id));
const touchedVariations = new Set(plan.filter((x) => x.type === "variation").map((x) => x.id));
const backupPath = join(ROOT, `reprice-backup-${stamp()}.json`);
writeFileSync(backupPath, JSON.stringify({
  takenAt: new Date().toISOString(),
  products: products.filter((p) => touchedProducts.has(p.id)).map(({ id, price, compare_at_price }) => ({ id, price, compare_at_price })),
  variations: variations.filter((v) => touchedVariations.has(v.id)).map(({ id, price }) => ({ id, price })),
}, null, 2));
console.log(`\nBackup of current prices: ${backupPath}`);
console.log(`To undo: node scripts/reprice-products.mjs --restore="${backupPath}"`);

let ok = 0, failed = 0;
for (const change of plan) {
  const table = change.type === "product" ? "products" : "product_variations";
  const { error } = await db.from(table).update({ [change.field]: change.to }).eq("id", change.id);
  if (error) { failed++; console.error(`  ✗ ${change.type} ${change.id} ${change.field}: ${error.message}`); }
  else ok++;
}
console.log(`\nUpdated ${ok} prices${failed ? `, ${failed} failed (see above)` : ""}.`);
