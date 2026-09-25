// Link a card by initiating a PayFast tokenization verification payment (R1 hold).
// Returns a PayFast redirect. The ITN callback (payfast-itn) creates the payment_instruments row from the returned token.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPayFastConfig, signPayFast } from "../_shared/payfast.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const user = u.user;

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || `${req.headers.get("origin") || "https://1145.io"}/wallet?linked=1`;
    const cancelUrl = body.cancelUrl || `${req.headers.get("origin") || "https://1145.io"}/wallet?linked=0`;

    const payfast = getPayFastConfig();
    if (!payfast) return json({ success: false, error: "Payment gateway not configured properly" }, 500);

    // Subscription type 2 = tokenization (recurring/adhoc). Amount R1.00 verification.
    const formData: Record<string, any> = {
      merchant_id: payfast.merchantId,
      merchant_key: payfast.merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: payfast.notifyUrl,
      name_first: (user.user_metadata?.first_name as string) || "1145",
      name_last: (user.user_metadata?.last_name as string) || "Member",
      email_address: user.email || "",
      m_payment_id: `LINKCARD-${user.id}-${Date.now()}`,
      amount: "1.00",
      item_name: "1145 Card Verification",
      item_description: "R1.00 verification to link your card to 1145 Wallet",
      custom_str1: "link_card",
      custom_str2: user.id,
      subscription_type: 2,
    };
    const signature = await signPayFast(formData, payfast.passphrase);

    return json({ success: true, action: payfast.processUrl, formData: { ...formData, signature } });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
