// Link a card by initiating a PayFast tokenization verification payment (R1 hold).
// Returns a PayFast redirect. The ITN callback (payfast-itn) creates the payment_instruments row from the returned token.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function md5Hash(input: string): Promise<string> {
  const c = await import("node:crypto");
  return c.createHash("md5").update(input).digest("hex");
}
function phpUrlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29")
    .replace(/\*/g, "%2A").replace(/~/g, "%7E").replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}
async function sign(data: Record<string, any>, passphrase: string) {
  const filtered: Record<string, any> = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (k !== "signature" && v !== "" && v !== null && v !== undefined) filtered[k] = v;
  }
  const paramString = Object.keys(filtered).sort().map((k) => `${k}=${phpUrlencode(String(filtered[k]).trim())}`).join("&");
  return md5Hash(`${paramString}&passphrase=${phpUrlencode(passphrase)}`);
}

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
    const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`;

    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "10000100";
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "46f0cd694581a";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "jt7NOE43FZPn";
    const payfastUrl = "https://www.payfast.co.za/eng/process";

    // Subscription type 2 = tokenization (recurring/adhoc). Amount R1.00 verification.
    const formData: Record<string, any> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl,
      cancel_url: cancelUrl,
      notify_url: notifyUrl,
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
    const signature = await sign(formData, passphrase);

    return json({ success: true, action: payfastUrl, formData: { ...formData, signature } });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
