import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PLATFORM_MARKUP_PERCENTAGE } from "@/utils/pricingMarkup";

interface Vendor {
  id: string;
  business_name: string;
  subscription_tier?: string;
  subscription_status?: string;
  custom_markup_percentage?: number | null;
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
  const [useCustomMarkup, setUseCustomMarkup] = useState(vendor?.custom_markup_percentage !== null && vendor?.custom_markup_percentage !== undefined);
  const [customMarkup, setCustomMarkup] = useState<string>(
    vendor?.custom_markup_percentage !== null && vendor?.custom_markup_percentage !== undefined
      ? String(vendor.custom_markup_percentage)
      : ""
  );

  // Update state when vendor changes
  React.useEffect(() => {
    if (vendor) {
      setTier(vendor.subscription_tier || "starter");
      setStatus(vendor.subscription_status || "trial");
      setReason("");
      const hasCustom = vendor.custom_markup_percentage !== null && vendor.custom_markup_percentage !== undefined;
      setUseCustomMarkup(hasCustom);
      setCustomMarkup(hasCustom ? String(vendor.custom_markup_percentage) : "");
    }
  }, [vendor]);

  const handleSave = async () => {
    if (!vendor) return;

    const tierChanged = tier !== (vendor.subscription_tier || "starter");
    const statusChanged = status !== (vendor.subscription_status || "trial");
    
    const newMarkupValue = useCustomMarkup ? parseFloat(customMarkup) : null;
    const oldMarkupValue = vendor.custom_markup_percentage ?? null;
    const markupChanged = newMarkupValue !== oldMarkupValue;

    if (useCustomMarkup && (isNaN(parseFloat(customMarkup)) || parseFloat(customMarkup) < 0 || parseFloat(customMarkup) > 100)) {
      toast({
        variant: "destructive",
        title: "Invalid markup",
        description: "Custom markup must be between 0% and 100%.",
      });
      return;
    }

    if (!tierChanged && !statusChanged && !markupChanged) {
      toast({
        title: "No changes",
        description: "No changes were made.",
      });
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      // Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update vendor
      const { error: updateError } = await supabase
        .from("vendors")
        .update({
          subscription_tier: tier,
          subscription_status: status,
          custom_markup_percentage: useCustomMarkup ? parseFloat(customMarkup) : null,
        })
        .eq("id", vendor.id);

      if (updateError) throw updateError;

      // Create audit log entry
      const changeType = tierChanged && statusChanged
        ? "tier_and_status_change"
        : tierChanged
        ? "tier_change"
        : statusChanged
        ? "status_change"
        : "markup_change";

      const auditReason = markupChanged
        ? `${reason ? reason + '. ' : ''}Platform fee changed from ${oldMarkupValue ?? DEFAULT_PLATFORM_MARKUP_PERCENTAGE}% to ${newMarkupValue ?? DEFAULT_PLATFORM_MARKUP_PERCENTAGE}% (${newMarkupValue === null ? 'reset to default' : 'custom override'}).`
        : reason.trim() || null;

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
          reason: auditReason,
        });

      if (auditError) {
        console.error("Failed to create audit log:", auditError);
      }

      toast({
        title: "Vendor updated",
        description: `${vendor.business_name}'s settings have been updated.`,
      });

      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating vendor:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update vendor.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!vendor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Merchant Settings</DialogTitle>
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

          {/* Custom Platform Fee */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="custom-markup" className="text-sm font-medium">Custom Platform Fee</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Override the default {DEFAULT_PLATFORM_MARKUP_PERCENTAGE}% markup for this merchant
                </p>
              </div>
              <Switch
                id="custom-markup"
                checked={useCustomMarkup}
                onCheckedChange={(checked) => {
                  setUseCustomMarkup(checked);
                  if (!checked) setCustomMarkup("");
                }}
              />
            </div>

            {useCustomMarkup && (
              <div className="space-y-2">
                <Label htmlFor="markup-value">Fee Percentage (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="markup-value"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    placeholder="e.g. 5"
                    value={customMarkup}
                    onChange={(e) => setCustomMarkup(e.target.value)}
                    className="max-w-[120px]"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set to <strong>0</strong> for no platform fee (e.g. promotional offer).
                </p>
              </div>
            )}

            {!useCustomMarkup && (
              <p className="text-xs text-muted-foreground">
                Using default platform fee: <strong>{DEFAULT_PLATFORM_MARKUP_PERCENTAGE}%</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., First Gold tier merchant — waived platform fee as promotion."
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
