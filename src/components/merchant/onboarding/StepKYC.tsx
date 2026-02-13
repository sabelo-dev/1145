import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Upload, Shield, Loader2, AlertCircle } from "lucide-react";

interface StepKYCProps {
  documents: Record<string, string>;
  bankDetails: {
    accountHolder: string;
    accountNumber: string;
    routingCode: string;
  };
  onUpload: (file: File, type: string) => Promise<void>;
  onBankDetailsChange: (details: { accountHolder: string; accountNumber: string; routingCode: string }) => void;
  onNext: () => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  kycStatus?: string;
}

const StepKYC: React.FC<StepKYCProps> = ({
  documents, bankDetails, onUpload, onBankDetailsChange, onNext, onBack, isLoading, kycStatus
}) => {
  const [uploading, setUploading] = useState<string | null>(null);

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
  const hasBankDetails = bankDetails.accountHolder && bankDetails.accountNumber && bankDetails.routingCode;
  const canProceed = hasGovernmentId && hasBankDetails;

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

        {/* Bank Account Details */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Bank Account Details *</h4>
          <div className="space-y-3">
            <div>
              <Label>Account Holder Name</Label>
              <Input
                value={bankDetails.accountHolder}
                onChange={(e) => onBankDetailsChange({ ...bankDetails, accountHolder: e.target.value })}
                placeholder="Full name on bank account"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Account Number / IBAN</Label>
              <Input
                value={bankDetails.accountNumber}
                onChange={(e) => onBankDetailsChange({ ...bankDetails, accountNumber: e.target.value })}
                placeholder="Enter account number or IBAN"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Routing / SWIFT Code</Label>
              <Input
                value={bankDetails.routingCode}
                onChange={(e) => onBankDetailsChange({ ...bankDetails, routingCode: e.target.value })}
                placeholder="Enter routing or SWIFT code"
                className="mt-1"
              />
            </div>
          </div>
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
