// Save a merchant's payout bank account — only for merchants with a card
// verified through PayFast (see _shared/bankVerification.ts).
// Used by the merchant settings dialog and the onboarding KYC step.
//
// merchant_payment_methods and the bank columns of merchant_financial_details are
// not writable by clients; this function is the only way in.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkBankDetails, VERIFICATION_PROVIDER } from "../_shared/bankVerification.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user } } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: merchant } = await admin.from("merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (!merchant) return json({ error: "No merchant account found for this user" }, 403);

    const check = await checkBankDetails(admin, user.id, await req.json().catch(() => ({})));
    if (!check.ok) return json(check.body, check.status);
    const bank = check.details;

    // Verified: this becomes the only payout account.
    const { error: deleteError } = await admin.from("merchant_payment_methods").delete().eq("merchant_id", merchant.id);
    if (deleteError) return json({ error: deleteError.message }, 500);
    const { error: insertError } = await admin.from("merchant_payment_methods").insert({
      merchant_id: merchant.id,
      account_holder_name: bank.accountHolder,
      bank_name: bank.bankName,
      account_number: bank.accountNumber,
      account_type: bank.accountType,
      branch_code: bank.bankCode,
      is_default: true,
      verified_at: new Date().toISOString(),
      verification_provider: VERIFICATION_PROVIDER,
      verification_message: `PayFast-verified card ending ${bank.cardLast4 ?? "••••"}`,
      card_instrument_id: bank.cardId,
    });
    if (insertError) return json({ error: insertError.message }, 500);

    // Onboarding / KYC review reads the bank details from here.
    const { error: finError } = await admin.from("merchant_financial_details").upsert({
      merchant_id: merchant.id,
      bank_account_holder: bank.accountHolder,
      bank_account_number: bank.accountNumber,
      bank_routing_code: bank.bankCode,
    }, { onConflict: "merchant_id" });
    if (finError) console.error("merchant_financial_details sync failed:", finError);

    await admin.from("user_notifications").insert({
      user_id: user.id,
      type: "bank_verified",
      title: "Payout account saved",
      message: `Your ${bank.bankName} account ending ${bank.last4} will be used for payouts.`,
    });

    return json({ success: true, bank_name: bank.bankName, last4: bank.last4 });
  } catch (e) {
    console.error("merchant-payout-method error:", e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
