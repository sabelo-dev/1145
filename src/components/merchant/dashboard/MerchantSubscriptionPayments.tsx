import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTier } from "@/utils/subscriptionTier";
import {
  TIER_PRICING,
  changeSubscription,
  redirectToPayFast,
  type BillingPeriod,
} from "@/services/subscription";
import { CreditCard, Calendar, CheckCircle2, XCircle, Clock, RefreshCcw, Receipt } from "lucide-react";

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

interface MerchantBilling {
  id: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
  trial_end_date: string | null;
}

interface MerchantSubscriptionPaymentsProps {
  /** Switches the dashboard tab (used to open the plan chooser). */
  onNavigate?: (tab: string) => void;
}

const money = (amount: number) => `R${amount.toFixed(2)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString();

/** What a payment row's status means to the merchant. */
const PAYMENT_STATUS: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  completed: { label: "Paid", icon: CheckCircle2, className: "text-green-500" },
  failed: { label: "Failed", icon: XCircle, className: "text-destructive" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "text-muted-foreground" },
  pending: { label: "Checkout not completed", icon: Clock, className: "text-muted-foreground" },
};

const MerchantSubscriptionPayments = ({ onNavigate }: MerchantSubscriptionPaymentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [merchant, setMerchant] = useState<MerchantBilling | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: merchantRow } = await supabase
        .from("merchants")
        .select("id, subscription_tier, subscription_status, subscription_expires_at, trial_end_date")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!merchantRow) return;
      setMerchant(merchantRow);

      const { data: paymentData } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("merchant_id", merchantRow.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setPayments(paymentData || []);
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const tier = normalizeTier(merchant?.subscription_tier);
  const onTrial = (merchant?.subscription_tier || "").toLowerCase() === "trial" || merchant?.subscription_status === "trial";
  const cancelled = merchant?.subscription_status === "cancelled";

  // The last payment that went through for this plan says how it is billed.
  const lastPaid = payments.find(p => p.status === "completed" && Number(p.amount) > 0 && p.tier === tier);
  const period: BillingPeriod = lastPaid?.billing_period === "yearly" ? "yearly" : "monthly";
  const price = TIER_PRICING[tier][period];

  const paidUntil = merchant?.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null;
  const lapsed = paidUntil !== null && paidUntil.getTime() < Date.now();
  // Money is owed only for a paid plan whose paid period has run out.
  const amountDue = price > 0 && lapsed ? price : 0;

  let nextPayment = "None scheduled";
  let nextPaymentNote = "";
  if (price === 0) {
    nextPaymentNote = onTrial && merchant?.trial_end_date
      ? `Free trial until ${day(merchant.trial_end_date)}`
      : "The Starter plan is free";
  } else if (lapsed) {
    nextPayment = "Overdue";
    nextPaymentNote = `Your paid period ended on ${day(merchant!.subscription_expires_at!)}`;
  } else if (paidUntil && cancelled) {
    nextPaymentNote = `Cancelled. The plan stays active until ${paidUntil.toLocaleDateString()}`;
  } else if (paidUntil) {
    nextPayment = paidUntil.toLocaleDateString();
    nextPaymentNote = `${money(price)} is charged automatically by PayFast`;
  } else {
    nextPaymentNote = "This plan was assigned by 1145 and has no payment scheduled";
  }

  const payNow = async () => {
    setPaying(true);
    try {
      const result = await changeSubscription(tier, period, "Renewal");
      if (result.requiresPayment && result.paymentUrl && result.formData) {
        await redirectToPayFast(result.paymentUrl, result.formData);
        return;
      }
      await fetchData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Payment not started",
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Subscription & Billing</h2>
        <p className="text-muted-foreground">What your plan costs, what you owe and what you have paid</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize flex items-center gap-2">
              {tier}
              {onTrial && <Badge variant="secondary">Trial</Badge>}
              {cancelled && <Badge variant="outline">Cancelled</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {price > 0 ? `${money(price)} per ${period === "yearly" ? "year" : "month"}` : "Free"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amount Due</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${amountDue > 0 ? "text-destructive" : ""}`}>{money(amountDue)}</div>
            <p className="text-xs text-muted-foreground">
              {amountDue > 0 ? "Pay to keep your plan" : "Nothing to pay right now"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payment</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextPayment}</div>
            <p className="text-xs text-muted-foreground">{nextPaymentNote}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paying for your plan</CardTitle>
          <CardDescription>
            Plans are paid by card through PayFast, which then charges the same card each {period === "yearly" ? "year" : "month"} until you cancel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {amountDue > 0 && (
            <Button onClick={payNow} disabled={paying}>
              {paying ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              {paying ? "Opening PayFast..." : `Pay ${money(amountDue)}`}
            </Button>
          )}
          {onNavigate && (
            <Button variant="outline" onClick={() => onNavigate("subscription")}>
              Change or cancel plan
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Payments and checkout attempts for your plan</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No payments yet</p>
          ) : (
            <div className="divide-y">
              {payments.map((payment) => {
                const status = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.pending;
                const Icon = status.icon;
                const paid = payment.status === "completed";
                return (
                  <div key={payment.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${status.className}`} />
                      <div>
                        <p className="text-sm font-medium capitalize">{payment.tier} — {payment.billing_period}</p>
                        <p className="text-xs text-muted-foreground">{status.label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${paid ? "" : "text-muted-foreground line-through"}`}>
                        {money(Number(payment.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">{day(payment.paid_at || payment.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantSubscriptionPayments;
