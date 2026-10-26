import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const sharer = id(1), friend = id(2), other = id(3), oldUser = id(4), signedUpWithCode = id(5);
before(async () => {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA storage;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY, created_at timestamptz DEFAULT now());
 CREATE FUNCTION public.is_admin(uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
 CREATE TABLE mining_activities(code text PRIMARY KEY,display_name text,description text,reward_mg numeric,reward_kind text,min_reward numeric,max_reward numeric,
  daily_cap int,audience text,conditions text,admin_granted boolean,sort_order int,is_active boolean,updated_at timestamptz);
 CREATE TABLE user_referral_codes(user_id uuid UNIQUE,code text UNIQUE,is_active boolean DEFAULT true);
 CREATE TABLE referrals(referrer_id uuid,referred_id uuid,created_at timestamptz DEFAULT now());
 CREATE FUNCTION public.uc_referrer_of(p_user_id uuid) RETURNS uuid LANGUAGE sql AS $$
  SELECT referrer_id FROM referrals WHERE referred_id=p_user_id AND referrer_id IS DISTINCT FROM p_user_id ORDER BY created_at LIMIT 1 $$;
 -- Records what would be paid; the real uc_award applies caps and idempotency.
 CREATE TABLE awards(user_id uuid,code text,key text UNIQUE,amount numeric);
 CREATE FUNCTION public.uc_award(p_user_id uuid,p_code text,p_key text,p_amount numeric DEFAULT NULL,p_reference_type text DEFAULT NULL,p_reference_id text DEFAULT NULL,p_title text DEFAULT NULL)
  RETURNS numeric LANGUAGE plpgsql AS $$ DECLARE v numeric; BEGIN
   SELECT reward_mg INTO v FROM mining_activities WHERE code=p_code AND is_active;
   INSERT INTO awards VALUES(p_user_id,p_code,p_key,v) ON CONFLICT (key) DO NOTHING;
   IF NOT FOUND THEN RETURN 0; END IF; RETURN v; END $$;
 `);
 await db.exec(await readFile(new URL("../supabase/migrations/20261026120000_app_install_referrals.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec("TRUNCATE app_install_claims,awards,referrals,user_referral_codes,auth.users CASCADE");
 await db.query("INSERT INTO auth.users(id) VALUES($1),($2),($3),($4)",[sharer,friend,other,signedUpWithCode]);
 await db.query("INSERT INTO auth.users(id,created_at) VALUES($1,now()-interval '30 days')",[oldUser]);
 await db.query("INSERT INTO user_referral_codes(user_id,code) VALUES($1,'SHARE123')",[sharer]);
});
const as = (u: string) => db.query("SELECT set_config('test.user',$1,false)",[u]);
async function claim(u: string, device: string, code: string | null = null, app = "app") {
 await as(u);
 const { rows } = await db.query<{r:{status:string;amount:number}}>("SELECT claim_app_install($1,'android',$2,$3) r",[app,device,code]);
 return rows[0].r;
}
const awards = async () => (await db.query<{user_id:string;amount:string}>("SELECT user_id,amount FROM awards")).rows;

test("rule pays 200 UC with a daily cap", async () => {
 const { rows } = await db.query<{reward_mg:string;daily_cap:number}>("SELECT reward_mg,daily_cap FROM mining_activities WHERE code='app_install_referral'");
 assert.equal(Number(rows[0].reward_mg), 200);
 assert.equal(rows[0].daily_cap, 20);
});

test("friend entering the sharer's code pays the sharer 200 UC once", async () => {
 assert.deepEqual(await claim(friend, "device-friend-1", "share123"), { status: "awarded", amount: 200 });
 assert.deepEqual(await awards(), [{ user_id: sharer, amount: "200" }]);
 assert.equal((await claim(friend, "device-friend-2", "SHARE123", "driver")).status, "already_claimed");
 assert.equal((await awards()).length, 1);
});

test("account that signed up with a referral needs no code", async () => {
 await db.query("INSERT INTO referrals(referrer_id,referred_id) VALUES($1,$2)",[sharer,signedUpWithCode]);
 assert.equal((await claim(signedUpWithCode, "device-ref-1", null, "orders")).status, "awarded");
});

test("no referrer asks for a code without using up the claim", async () => {
 assert.equal((await claim(friend, "device-friend-1")).status, "no_referrer");
 assert.equal((await claim(friend, "device-friend-1", "NOPE999")).status, "invalid_code");
 assert.equal((await claim(friend, "device-friend-1", "SHARE123")).status, "awarded");
});

test("one reward per device, none for old accounts or own code", async () => {
 await claim(friend, "device-shared-1", "SHARE123");
 assert.equal((await claim(other, "device-shared-1", "SHARE123")).status, "device_used");
 assert.equal((await claim(oldUser, "device-old-1", "SHARE123")).status, "not_new");
 assert.equal((await claim(sharer, "device-sharer-1", "SHARE123")).status, "invalid_code");
 assert.equal((await awards()).length, 1);
});

test("stats count the sharer's rewarded installs", async () => {
 await claim(friend, "device-friend-1", "SHARE123");
 await claim(other, "device-other-1", "SHARE123");
 await as(sharer);
 const { rows } = await db.query<{s:{installs:number;earned:number}}>("SELECT app_install_referral_stats() s");
 assert.deepEqual(rows[0].s, { installs: 2, earned: 400 });
});

test("bad input and signed-out calls are refused", async () => {
 await as("");
 await assert.rejects(db.query("SELECT claim_app_install('app','android','device-x-1',NULL)"), /Sign in first/);
 await as(friend);
 await assert.rejects(db.query("SELECT claim_app_install('web','android','device-x-1',NULL)"), /Invalid app install/);
 await assert.rejects(db.query("SELECT claim_app_install('app','web','device-x-1',NULL)"), /Invalid app install/);
 await assert.rejects(db.query("SELECT claim_app_install('app','android','short',NULL)"), /Invalid app install/);
});
