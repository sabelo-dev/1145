// Paid UCoin tier management for the signed-in user.
//   POST { action: "cancel" }  stop renewals at PayFast; the tier stays until
//                              the paid period ends.
// Starting / paying a subscription goes through payfast-payment
// (customStr2 = "tier_subscription") and payfast-itn.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelPayFastSubscription, getPayFastConfig } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "cancel") return json({ success: false, error: "Unknown action" }, 400);

  const { data: sub } = await admin
    .from("uc_tier_subscriptions")
    .select("id, payfast_token, current_period_end")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return json({ success: false, error: "You have no active paid tier" }, 404);

  if (sub.payfast_token) {
    const payfast = getPayFastConfig();
    if (!payfast) return json({ success: false, error: "Payments are not configured" }, 500);
    const cancelled = await cancelPayFastSubscription(sub.payfast_token, payfast);
    if (!cancelled.ok) {
      console.error("PayFast cancel failed:", cancelled.error);
      return json({ success: false, error: "PayFast could not cancel the debit order. Please try again." }, 502);
    }
  }

  const { error } = await admin.rpc("uc_tier_subscription_cancelled", { p_subscription_id: sub.id });
  if (error) return json({ success: false, error: "Could not update your subscription" }, 500);

  return json({ success: true, active_until: sub.current_period_end });
});
