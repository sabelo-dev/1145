import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Vendor {
  id: string;
  business_name: string;
  subscription_tier?: string;
  subscription_status?: string;
}

interface EditVendorSubscriptionDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const TIERS = [
  { value: "starter", label: "Starter", color: "bg-gray-500" },
  { value: "bronze", label: "Bronze", color: "bg-amber-700" },
  { value: "silver", label: "Silver", color: "bg-slate-400" },
  { value: "gold", label: "Gold", color: "bg-yellow-500" },
];

const STATUSES = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

const EditVendorSubscriptionDialog: React.FC<EditVendorSubscriptionDialogProps> = ({
  vendor,
  open,
  onOpenChange,
  onUpdated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tier, setTier] = useState(vendor?.subscription_tier || "starter");
  const [status, setStatus] = useState(vendor?.subscription_status || "trial");
  const [reason, setReason] = useState("");

  // Update state when vendor changes
  React.useEffect(() => {
    if (vendor) {
      setTier(vendor.subscription_tier || "starter");
      setStatus(vendor.subscription_status || "trial");
      setReason("");
    }
  }, [vendor]);

  const handleSave = async () => {
    if (!vendor) return;

    const tierChanged = tier !== (vendor.subscription_tier || "starter");
    const statusChanged = status !== (vendor.subscription_status || "trial");

    if (!tierChanged && !statusChanged) {
      toast({
        title: "No changes",
        description: "No changes were made to the subscription.",
      });
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      // Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update vendor subscription
      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          subscription_tier: tier,
          subscription_status: status,
        })
        .eq("id", vendor.id);

      if (updateError) throw updateError;

      // Create audit log entry
      const changeType = tierChanged && statusChanged
        ? "tier_and_status_change"
        : tierChanged
        ? "tier_change"
        : "status_change";

      const { error: auditError } = await supabase
        .from("vendor_subscription_audit_log")
        .insert({
          vendor_id: vendor.id,
          changed_by: user.id,
          change_type: changeType,
          old_tier: tierChanged ? (vendor.subscription_tier || "starter") : null,
          new_tier: tierChanged ? tier : null,
          old_status: statusChanged ? (vendor.subscription_status || "trial") : null,
          new_status: statusChanged ? status : null,
          reason: reason.trim() || null,
        });

      if (auditError) {
        console.error("Failed to create audit log:", auditError);
        // Don't throw - the main update succeeded
      }

      toast({
        title: "Subscription updated",
        description: `${vendor.business_name}'s subscription has been updated.`,
      });

      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update subscription.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Subscription</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Vendor</Label>
            <p className="font-medium">{vendor.business_name}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tier">Subscription Tier</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger id="tier">
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <Badge className={`${t.color} text-white text-xs`}>
                        {t.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Subscription Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Upgraded per customer request, Promotional upgrade, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditVendorSubscriptionDialog;
