import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, ArrowUpRight, ArrowDownLeft, Send, Plus, History, 
  Wallet, CreditCard, Eye, EyeOff, Coins, Scale, ArrowRightLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoldPricingContext } from "@/contexts/GoldPricingContext";
import { GoldTradingPanel } from "@/components/wallet/GoldTradingPanel";
import { format } from "date-fns";

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { mgGoldToCurrency, formatGold, displayCurrency, getCurrency, goldPrice } = useGoldPricingContext();
  
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchWalletData = useCallback(async () => {
    if (!user) return;
    
    const { data: walletId } = await supabase.rpc("get_or_create_wallet", { p_user_id: user.id });
    
    const [walletRes, txRes] = await Promise.all([
      supabase.from("platform_wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    setWallet(walletRes.data);
    setTransactions(txRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchWalletData();
  }, [user, fetchWalletData]);

  const handleTransfer = async () => {
    if (!user || !wallet) return;
    const amount = parseFloat(transferAmount);
    if (!transferTo.trim() || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Enter a valid wallet address and amount" });
      return;
    }
    if (amount > wallet.balance_zar) {
      toast({ variant: "destructive", title: "Insufficient balance" });
      return;
    }

    setIsTransferring(true);
    try {
      const { error } = await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        user_id: user.id,
        type: "transfer_out",
        amount: -amount,
        net_amount: -amount,
        status: "completed",
        description: `Transfer to ${transferTo}`,
        counterparty_id: transferTo,
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      await supabase.from("platform_wallets").update({
        balance_zar: wallet.balance_zar - amount,
        lifetime_spent: wallet.lifetime_spent + amount,
      }).eq("id", wallet.id);

      toast({ title: "Transfer sent!", description: `R${amount.toFixed(2)} sent successfully` });
      setTransferTo("");
      setTransferAmount("");
      fetchWalletData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transfer failed", description: err.message });
    } finally {
      setIsTransferring(false);
    }
  };

  const goldBalanceMg = wallet?.gold_balance_mg || 0;
  const goldValueZar = mgGoldToCurrency(goldBalanceMg, displayCurrency);
  const currency = getCurrency(displayCurrency);
  const currencySymbol = currency?.currencySymbol || 'R';
  const totalPortfolioZar = (wallet?.balance_zar || 0) + goldValueZar;

  const txIcon = (type: string) => {
    if (type.includes("gold_buy")) return <Scale className="h-4 w-4 text-amber-500" />;
    if (type.includes("gold_sell")) return <Scale className="h-4 w-4 text-emerald-500" />;
    if (type.includes("earning") || type.includes("deposit") || type.includes("transfer_in") || type.includes("refund")) 
      return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />;
    return <ArrowUpRight className="h-4 w-4 text-destructive" />;
  };

  const txColor = (type: string) => {
    if (type.includes("gold_buy")) return "text-amber-600";
    if (type.includes("gold_sell")) return "text-emerald-600";
    if (type.includes("earning") || type.includes("deposit") || type.includes("transfer_in") || type.includes("refund")) 
      return "text-emerald-600";
    return "text-destructive";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-500 text-white p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Multi-Asset Wallet</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Portfolio Overview Card */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/60 text-sm">Total Portfolio Value</span>
              <button onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye className="h-4 w-4 text-white/60" /> : <EyeOff className="h-4 w-4 text-white/60" />}
              </button>
            </div>
            <p className="text-3xl font-extrabold mb-4">
              {showBalance ? `${currencySymbol}${totalPortfolioZar.toFixed(2)}` : `${currencySymbol}•••••`}
            </p>

            {/* Asset Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              {/* ZAR Balance */}
              <div className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-blue-300" />
                  <span className="text-xs text-white/70">Cash (ZAR)</span>
                </div>
                <p className="text-lg font-bold">
                  {showBalance ? `R${(wallet?.balance_zar || 0).toFixed(2)}` : "R•••"}
                </p>
              </div>

              {/* Gold Balance */}
              <div className="bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Scale className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-xs text-white/70">Gold Vault</span>
                </div>
                <p className="text-lg font-bold text-amber-300">
                  {showBalance ? formatGold(goldBalanceMg) : "•••"}
                </p>
                {showBalance && goldBalanceMg > 0 && (
                  <p className="text-xs text-white/50 mt-0.5">
                    ≈ {currencySymbol}{goldValueZar.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* UCoin Link */}
            <div className="flex items-center gap-2 mt-3 text-xs text-white/40">
              <Coins className="h-3.5 w-3.5" />
              <span>1 UCoin = 1 mg Gold | Wallet: {user?.id?.slice(0, 8)}...</span>
            </div>
          </div>

          {wallet?.pending_balance_zar > 0 && (
            <CardContent className="py-2 bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Pending: R{wallet.pending_balance_zar.toFixed(2)}
              </p>
            </CardContent>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" size="sm">
            <Plus className="h-4 w-4" />
            <span className="text-[10px]">Deposit</span>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" size="sm">
                <Send className="h-4 w-4" />
                <span className="text-[10px]">Transfer</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Money</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Recipient Wallet ID</label>
                  <Input placeholder="Enter wallet address" value={transferTo} onChange={e => setTransferTo(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount (ZAR)</label>
                  <Input type="number" placeholder="0.00" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleTransfer} disabled={isTransferring}>
                  {isTransferring ? "Sending..." : "Send Money"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" className="flex flex-col h-auto py-3 gap-1" size="sm">
            <CreditCard className="h-4 w-4" />
            <span className="text-[10px]">Withdraw</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col h-auto py-3 gap-1 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950" 
            size="sm"
            onClick={() => setActiveTab("trade")}
          >
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
            <span className="text-[10px]">Trade Gold</span>
          </Button>
        </div>

        {/* Tabs: Trade / History */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="trade" className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Trade Gold
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            {/* Gold Price Ticker */}
            {goldPrice && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-500" />
                  <span className="text-muted-foreground">Gold Spot Price</span>
                </div>
                <span className="font-semibold">
                  ${goldPrice.pricePerOzUsd.toFixed(2)}/oz
                </span>
              </div>
            )}

            {transactions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <p>No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <Card key={tx.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-muted">
                          {txIcon(tx.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{tx.type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.description || format(new Date(tx.created_at), "dd MMM, HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold ${txColor(tx.type)}`}>
                          {tx.net_amount >= 0 ? "+" : ""}R{Math.abs(tx.net_amount).toFixed(2)}
                        </span>
                        {tx.asset_type && tx.asset_type !== 'ZAR' && (
                          <Badge variant="outline" className="ml-1 text-[10px]">{tx.asset_type}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trade" className="mt-4">
            <GoldTradingPanel
              zarBalance={wallet?.balance_zar || 0}
              goldBalanceMg={goldBalanceMg}
              onTradeComplete={fetchWalletData}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WalletPage;
