// Link a member's bank account to their wallet — only for members with a card
// verified through PayFast (see _shared/bankVerification.ts).
// Never persists the full account number: only the last 4 digits.
//
// body.destination picks the wallet feature the account is for:
//   "withdrawals" (default) -> linked_bank_accounts
//   "transfers"             -> user_linked_bank_accounts (bank transfer dialog)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkBankDetails, sha256Hex, VERIFICATION_PROVIDER } from "../_shared/bankVerification.ts";

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

    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const check = await checkBankDetails(admin, userId, body);
    if (!check.ok) return j(check.body, check.status);
    const bank = check.details;
    const verifiedAt = new Date().toISOString();

    let bankAccount: unknown;
    if (body.destination === "transfers") {
      const { data: existing } = await admin.from("user_linked_bank_accounts").select("id").eq("user_id", userId);
      const { data, error } = await admin.from("user_linked_bank_accounts").insert({
        user_id: userId,
        bank_name: bank.bankName,
        account_holder_name: bank.accountHolder,
        account_number_masked: `****${bank.last4}`,
        account_number_hash: await sha256Hex(bank.accountNumber),
        account_type: bank.accountType,
        branch_code: bank.bankCode,
        is_default: (existing ?? []).length === 0,
        is_verified: true,
        verified_at: verifiedAt,
        verification_provider: VERIFICATION_PROVIDER,
      }).select().single();
      if (error) return j({ error: error.message }, 400);
      bankAccount = data;
    } else {
      // Basic fraud signal: duplicate last4+holder across users
      const { data: dup } = await admin.from("linked_bank_accounts")
        .select("id,user_id").eq("account_last4", bank.last4)
        .eq("account_holder_name", bank.accountHolder).neq("user_id", userId).limit(1);
      if (dup && dup.length > 0) {
        await admin.from("fintech_fraud_events").insert({
          user_id: userId, event_type: "duplicate_bank_account", risk_score: 60,
          signals: { last4: bank.last4, holder: bank.accountHolder, ip: req.headers.get("x-forwarded-for") },
        });
      }

      const { data, error } = await admin.from("linked_bank_accounts").insert({
        user_id: userId,
        provider: VERIFICATION_PROVIDER,
        bank_name: bank.bankName,
        account_holder_name: bank.accountHolder,
        account_last4: bank.last4,
        account_type: bank.accountType,
        branch_code: bank.bankCode,
        verification_status: "verified",
        verified_at: verifiedAt,
      }).select().single();
      if (error) return j({ error: error.message }, 400);
      bankAccount = data;
    }

    await admin.from("user_notifications").insert({
      user_id: userId, type: "bank_linked",
      title: "Bank account linked",
      message: `Your ${bank.bankName} account ending ${bank.last4} is linked to your wallet.`,
    });

    return j({ success: true, bankAccount, bank_name: bank.bankName, last4: bank.last4 });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
