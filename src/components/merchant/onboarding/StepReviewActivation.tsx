import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Rocket, Mail, MessageSquare, MinusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChecklistItem {
  label: string;
  completed: boolean;
}

type DeliveryStatus = "sent" | "skipped" | "failed";
interface NotificationResult {
  email: { status: DeliveryStatus; to?: string | null; error?: string | null };
  sms: { status: DeliveryStatus; to?: string | null; error?: string | null };
}

interface StepReviewActivationProps {
  checklist: ChecklistItem[];
  allComplete: boolean;
  onActivate: () => Promise<void>;
  isLoading: boolean;
  isActivated: boolean;
  notificationResult?: NotificationResult | null;
}

const statusMeta: Record<DeliveryStatus, { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  sent: { label: "Sent", className: "bg-primary/10 text-primary border-primary/20", Icon: CheckCircle },
  skipped: { label: "Not configured", className: "bg-muted text-muted-foreground border-border", Icon: MinusCircle },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20", Icon: XCircle },
};

const DeliveryRow: React.FC<{
  channel: string;
  Icon: React.ComponentType<{ className?: string }>;
  status: DeliveryStatus;
  to?: string | null;
  error?: string | null;
}> = ({ channel, Icon, status, to, error }) => {
  const meta = statusMeta[status];
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <div>
          <div className="font-medium">{channel}</div>
          <div className="text-sm text-muted-foreground">
            {to || (status === "skipped" ? "No destination on file" : "—")}
          </div>
          {status === "failed" && error && (
            <div className="text-xs text-destructive mt-1 break-all">{error}</div>
          )}
        </div>
      </div>
      <Badge variant="outline" className={`gap-1 ${meta.className}`}>
        <meta.Icon className="h-3.5 w-3.5" />
        {meta.label}
      </Badge>
    </div>
  );
};

const StepReviewActivation: React.FC<StepReviewActivationProps> = ({
  checklist, allComplete, onActivate, isLoading, isActivated, notificationResult,
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
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">You're All Set!</h2>
            <div className="flex justify-center">
              <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/20">
                <CheckCircle className="h-3.5 w-3.5" />
                Store status: ACTIVE
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Your store is live. Customers can now find and purchase your products.
            </p>
          </div>

          {notificationResult && (
            <div className="text-left space-y-3">
              <div className="text-sm font-medium">Confirmation delivery</div>
              <DeliveryRow
                channel="Email confirmation"
                Icon={Mail}
                status={notificationResult.email.status}
                to={notificationResult.email.to}
                error={notificationResult.email.error}
              />
              <DeliveryRow
                channel="SMS confirmation"
                Icon={MessageSquare}
                status={notificationResult.sms.status}
                to={notificationResult.sms.to}
                error={notificationResult.sms.error}
              />
            </div>
          )}

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
