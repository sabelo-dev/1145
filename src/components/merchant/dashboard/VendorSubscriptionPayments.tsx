import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  Wallet,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  RefreshCcw,
} from "lucide-react";

interface SubscriptionPayment {
  id: string;
  amount: number;
  payment_method: string;
  billing_period: string;
  tier: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const TIER_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 299, yearly: 2990 },
  silver: { monthly: 599, yearly: 5990 },
  gold: { monthly: 999, yearly: 9990 },
};

const PAYMENT_METHODS = [
  { value: "platform_balance", label: "Platform Balance", icon: Wallet, description: "Pay from your accumulated sales revenue" },
  { value: "manual_card", label: "Card Payment", icon: CreditCard, description: "Pay manually each billing cycle via card" },
  { value: "payfast_debit", label: "PayFast Debit Order", icon: Building2, description: "Recurring debit order from your bank account" },
];

const VendorSubscriptionPayments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("manual_card");
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "yearly">("monthly");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, subscription_tier, subscription_payment_method, subscription_next_billing_date, subscription_auto_renew, platform_balance")
        .eq("user_id", user!.id)
        .single();

      if (!vendor) return;
      setVendorId(vendor.id);
      setVendorData(vendor);
      setSelectedMethod(vendor.subscription_payment_method || "manual_card");

      const { data: paymentData } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setPayments(paymentData || []);
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaySubscription = async () => {
    if (!vendorId || !vendorData) return;
    setProcessing(true);

    const tier = vendorData.subscription_tier || "starter";
    const price = TIER_PRICES[tier]?.[selectedBilling] || 0;

    if (price === 0) {
      toast({ title: "Free tier", description: "Starter tier doesn't require payment." });
      setProcessing(false);
      return;
    }

    try {
      if (selectedMethod === "platform_balance") {
        const balance = vendorData.platform_balance || 0;
        if (balance < price) {
          toast({ variant: "destructive", title: "Insufficient balance", description: `You need R${price} but only have R${balance.toFixed(2)} available.` });
          setProcessing(false);
          return;
        }

        // Deduct from platform balance
        await supabase.from("vendors").update({
          platform_balance: balance - price,
          subscription_payment_method: "platform_balance",
          subscription_next_billing_date: new Date(Date.now() + (selectedBilling === "yearly" ? 365 : 30) * 86400000).toISOString(),
        }).eq("id", vendorId);

        await supabase.from("subscription_payments").insert({
          vendor_id: vendorId,
          amount: price,
          payment_method: "platform_balance",
          billing_period: selectedBilling,
          tier,
          status: "completed",
          paid_at: new Date().toISOString(),
        });

        toast({ title: "Payment successful", description: `R${price} deducted from your platform balance.` });
      } else if (selectedMethod === "payfast_debit") {
        // Create pending payment and redirect to PayFast
        await supabase.from("subscription_payments").insert({
          vendor_id: vendorId,
          amount: price,
          payment_method: "payfast_debit",
          billing_period: selectedBilling,
          tier,
          status: "pending",
        });

        await supabase.from("vendors").update({
          subscription_payment_method: "payfast_debit",
        }).eq("id", vendorId);

        // Invoke PayFast payment edge function
        const { data, error } = await supabase.functions.invoke("payfast-payment", {
          body: {
            amount: price,
            item_name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription (${selectedBilling})`,
            item_description: `Merchant ${selectedBilling} subscription - ${tier} tier`,
            subscription_type: 1,
            billing_date: new Date().toISOString(),
            recurring_amount: price,
            frequency: selectedBilling === "yearly" ? 6 : 3, // 3=monthly, 6=annually
            cycles: 0, // indefinite
          },
        });

        if (error) throw error;
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }

        toast({ title: "Debit order initiated", description: "You'll be redirected to PayFast to set up recurring payments." });
      } else {
        // Manual card - create pending and redirect
        await supabase.from("subscription_payments").insert({
          vendor_id: vendorId,
          amount: price,
          payment_method: "manual_card",
          billing_period: selectedBilling,
          tier,
          status: "pending",
        });

        await supabase.from("vendors").update({
          subscription_payment_method: "manual_card",
        }).eq("id", vendorId);

        const { data, error } = await supabase.functions.invoke("payfast-payment", {
          body: {
            amount: price,
            item_name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription (${selectedBilling})`,
            item_description: `Merchant ${selectedBilling} subscription - ${tier} tier`,
          },
        });

        if (error) throw error;
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }

        toast({ title: "Payment initiated", description: "Complete your payment to activate your subscription." });
      }

      setPayDialogOpen(false);
      await fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Payment failed", description: error.message || "Something went wrong" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleAutoRenew = async (checked: boolean) => {
    if (!vendorId) return;
    await supabase.from("vendors").update({ subscription_auto_renew: checked }).eq("id", vendorId);
    setVendorData((prev: any) => ({ ...prev, subscription_auto_renew: checked }));
    toast({ title: checked ? "Auto-renewal enabled" : "Auto-renewal disabled" });
  };

  const updatePaymentMethod = async (method: string) => {
    if (!vendorId) return;
    await supabase.from("vendors").update({ subscription_payment_method: method }).eq("id", vendorId);
    setSelectedMethod(method);
    setVendorData((prev: any) => ({ ...prev, subscription_payment_method: method }));
    toast({ title: "Payment method updated" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const currentTier = vendorData?.subscription_tier || "starter";
  const currentPrice = TIER_PRICES[currentTier]?.monthly || 0;
  const nextBilling = vendorData?.subscription_next_billing_date;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Subscription & Billing</h2>
        <p className="text-muted-foreground">Manage your subscription payments and billing preferences</p>
      </div>

      {/* Current Plan */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{currentTier}</div>
            <p className="text-xs text-muted-foreground">R{currentPrice}/month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R{(vendorData?.platform_balance || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Available for subscription</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {nextBilling ? new Date(nextBilling).toLocaleDateString() : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {vendorData?.subscription_auto_renew ? "Auto-renewal on" : "Manual renewal"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
          <CardDescription>Choose how you want to pay for your subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-medium">Payment Method</Label>
            <RadioGroup value={selectedMethod} onValueChange={updatePaymentMethod} className="grid gap-3">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <label key={method.value} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${selectedMethod === method.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                    <RadioGroupItem value={method.value} />
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{method.label}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <p className="font-medium text-sm">Auto-renewal</p>
              <p className="text-xs text-muted-foreground">Automatically renew your subscription when it expires</p>
            </div>
            <Switch checked={vendorData?.subscription_auto_renew ?? true} onCheckedChange={toggleAutoRenew} />
          </div>

          {currentPrice > 0 && (
            <Button onClick={() => setPayDialogOpen(true)} className="w-full sm:w-auto">
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now — R{currentPrice}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>
          ) : (
            <div className="divide-y">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {payment.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : payment.status === "failed" ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium capitalize">{payment.tier} — {payment.billing_period}</p>
                      <p className="text-xs text-muted-foreground capitalize">{payment.payment_method.replace("_", " ")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">R{payment.amount}</p>
                    <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Subscription</DialogTitle>
            <DialogDescription>Complete your {currentTier} subscription payment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Billing Period</Label>
              <Select value={selectedBilling} onValueChange={(v: "monthly" | "yearly") => setSelectedBilling(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly — R{TIER_PRICES[currentTier]?.monthly || 0}</SelectItem>
                  <SelectItem value="yearly">Yearly — R{TIER_PRICES[currentTier]?.yearly || 0} (save ~17%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Plan</span>
                <span className="font-medium capitalize">{currentTier}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Amount</span>
                <span className="font-bold">R{TIER_PRICES[currentTier]?.[selectedBilling] || 0}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>Method</span>
                <span className="capitalize">{selectedMethod.replace("_", " ")}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePaySubscription} disabled={processing}>
              {processing ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              {processing ? "Processing..." : "Confirm Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorSubscriptionPayments;
