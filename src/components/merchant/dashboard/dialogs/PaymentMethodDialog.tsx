import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
}

export const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({ 
  open, 
  onOpenChange, 
  vendorId 
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    account_type: "checking"
  });

  useEffect(() => {
    if (open && vendorId) {
      fetchPaymentMethod();
    }
  }, [open, vendorId]);

  const fetchPaymentMethod = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_payment_methods')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_default', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setFormData({
          account_holder_name: data.account_holder_name,
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_type: data.account_type || "checking"
        });
      }
    } catch (error) {
      console.error('Error fetching payment method:', error);
    }
  };

  const savePaymentMethod = async () => {
    if (!formData.account_holder_name || !formData.bank_name || !formData.account_number) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Check if a payment method exists
      const { data: existing } = await supabase
        .from('vendor_payment_methods')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('is_default', true)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('vendor_payment_methods')
          .update(formData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('vendor_payment_methods')
          .insert([{
            vendor_id: vendorId,
            ...formData,
            is_default: true
          }]);

        if (error) throw error;
      }

      toast({
        title: "Payment method updated",
        description: "Your payment information has been saved successfully."
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving payment method:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save payment method"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Payment Method</DialogTitle>
          <DialogDescription>
            Update your bank account information for payouts.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="account-holder">Account Holder Name *</Label>
            <Input
              id="account-holder"
              value={formData.account_holder_name}
              onChange={(e) => setFormData({...formData, account_holder_name: e.target.value})}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-name">Bank Name *</Label>
            <Select 
              value={formData.bank_name} 
              onValueChange={(value) => setFormData({...formData, bank_name: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ABSA">ABSA</SelectItem>
                <SelectItem value="Standard Bank">Standard Bank</SelectItem>
                <SelectItem value="FNB">FNB</SelectItem>
                <SelectItem value="Nedbank">Nedbank</SelectItem>
                <SelectItem value="Capitec">Capitec</SelectItem>
                <SelectItem value="Discovery Bank">Discovery Bank</SelectItem>
                <SelectItem value="TymeBank">TymeBank</SelectItem>
                <SelectItem value="African Bank">African Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-number">Account Number *</Label>
            <Input
              id="account-number"
              value={formData.account_number}
              onChange={(e) => setFormData({...formData, account_number: e.target.value})}
              placeholder="1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select 
              value={formData.account_type} 
              onValueChange={(value) => setFormData({...formData, account_type: value})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={savePaymentMethod} disabled={loading}>
            {loading ? "Saving..." : "Save Payment Method"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};