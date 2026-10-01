// Save a merchant's payout bank account — only if it is verified.
//
// Nothing is stored unless both checks pass:
//   1. the merchant has a card verified through PayFast (payment_instruments,
//      written by payfast-itn after the R1 card verification), and
//   2. the bank confirms the account number belongs to the named holder
//      (Paystack account validation, South Africa).
//
// vendor_payment_methods is not writable by clients; this function is the
// only way in. Needs the PAYSTACK_SECRET_KEY function secret.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Universal branch codes, which Paystack also uses as its South African bank codes.
const BANKS: Record<string, string> = {
  "ABSA": "632005",
  "Standard Bank": "051001",
  "FNB": "250655",
  "Nedbank": "198765",
  "Capitec": "470010",
  "Discovery Bank": "679000",
  "TymeBank": "678910",
  "African Bank": "430000",
};

const DOCUMENT_TYPES = ["identityNumber", "passportNumber", "businessRegistrationNumber"];

interface BankCheck {
  verified: boolean;
  message: string;
}

/** Ask the bank (through Paystack) whether this account belongs to this holder. */
async function verifyBankAccount(secretKey: string, input: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  business: boolean;
  documentType: string;
  documentNumber: string;
}): Promise<BankCheck> {
  let res: Response;
  try {
    res = await fetch("https://api.paystack.co/bank/validate", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        bank_code: input.bankCode,
        country_code: "ZA",
        account_number: input.accountNumber,
        account_name: input.accountName,
        account_type: input.business ? "business" : "personal",
        document_type: input.documentType,
        document_number: input.documentNumber,
      }),
    });
  } catch (e) {
    console.error("Bank verification request failed:", e);
    return { verified: false, message: "The bank verification service could not be reached. Try again shortly." };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status !== true) {
    console.error("Bank verification rejected:", res.status, body?.message);
    return { verified: false, message: body?.message || "The bank could not verify this account." };
  }
  return {
    verified: body?.data?.verified === true,
    message: body?.data?.verificationMessage || body?.message || "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user } } = await admin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: vendor } = await admin.from("vendors").select("id").eq("user_id", user.id).maybeSingle();
    if (!vendor) return json({ error: "No merchant account found for this user" }, 403);

    const body = await req.json().catch(() => ({}));
    const accountHolder = String(body.account_holder_name ?? "").trim();
    const bankName = String(body.bank_name ?? "").trim();
    const accountNumber = String(body.account_number ?? "").replace(/\s/g, "");
    const accountType = ["checking", "savings", "business"].includes(body.account_type) ? body.account_type : "checking";
    const documentType = String(body.document_type ?? "");
    const documentNumber = String(body.document_number ?? "").replace(/\s/g, "");

    const bankCode = BANKS[bankName];
    if (!accountHolder || accountHolder.length > 100) return json({ error: "Enter the account holder's name" }, 400);
    if (!bankCode) return json({ error: "Choose your bank" }, 400);
    if (!/^\d{6,16}$/.test(accountNumber)) return json({ error: "Enter a valid account number (digits only)" }, 400);
    if (!DOCUMENT_TYPES.includes(documentType) || !/^[A-Za-z0-9/]{5,20}$/.test(documentNumber)) {
      return json({ error: "Enter the ID, passport or company registration number of the account holder" }, 400);
    }

    // 1. A card verified through PayFast.
    const { data: cards } = await admin
      .from("payment_instruments")
      .select("id, last4, verified_at, created_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const card = (cards ?? []).find((c: { verified_at: string | null }) => c.verified_at);
    if (!card) {
      return json({ error: "Verify a card with PayFast first", code: "card_required" }, 400);
    }

    // 2. The bank confirms the account.
    const secretKey = (Deno.env.get("PAYSTACK_SECRET_KEY") ?? "").trim();
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY is not set; bank accounts cannot be verified.");
      return json({ error: "Bank verification is not available yet. Please try again later.", code: "verification_unavailable" }, 503);
    }
    const check = await verifyBankAccount(secretKey, {
      bankCode,
      accountNumber,
      accountName: accountHolder,
      business: accountType === "business" || documentType === "businessRegistrationNumber",
      documentType,
      documentNumber,
    });
    if (!check.verified) {
      return json({
        error: "The bank could not confirm this account. Check the account number, holder name and ID number.",
        detail: check.message,
        code: "not_verified",
      }, 422);
    }

    // Verified: this becomes the only payout account.
    const row = {
      vendor_id: vendor.id,
      account_holder_name: accountHolder,
      bank_name: bankName,
      account_number: accountNumber,
      account_type: accountType,
      branch_code: bankCode,
      is_default: true,
      verified_at: new Date().toISOString(),
      verification_provider: "paystack",
      verification_message: check.message || null,
      card_instrument_id: card.id,
    };
    const { error: deleteError } = await admin.from("vendor_payment_methods").delete().eq("vendor_id", vendor.id);
    if (deleteError) return json({ error: deleteError.message }, 500);
    const { error: insertError } = await admin.from("vendor_payment_methods").insert(row);
    if (insertError) return json({ error: insertError.message }, 500);

    await admin.from("user_notifications").insert({
      user_id: user.id,
      type: "bank_verified",
      title: "Bank account verified",
      message: `Your ${bankName} account ending ${accountNumber.slice(-4)} is verified and will be used for payouts.`,
    });

    return json({ success: true, last4: accountNumber.slice(-4) });
  } catch (e) {
    console.error("vendor-payout-method error:", e);
    return json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});
