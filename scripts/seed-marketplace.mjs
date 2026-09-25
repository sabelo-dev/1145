#!/usr/bin/env node
// Seeds the "Marketplace" merchant store with the 1145 DROP 001 products.
//
// Creates (or updates, if they already exist):
//   * auth user marketplace@1145.io with the vendor role
//   * an approved, active vendor + store named "Marketplace" (slug: marketplace)
//   * one product per garment (status "pending" = hidden until an admin
//     approves it), with a colour variation per manifest row
//   * product images converted to WebP and uploaded to the product-images bucket
//
// Products stay "pending" with price 0 and no stock, as the manifest has no
// price/stock yet and the image pack says to confirm samples first. Set price,
// stock and status (approved) in the merchant/admin dashboard to go live.
//
// Usage (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
//   $env:MARKETPLACE_PASSWORD = "<password>"
//   node scripts/seed-marketplace.mjs            # seed
//   node scripts/seed-marketplace.mjs --dry-run  # validate files, no network

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DROP_DIR = join(ROOT, "supabase", "seed", "drop-001");

export const MARKETPLACE = {
  email: "marketplace@1145.io",
  name: "Marketplace",
  storeSlug: "marketplace",
  description: "Official 1145 merchandise — DROP 001.",
};

// Manifest garment code -> catalogue placement (products.category = categories.name)
const GARMENTS = {
  bra: { code: "BR", category: "Clothing", subcategory: "Womens Clothing" },
  legging: { code: "LG", category: "Clothing", subcategory: "Womens Clothing" },
  hoodie: { code: "HD", category: "Clothing", subcategory: "Mens Clothing, Womens Clothing" },
  tracksuit: { code: "TS", category: "Clothing", subcategory: "Mens Clothing, Womens Clothing" },
  cap: { code: "CP", category: "Clothing", subcategory: "Accessories" },
};

const BUCKET = "product-images";
const STORAGE_PREFIX = "marketplace/drop-001";

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, commas in quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Groups manifest rows into products (one per product_name) with colour variations. */
export function buildCatalogue(rows) {
  const products = new Map();
  for (const row of rows) {
    const garment = GARMENTS[row.category];
    if (!garment) throw new Error(`Unknown manifest category "${row.category}" (sku ${row.sku})`);
    if (!row.sku.startsWith(`1145-D001-${garment.code}-`)) throw new Error(`SKU ${row.sku} does not match category ${row.category}`);
    if (!products.has(row.product_name)) {
      products.set(row.product_name, {
        name: row.product_name,
        slug: slugify(row.product_name),
        sku: `1145-D001-${garment.code}`,
        description: row.description,
        category: garment.category,
        subcategory: garment.subcategory,
        variations: [],
      });
    }
    products.get(row.product_name).variations.push({
      sku: row.sku,
      colour: row.colour,
      imageFile: row.image_filename,
      altText: row.alt_text,
      price: row.price_zar ? Number(row.price_zar) : 0,
      quantity: row.stock_quantity ? Number(row.stock_quantity) : 0,
    });
  }
  return [...products.values()];
}

export function loadDrop(dropDir = DROP_DIR) {
  const rows = parseCsv(readFileSync(join(dropDir, "manifest.csv"), "utf8"));
  const catalogue = buildCatalogue(rows);
  const missing = rows.map((r) => r.image_filename).filter((f) => !existsSync(join(dropDir, "images", f)));
  if (missing.length) throw new Error(`Missing images: ${missing.join(", ")}`);
  const skus = rows.map((r) => r.sku);
  const dupes = skus.filter((s, i) => skus.indexOf(s) !== i);
  if (dupes.length) throw new Error(`Duplicate SKUs in manifest: ${dupes.join(", ")}`);
  return { rows, catalogue };
}

async function toWebp(path) {
  const { default: sharp } = await import("sharp");
  return sharp(path).webp({ quality: 85 }).toBuffer();
}

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

/**
 * Makes sure every category/subcategory the catalogue uses exists (matched by
 * slug) and returns the stored names, since products.category holds the name.
 */
async function ensureCategories(db, catalogue, log) {
  const wanted = new Map();
  for (const p of catalogue) {
    const subs = wanted.get(p.category) ?? new Set();
    p.subcategory.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => subs.add(s));
    wanted.set(p.category, subs);
  }

  const names = new Map();
  for (const [category, subs] of wanted) {
    let row = must(await db.from("categories").select("id, name").eq("slug", slugify(category)).maybeSingle(), `Read category ${category}`);
    if (!row) {
      row = must(await db.from("categories").insert({ name: category, slug: slugify(category), is_active: true }).select("id, name").single(), `Create category ${category}`);
      log(`Created category ${category}`);
    }
    names.set(category, row.name);

    for (const sub of subs) {
      const existing = must(await db.from("subcategories").select("id").eq("category_id", row.id).eq("slug", slugify(sub)).maybeSingle(), `Read subcategory ${sub}`);
      if (!existing) {
        must(await db.from("subcategories").insert({ category_id: row.id, name: sub, slug: slugify(sub), is_active: true }), `Create subcategory ${sub}`);
        log(`Created subcategory ${category} › ${sub}`);
      }
    }
  }
  return names;
}

async function findUserByEmail(db, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`List users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit || data.users.length < 1000) return hit ?? null;
  }
}

export async function seed(db, { password, dropDir = DROP_DIR, convert = toWebp, log = console.log } = {}) {
  const { catalogue } = loadDrop(dropDir);

  // 1. Merchant login (the signup trigger adds profile + vendor role on create).
  let user = await findUserByEmail(db, MARKETPLACE.email);
  if (!user) {
    if (!password) throw new Error("MARKETPLACE_PASSWORD is required to create the account");
    user = must(await db.auth.admin.createUser({
      email: MARKETPLACE.email,
      password,
      email_confirm: true,
      user_metadata: { name: MARKETPLACE.name, full_name: MARKETPLACE.name, role: "vendor" },
    }), "Create user").user;
    log(`Created user ${MARKETPLACE.email}`);
  } else {
    if (password) must(await db.auth.admin.updateUserById(user.id, { password }), "Update password");
    log(`Using existing user ${MARKETPLACE.email}${password ? " (password updated)" : ""}`);
  }

  const profile = must(await db.from("profiles").select("id").eq("id", user.id).maybeSingle(), "Read profile");
  if (!profile) {
    must(await db.from("profiles").insert({ id: user.id, email: MARKETPLACE.email, name: MARKETPLACE.name, role: "vendor" }), "Create profile");
  }
  must(await db.from("user_roles").upsert({ user_id: user.id, role: "vendor" }, { onConflict: "user_id,role" }), "Grant vendor role");

  // 2. Approved, active vendor.
  const now = new Date().toISOString();
  const vendorFields = {
    business_name: MARKETPLACE.name,
    description: MARKETPLACE.description,
    status: "approved",
    onboarding_status: "ACTIVE",
    onboarding_completed_at: now,
    approval_date: now,
  };
  let vendor = must(await db.from("vendors").select("id").eq("user_id", user.id).maybeSingle(), "Read vendor");
  if (vendor) {
    must(await db.from("vendors").update(vendorFields).eq("id", vendor.id), "Update vendor");
  } else {
    vendor = must(await db.from("vendors").insert({ user_id: user.id, ...vendorFields }).select("id").single(), "Create vendor");
  }
  log(`Vendor ${vendor.id} ready`);

  // 3. Store.
  let store = must(await db.from("stores").select("id, slug").eq("vendor_id", vendor.id).maybeSingle(), "Read store");
  const storeFields = {
    name: MARKETPLACE.name,
    slug: MARKETPLACE.storeSlug,
    description: MARKETPLACE.description,
    logo_url: `${(process.env.SITE_URL || "https://1145.io").replace(/\/+$/, "")}/logo.png`,
  };
  if (store) {
    must(await db.from("stores").update(storeFields).eq("id", store.id), "Update store");
  } else {
    const taken = must(await db.from("stores").select("id").eq("slug", MARKETPLACE.storeSlug).maybeSingle(), "Check store slug");
    if (taken) throw new Error(`Store slug "${MARKETPLACE.storeSlug}" is already used by another store`);
    store = must(await db.from("stores").insert({ vendor_id: vendor.id, ...storeFields }).select("id").single(), "Create store");
  }
  log(`Store ${store.id} (/${MARKETPLACE.storeSlug}) ready`);

  // 4. Products, images and colour variations.
  const categoryNames = await ensureCategories(db, catalogue, log);
  const summary = [];
  for (const product of catalogue) {
    const productFields = {
      store_id: store.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      category: categoryNames.get(product.category),
      subcategory: product.subcategory,
      product_type: "variable",
      listing_type: "sale",
      status: "pending", // products allow pending | approved | rejected
      price: 0,
      quantity: product.variations.reduce((sum, v) => sum + v.quantity, 0),
    };
    let row = must(await db.from("products").select("id").eq("store_id", store.id).eq("sku", product.sku).maybeSingle(), `Read ${product.sku}`);
    if (row) {
      must(await db.from("products").update(productFields).eq("id", row.id), `Update ${product.sku}`);
    } else {
      row = must(await db.from("products").insert(productFields).select("id").single(), `Create ${product.sku}`);
    }

    const imageRows = [];
    for (const [position, v] of product.variations.entries()) {
      const objectPath = `${STORAGE_PREFIX}/${v.imageFile.replace(/\.png$/i, ".webp")}`;
      const body = await convert(join(dropDir, "images", v.imageFile));
      must(await db.storage.from(BUCKET).upload(objectPath, body, {
        contentType: "image/webp", cacheControl: "31536000", upsert: true,
      }), `Upload ${v.imageFile}`);
      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(objectPath);
      imageRows.push({ product_id: row.id, image_url: publicUrl, position });

      const variationFields = {
        product_id: row.id,
        sku: v.sku,
        attributes: { Color: v.colour },
        price: v.price,
        quantity: v.quantity,
        image_url: publicUrl,
      };
      const existing = must(await db.from("product_variations").select("id").eq("product_id", row.id).eq("sku", v.sku).maybeSingle(), `Read ${v.sku}`);
      if (existing) must(await db.from("product_variations").update(variationFields).eq("id", existing.id), `Update ${v.sku}`);
      else must(await db.from("product_variations").insert(variationFields), `Create ${v.sku}`);
    }

    must(await db.from("product_images").delete().eq("product_id", row.id), `Clear images ${product.sku}`);
    must(await db.from("product_images").insert(imageRows), `Save images ${product.sku}`);
    summary.push(`${product.name}: ${product.variations.map((v) => v.colour).join(", ")}`);
    log(`  ✓ ${product.name} (${product.variations.length} colours)`);
  }

  return { userId: user.id, vendorId: vendor.id, storeId: store.id, products: summary };
}

// ---------------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes("--dry-run");
  try {
    const { rows, catalogue } = loadDrop();
    console.log(`Manifest OK: ${rows.length} SKUs, ${catalogue.length} products, all images present.`);
    if (dryRun) {
      for (const p of catalogue) console.log(`  ${p.sku}  ${p.name}  [${p.category} / ${p.subcategory}]  ${p.variations.map((v) => v.colour).join(", ")}`);
      const sample = await toWebp(join(DROP_DIR, "images", rows[0].image_filename));
      console.log(`WebP conversion OK (${rows[0].image_filename}: ${Math.round(sample.length / 1024)} KB)`);
      process.exit(0);
    }

    const url = process.env.SUPABASE_URL || "https://hipomusjocacncjsvgfa.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API).");
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const result = await seed(db, { password: process.env.MARKETPLACE_PASSWORD });
    const site = (process.env.SITE_URL || "https://1145.io").replace(/\/$/, "");
    console.log(`\nDone. Storefront: ${site}/store/${MARKETPLACE.storeSlug} (products are pending until an admin approves them)`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`\nSeed failed: ${err.message}`);
    process.exit(1);
  }
}
