import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fintech } from "@/services/fintech";

const BANKS = [
  "ABSA", "Standard Bank", "FNB", "Nedbank", "Capitec", "Discovery Bank", "TymeBank", "African Bank", "Investec",
  "Bidvest Bank",
];

const EMPTY_FORM = { account_holder_name: "", bank_name: "", account_number: "", account_type: "checking" };

interface VerifiedCard {
  id: string;
  brand: string | null;
  last4: string | null;
}

export interface VerifiedBankResult {
  bank_name: string;
  last4: string;
  account_holder_name: string;
}

interface VerifiedBankFormProps {
  /** Edge function that stores the account: "merchant-payout-method" or "fintech-link-bank". */
  endpoint: string;
  /** Extra fields for the function, e.g. { destination: "transfers" }. */
  extraBody?: Record<string, unknown>;
  /** Page to come back to after verifying the card on PayFast. */
  returnPath: string;
  onSaved: (result: VerifiedBankResult) => void;
  onCancel?: () => void;
  submitLabel?: string;
  /** Called just before leaving for PayFast, e.g. to keep an unsaved form. */
  onBeforeCardVerify?: () => void;
}

/**
 * The only way bank details are entered in the app. Step 1: verify a card on
 * PayFast (R1, confirmed by the cardholder's bank). Step 2: the bank account,
 * which the server accepts only from a user with a verified card.
 */
export const VerifiedBankForm: React.FC<VerifiedBankFormProps> = ({
  endpoint, extraBody, returnPath, onSaved, onCancel, submitLabel = "Save bank account", onBeforeCardVerify,
}) => {
  const [card, setCard] = useState<VerifiedCard | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [problem, setProblem] = useState<string | null>(null);

  const loadCard = useCallback(async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("payment_instruments")
        .select("id, brand, last4")
        .eq("user_id", user.id)
        .eq("provider", "payfast")
        .eq("status", "active")
        .not("verified_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCard((data as VerifiedCard | null) ?? null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { loadCard(); }, [loadCard]);

  const verifyCard = async () => {
    setProblem(null);
    try {
      setLoading(true);
      onBeforeCardVerify?.();
      await fintech.startLinkCard(returnPath);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not start card verification.");
      setLoading(false);
    }
  };

  const save = async () => {
    setProblem(null);
    if (!formData.account_holder_name.trim() || !formData.bank_name || !formData.account_number) {
      setProblem("Please fill in all required fields.");
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(endpoint, { body: { ...formData, ...extraBody } });
      let message: string | undefined = data?.error;
      if (error) {
        // Non-2xx: the reason is in the response body.
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        message = body?.error || error.message;
      }
      if (message) {
        setProblem(message);
        return;
      }
      onSaved({
        bank_name: data?.bank_name ?? formData.bank_name,
        last4: data?.last4 ?? formData.account_number.slice(-4),
        account_holder_name: formData.account_holder_name.trim(),
      });
      setFormData(EMPTY_FORM);
    } catch (error) {
      console.error("Error saving bank account:", error);
      setProblem("Could not save your bank account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));
  const locked = !card || loading;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Step 1: Card verification
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={loadCard} disabled={checking} aria-label="Check again">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        {card ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-green-600" />
            {card.brand || "Card"} ending {card.last4 || "••••"} is verified.
          </p>
        ) : checking ? (
          <p className="text-sm text-muted-foreground">Checking for a verified card…</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter your card number on PayFast's secure page. Your bank confirms it with a R1.00 payment. We never
              see or store the card number, only its last 4 digits.
            </p>
            <Button type="button" onClick={verifyCard} disabled={loading}>
              Verify card with PayFast
            </Button>
          </>
        )}
      </div>

      <fieldset disabled={locked} className="space-y-4 disabled:opacity-50">
        <p className="text-sm font-medium">Step 2: Bank account</p>

        <div className="space-y-2">
          <Label htmlFor="vbf-holder">Account Holder Name *</Label>
          <Input
            id="vbf-holder"
            value={formData.account_holder_name}
            onChange={(e) => set("account_holder_name")(e.target.value)}
            placeholder="Exactly as on the bank account"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vbf-bank">Bank Name *</Label>
          <Select value={formData.bank_name} onValueChange={set("bank_name")} disabled={locked}>
            <SelectTrigger id="vbf-bank">
              <SelectValue placeholder="Select your bank" />
            </SelectTrigger>
            <SelectContent>
              {BANKS.map((bank) => (
                <SelectItem key={bank} value={bank}>{bank}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vbf-number">Account Number *</Label>
          <Input
            id="vbf-number"
            inputMode="numeric"
            autoComplete="off"
            value={formData.account_number}
            onChange={(e) => set("account_number")(e.target.value.replace(/\D/g, ""))}
            placeholder="1234567890"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vbf-type">Account Type</Label>
          <Select value={formData.account_type} onValueChange={set("account_type")} disabled={locked}>
            <SelectTrigger id="vbf-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">Cheque / Current</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={save} disabled={locked}>
          {loading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
};
