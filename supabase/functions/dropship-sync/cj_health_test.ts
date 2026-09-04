// Verifies the CJdropshipping credentials stored as edge-function secrets
// by requesting an access token. Never prints secret values.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CJAdapter } from "../_shared/dropship/cj.ts";

Deno.test("CJdropshipping credentials authenticate", async () => {
  const email = Deno.env.get("CJ_EMAIL");
  const apiKey = Deno.env.get("CJ_API_KEY");
  assert(email, "CJ_EMAIL secret is not set");
  assert(apiKey, "CJ_API_KEY secret is not set");
  const adapter = new CJAdapter(email, apiKey);
  const health = await adapter.health();
  assert(health.ok, `CJ health check failed: ${health.message ?? "unknown error"}`);
});
