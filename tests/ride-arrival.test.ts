import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";

const source = transformSync(await readFile(new URL("../supabase/functions/ride-arrival/index.ts",import.meta.url),"utf8"),{loader:"ts",format:"cjs"}).code;
async function setup(options: { user?: string; stale?: boolean; key?: boolean; cached?: boolean; providerFails?: boolean; status?: string } = {}) {
 const calls: Record<string,unknown>[] = [];
 const rows: Record<string,unknown> = {
  rides: {id:"00000000-0000-4000-8000-000000000001",passenger_id:"rider",driver_id:"driver",status:options.status??"accepted",pickup_lat:0,pickup_lng:0,dropoff_lat:1,dropoff_lng:1},
  drivers: {user_id:"driver-user"},
  driver_locations: {latitude:0.03,longitude:0.04,last_updated:new Date(Date.now()-(options.stale?120_000:0)).toISOString()},
  ride_arrival_estimates: options.cached ? {driver_id:"driver",destination_kind:"pickup",duration_seconds:600,static_duration_seconds:420,distance_meters:3000,updated_at:new Date().toISOString()} : null,
 };
 const client = { auth:{getUser:async()=>({data:{user:{id:options.user??"rider"}}})},from:(table:string)=>({select(){return this;},eq(){return this;},async maybeSingle(){return {data:rows[table]};},async single(){return {data:rows[table]};},async upsert(row:Record<string,unknown>){calls.push(row);return {error:null};}}) };
 let handler: (request: Request)=>Promise<Response>;
 runInNewContext(source,{
  exports:{},require:()=>({createClient:()=>client}),
  Deno:{env:{get:(name:string)=> name==="GOOGLE_ROUTES_API_KEY" && options.key===false ? undefined : "test"},serve:(fn:typeof handler)=>{handler=fn;}},
  Response,Request,AbortSignal,Date,JSON,Number,Math,
  fetch:async (_url:string,init:{body:string;headers:Record<string,string>})=>{
   calls.push({google:JSON.parse(init.body),headers:init.headers});
   return new Response(JSON.stringify(options.providerFails?{error:"unavailable"}:{routes:[{duration:"600s",staticDuration:"420s",distanceMeters:3000}]}),{status:options.providerFails?503:200});
  },
 });
 const response = await handler!(new Request("https://example.test/ride-arrival",{method:"POST",headers:{Authorization:"Bearer test","Content-Type":"application/json"},body:JSON.stringify({rideId:"00000000-0000-4000-8000-000000000001"})}));
 return {response,body:await response.json(),calls};
}
test("arrival uses live road traffic, not straight line time",async()=>{
 const {response,body,calls}=await setup(); assert.equal(response.status,200);
 assert.equal(body.minutes,10);assert.equal(body.distanceKm,3);assert.equal(body.trafficDelayMinutes,3);assert.equal(body.trafficAware,true);
 const request=calls[0].google as {routingPreference:string;origin:{location:{latLng:{latitude:number}}};destination:{location:{latLng:{latitude:number}}}};
 assert.equal(request.routingPreference,"TRAFFIC_AWARE_OPTIMAL");assert.equal(request.origin.location.latLng.latitude,0.03);assert.equal(request.destination.location.latLng.latitude,0);
});
test("in-progress ETA targets the dropoff",async()=>{
 const {body,calls}=await setup({status:"in_progress"});assert.equal(body.destination,"dropoff");
 assert.equal((calls[0].google as {destination:{location:{latLng:{latitude:number}}}}).destination.location.latLng.latitude,1);
});
test("cached traffic estimates avoid repeated paid routing requests",async()=>{const {response,calls}=await setup({cached:true});assert.equal(response.status,200);assert.equal(calls.length,0);});
test("another user cannot request driver location or a route",async()=>{const {response,calls}=await setup({user:"stranger"});assert.equal(response.status,403);assert.equal(calls.length,0);});
test("stale GPS never produces a confident ETA",async()=>{const {response,calls,body}=await setup({stale:true});assert.equal(response.status,503);assert.equal(calls.length,0);assert.equal(body.trafficAware,undefined);});
test("missing API key and provider failures do not fabricate estimates",async()=>{
 for(const options of [{key:false},{providerFails:true}]){const {response,body}=await setup(options);assert.equal(response.status,503);assert.equal(body.minutes,undefined);}
});
