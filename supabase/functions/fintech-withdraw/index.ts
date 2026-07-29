// Request a withdrawal from 1145 Wallet to a verified bank account.
// Debits the wallet immediately (available -> ledger withdrawal_request) and queues admin review.
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
    const userId = u.user.id;

    const body = await req.json();
    const amount = Number(body.amount);
    const bankAccountId = String(body.bank_account_id || "");
    if (!Number.isFinite(amount) || amount <= 0) return j({ error: "Invalid amount" }, 400);
    if (!bankAccountId) return j({ error: "bank_account_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // KYC gate + limits
    const { data: summary } = await admin.rpc("get_wallet_summary", { p_user_id: userId });
    const kycLevel = summary?.kyc?.level || "none";
    const kycStatus = summary?.kyc?.status;
    if (kycLevel === "none" || kycStatus !== "approved") {
      return j({ error: "Complete KYC verification to enable withdrawals" }, 403);
    }
    const single = Number(summary?.limits?.single_withdrawal_max || 0);
    if (amount > single) return j({ error: `Amount exceeds your R${single} per-withdrawal limit` }, 400);

    // Daily/monthly usage
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: recentWd } = await admin.from("withdrawal_requests")
      .select("amount,created_at,status").eq("user_id", userId).neq("status", "rejected").neq("status", "cancelled")
      .gte("created_at", monthStart);
    const dayTotal = (recentWd || []).filter(r => r.created_at >= dayStart).reduce((s, r) => s + Number(r.amount), 0);
    const monthTotal = (recentWd || []).reduce((s, r) => s + Number(r.amount), 0);
    if (dayTotal + amount > Number(summary?.limits?.daily_withdrawal || 0)) return j({ error: "Daily withdrawal limit exceeded" }, 400);
    if (monthTotal + amount > Number(summary?.limits?.monthly_withdrawal || 0)) return j({ error: "Monthly withdrawal limit exceeded" }, 400);

    // Bank must be verified & owned
    const { data: bank } = await admin.from("linked_bank_accounts")
      .select("*").eq("id", bankAccountId).eq("user_id", userId).maybeSingle();
    if (!bank) return j({ error: "Bank account not found" }, 404);
    if (bank.verification_status !== "verified") return j({ error: "Bank account is not verified yet" }, 400);

    // Simple velocity fraud check: >3 withdrawal attempts in last 10 min
    const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentAttempts } = await admin.from("withdrawal_requests")
      .select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", tenMin);
    let fraudScore = 0;
    if ((recentAttempts || 0) >= 3) {
      fraudScore = 75;
      await admin.from("fintech_fraud_events").insert({
        user_id: userId, event_type: "withdrawal_velocity", risk_score: fraudScore,
        signals: { attempts_10min: recentAttempts, amount },
        ip: req.headers.get("x-forwarded-for"),
      });
    }

    // Debit available balance
    const { error: debitErr } = await admin.rpc("debit_wallet", {
      p_user_id: userId, p_bucket: "available", p_amount: amount,
      p_type: "withdrawal_request", p_provider: "internal",
      p_related_type: "bank_account", p_related_id: bankAccountId,
      p_metadata: { bank_last4: bank.account_last4 },
    });
    if (debitErr) return j({ error: debitErr.message }, 400);

    const { data: wd, error: wdErr } = await admin.from("withdrawal_requests").insert({
      user_id: userId, bank_account_id: bankAccountId, amount, fraud_score: fraudScore,
    }).select().single();
    if (wdErr) return j({ error: wdErr.message }, 400);

    await admin.from("user_notifications").insert({
      user_id: userId, type: "withdrawal_requested",
      title: "Withdrawal requested",
      message: `Your R${amount.toFixed(2)} withdrawal to ${bank.bank_name} •••• ${bank.account_last4} is pending review.`,
    }).catch(() => {});

    return j({ success: true, withdrawal: wd });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
