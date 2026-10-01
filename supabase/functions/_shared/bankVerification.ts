// Bank details are only accepted from users with a card verified through
// PayFast. Shared by every function that stores a bank account (merchant
// payouts, merchant onboarding, member wallet).
//
// The card check is the R1 PayFast card verification (fintech-link-card):
// the cardholder's bank confirms the card, and payfast-itn records it in
// payment_instruments. PayFast has no service that confirms a bank account
// number or its holder, so the account number itself is only format-checked.

// Universal branch codes.
export const BANKS: Record<string, string> = {
  "ABSA": "632005",
  "Standard Bank": "051001",
  "FNB": "250655",
  "Nedbank": "198765",
  "Capitec": "470010",
  "Discovery Bank": "679000",
  "TymeBank": "678910",
  "African Bank": "430000",
  "Investec": "580105",
  "Bidvest Bank": "462005",
};

/** Recorded with each accepted account: what it was verified by. */
export const VERIFICATION_PROVIDER = "payfast_card";

export interface VerifiedBankDetails {
  accountHolder: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  last4: string;
  accountType: "checking" | "savings" | "business";
  cardId: string;
  cardLast4: string | null;
}

export type BankCheckResult =
  | { ok: true; details: VerifiedBankDetails }
  | { ok: false; status: number; body: { error: string; code: string } };

const fail = (status: number, code: string, error: string): BankCheckResult =>
  ({ ok: false, status, body: { error, code } });

/**
 * Validate the submitted bank details and require a PayFast-verified card.
 * `admin` is a service-role client. Nothing may be stored unless this passes.
 */
// deno-lint-ignore no-explicit-any
export async function checkBankDetails(admin: any, userId: string, body: Record<string, unknown>): Promise<BankCheckResult> {
  const accountHolder = String(body.account_holder_name ?? "").trim();
  const bankName = String(body.bank_name ?? "").trim();
  const accountNumber = String(body.account_number ?? "").replace(/\s/g, "");
  const accountType = (["checking", "savings", "business"].includes(String(body.account_type))
    ? String(body.account_type) : "checking") as VerifiedBankDetails["accountType"];

  const bankCode = BANKS[bankName];
  if (!accountHolder || accountHolder.length > 100) return fail(400, "invalid_input", "Enter the account holder's name");
  if (!bankCode) return fail(400, "invalid_input", "Choose your bank");
  if (!/^\d{6,16}$/.test(accountNumber)) return fail(400, "invalid_input", "Enter a valid account number (digits only)");

  const { data: cards } = await admin
    .from("payment_instruments")
    .select("id, last4, verified_at, created_at")
    .eq("user_id", userId)
    .eq("provider", "payfast")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  const card = (cards ?? []).find((c: { verified_at: string | null }) => c.verified_at);
  if (!card) return fail(400, "card_required", "Verify a card with PayFast first");

  return {
    ok: true,
    details: {
      accountHolder, bankName, bankCode, accountNumber, accountType,
      last4: accountNumber.slice(-4),
      cardId: card.id,
      cardLast4: card.last4 ?? null,
    },
  };
}

/** SHA-256 hex, for keeping a fingerprint of an account number instead of the number. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
