import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
const source = transformSync(await readFile(new URL("../supabase/functions/send-push/index.ts",import.meta.url),"utf8"),{loader:"ts",format:"cjs"}).code;
async function send(status = "offered", driverStatus = "available", owner = "driver-user") {
 let handler: (req:Request)=>Promise<Response>;
 let readTokens=false;
 const rows:Record<string,unknown>={ dispatch_assignments:{driver_id:"driver-id",status,expires_at:new Date(Date.now()+45_000).toISOString()},drivers:{user_id:owner,status:driverStatus} };
 const client={from:(table:string)=>{
  if(table==="push_tokens") readTokens=true;
  return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:rows[table],error:null};},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:[]}).then(resolve);}};
 }};
 runInNewContext(source,{exports:{},require:()=>({createClient:()=>client}),Deno:{env:{get:()=>"server-secret"},serve:(fn:typeof handler)=>{handler=fn;}},Response,Request,Date,JSON,TextEncoder,Uint8Array,console});
 const res=await handler!(new Request("https://example.test/send-push",{method:"POST",headers:{Authorization:"Bearer server-secret","Content-Type":"application/json"},body:JSON.stringify({user_id:"driver-user",title:"Food delivery request",data:{assignment_id:"offer-id"}})}));
 return {status:res.status,body:await res.json(),readTokens};
}
test("queued push is skipped after a service preference expires its offer",async()=>{
 const result=await send("expired");assert.equal(result.body.skipped,"inactive_offer");assert.equal(result.readTokens,false);
});
test("queued push is skipped when the driver goes offline or belongs to another account",async()=>{
 for(const args of [["offered","offline","driver-user"],["offered","available","another-user"]]){
  const result=await send(...args as [string,string,string]);assert.equal(result.body.skipped,"driver_unavailable");assert.equal(result.readTokens,false);
 }
});
test("a live offer for an available driver reaches token lookup",async()=>{
 const result=await send();assert.equal(result.status,200);assert.equal(result.body.success,true);assert.equal(result.readTokens,true);
});
