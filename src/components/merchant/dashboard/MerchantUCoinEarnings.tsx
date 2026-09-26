import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Coins, Banknote, Pickaxe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";

const money = (v: number) => `R${Number(v || 0).toFixed(2)}`;
const MIN_CASHOUT = 500;

interface Cashout {
  id: string;
  ucoin_amount: number;
  zar_amount: number;
  status: string;
  created_at: string;
}

const MerchantUCoinEarnings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [minedThisMonth, setMinedThisMonth] = useState(0);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [walletRes, minedRes, cashoutRes] = await Promise.all([
      supabase.from("ucoin_wallets").select("balance, lifetime_earned").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("ucoin_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "earn")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("ucoin_cashouts")
        .select("id, ucoin_amount, zar_amount, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setBalance(walletRes.data?.balance ?? 0);
    setLifetime(walletRes.data?.lifetime_earned ?? 0);
    setMinedThisMonth(((minedRes.data as any[]) || []).reduce((sum, t) => sum + Number(t.amount || 0), 0));
    setCashouts(((cashoutRes.data as any[]) || []) as Cashout[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitCashout = async () => {
    const coins = Math.floor(Number(amount) || 0);
    if (coins < MIN_CASHOUT) {
      toast({ variant: "destructive", title: "Too small", description: `The smallest cash-out is ${MIN_CASHOUT} UCoin.` });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("request_ucoin_cashout", {
      p_ucoin: coins,
      p_destination: destination || null,
    });
    setSubmitting(false);

    const result = data as any;
    if (error || !result?.success) {
      toast({
        variant: "destructive",
        title: "Cash-out not sent",
        description: result?.error || error?.message || "Please try again.",
      });
      return;
    }

    toast({
      title: "Cash-out requested",
      description: `${coins.toLocaleString()} UCoin (${money(result.zar_amount)}) is pending approval.`,
    });
    setOpen(false);
    setAmount("");
    setDestination("");
    await load();
  };

  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-3 min-w-0">
      <div className="header-row">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold truncate">UCoin rewards</h3>
          <p className="text-sm text-muted-foreground truncate">
            What you earned from mining and promoting, alongside your sales
          </p>
        </div>
        <div className="header-actions">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={balance < MIN_CASHOUT}>
                <Banknote className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Cash out</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cash out UCoin</DialogTitle>
                <DialogDescription>
                  Every UCoin is worth {money(UCOIN_RAND_VALUE)}. Cash-outs are paid after an admin approves them.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="cashout-amount">UCoin to cash out</Label>
                  <Input
                    id="cashout-amount"
                    type="number"
                    inputMode="numeric"
                    min={MIN_CASHOUT}
                    max={balance}
                    value={amount}
                    placeholder={`${MIN_CASHOUT} minimum`}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    You have {balance.toLocaleString()} UCoin ({money(balance * UCOIN_RAND_VALUE)}).
                    {amount ? ` This request is worth ${money(Math.floor(Number(amount) || 0) * UCOIN_RAND_VALUE)}.` : ""}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cashout-destination">Where should we pay it? (optional)</Label>
                  <Input
                    id="cashout-destination"
                    value={destination}
                    placeholder="Bank account or wallet reference"
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitCashout} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Request cash-out
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
            <Coins className="h-4 w-4 text-gold shrink-0" />
            <span className="text-xl font-semibold truncate w-full">{balance.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground truncate w-full">UCoin balance</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
            <Banknote className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xl font-semibold truncate w-full">{money(balance * UCOIN_RAND_VALUE)}</span>
            <span className="text-xs text-muted-foreground truncate w-full">Rand value</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
            <Pickaxe className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xl font-semibold truncate w-full">{minedThisMonth.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground truncate w-full">Earned this month</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
            <Coins className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xl font-semibold truncate w-full">{lifetime.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground truncate w-full">Earned all time</span>
          </CardContent>
        </Card>
      </div>

      {cashouts.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Recent cash-outs</p>
            {cashouts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {c.ucoin_amount.toLocaleString()} UCoin · {money(c.zar_amount)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-ZA")}
                  </span>
                  <Badge variant={c.status === "paid" ? "default" : c.status === "declined" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MerchantUCoinEarnings;
