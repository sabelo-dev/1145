// Admin fintech actions: list flagged/withdrawals, review withdrawal, verify bank, freeze/unfreeze wallet.
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return j({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    const audit = (details: Record<string, unknown>, target_type?: string, target_id?: string) =>
      admin.from("fintech_admin_audit").insert({
        admin_id: u.user.id, action, target_type: target_type ?? null, target_id: target_id ?? null, details,
      });

    switch (action) {
      case "overview": {
        const [wds, flags, frozen, ledger] = await Promise.all([
          admin.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(200),
          admin.from("fintech_fraud_events").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(100),
          admin.from("wallets").select("*").eq("status", "frozen"),
          admin.from("wallet_ledger").select("*").order("created_at", { ascending: false }).limit(200),
        ]);
        return j({ withdrawals: wds.data, flagged: flags.data, frozen: frozen.data, recentLedger: ledger.data });
      }
      case "review_withdrawal": {
        const wdId = String(body.withdrawal_id || "");
        const decision = String(body.decision || "");
        const reason = body.reason ? String(body.reason) : null;
        const { data: wd } = await admin.from("withdrawal_requests").select("*").eq("id", wdId).maybeSingle();
        if (!wd) return j({ error: "Not found" }, 404);
        if (wd.status !== "pending") return j({ error: `Cannot review a ${wd.status} withdrawal` }, 400);

        if (decision === "approve") {
          await admin.from("withdrawal_requests").update({
            status: "completed", reviewer_id: u.user.id, reviewed_at: new Date().toISOString(),
            provider_reference: body.provider_reference || null,
          }).eq("id", wdId);
          await admin.rpc("credit_wallet", {
            p_user_id: wd.user_id, p_bucket: "withdrawal", p_amount: wd.amount,
            p_type: "withdrawal_completed", p_provider: "manual",
            p_related_type: "withdrawal_request", p_related_id: wdId,
          }).catch(() => {});
          await admin.rpc("debit_wallet", {
            p_user_id: wd.user_id, p_bucket: "withdrawal", p_amount: wd.amount,
            p_type: "withdrawal_completed", p_provider: "manual",
            p_related_type: "withdrawal_request", p_related_id: wdId,
          }).catch(() => {});
          await admin.from("user_notifications").insert({
            user_id: wd.user_id, type: "withdrawal_completed",
            title: "Withdrawal approved", message: `Your R${Number(wd.amount).toFixed(2)} withdrawal has been paid out.`,
          }).catch(() => {});
        } else if (decision === "reject") {
          // Refund
          await admin.rpc("credit_wallet", {
            p_user_id: wd.user_id, p_bucket: "available", p_amount: wd.amount,
            p_type: "reversal", p_provider: "internal",
            p_related_type: "withdrawal_request", p_related_id: wdId,
            p_metadata: { reason },
          });
          await admin.from("withdrawal_requests").update({
            status: "rejected", reviewer_id: u.user.id, reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
          }).eq("id", wdId);
          await admin.from("user_notifications").insert({
            user_id: wd.user_id, type: "withdrawal_rejected",
            title: "Withdrawal rejected", message: reason || "Your withdrawal was rejected and funds returned to your wallet.",
          }).catch(() => {});
        } else return j({ error: "Invalid decision" }, 400);

        await audit({ decision, reason, wd_amount: wd.amount }, "withdrawal_request", wdId);
        return j({ success: true });
      }
      case "verify_bank": {
        const bankId = String(body.bank_id || "");
        const approve = body.approve !== false;
        await admin.from("linked_bank_accounts").update({
          verification_status: approve ? "verified" : "failed",
          verified_at: approve ? new Date().toISOString() : null,
          verified_by: u.user.id,
        }).eq("id", bankId);
        await audit({ approve }, "linked_bank_account", bankId);
        return j({ success: true });
      }
      case "freeze_wallet": {
        const targetUserId = String(body.user_id || "");
        const freeze = body.freeze !== false;
        await admin.from("wallets").update({ status: freeze ? "frozen" : "active" }).eq("user_id", targetUserId);
        await admin.from("user_notifications").insert({
          user_id: targetUserId, type: freeze ? "wallet_frozen" : "wallet_unfrozen",
          title: freeze ? "Wallet frozen" : "Wallet reactivated",
          message: freeze ? "Your 1145 Wallet has been frozen. Contact support." : "Your 1145 Wallet is active again.",
        }).catch(() => {});
        await audit({ freeze }, "wallet", targetUserId);
        return j({ success: true });
      }
      case "resolve_flag": {
        const id = String(body.event_id || "");
        await admin.from("fintech_fraud_events").update({ resolved: true }).eq("id", id);
        await audit({}, "fraud_event", id);
        return j({ success: true });
      }
      case "audit_log": {
        const { data } = await admin.from("fintech_admin_audit").select("*").order("created_at", { ascending: false }).limit(200);
        return j({ audit: data });
      }
      default: return j({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
