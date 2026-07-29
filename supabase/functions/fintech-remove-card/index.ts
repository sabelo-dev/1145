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
    if (!authHeader) return j({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supa.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);

    const { cardId } = await req.json();
    if (!cardId) return j({ error: "cardId required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("payment_instruments")
      .update({ status: "removed", is_default: false })
      .eq("id", cardId).eq("user_id", u.user.id);
    if (error) return j({ error: error.message }, 400);

    await admin.from("user_notifications").insert({
      user_id: u.user.id, type: "card_removed",
      title: "Card removed", message: "A payment card has been removed from your wallet.",
    }).catch(() => {});

    return j({ success: true });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
