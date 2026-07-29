// Wallet read API: summary + ledger + cards + bank accounts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const userId = u.user.id;

    // Ensure wallet exists
    await supa.rpc("get_or_create_1145_wallet", { p_user_id: userId }).catch(() => {});

    const [summaryRes, ledgerRes, cardsRes, banksRes, wdRes] = await Promise.all([
      supa.rpc("get_wallet_summary", { p_user_id: userId }),
      supa.from("wallet_ledger").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supa.from("payment_instruments").select("id,provider,brand,last4,exp_month,exp_year,holder_name,is_default,status,verified_at,created_at").eq("user_id", userId).neq("status", "removed").order("created_at", { ascending: false }),
      supa.from("linked_bank_accounts").select("*").eq("user_id", userId).neq("verification_status", "removed").order("created_at", { ascending: false }),
      supa.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);

    return json({
      summary: summaryRes.data,
      ledger: ledgerRes.data ?? [],
      cards: cardsRes.data ?? [],
      banks: banksRes.data ?? [],
      withdrawals: wdRes.data ?? [],
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
