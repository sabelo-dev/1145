import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChecklistItem {
  label: string;
  completed: boolean;
}

interface StepReviewActivationProps {
  checklist: ChecklistItem[];
  allComplete: boolean;
  onActivate: () => Promise<void>;
  isLoading: boolean;
  isActivated: boolean;
}

const StepReviewActivation: React.FC<StepReviewActivationProps> = ({
  checklist, allComplete, onActivate, isLoading, isActivated,
}) => {
  const navigate = useNavigate();

  if (isActivated) {
    return (
      <Card className="text-center">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">You're All Set!</h2>
            <p className="text-muted-foreground mt-2">
              Your store is now active. Customers can find and purchase your products.
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/merchant/dashboard", { replace: true })}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Review & Activation
        </CardTitle>
        <CardDescription>
          {allComplete
            ? "Everything looks good! Activate your store to start selling."
            : "Complete all requirements below to activate your store."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              {item.completed ? (
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <span className={item.completed ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onActivate} disabled={!allComplete || isLoading} size="lg">
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Activating...</>
            ) : (
              "Activate Store"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StepReviewActivation;
