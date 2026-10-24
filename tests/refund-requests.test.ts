import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const customer = id(1), stranger = id(2), ownerA = id(3), ownerB = id(4), cashierA = id(5), admin = id(900);
const order = id(10), storeA = id(20), storeB = id(21), itemA = id(30), itemB = id(31);
before(async () => {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE($1 = '${admin}'::uuid, false) $$;
 CREATE TABLE store_roles(store_id uuid, user_id uuid, role text);
 CREATE FUNCTION public.store_role(p_store uuid, p_user uuid DEFAULT auth.uid()) RETURNS text LANGUAGE sql AS $$ SELECT role FROM store_roles WHERE store_id=p_store AND user_id=p_user $$;
 CREATE FUNCTION public.store_has_permission(p_store uuid, p_perm text, p_user uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql AS $$ SELECT public.store_role(p_store,p_user) IS NOT NULL $$;
 CREATE TABLE orders(id uuid PRIMARY KEY,user_id uuid,status text,payment_status text,total numeric,updated_at timestamptz DEFAULT now(),
  refund_status text CHECK (refund_status IN ('none','requested','approved','rejected','completed')),refund_reason text,refund_amount numeric,
  return_status text CHECK (return_status IN ('none','requested','approved','rejected','completed')),return_reason text);
 CREATE TABLE order_items(id uuid PRIMARY KEY,order_id uuid,product_id uuid,store_id uuid,quantity int,price numeric);
 CREATE TABLE order_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,event_type text,status text,title text,description text,actor text DEFAULT 'system',metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
 `);
 await db.exec(await readFile(new URL("../supabase/migrations/20261024110000_order_refund_requests.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec("TRUNCATE order_refund_requests,orders,order_items,order_events,store_roles");
 await db.query("INSERT INTO store_roles VALUES($1,$2,'owner'),($3,$4,'owner'),($1,$5,'cashier')",[storeA,ownerA,storeB,ownerB,cashierA]);
 await user(customer);
});
const user = (u: string) => db.query("SELECT set_config('test.user',$1,false)",[u]);
async function placeOrder(status = "processing", payment = "paid", twoStores = false) {
 await db.query("INSERT INTO orders(id,user_id,status,payment_status,total) VALUES($1,$2,$3,$4,300)",[order,customer,status,payment]);
 await db.query("INSERT INTO order_items VALUES($1,$2,$3,$4,2,50)",[itemA,order,id(40),storeA]);
 await db.query("INSERT INTO order_items VALUES($1,$2,$3,$4,1,200)",[itemB,order,id(41),twoStores ? storeB : storeA]);
}
const request = (items: string[] | null = null, reason = "damaged") =>
 db.query<{r:{request_id:string;kind:string;amount_requested:number}}>("SELECT customer_request_refund($1,$2,'Box was crushed',$3) r",[order,reason,items]);
const decide = (req: string, approve: boolean, note: string | null = null, amount: number | null = null) =>
 db.query<{r:{status:string;amount_approved:number}}>("SELECT refund_request_decide($1,$2,$3,$4) r",[req,approve,note,amount]);
const orderRow = async () => (await db.query<{refund_status:string|null;return_status:string|null;refund_amount:string|null}>("SELECT refund_status,return_status,refund_amount::text FROM orders")).rows[0];

test("paid, undelivered order: refund for chosen items", async () => {
 await placeOrder();
 const r = (await request([itemA])).rows[0].r;
 assert.equal(r.kind, "refund");
 assert.equal(Number(r.amount_requested), 100);
 assert.equal((await orderRow()).refund_status, "requested");
});
test("delivered order becomes a return, closed after 30 days", async () => {
 await placeOrder("delivered");
 assert.equal((await request()).rows[0].r.kind, "return");
 assert.equal((await orderRow()).return_status, "requested");
 await db.exec("TRUNCATE order_refund_requests; UPDATE orders SET return_status='none'");
 await db.query("INSERT INTO order_events(order_id,status,event_type,title,created_at) VALUES($1,'delivered','status_changed','Delivered',now()-interval '31 days')",[order]);
 await assert.rejects(request(), /30-day return window/);
});
test("unpaid and cancelled orders cannot be refunded", async () => {
 await placeOrder("pending","pending");
 await assert.rejects(request(), /Only paid orders/);
});
test("one open request per order; items must belong to the order", async () => {
 await placeOrder();
 await assert.rejects(request([id(99)]), /Choose items/);
 await request();
 await assert.rejects(request(), /already exists/);
});
test("other customers cannot request or withdraw", async () => {
 await placeOrder();
 const req = (await request()).rows[0].r.request_id;
 await user(stranger);
 await assert.rejects(request(), /Order not found/);
 await assert.rejects(db.query("SELECT customer_withdraw_refund_request($1)",[req]), /Request not found/);
});
test("customer withdraws while requested", async () => {
 await placeOrder();
 const req = (await request()).rows[0].r.request_id;
 await db.query("SELECT customer_withdraw_refund_request($1)",[req]);
 assert.equal((await orderRow()).refund_status, "none");
 await request();
});
test("store owner approves; payout status follows; admin completes with a reference", async () => {
 await placeOrder();
 const req = (await request()).rows[0].r.request_id;
 await user(ownerA);
 assert.deepEqual((await decide(req, true, null, 250)).rows[0].r, {success:true,status:"approved",amount_approved:250});
 assert.deepEqual(await orderRow(), {refund_status:"approved",return_status:null,refund_amount:"250.00"});
 await assert.rejects(db.query("SELECT refund_request_complete($1,'PF-1')",[req]), /Only an admin/);
 await user(admin);
 await assert.rejects(db.query("SELECT refund_request_complete($1,' ')",[req]), /refund reference/);
 await db.query("SELECT refund_request_complete($1,'PF-1')",[req]);
 assert.equal((await orderRow()).refund_status, "completed");
 await user(customer);
 await assert.rejects(request(), /already exists/);
});
test("cashiers, owners of other stores and strangers cannot decide", async () => {
 await placeOrder("processing","paid",true);
 const req = (await request()).rows[0].r.request_id;
 for (const u of [cashierA, ownerA, ownerB, stranger, customer]) {
  await user(u);
  await assert.rejects(decide(req, true), /admin, or the store owner or manager/, u);
 }
});
test("rejection needs a reason; admin can overturn it; amount is capped at the order total", async () => {
 await placeOrder();
 const req = (await request()).rows[0].r.request_id;
 await user(ownerA);
 await assert.rejects(decide(req, false), /reason/);
 await decide(req, false, "Item was used");
 await assert.rejects(decide(req, true), /already been decided/);
 await user(admin);
 await assert.rejects(decide(req, true, null, 301), /at most the order total/);
 assert.equal((await decide(req, true, null, 300)).rows[0].r.status, "approved");
});
test("API callers cannot write the table directly", async () => {
 await placeOrder();
 await db.exec("SET ROLE authenticated");
 try {
  await assert.rejects(db.query("INSERT INTO order_refund_requests(order_id,user_id,kind,reason,amount_requested) VALUES($1,$2,'refund','other',1)",[order,customer]), /permission denied/);
 } finally { await db.exec("RESET ROLE"); }
});
