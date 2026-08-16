// Deposit funds into 1145 Wallet via PayFast. Creates a pending ledger row keyed by m_payment_id.
// payfast-itn credits the wallet on COMPLETE.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function md5Hash(s: string) { const c = await import("node:crypto"); return c.createHash("md5").update(s).digest("hex"); }
function phpUrlencode(str: string) {
  return encodeURIComponent(str)
    .replace(/!/g, "%21").replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29")
    .replace(/\*/g, "%2A").replace(/~/g, "%7E").replace(/%20/g, "+")
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase());
}
async function sign(data: Record<string, any>, passphrase: string) {
  const filtered: Record<string, any> = {};
  for (const k of Object.keys(data)) { const v = data[k]; if (k !== "signature" && v !== "" && v !== null && v !== undefined) filtered[k] = v; }
  const p = Object.keys(filtered).sort().map(k => `${k}=${phpUrlencode(String(filtered[k]).trim())}`).join("&");
  return md5Hash(`${p}&passphrase=${phpUrlencode(passphrase)}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);
    const user = u.user;

    const body = await req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 10 || amount > 100000) return j({ error: "Amount must be between R10 and R100,000" }, 400);

    const origin = req.headers.get("origin") || "https://1145.io";
    const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID") || "10000100";
    const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY") || "46f0cd694581a";
    const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "jt7NOE43FZPn";

    const mPaymentId = `DEPOSIT-${user.id}-${Date.now()}`;

    const formData: Record<string, any> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${origin}/wallet?deposit=success`,
      cancel_url: `${origin}/wallet?deposit=cancelled`,
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payfast-itn`,
      name_first: (user.user_metadata?.first_name as string) || "1145",
      name_last: (user.user_metadata?.last_name as string) || "Member",
      email_address: user.email || "",
      m_payment_id: mPaymentId,
      amount: amount.toFixed(2),
      item_name: "1145 Wallet Deposit",
      item_description: `Deposit R${amount.toFixed(2)} into your 1145 Wallet`,
      custom_str1: "wallet_deposit",
      custom_str2: user.id,
    };
    const signature = await sign(formData, passphrase);

    return j({ success: true, action: "https://www.payfast.co.za/eng/process", formData: { ...formData, signature }, reference: mPaymentId });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
