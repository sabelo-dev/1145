import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VerifiedBankForm } from "@/components/banking/VerifiedBankForm";

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

/**
 * Payout bank details. They are only accepted from a merchant with a card
 * verified on PayFast (vendor-payout-method edge function); anything else is
 * never saved.
 */
export const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({ open, onOpenChange, vendorId }) => {
  const { toast } = useToast();
  const [saved, setSaved] = useState<SavedMethod | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("vendor_payment_methods")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) console.error("Error fetching payment method:", error);
    setSaved((data as unknown as SavedMethod) ?? null);
  }, [vendorId]);

  useEffect(() => {
    if (open && vendorId) load();
  }, [open, vendorId, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Payment Method</DialogTitle>
          <DialogDescription>
            Payouts only go to a bank account added by a verified cardholder. Verify a card, then add your account.
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
                  ? `Payout account of ${saved.account_holder_name}. Enter new details below to replace it.`
                  : "This account is not verified, so it cannot receive payouts. Enter it again below."}
              </p>
            </div>
          )}

          <VerifiedBankForm
            endpoint="vendor-payout-method"
            returnPath="/merchant/dashboard?tab=settings"
            submitLabel="Save payout account"
            onCancel={() => onOpenChange(false)}
            onSaved={(result) => {
              toast({
                title: "Payout account saved",
                description: `Payouts will go to your ${result.bank_name} account ending ${result.last4}.`,
              });
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
