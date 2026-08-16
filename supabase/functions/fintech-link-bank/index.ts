// Add a bank account for payouts. Stores only last 4 of account number.
// Verification is initially manual (admin approval). Never persists the full account number.
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

    const body = await req.json();
    const bank_name = String(body.bank_name || "").trim();
    const account_holder_name = String(body.account_holder_name || "").trim();
    const account_number = String(body.account_number || "").replace(/\D/g, "");
    const account_type = String(body.account_type || "checking");
    const branch_code = body.branch_code ? String(body.branch_code) : null;

    if (!bank_name || !account_holder_name || account_number.length < 6) {
      return j({ error: "Invalid input" }, 400);
    }
    // Never store full account number. Only last 4.
    const account_last4 = account_number.slice(-4);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Basic fraud signal: duplicate last4+holder across users
    const { data: dup } = await admin.from("linked_bank_accounts")
      .select("id,user_id").eq("account_last4", account_last4)
      .eq("account_holder_name", account_holder_name).neq("user_id", u.user.id).limit(1);
    if (dup && dup.length > 0) {
      await admin.from("fintech_fraud_events").insert({
        user_id: u.user.id, event_type: "duplicate_bank_account", risk_score: 60,
        signals: { last4: account_last4, holder: account_holder_name, ip: req.headers.get("x-forwarded-for") },
      });
    }

    const { data, error } = await admin.from("linked_bank_accounts").insert({
      user_id: u.user.id,
      provider: "manual",
      bank_name, account_holder_name, account_last4, account_type, branch_code,
      verification_status: "pending",
    }).select().single();
    if (error) return j({ error: error.message }, 400);

    await admin.from("user_notifications").insert({
      user_id: u.user.id, type: "bank_linked",
      title: "Bank account added",
      message: `Your ${bank_name} account ending ${account_last4} is pending verification.`,
    }).catch(() => {});

    return j({ success: true, bankAccount: data });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
