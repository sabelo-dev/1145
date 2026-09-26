import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUCoin } from "@/hooks/useUCoin";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownToLine, ArrowUpRight, Coins, Landmark, Loader2, Wallet } from "lucide-react";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

interface BankAccount {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number_masked: string;
  is_verified: boolean;
  is_default: boolean;
}

interface Cashout {
  id: string;
  ucoin_amount: number;
  zar_amount: number;
  status: string;
  destination: string | null;
  created_at: string;
}

const MIN_WITHDRAWAL = 500;

const statusVariant = (status: string) =>
  status === "paid" || status === "completed" ? "default" : status === "rejected" ? "destructive" : "secondary";

const UCoinWalletPage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { wallet, transactions, isLoading, refreshWallet, refreshTransactions } = useUCoin();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const balance = wallet?.balance ?? 0;
  const earned = wallet?.lifetime_earned ?? 0;
  const spent = wallet?.lifetime_spent ?? 0;

  const loadSide = useCallback(async () => {
    if (!user) return;
    const [acc, cash] = await Promise.all([
      supabase.from("user_linked_bank_accounts").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
      supabase.from("ucoin_cashouts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    const list = ((acc.data as any[]) || []) as BankAccount[];
    setAccounts(list);
    setAccountId((prev) => prev || list.find((a) => a.is_default)?.id || list[0]?.id || "");
    setCashouts(((cash.data as any[]) || []) as Cashout[]);
  }, [user]);

  useEffect(() => {
    loadSide();
  }, [loadSide]);

  const mined = useMemo(
    () => transactions.filter((t: any) => t.type === "earn").reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
    [transactions],
  );

  const withdraw = async () => {
    const coins = Math.floor(Number(amount) || 0);
    if (coins < MIN_WITHDRAWAL) {
      toast({ variant: "destructive", title: "Too small", description: `The minimum withdrawal is ${MIN_WITHDRAWAL} UCoin.` });
      return;
    }
    if (coins > balance) {
      toast({ variant: "destructive", title: "Not enough UCoin", description: "Lower the amount and try again." });
      return;
    }
    if (!accountId) {
      toast({ variant: "destructive", title: "No bank account", description: "Link a bank account first." });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("request_ucoin_cashout_to_bank" as any, {
      p_ucoin: coins,
      p_bank_account_id: accountId,
    });
    setSubmitting(false);
    const result = data as any;
    if (error || !result?.success) {
      toast({ variant: "destructive", title: "Withdrawal not sent", description: result?.error || error?.message });
      return;
    }
    toast({ title: "Withdrawal requested", description: `R${Number(result.zar_amount).toFixed(2)} is on its way once approved.` });
    setAmount("");
    await Promise.all([refreshWallet(), refreshTransactions(), loadSide()]);
  };

  if (!user) {
    return (
      <div ref={ref} className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Wallet className="h-8 w-8 mx-auto text-gold" />
            <p className="text-sm text-muted-foreground">Sign in to see your UCoin balance and withdraw to your bank.</p>
            <Button asChild><Link to="/login">Sign in</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={ref} className="min-h-screen bg-background">
      <SEO
        title="UCoin Wallet | Balance, rewards and withdrawals"
        description="See how much UCoin you have mined and spent, and withdraw your balance to a linked bank account."
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="header-row">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-gold shrink-0" />
              UCoin Wallet
            </h1>
            <p className="text-sm text-muted-foreground">1 UCoin = R{UCOIN_RAND_VALUE.toFixed(2)}</p>
          </div>
          <div className="header-actions">
            <Button asChild variant="outline" size="sm"><Link to="/ucoin-market">Spend UCoin</Link></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-gold/40">
              <CardContent className="p-4">
                <Coins className="h-5 w-5 text-gold" />
                <p className="text-2xl font-bold mt-2">{balance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Balance · R{(balance * UCOIN_RAND_VALUE).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
                <p className="text-2xl font-bold mt-2">{Math.max(earned, mined).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total mined and earned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                <p className="text-2xl font-bold mt-2">{spent.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total spent and withdrawn</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="withdraw">
          <TabsList className="w-full overflow-x-auto justify-start">
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            <TabsTrigger value="history">Activity</TabsTrigger>
            <TabsTrigger value="payouts">Withdrawals</TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> Withdraw to your bank
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground space-y-3">
                    <p>You have no bank account linked yet. Link one in your wallet settings to withdraw.</p>
                    <Button asChild variant="outline" size="sm"><Link to="/wallet">Link a bank account</Link></Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Pay into</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.bank_name} · {a.account_number_masked}{a.is_verified ? "" : " (unverified)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount in UCoin</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        inputMode="numeric"
                        min={MIN_WITHDRAWAL}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`${MIN_WITHDRAWAL} minimum`}
                      />
                      <p className="text-xs text-muted-foreground">
                        You'll receive about R{((Math.floor(Number(amount) || 0)) * UCOIN_RAND_VALUE).toFixed(2)}. Payouts are reviewed before they are paid out.
                      </p>
                    </div>
                    <Button onClick={withdraw} disabled={submitting} className="w-full sm:w-auto">
                      {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Request withdrawal
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No UCoin activity yet.</p>
                ) : (
                  transactions.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{t.description || t.category?.replace(/_/g, " ") || "UCoin"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${t.type === "earn" ? "text-gold" : "text-muted-foreground"}`}>
                        {t.type === "earn" ? "+" : "-"}{Number(t.amount).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {cashouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No withdrawals requested yet.</p>
                ) : (
                  cashouts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{c.destination || "Bank account"}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.ucoin_amount.toLocaleString()} UCoin · {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">R{Number(c.zar_amount).toFixed(2)}</p>
                        <Badge variant={statusVariant(c.status)} className="text-[11px]">{c.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

UCoinWalletPage.displayName = "UCoinWalletPage";

export default UCoinWalletPage;
