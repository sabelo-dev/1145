import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgeCheck, CheckCircle, Upload, Shield, Loader2, AlertCircle } from "lucide-react";
import { VerifiedBankForm, type VerifiedBankResult } from "@/components/banking/VerifiedBankForm";

interface StepKYCProps {
  documents: Record<string, string>;
  /** The payout account already accepted for this merchant, if any. */
  verifiedBank: { bank_name: string; last4: string } | null;
  onBankVerified: (bank: VerifiedBankResult) => void;
  onUpload: (file: File, type: string) => Promise<void>;
  onNext: () => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  kycStatus?: string;
}

const StepKYC: React.FC<StepKYCProps> = ({
  documents, verifiedBank, onBankVerified, onUpload, onNext, onBack, isLoading, kycStatus
}) => {
  const [uploading, setUploading] = useState<string | null>(null);
  const [replacingBank, setReplacingBank] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    if (!e.target.files?.[0]) return;
    setUploading(type);
    try {
      await onUpload(e.target.files[0], type);
    } finally {
      setUploading(null);
    }
  };

  const hasGovernmentId = !!documents["government-id"];
  const canProceed = hasGovernmentId && !!verifiedBank;

  const isRejected = kycStatus === 'KYC_REJECTED';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Identity & Compliance (KYC)
        </CardTitle>
        <CardDescription>Upload required documents for verification</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isRejected && (
          <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">KYC Rejected</p>
              <p className="text-sm text-muted-foreground">Please re-upload your documents to continue.</p>
            </div>
          </div>
        )}

        {/* Government ID */}
        <div className="space-y-2">
          <Label>Government-Issued ID *</Label>
          <p className="text-xs text-muted-foreground">Passport, Driver's License, or National ID (image or PDF)</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFileChange(e, "government-id")}
                disabled={uploading === "government-id"}
                className="max-w-sm"
              />
            </div>
            {uploading === "government-id" && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasGovernmentId && <CheckCircle className="h-5 w-5 text-primary" />}
          </div>
        </div>

        {/* Business Registration (optional) */}
        <div className="space-y-2">
          <Label>Business Registration Document (optional)</Label>
          <div className="flex items-center gap-3">
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => handleFileChange(e, "business-registration")}
              disabled={uploading === "business-registration"}
              className="max-w-sm"
            />
            {uploading === "business-registration" && <Loader2 className="h-4 w-4 animate-spin" />}
            {documents["business-registration"] && <CheckCircle className="h-5 w-5 text-primary" />}
          </div>
        </div>

        {/* Bank Account Details: only accepted through card + bank verification */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Bank Account Details *</h4>
          {verifiedBank && (
            <p className="text-sm flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-green-600" />
              {verifiedBank.bank_name} account ending {verifiedBank.last4} is saved for payouts.
            </p>
          )}
          {verifiedBank && !replacingBank ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setReplacingBank(true)}>
              Use a different account
            </Button>
          ) : (
            <VerifiedBankForm
              endpoint="vendor-payout-method"
              returnPath="/merchant/onboarding"
              submitLabel="Save bank account"
              onCancel={verifiedBank ? () => setReplacingBank(false) : undefined}
              onSaved={(result) => {
                setReplacingBank(false);
                onBankVerified(result);
              }}
            />
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>Back</Button>
          <Button onClick={onNext} disabled={!canProceed || isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit for Review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepKYC;
