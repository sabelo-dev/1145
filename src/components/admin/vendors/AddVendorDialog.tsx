import React, { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

export type VendorStatus = "pending" | "approved" | "rejected" | "suspended";

type Props = {
  onCreated: () => void;
};

const AddVendorDialog: React.FC<Props> = ({ onCreated }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [ownerEmail, setOwnerEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  const canSubmit = useMemo(() => {
    return ownerEmail.trim().length > 3 && businessName.trim().length > 1;
  }, [ownerEmail, businessName]);

  const reset = () => {
    setOwnerEmail("");
    setBusinessName("");
    setBusinessEmail("");
    setBusinessPhone("");
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const email = ownerEmail.trim().toLowerCase();

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("email", email)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.id) {
        throw new Error(
          `No user profile found for ${email}. Ask the vendor to register first.`
        );
      }

      const { error: insertError } = await supabase.from("vendors").insert([
        {
          user_id: profile.id,
          business_name: businessName.trim(),
          status: "approved" as VendorStatus,
          business_email: businessEmail.trim() || null,
          business_phone: businessPhone.trim() || null,
        },
      ]);

      if (insertError) throw insertError;

      toast({
        title: "Vendor created",
        description: "Vendor has been added and approved.",
      });
      onCreated();
      reset();
      setOpen(false);
    } catch (err: any) {
      console.error("Add vendor error:", err);
      toast({
        variant: "destructive",
        title: "Could not add vendor",
        description: err?.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">Add Vendor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add vendor</DialogTitle>
          <DialogDescription>
            Link a vendor record to an existing user (by email).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input
              id="ownerEmail"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="vendor@1145lifestyle.com"
              type="email"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="1145 Lifestyle Store"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessEmail">Business email (optional)</Label>
            <Input
              id="businessEmail"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="sales@1145lifestyle.com"
              type="email"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="businessPhone">Business phone (optional)</Label>
            <Input
              id="businessPhone"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={!canSubmit || submitting}>
            {submitting ? "Adding..." : "Add & approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVendorDialog;
