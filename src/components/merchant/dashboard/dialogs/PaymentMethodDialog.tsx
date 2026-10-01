import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CreditCard, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fintech } from "@/services/fintech";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
}

interface SavedMethod {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  verified_at: string | null;
}

interface VerifiedCard {
  id: string;
  brand: string | null;
  last4: string | null;
}

const BANKS = ["ABSA", "Standard Bank", "FNB", "Nedbank", "Capitec", "Discovery Bank", "TymeBank", "African Bank"];

const DOCUMENT_TYPES = [
  { value: "identityNumber", label: "SA ID number" },
  { value: "passportNumber", label: "Passport number" },
  { value: "businessRegistrationNumber", label: "Company registration number" },
];

const EMPTY_FORM = {
  account_holder_name: "",
  bank_name: "",
  account_number: "",
  account_type: "checking",
  document_type: "identityNumber",
  document_number: "",
};

/**
 * Payout bank details. They are only accepted once verified: first a card is
 * verified on PayFast, then the bank confirms the account number and holder
 * (vendor-payout-method edge function). Unverified details are never saved.
 */
export const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({ open, onOpenChange, vendorId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [card, setCard] = useState<VerifiedCard | null>(null);
  const [saved, setSaved] = useState<SavedMethod | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [methodRes, cardRes] = await Promise.all([
        supabase.from("vendor_payment_methods").select("*").eq("vendor_id", vendorId).eq("is_default", true).maybeSingle(),
        user
          ? supabase
              .from("payment_instruments")
              .select("id, brand, last4, verified_at")
              .eq("user_id", user.id)
              .eq("status", "active")
              .not("verified_at", "is", null)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setSaved((methodRes.data as unknown as SavedMethod) ?? null);
      setCard((cardRes.data as VerifiedCard | null) ?? null);
    } catch (error) {
      console.error("Error loading payout details:", error);
    } finally {
      setChecking(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (open && vendorId) {
      setFormData(EMPTY_FORM);
      setProblem(null);
      load();
    }
  }, [open, vendorId, load]);

  const verifyCard = async () => {
    try {
      setLoading(true);
      await fintech.startLinkCard("/merchant/dashboard?tab=settings");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not start card verification",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      setLoading(false);
    }
  };

  const savePaymentMethod = async () => {
    setProblem(null);
    if (!formData.account_holder_name || !formData.bank_name || !formData.account_number || !formData.document_number) {
      setProblem("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("vendor-payout-method", { body: formData });
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

      toast({
        title: "Bank account verified",
        description: `Payouts will go to your ${formData.bank_name} account ending ${data?.last4 ?? ""}.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving payment method:", error);
      setProblem("Could not verify your bank account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const set = (field: keyof typeof EMPTY_FORM) => (value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Payment Method</DialogTitle>
          <DialogDescription>
            Payouts only go to a verified bank account. Verify a card, then your bank account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {saved && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {saved.verified_at ? (
                  <BadgeCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                )}
                {saved.bank_name} ••••{saved.account_number.slice(-4)}
              </div>
              <p className="text-muted-foreground mt-1">
                {saved.verified_at
                  ? `Verified account of ${saved.account_holder_name}. Enter new details below to replace it.`
                  : "This account is not verified, so it cannot receive payouts. Enter it again below to verify it."}
              </p>
            </div>
          )}

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Step 1: Card verification
              </p>
              <Button variant="ghost" size="sm" onClick={load} disabled={checking} aria-label="Check again">
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {card ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-green-600" />
                {card.brand || "Card"} ending {card.last4 || "••••"} is verified.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Enter your card number on PayFast's secure page. Your bank confirms it with a R1.00 payment. We
                  never see or store the card number, only its last 4 digits.
                </p>
                <Button onClick={verifyCard} disabled={loading}>
                  Verify card with PayFast
                </Button>
              </>
            )}
          </div>

          <fieldset disabled={!card || loading} className="space-y-4 disabled:opacity-50">
            <p className="text-sm font-medium">Step 2: Bank account</p>

            <div className="space-y-2">
              <Label htmlFor="account-holder">Account Holder Name *</Label>
              <Input
                id="account-holder"
                value={formData.account_holder_name}
                onChange={(e) => set("account_holder_name")(e.target.value)}
                placeholder="Exactly as on the bank account"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name *</Label>
              <Select value={formData.bank_name} onValueChange={set("bank_name")} disabled={!card || loading}>
                <SelectTrigger id="bank-name">
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
              <Label htmlFor="account-number">Account Number *</Label>
              <Input
                id="account-number"
                inputMode="numeric"
                value={formData.account_number}
                onChange={(e) => set("account_number")(e.target.value.replace(/\D/g, ""))}
                placeholder="1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-type">Account Type</Label>
              <Select value={formData.account_type} onValueChange={set("account_type")} disabled={!card || loading}>
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="document-type">Holder's ID type *</Label>
                <Select value={formData.document_type} onValueChange={set("document_type")} disabled={!card || loading}>
                  <SelectTrigger id="document-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="document-number">Number *</Label>
                <Input
                  id="document-number"
                  value={formData.document_number}
                  onChange={(e) => set("document_number")(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The bank uses this number to confirm the account belongs to the holder. It is not stored.
            </p>
          </fieldset>

          {problem && (
            <p role="alert" className="text-sm text-destructive">{problem}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={savePaymentMethod} disabled={loading || !card}>
            {loading ? "Verifying..." : "Verify and save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
