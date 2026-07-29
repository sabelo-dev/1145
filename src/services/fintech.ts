import { supabase } from "@/integrations/supabase/client";

export interface WalletSummary {
  wallet: {
    id: string;
    available_balance: number;
    pending_balance: number;
    withdrawal_balance: number;
    currency: string;
    status: "active" | "frozen" | "closed";
  } | null;
  kyc: {
    level: "none" | "basic" | "enhanced";
    status: "pending" | "approved" | "rejected";
    legal_name?: string;
  } | null;
  limits: {
    daily_deposit: number;
    daily_withdrawal: number;
    single_withdrawal_max: number;
    monthly_withdrawal: number;
  } | null;
}

export interface LinkedCard {
  id: string;
  provider: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  holder_name: string | null;
  is_default: boolean;
  status: string;
  verified_at: string | null;
  created_at: string;
}

export interface LinkedBankAccount {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_last4: string;
  account_type: string | null;
  branch_code: string | null;
  verification_status: "pending" | "verified" | "failed" | "removed";
  is_default: boolean;
  created_at: string;
}

export interface LedgerRow {
  id: string;
  direction: "credit" | "debit";
  bucket: "available" | "pending" | "withdrawal";
  amount: number;
  currency: string;
  type: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  balance_after: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  currency: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  bank_account_id: string;
}

export interface WalletBundle {
  summary: WalletSummary;
  ledger: LedgerRow[];
  cards: LinkedCard[];
  banks: LinkedBankAccount[];
  withdrawals: WithdrawalRequest[];
}

function submitPayFastForm(action: string, formData: Record<string, string | number>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";
  Object.entries(formData).forEach(([k, v]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v);
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

export const fintech = {
  async loadWallet(): Promise<WalletBundle> {
    const { data, error } = await supabase.functions.invoke("fintech-wallet", { body: {} });
    if (error) throw error;
    return data as WalletBundle;
  },

  async startLinkCard(): Promise<void> {
    const { data, error } = await supabase.functions.invoke("fintech-link-card", { body: {} });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to start card linking");
    submitPayFastForm(data.action, data.formData);
  },

  async removeCard(cardId: string) {
    const { data, error } = await supabase.functions.invoke("fintech-remove-card", { body: { cardId } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async addBankAccount(input: {
    bank_name: string;
    account_holder_name: string;
    account_number: string;
    account_type?: string;
    branch_code?: string;
  }) {
    const { data, error } = await supabase.functions.invoke("fintech-link-bank", { body: input });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.bankAccount as LinkedBankAccount;
  },

  async deposit(amount: number): Promise<void> {
    const { data, error } = await supabase.functions.invoke("fintech-deposit", { body: { amount } });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Failed to start deposit");
    submitPayFastForm(data.action, data.formData);
  },

  async withdraw(amount: number, bankAccountId: string) {
    const { data, error } = await supabase.functions.invoke("fintech-withdraw", {
      body: { amount, bank_account_id: bankAccountId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.withdrawal as WithdrawalRequest;
  },

  async submitKyc(input: {
    legal_name: string;
    dob: string;
    id_number: string;
    id_document_ref?: string;
    address_line1: string;
    city: string;
    province: string;
    postal_code: string;
    country?: string;
    selfie_ref?: string;
  }) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error("Not signed in");
    // Hash ID number client-side too (server also stores hash only via later columns).
    const enc = new TextEncoder().encode(input.id_number);
    const hashBuf = await crypto.subtle.digest("SHA-256", enc);
    const id_number_hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const payload = {
      user_id: userData.user.id,
      legal_name: input.legal_name,
      dob: input.dob,
      id_number_hash,
      id_document_ref: input.id_document_ref || null,
      address_line1: input.address_line1,
      city: input.city,
      province: input.province,
      postal_code: input.postal_code,
      country: input.country || "ZA",
      selfie_ref: input.selfie_ref || null,
      level: "basic" as const,
      status: "pending" as const,
      email_verified: !!userData.user.email_confirmed_at,
    };
    const { data, error } = await supabase.from("kyc_profiles").upsert(payload, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    return data;
  },

  async adminCall(action: string, body: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke("fintech-admin", { body: { action, ...body } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },
};
