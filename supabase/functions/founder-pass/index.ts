// Starts a once-off PayFast payment for a Founders Pass. The founder number
// is assigned when payfast-itn confirms the payment (founder_pass_complete).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";
import { getPayFastConfig, payfastReturnUrl, signPayFast } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const origin = req.headers.get("origin") || body.origin || "";
    const source = typeof body.source === "string" ? body.source.slice(0, 100) : null;

    // The price and the remaining count come from the database, never from the request.
    const { data: started, error: startError } = await admin.rpc("founder_pass_start", {
      p_user_id: user.id,
      p_source: source,
    });
    if (startError) {
      console.error("founder_pass_start failed:", startError);
      return json({ error: "Could not start the purchase" }, 500);
    }

    if (started?.outcome === "already_member") return json({ error: "You already have a Founders Pass", code: "already_member" }, 409);
    if (started?.outcome === "sold_out") return json({ error: "All Founders Passes have been claimed", code: "sold_out" }, 409);
    if (started?.outcome === "closed") return json({ error: "Founders Passes are not on sale right now", code: "closed" }, 409);
    if (started?.outcome !== "ok" || !started.order_id) return json({ error: "Could not start the purchase" }, 500);

    const payfast = getPayFastConfig();
    if (!payfast) return json({ error: "Payment gateway not configured properly" }, 500);

    const name = String(user.user_metadata?.name || user.user_metadata?.full_name || "1145 member");
    const fields: Record<string, string> = {
      merchant_id: payfast.merchantId,
      merchant_key: payfast.merchantKey,
      return_url: payfastReturnUrl(origin, "/founders?claim=success"),
      cancel_url: payfastReturnUrl(origin, "/founders?claim=cancelled"),
      notify_url: payfast.notifyUrl,
      name_first: name.slice(0, 100),
      email_address: user.email || "",
      m_payment_id: `FPASS-${started.order_id}`,
      amount: Number(started.amount).toFixed(2),
      item_name: "1145 Founders Pass",
      custom_str1: started.order_id,
      custom_str2: "founders_pass",
    };
    const signature = await signPayFast(fields, payfast.passphrase);

    return json({ paymentUrl: payfast.processUrl, formData: { ...fields, signature } });
  } catch (err) {
    console.error("founder-pass error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
