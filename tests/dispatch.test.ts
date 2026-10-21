import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
before(async () => {
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
 CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(auth.uid()='00000000-0000-4000-8000-000000000900'::uuid,false) $$;
 CREATE TABLE drivers(id uuid PRIMARY KEY,user_id uuid,name text,status text,current_location jsonb,vehicle_type text);
 CREATE TABLE driver_devices(id uuid PRIMARY KEY,driver_id uuid,device_id text,status text);
 CREATE TABLE driver_sessions(id uuid PRIMARY KEY,driver_id uuid,device_id uuid,vehicle_id uuid,ended_at timestamptz,last_seen_at timestamptz DEFAULT now());
 CREATE TABLE vehicles(id uuid PRIMARY KEY,vehicle_type_id uuid,driver_id uuid);
 CREATE TABLE vehicle_driver_assignments(id uuid PRIMARY KEY,vehicle_id uuid,driver_id uuid,status text,reviewed_at timestamptz);
 CREATE FUNCTION review_vehicle_assignment(uuid,boolean,text) RETURNS void LANGUAGE sql AS $$ UPDATE vehicle_driver_assignments SET status=CASE WHEN $2 THEN 'approved' ELSE 'rejected' END WHERE id=$1 $$;
 CREATE TABLE driver_locations(driver_id uuid PRIMARY KEY,latitude numeric,longitude numeric,is_online boolean,is_available boolean,last_updated timestamptz);
 CREATE TABLE rides(id uuid PRIMARY KEY,passenger_id uuid,driver_id uuid,status text,vehicle_type_id uuid,pickup_lat numeric,pickup_lng numeric,pickup_latitude numeric,pickup_longitude numeric,dropoff_lat numeric,dropoff_lng numeric,dropoff_latitude numeric,dropoff_longitude numeric,pickup_address text,dropoff_address text,accepted_at timestamptz,estimated_fare numeric);
 CREATE TABLE delivery_jobs(id uuid PRIMARY KEY,driver_id uuid,status text,pickup_address jsonb,delivery_address jsonb,order_id uuid,food_order_id uuid,earnings numeric);
 CREATE TABLE dispatch_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_type text,entity_id uuid,driver_id uuid,status text,distance_to_pickup_km numeric,expires_at timestamptz,offered_at timestamptz DEFAULT now(),responded_at timestamptz);
 CREATE TABLE user_notifications(id uuid DEFAULT gen_random_uuid(),user_id uuid,type text,title text,message text,data jsonb);
 CREATE TABLE orders(id uuid,user_id uuid); CREATE TABLE food_orders(id uuid,user_id uuid);
 CREATE TABLE order_items(order_id uuid,store_id uuid); CREATE TABLE stores(id uuid,merchant_id uuid); CREATE TABLE merchants(id uuid,user_id uuid);
 CREATE FUNCTION driver_session_heartbeat(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"online":true}'::jsonb $$;
 CREATE FUNCTION driver_active_session_id(uuid) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM driver_sessions WHERE driver_id=$1 AND ended_at IS NULL LIMIT 1 $$;
 CREATE FUNCTION driver_trip_in_flight(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM rides WHERE driver_id=$1 AND status IN ('accepted','arriving','arrived','in_progress')) OR EXISTS(SELECT 1 FROM delivery_jobs WHERE driver_id=$1 AND status IN ('accepted','assigned','picked_up','in_transit')) $$;
 CREATE PUBLICATION supabase_realtime;
 `);
 await db.exec(await readFile(new URL("../supabase/migrations/20261022120000_driver_nearby_dispatch.sql", import.meta.url), "utf8"));
 await db.exec(await readFile(new URL("../supabase/migrations/20261022130000_driver_service_preferences.sql", import.meta.url), "utf8"));
});
after(async () => { await db.close(); });
beforeEach(async () => {
 await db.exec("TRUNCATE driver_dispatch_requests,dispatch_assignments,user_notifications,ride_arrival_estimates,rides,delivery_jobs,drivers,driver_devices,driver_sessions,driver_locations,vehicles,vehicle_driver_assignments CASCADE");
 await user(99);
});
const user = (n: number) => db.query("SELECT set_config('test.user',$1,false)",[id(n)]);
async function driver(n: number, km: number, extra = "") {
 await db.query("INSERT INTO drivers(id,user_id,name,status,current_location,vehicle_type) VALUES($1,$2,'Driver','available',NULL,'car')",[id(n),id(n+100)]);
 await db.query("INSERT INTO driver_devices VALUES($1,$2,$3,'active')",[id(n+200),id(n),`device-${n}`]);
 await db.query("INSERT INTO vehicles(id,driver_id,transport_mode) VALUES($1,$2,'car')",[id(n+400),id(n)]);
 await db.query("INSERT INTO driver_sessions(id,driver_id,device_id,vehicle_id) VALUES($1,$2,$3,$4)",[id(n+300),id(n),id(n+200),id(n+400)]);
 // Equator: one degree of latitude is about 111.195 km.
 await db.query("INSERT INTO driver_locations VALUES($1,$2,0,true,true,now())",[id(n),km/111.195]);
 if (extra) await db.exec(extra.replaceAll("DRIVER", `'${id(n)}'`));
}
const ride = (n = 1) => db.query("INSERT INTO rides(id,passenger_id,status,pickup_lat,pickup_lng,pickup_address,dropoff_address) VALUES($1,$2,'searching',0,0,'Pickup','Dropoff')",[id(n),id(99)]);
async function offers() { return (await db.query<{driver_id:string;search_radius_km:number}>("SELECT driver_id,search_radius_km FROM dispatch_assignments ORDER BY driver_id")).rows; }
async function accept(assignment: string, n: number, yes = true) { await user(n+100); return db.query("SELECT driver_respond_offer($1,$2,$3)",[assignment,`device-${n}`,yes]); }
for (const [near,far,radius] of [[4,9,5],[7,12,10],[12,16,15]]) {
 test(`search stops at ${radius} km when an eligible driver is found`, async () => {
  await driver(10,near); await driver(11,far); await ride();
  assert.deepEqual(await offers(),[{driver_id:id(10),search_radius_km:radius}]);
 });
}
test("never offers outside 15 km and marks no drivers",async () => {
 await driver(10,15.1); await ride(); assert.equal((await offers()).length,0);
 assert.equal((await db.query<{status:string}>("SELECT status FROM rides")).rows[0].status,"no_drivers");
});
test("stale GPS, ended sessions and busy drivers are excluded",async () => {
 await driver(10,1,"UPDATE driver_locations SET last_updated=now()-interval '2 minutes' WHERE driver_id=DRIVER");
 await driver(11,1,"UPDATE driver_sessions SET ended_at=now() WHERE driver_id=DRIVER");
 await driver(12,1,"UPDATE drivers SET status='busy' WHERE id=DRIVER");
 await driver(13,8); await ride(); assert.deepEqual(await offers(),[{driver_id:id(13),search_radius_km:10}]);
});
test("server polling does not create duplicate offers or notifications",async () => {
 await driver(10,1); await ride(); await db.query("SELECT dispatch_nearby('ride',$1)",[id(1)]);
 assert.equal((await offers()).length,1); assert.equal((await db.query("SELECT * FROM user_notifications")).rows.length,1);
});
test("expiry expands to next radius and never repeats an expired offer",async () => {
 await driver(10,4); await driver(11,8); await ride();
 await db.exec("UPDATE dispatch_assignments SET expires_at=now()-interval '1 second'; UPDATE driver_dispatch_requests SET next_check_at=now()-interval '1 second'");
 await db.exec("SELECT run_nearby_dispatch()");
 assert.deepEqual(await offers(),[{driver_id:id(10),search_radius_km:5},{driver_id:id(11),search_radius_km:10}]);
});
test("one winner per trip; a second driver cannot take an accepted trip",async () => {
 await driver(10,1); await driver(11,2); await ride();
 const rows=(await db.query<{id:string;driver_id:string}>("SELECT id,driver_id FROM dispatch_assignments ORDER BY driver_id")).rows;
 await accept(rows[0].id,10); await assert.rejects(accept(rows[1].id,11));
 assert.equal((await db.query<{driver_id:string}>("SELECT driver_id FROM rides")).rows[0].driver_id,id(10));
});
test("one driver cannot accept two active requests",async () => {
 await driver(10,1); await ride(1); await ride(2);
 const rows=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments ORDER BY entity_id")).rows;
 await accept(rows[0].id,10); await assert.rejects(accept(rows[1].id,10));
});
test("expired offers, wrong account and wrong device cannot accept",async () => {
 await driver(10,1); await ride(); const a=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments")).rows[0].id;
 await user(111); await assert.rejects(db.query("SELECT driver_respond_offer($1,'device-10',true)",[a]));
 await user(110); await assert.rejects(db.query("SELECT driver_respond_offer($1,'wrong',true)",[a]));
 await db.exec("UPDATE dispatch_assignments SET expires_at=now()-interval '1 second'"); await assert.rejects(accept(a,10));
});
test("delivery creation notifies only nearby drivers and acceptance assigns the job",async () => {
 await driver(10,3); await driver(11,12);
 await db.query(`INSERT INTO delivery_jobs(id,status,pickup_address,delivery_address) VALUES($1,'pending',$2::jsonb,$3::jsonb)`,[id(1),JSON.stringify({lat:0,lng:0,street:'Shop'}),JSON.stringify({street:'Customer'})]);
 assert.equal((await offers()).length,1);
 const a=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments")).rows[0].id; await accept(a,10);
 assert.equal((await db.query<{status:string}>("SELECT status FROM delivery_jobs")).rows[0].status,"accepted");
});
test("fresh GPS publication updates both location sources and blocks bad accuracy",async () => {
 await driver(10,1); await user(110);
 await db.query("SELECT driver_publish_position('device-10',0,0,15)");
 assert.deepEqual((await db.query<{current_location:{lat:number;lng:number}}>("SELECT current_location FROM drivers")).rows[0].current_location.lat,0);
 await assert.rejects(db.query("SELECT driver_publish_position('device-10',0,0,201)"));
 await assert.rejects(db.query("SELECT driver_publish_position('wrong',0,0,15)"));
});

test("driver cannot bypass nearby acceptance with a direct insert or update", async () => {
 await driver(10,1); await ride();
 await db.exec("GRANT USAGE ON SCHEMA auth TO authenticated; GRANT SELECT,INSERT,UPDATE ON rides TO authenticated; SET ROLE authenticated");
 try {
  await assert.rejects(db.query("UPDATE rides SET driver_id=$1 WHERE id=$2",[id(10),id(1)]));
  await assert.rejects(db.query("INSERT INTO rides(id,driver_id,status) VALUES($1,$2,'accepted')",[id(2),id(10)]));
 } finally { await db.exec("RESET ROLE"); }
});
test("a different passenger cannot trigger another user's ride dispatch",async () => {
 await driver(10,1); await ride(); await user(98);
 await assert.rejects(db.query("SELECT request_nearby_dispatch('ride',$1)",[id(1)]));
});
test("a driver only sees offers intended for their account",async () => {
 await driver(10,1); await driver(11,2); await ride(); await user(110);
 const result=await db.query<{offers:unknown[]}>("SELECT driver_nearby_offers() AS offers");
 assert.equal(result.rows[0].offers.length,1);
});

const delivery = (n: number, food = false) => db.query("INSERT INTO delivery_jobs(id,status,pickup_address,delivery_address,food_order_id) VALUES($1,'pending',$2::jsonb,$3::jsonb,$4)",[id(n),JSON.stringify({lat:0,lng:0,street:"Shop"}),JSON.stringify({street:"Customer"}),food?id(999):null]);
const services = async (n: number, passengers: boolean, food: boolean, parcels: boolean) => { await user(n+100); return db.query("SELECT driver_set_services($1,$2,$3)",[passengers,food,parcels]); };
test("scooter receives food and parcel offers but never passenger offers",async()=>{
 await driver(10,1,"UPDATE vehicles SET transport_mode='scooter' WHERE driver_id=DRIVER");
 await ride(); await delivery(2,true); await delivery(3);
 const rows=(await db.query<{kind:string}>("SELECT dispatch_service_kind(entity_type,entity_id) kind FROM dispatch_assignments ORDER BY kind")).rows;
 assert.deepEqual(rows.map(r=>r.kind),["food","parcels"]);
 await assert.rejects(services(10,true,true,true),/Scooters are for deliveries only/);
});
test("car can choose passengers only without receiving food or parcel notifications",async()=>{
 await driver(10,1); await services(10,true,false,false); await ride(); await delivery(2,true); await delivery(3);
 const rows=(await db.query<{entity_type:string}>("SELECT entity_type FROM dispatch_assignments")).rows;
 assert.deepEqual(rows,[{entity_type:"ride"}]);
 assert.equal((await db.query("SELECT * FROM user_notifications")).rows.length,1);
});
test("car can choose food only or parcels only",async()=>{
 for(const food of [true,false]) {
  await driver(food?10:11,food?1:2); await services(food?10:11,false,food,!food);
 }
 await ride(); await delivery(2,true); await delivery(3);
 const rows=(await db.query<{driver_id:string;kind:string}>("SELECT driver_id,dispatch_service_kind(entity_type,entity_id) kind FROM dispatch_assignments ORDER BY driver_id")).rows;
 assert.deepEqual(rows,[{driver_id:id(10),kind:"food"},{driver_id:id(11),kind:"parcels"}]);
});
test("car can combine passenger trips and parcels with food disabled",async()=>{
 await driver(10,1); await services(10,true,false,true); await ride(); await delivery(2,true); await delivery(3);
 const rows=(await db.query<{kind:string}>("SELECT dispatch_service_kind(entity_type,entity_id) kind FROM dispatch_assignments ORDER BY kind")).rows;
 assert.deepEqual(rows.map(r=>r.kind),["parcels","passengers"]);
});
test("turning off an offered service expires the offer and blocks acceptance",async()=>{
 await driver(10,1); await ride(); const a=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments")).rows[0].id;
 await services(10,false,true,true); await assert.rejects(accept(a,10));
 assert.equal((await db.query<{status:string}>("SELECT status FROM dispatch_assignments")).rows[0].status,"expired");
});
test("acceptance rechecks the current verified vehicle even after a passenger offer was sent",async()=>{
 await driver(10,1); await ride(); const a=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments")).rows[0].id;
 await db.exec("UPDATE vehicles SET transport_mode='scooter'");
 await assert.rejects(accept(a,10),/vehicle is not eligible/);
});
test("editing a scooter's profile label to car cannot unlock passenger work",async()=>{
 await driver(10,1,"UPDATE vehicles SET transport_mode='scooter' WHERE driver_id=DRIVER");
 await db.exec("UPDATE drivers SET vehicle_type='car'"); await assert.rejects(services(10,true,true,true));
});
test("all services can be disabled, without cancelling an already accepted trip",async()=>{
 await driver(10,1); await ride(); const a=(await db.query<{id:string}>("SELECT id FROM dispatch_assignments")).rows[0].id;
 await accept(a,10); await services(10,false,false,false);
 assert.equal((await db.query<{status:string}>("SELECT status FROM rides")).rows[0].status,"accepted");
 assert.equal((await db.query<{ok:boolean}>("SELECT driver_accepts_service($1,'passengers') ok",[id(10)])).rows[0].ok,false);
});
test("an active unclassified vehicle cannot inherit eligibility from a previously approved car",async()=>{
 await driver(10,1); await db.query("INSERT INTO vehicle_driver_assignments VALUES($1,$2,$3,'approved',now())",[id(700),id(410),id(10)]);
 await db.query("INSERT INTO vehicles(id,driver_id) VALUES($1,$2)",[id(800),id(10)]);
 await db.query("UPDATE driver_sessions SET vehicle_id=$1 WHERE driver_id=$2",[id(800),id(10)]);
 await ride(); assert.equal((await offers()).length,0);
});
test("a driver cannot change their verified scooter classification directly",async()=>{
 await driver(10,1,"UPDATE vehicles SET transport_mode='scooter' WHERE driver_id=DRIVER");
 await user(110); await db.exec("GRANT SELECT,UPDATE ON vehicles TO authenticated; SET ROLE authenticated");
 try { await db.exec("UPDATE vehicles SET transport_mode='car'"); } finally { await db.exec("RESET ROLE"); }
 assert.equal((await db.query<{transport_mode:string}>("SELECT transport_mode FROM vehicles")).rows[0].transport_mode,"scooter");
});
test("services cannot be updated by an account without a driver profile",async()=>{
 await driver(10,1); await user(999); await assert.rejects(db.query("SELECT driver_set_services(true,true,true)"));
});

test("nearby scooters do not prevent passenger search expanding to an eligible car",async()=>{
 await driver(10,2,"UPDATE vehicles SET transport_mode='scooter' WHERE driver_id=DRIVER");
 await driver(11,8); await ride();
 assert.deepEqual(await offers(),[{driver_id:id(11),search_radius_km:10}]);
});
test("vehicle mode review is admin-only and cannot reclassify an online vehicle",async()=>{
 await driver(10,1); await db.query("INSERT INTO vehicle_driver_assignments VALUES($1,$2,$3,'pending',NULL)",[id(700),id(410),id(10)]);
 await user(110); await assert.rejects(db.query("SELECT review_vehicle_assignment_services($1,true,'car',NULL)",[id(700)]),/Not authorized/);
 await user(900); await assert.rejects(db.query("SELECT review_vehicle_assignment_services($1,true,'scooter',NULL)",[id(700)]),/offline/);
 await db.exec("UPDATE driver_sessions SET ended_at=now()");
 await db.query("SELECT review_vehicle_assignment_services($1,true,'scooter',NULL)",[id(700)]);
 assert.equal((await db.query<{transport_mode:string}>("SELECT transport_mode FROM vehicles")).rows[0].transport_mode,"scooter");
 assert.equal((await db.query<{status:string}>("SELECT status FROM vehicle_driver_assignments")).rows[0].status,"approved");
});
