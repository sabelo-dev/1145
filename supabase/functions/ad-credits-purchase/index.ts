// Starts a once-off PayFast payment for a pack of ad credits. The credits are
// added when payfast-itn confirms the payment (ad_credit_purchase_complete).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const packId = typeof body.pack_id === "string" ? body.pack_id : "";
    const origin = req.headers.get("origin") || body.origin || "";

    const { data: merchant, error: merchantError } = await admin
      .from("merchants")
      .select("id, business_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (merchantError) return json({ error: merchantError.message }, 500);
    if (!merchant) return json({ error: "No merchant account found for this user" }, 403);

    // The price comes from the pack, never from the request.
    const { data: pack } = await admin
      .from("ad_credit_packs")
      .select("id, credits, price, is_active")
      .eq("id", packId)
      .maybeSingle();
    if (!pack || !pack.is_active) return json({ error: "That credit pack is not available" }, 400);

    const { data: purchase, error: purchaseError } = await admin
      .from("ad_credit_purchases")
      .insert({ merchant_id: merchant.id, pack_id: pack.id, credits: pack.credits, amount: pack.price })
      .select()
      .single();
    if (purchaseError || !purchase) return json({ error: purchaseError?.message ?? "Could not start the purchase" }, 500);

    const payfast = getPayFastConfig();
    if (!payfast) return json({ error: "Payment gateway not configured properly" }, 500);

    const fields: Record<string, string> = {
      merchant_id: payfast.merchantId,
      merchant_key: payfast.merchantKey,
      return_url: payfastReturnUrl(origin, "/merchant/dashboard?tab=ad-credits&credits=success"),
      cancel_url: payfastReturnUrl(origin, "/merchant/dashboard?tab=ad-credits&credits=cancelled"),
      notify_url: payfast.notifyUrl,
      name_first: (merchant.business_name || "Merchant").slice(0, 100),
      email_address: user.email || "",
      m_payment_id: `ADC-${purchase.id}`,
      amount: Number(pack.price).toFixed(2),
      item_name: `1145 ad credits (${pack.credits})`,
      custom_str1: purchase.id,
      custom_str2: "ad_credits",
    };
    const signature = await signPayFast(fields, payfast.passphrase);

    return json({ paymentUrl: payfast.processUrl, formData: { ...fields, signature } });
  } catch (err) {
    console.error("ad-credits-purchase error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
