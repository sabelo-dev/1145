import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail } from "lucide-react";

interface StepAccountCreationProps {
  email: string;
  isVerified: boolean;
  onNext: () => void;
}

const StepAccountCreation: React.FC<StepAccountCreationProps> = ({ email, isVerified, onNext }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Account Created
        </CardTitle>
        <CardDescription>Your merchant account has been created successfully</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
          <CheckCircle className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Email Verified</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
          <CheckCircle className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Terms & Conditions Accepted</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onNext}>Continue to Business Info</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepAccountCreation;
