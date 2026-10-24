import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const owner = id(1), other = id(2), order = id(10);
before(async () => {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE TABLE orders(id uuid PRIMARY KEY,user_id uuid,status text,payment_status text,total numeric,ucoin_spent integer DEFAULT 0,ucoin_value_zar numeric DEFAULT 0,updated_at timestamptz);
 CREATE TABLE order_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,event_type text,status text,title text,description text,actor text DEFAULT 'system',metadata jsonb DEFAULT '{}');
 CREATE TABLE ucoin_wallets(user_id uuid PRIMARY KEY,balance integer,lifetime_spent integer,updated_at timestamptz);
 CREATE TABLE ucoin_transactions(user_id uuid,amount integer,type text CHECK (type IN ('earn','spend')),category text,description text,reference_id text,reference_type text);
 `);
 await db.exec(await readFile(new URL("../supabase/migrations/20261024100000_customer_cancel_order.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec("TRUNCATE orders,order_events,ucoin_wallets,ucoin_transactions");
 await db.query("INSERT INTO ucoin_wallets VALUES($1,100,50,now())",[owner]);
 await user(owner);
});
const user = (u: string) => db.query("SELECT set_config('test.user',$1,false)",[u]);
const placeOrder = (status = "pending", payment = "pending", ucoin = 0) =>
 db.query("INSERT INTO orders(id,user_id,status,payment_status,total,ucoin_spent,ucoin_value_zar) VALUES($1,$2,$3,$4,500,$5::int,$5::int*0.1)",[order,owner,status,payment,ucoin]);
const cancel = () => db.query<{r:{success:boolean;ucoin_refunded:number;already_cancelled?:boolean}}>("SELECT customer_cancel_order($1) r",[order]);
const balance = async () => (await db.query<{balance:number}>("SELECT balance FROM ucoin_wallets")).rows[0].balance;
const row = async () => (await db.query<{status:string;payment_status:string}>("SELECT status,payment_status FROM orders")).rows[0];

test("cancels an unpaid order and keeps the row", async () => {
 await placeOrder();
 assert.deepEqual((await cancel()).rows[0].r, {success:true,ucoin_refunded:0});
 assert.deepEqual(await row(), {status:"cancelled",payment_status:"cancelled"});
});
test("returns UCoin applied to the order exactly once", async () => {
 await placeOrder("pending","pending",30);
 assert.equal((await cancel()).rows[0].r.ucoin_refunded, 30);
 assert.equal(await balance(), 130);
 assert.equal((await cancel()).rows[0].r.already_cancelled, true);
 assert.equal(await balance(), 130);
 assert.equal((await db.query("SELECT 1 FROM ucoin_transactions WHERE type='earn' AND category='order_refund'")).rows.length, 1);
});
test("keeps the UCoin columns so a late payment still reconciles", async () => {
 await placeOrder("pending","pending",30);
 await cancel();
 assert.deepEqual((await db.query("SELECT ucoin_spent,ucoin_value_zar::numeric(10,2)::text v FROM orders")).rows[0], {ucoin_spent:30,v:"3.00"});
});
test("refuses paid orders", async () => {
 await placeOrder("processing","paid",30);
 await assert.rejects(cancel(), /already paid/);
 assert.equal(await balance(), 100);
});
test("refuses orders past pending", async () => {
 await placeOrder("shipped","pending");
 await assert.rejects(cancel(), /no longer be cancelled/);
});
test("another customer cannot cancel the order", async () => {
 await placeOrder();
 await user(other);
 await assert.rejects(cancel(), /Order not found/);
 assert.equal((await row()).status, "pending");
});
test("signed-out callers are rejected", async () => {
 await placeOrder();
 await user("");
 await assert.rejects(cancel(), /signed in/);
});
