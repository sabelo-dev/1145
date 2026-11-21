// 1145 POS (20261120090000_merchant_pos.sql): pricing, discounts, VAT,
// tenders and change, stock, shifts and cash-up, refunds and voids, run
// against the real migration in PGlite with the tables it builds on stubbed.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1), cashier = id(2), operator = id(3), stranger = id(4);
const merchant = id(10), store = id(20), otherStore = id(21);
const mug = id(30), shirt = id(31), ebook = id(32), shirtS = id(40), shirtM = id(41);
const payReq = id(50), otherPayReq = id(51);

before(async () => {
  await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user', true), '')::uuid $$;
  CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
  CREATE TABLE profiles(id uuid PRIMARY KEY, name text, email text);
  CREATE TABLE stores(id uuid PRIMARY KEY, merchant_id uuid, name text, pickup_address jsonb);
  CREATE TABLE merchant_feature_flags(merchant_id uuid, flag_key text CONSTRAINT merchant_feature_flags_flag_key_check
    CHECK (flag_key IN ('order_console','payment_requests','ai_assistant')), enabled boolean);
  CREATE TABLE roles(store_id uuid, user_id uuid, role text);
  CREATE FUNCTION public.store_role_permissions(p_role text) RETURNS text[] LANGUAGE sql AS $$
    SELECT CASE p_role WHEN 'owner' THEN ARRAY['orders','catalog','payments','insights','operations','settings']
      WHEN 'operator' THEN ARRAY['orders','payments','insights','operations'] WHEN 'cashier' THEN ARRAY['orders','payments']
      ELSE ARRAY[]::text[] END $$;
  CREATE FUNCTION public.store_has_permission(p_store uuid, p_perm text, p_user uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql AS $$
    SELECT COALESCE((SELECT p_perm = ANY(public.store_role_permissions(role)) FROM roles WHERE store_id = p_store AND user_id = p_user), false) $$;
  CREATE FUNCTION public.require_store_access(p_store uuid, p_perm text, p_flag text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    IF NOT public.store_has_permission(p_store, p_perm) THEN RAISE EXCEPTION 'You do not have % access to this store', p_perm; END IF;
    IF p_flag IS NOT NULL AND NOT EXISTS (SELECT 1 FROM merchant_feature_flags f JOIN stores s ON s.merchant_id = f.merchant_id
       WHERE s.id = p_store AND f.flag_key = p_flag AND f.enabled) THEN RAISE EXCEPTION 'This feature is not enabled for your store yet'; END IF;
  END $$;
  CREATE TABLE products(id uuid PRIMARY KEY, store_id uuid, name text, sku text, category text, price numeric, quantity int,
    product_type text DEFAULT 'physical', status text DEFAULT 'active', updated_at timestamptz);
  CREATE TABLE product_variations(id uuid PRIMARY KEY, product_id uuid, sku text, attributes jsonb, price numeric, quantity int);
  CREATE TABLE product_images(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid, image_url text, position int, created_at timestamptz DEFAULT now());
  CREATE TABLE merchant_stock_adjustments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid, product_id uuid, variation_id uuid,
    old_quantity int, new_quantity int, reason text CONSTRAINT merchant_stock_adjustments_reason_check
    CHECK (reason IN ('received','count','damaged','returned','other')), note text, actor_user_id uuid, created_at timestamptz DEFAULT now());
  CREATE TABLE merchant_payment_requests(id uuid PRIMARY KEY, store_id uuid, amount_minor int, status text);
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/20261120090000_merchant_pos.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });

beforeEach(async () => {
  await db.exec(`TRUNCATE pos_refunds, pos_sale_payments, pos_sale_lines, pos_sales, pos_cash_movements, pos_shifts, pos_counters,
    pos_settings, merchant_stock_adjustments, merchant_payment_requests, product_images, product_variations, products, roles,
    merchant_feature_flags, stores, profiles, auth.users CASCADE`);
  await db.query("INSERT INTO auth.users VALUES ($1),($2),($3),($4)", [owner, cashier, operator, stranger]);
  await db.query("INSERT INTO profiles VALUES ($1,'Olive','o@x.co'),($2,'Cara','c@x.co'),($3,'Otto','t@x.co')", [owner, cashier, operator]);
  await db.query("INSERT INTO stores VALUES ($1,$2,'Corner Café',null),($3,$2,'Other',null)", [store, merchant, otherStore]);
  await db.query("INSERT INTO merchant_feature_flags VALUES ($1,'pos',true)", [merchant]);
  await db.query("INSERT INTO roles VALUES ($1,$2,'owner'),($1,$3,'cashier'),($1,$4,'operator')", [store, owner, cashier, operator]);
  await db.query(`INSERT INTO products(id,store_id,name,sku,category,price,quantity,product_type) VALUES
    ($1,$4,'Mug','MUG-1','Kitchen',100.00,10,'physical'),
    ($2,$4,'T-shirt',null,'Clothing',200.00,0,'physical'),
    ($3,$4,'Recipe e-book','EB-1','Books',50.00,0,'downloadable')`, [mug, shirt, ebook, store]);
  await db.query(`INSERT INTO product_variations VALUES ($1,$3,'TS-S','{"Size":"S"}',0,4),($2,$3,'TS-M','{"Size":"M"}',250.00,1)`,
    [shirtS, shirtM, shirt]);
  await as(cashier);
});

const as = (u: string) => db.query("SELECT set_config('test.user',$1,false)", [u]);
let keyN = 0;
const key = () => `k${++keyN}`;
// Database results are loose JSON; the tests assert on them field by field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
const one = async (sql: string, args: unknown[] = []) => (await db.query<{ r: Json }>(sql, args)).rows[0].r;
const openShift = (floatMinor = 50000, register = "Till 1") =>
  one("SELECT pos_shift_open($1,$2,$3,$4) r", [store, register, floatMinor, key()]);
const sell = (shiftId: string, lines: Json[], payments: Json[], saleDiscount = 0, k = key()) =>
  one("SELECT pos_sale_create($1,$2,$3,$4,$5,null,null,null,$6) r",
    [store, shiftId, JSON.stringify(lines), saleDiscount, JSON.stringify(payments), k]);
const stockOf = async (table: "products" | "product_variations", rowId: string) =>
  (await db.query<{ quantity: number }>(`SELECT quantity FROM ${table} WHERE id = $1`, [rowId])).rows[0].quantity;

test("a cash sale prices from the catalogue, gives change and takes stock out", async () => {
  const shift = await openShift();
  const sale = await sell(shift.shift_id, [{ product_id: mug, quantity: 2 }], [{ method: "cash", amount_minor: 25000 }]);
  assert.equal(sale.sale_number, 1);
  assert.equal(sale.total_minor, 20000);
  assert.equal(sale.change_minor, 5000);
  assert.equal(sale.payments[0].amount_minor, 20000);
  assert.equal(sale.vat_minor, 0);
  assert.equal(await stockOf("products", mug), 8);
  const report = await one("SELECT pos_shift_report($1) r", [shift.shift_id]);
  assert.equal(report.expected_cash_minor, 70000);
  assert.equal(report.by_method.cash, 20000);
});

test("the same request key never rings a sale up twice", async () => {
  const shift = await openShift();
  const k = key();
  await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "card", amount_minor: 10000 }], 0, k);
  const again = await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "card", amount_minor: 10000 }], 0, k);
  assert.equal(again.repeated, true);
  assert.equal(await stockOf("products", mug), 9);
});

test("variants need choosing, use their own price and stock; stock never goes below zero", async () => {
  const shift = await openShift();
  await assert.rejects(sell(shift.shift_id, [{ product_id: shirt, quantity: 1 }], [{ method: "cash", amount_minor: 30000 }]), /choose which T-shirt/);
  const sale = await sell(shift.shift_id, [{ product_id: shirt, variation_id: shirtM, quantity: 2 }, { product_id: shirt, variation_id: shirtS, quantity: 1 }],
    [{ method: "card", amount_minor: 70000 }]);
  assert.equal(sale.lines[0].name, "T-shirt (M)");
  assert.equal(sale.lines[0].unit_price_minor, 25000);
  assert.equal(sale.lines[1].unit_price_minor, 20000); // price 0 on the variant falls back to the product
  assert.equal(await stockOf("product_variations", shirtM), 0);
  assert.equal(await stockOf("product_variations", shirtS), 3);
});

test("cashiers can't change prices or give more than the store's discount limit; operators can", async () => {
  const shift = await openShift();
  await assert.rejects(sell(shift.shift_id, [{ product_id: mug, quantity: 1, unit_price_minor: 5000 }], [{ method: "cash", amount_minor: 5000 }]),
    /Only a manager or operator can change a price/);
  await assert.rejects(sell(shift.shift_id, [{ product_id: mug, quantity: 1, discount_minor: 1500 }], [{ method: "cash", amount_minor: 8500 }]),
    /Discounts over 10.0% need a manager/);
  const ok = await sell(shift.shift_id, [{ product_id: mug, quantity: 1, discount_minor: 1000 }], [{ method: "cash", amount_minor: 9000 }]);
  assert.equal(ok.total_minor, 9000);
  await as(operator);
  const big = await sell(shift.shift_id, [{ product_id: mug, quantity: 1, unit_price_minor: 5000 }], [{ method: "cash", amount_minor: 5000 }]);
  assert.equal(big.total_minor, 5000);
});

test("a sale discount is shared across lines to the cent, and VAT is worked out on the total", async () => {
  await as(owner);
  await one("SELECT pos_settings_set($1,true,'4123456789',null,'Thanks!',1000,true) r", [store]);
  const shift = await openShift();
  const sale = await sell(shift.shift_id,
    [{ product_id: mug, quantity: 1 }, { name: "Coffee", quantity: 3, unit_price_minor: 3333 }],
    [{ method: "cash", amount_minor: 20000 }], 1000);
  const lines = sale.lines as Json[];
  assert.equal(lines.reduce((s, l) => s + l.line_total_minor, 0), sale.total_minor);
  assert.equal(sale.total_minor, 10000 + 9999 - 1000);
  assert.equal(sale.vat_minor, Math.round((18999 * 1500) / 11500));
  assert.equal(sale.store.vat_number, "4123456789");
});

test("tenders: only cash gives change; split payments; nothing short", async () => {
  const shift = await openShift();
  await assert.rejects(sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "card", amount_minor: 12000 }]), /Only cash can give change/);
  await assert.rejects(sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "cash", amount_minor: 4000 }]), /R60.00 is still to pay/);
  const split = await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "card", amount_minor: 6000 }, { method: "cash", amount_minor: 5000 }]);
  assert.equal(split.change_minor, 1000);
  assert.deepEqual(split.payments.map((p: Json) => p.amount_minor).sort(), [4000, 6000]);
});

test("1145 Pay is accepted only when that request is paid, for this store, once", async () => {
  await db.query("INSERT INTO merchant_payment_requests VALUES ($1,$2,10000,'pending'),($3,$4,10000,'paid')", [payReq, store, otherPayReq, otherStore]);
  const shift = await openShift();
  const pay = (req: string) => sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "pay_1145", amount_minor: 10000, payment_request_id: req }]);
  await assert.rejects(pay(payReq), /has not come through yet/);
  await assert.rejects(pay(otherPayReq), /not for this store/);
  await db.query("UPDATE merchant_payment_requests SET status='paid' WHERE id=$1", [payReq]);
  await pay(payReq);
  await assert.rejects(pay(payReq), /already been used/);
});

test("open items, and downloadable products don't move stock", async () => {
  const shift = await openShift();
  const sale = await sell(shift.shift_id, [{ name: "Gift wrap", quantity: 1, unit_price_minor: 1500 }, { product_id: ebook, quantity: 1 }],
    [{ method: "eft", amount_minor: 6500, reference: "EFT123" }]);
  assert.equal(sale.total_minor, 6500);
  assert.equal(await stockOf("products", ebook), 0);
  assert.equal((await db.query("SELECT 1 FROM merchant_stock_adjustments")).rows.length, 0);
  await as(owner);
  await one("SELECT pos_settings_set($1,false,null,null,null,1000,false) r", [store]);
  await assert.rejects(sell(shift.shift_id, [{ name: "Gift wrap", quantity: 1, unit_price_minor: 1500 }], [{ method: "cash", amount_minor: 1500 }]),
    /Open items are switched off/);
});

test("partial then full refund gives back exactly what was paid, restocks, and counts against the drawer", async () => {
  const shift = await openShift();
  const sale = await sell(shift.shift_id, [{ product_id: mug, quantity: 3 }], [{ method: "cash", amount_minor: 30000 }], 1000);
  const line = sale.lines[0].line_id;
  const refund = (qty: number, k = key()) =>
    one("SELECT pos_sale_refund($1,$2,$3,'cash','Chipped',true,$4) r", [sale.sale_id, shift.shift_id, JSON.stringify([{ line_id: line, quantity: qty }]), k]);
  await assert.rejects(refund(1), /operations access/);
  await as(operator);
  const first = await refund(1);
  assert.equal(first.status, "partially_refunded");
  assert.equal(first.refunded_minor, 9666);
  await assert.rejects(refund(3), /Only 2 of Mug can still be refunded/);
  const full = await refund(2);
  assert.equal(full.status, "refunded");
  assert.equal(full.refunded_minor, 29000);
  assert.equal(await stockOf("products", mug), 10);
  const report = await one("SELECT pos_shift_report($1) r", [shift.shift_id]);
  assert.equal(report.expected_cash_minor, 50000);
  assert.equal(report.refunds_count, 2);
});

test("voids put stock back, but not after a refund, on a closed shift, or for 1145 Pay", async () => {
  const shift = await openShift();
  const sale = await sell(shift.shift_id, [{ product_id: mug, quantity: 2 }], [{ method: "cash", amount_minor: 20000 }]);
  await assert.rejects(one("SELECT pos_sale_void($1,'Wrong item') r", [sale.sale_id]), /operations access/);
  await as(operator);
  await assert.rejects(one("SELECT pos_sale_void($1,'') r", [sale.sale_id]), /Say why/);
  const voided = await one("SELECT pos_sale_void($1,'Wrong item') r", [sale.sale_id]);
  assert.equal(voided.status, "voided");
  assert.equal(await stockOf("products", mug), 10);
  const report = await one("SELECT pos_shift_report($1) r", [shift.shift_id]);
  assert.equal(report.sales_count, 0);
  assert.equal(report.voids_count, 1);
  assert.equal(report.expected_cash_minor, 50000);

  await db.query("INSERT INTO merchant_payment_requests VALUES ($1,$2,10000,'paid')", [payReq, store]);
  const paid = await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "pay_1145", amount_minor: 10000, payment_request_id: payReq }]);
  await assert.rejects(one("SELECT pos_sale_void($1,'x') r", [paid.sale_id]), /1145 Pay cannot be voided/);
});

test("shifts: one open per till, cash in and out, close with a count and variance", async () => {
  const shift = await openShift(50000);
  await assert.rejects(openShift(0, "till 1"), /already open on till 1/);
  await one("SELECT pos_cash_movement($1,'pay_out',2000,'Milk',$2) r", [shift.shift_id, key()]);
  await one("SELECT pos_cash_movement($1,'pay_in',10000,'Change from bank',$2) r", [shift.shift_id, key()]);
  await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "cash", amount_minor: 10000 }]);
  const closed = await one("SELECT pos_shift_close($1,$2,'Short a coin') r", [shift.shift_id, 67950]);
  assert.equal(closed.status, "closed");
  assert.equal(closed.expected_cash_minor, 68000);
  assert.equal(closed.variance_minor, -50);
  await assert.rejects(sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "cash", amount_minor: 10000 }]), /Open a shift/);
  const again = await openShift(0);
  assert.notEqual(again.shift_id, shift.shift_id);
});

test("people outside the store, or stores without POS, get nothing", async () => {
  await as(stranger);
  await assert.rejects(one("SELECT pos_catalog($1) r", [store]), /orders access/);
  await as(owner);
  await db.query("UPDATE merchant_feature_flags SET enabled=false");
  await assert.rejects(one("SELECT pos_catalog($1) r", [store]), /not enabled/);
});

test("catalogue, sales list and day summary", async () => {
  const catalog = (await one("SELECT pos_catalog($1) r", [store])) as unknown as Json[];
  const tshirt = catalog.find((p) => p.product_id === shirt)!;
  assert.equal(tshirt.variations.length, 2);
  assert.equal(catalog.find((p) => p.product_id === mug)!.price_minor, 10000);
  const shift = await openShift();
  await sell(shift.shift_id, [{ product_id: mug, quantity: 1 }], [{ method: "cash", amount_minor: 10000 }]);
  const list = (await one("SELECT pos_sales_list($1,null,'#1') r", [store])) as unknown as Json[];
  assert.equal(list.length, 1);
  await assert.rejects(one("SELECT pos_day_summary($1) r", [store]), /insights access/);
  await as(operator);
  const day = await one("SELECT pos_day_summary($1) r", [store]);
  assert.equal(day.sales_count, 1);
  assert.equal(day.by_method.cash, 10000);
  assert.equal(day.top_items[0].name, "Mug");
});
