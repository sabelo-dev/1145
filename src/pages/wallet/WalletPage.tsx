import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Send, Plus, History, Wallet, CreditCard, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    
    // Get or create wallet
    const { data: walletId } = await supabase.rpc("get_or_create_wallet", { p_user_id: user.id });
    
    const [walletRes, txRes] = await Promise.all([
      supabase.from("platform_wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    setWallet(walletRes.data);
    setTransactions(txRes.data || []);
    setLoading(false);
  };

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
      // Create outgoing transaction
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

      // Update balance
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

  const txIcon = (type: string) => {
    if (type.includes("earning") || type.includes("deposit") || type.includes("transfer_in") || type.includes("refund")) return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />;
    return <ArrowUpRight className="h-4 w-4 text-destructive" />;
  };

  const txColor = (type: string) => {
    if (type.includes("earning") || type.includes("deposit") || type.includes("transfer_in") || type.includes("refund")) return "text-emerald-600";
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
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4">
        <div className="container mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">My Wallet</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-[#3A0CA3] to-[#4361EE] text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white/70 text-sm">Available Balance</span>
              <button onClick={() => setShowBalance(!showBalance)}>
                {showBalance ? <Eye className="h-4 w-4 text-white/70" /> : <EyeOff className="h-4 w-4 text-white/70" />}
              </button>
            </div>
            <p className="text-4xl font-extrabold mb-4">
              {showBalance ? `R${(wallet?.balance_zar || 0).toFixed(2)}` : "R•••••"}
            </p>
            {wallet?.pending_balance_zar > 0 && (
              <p className="text-white/60 text-sm">Pending: R{wallet.pending_balance_zar.toFixed(2)}</p>
            )}
            <div className="flex items-center gap-2 mt-3 text-xs text-white/50">
              <Wallet className="h-3.5 w-3.5" />
              <span>Wallet ID: {user?.id?.slice(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button variant="outline" className="flex flex-col h-auto py-4 gap-1.5">
            <Plus className="h-5 w-5" />
            <span className="text-xs">Deposit</span>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-1.5">
                <Send className="h-5 w-5" />
                <span className="text-xs">Transfer</span>
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
          <Button variant="outline" className="flex flex-col h-auto py-4 gap-1.5">
            <CreditCard className="h-5 w-5" />
            <span className="text-xs">Withdraw</span>
          </Button>
        </div>

        {/* Transactions */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Transactions
          </h2>
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
                        <p className="text-xs text-muted-foreground">{tx.description || format(new Date(tx.created_at), "dd MMM, HH:mm")}</p>
                      </div>
                    </div>
                    <span className={`font-semibold ${txColor(tx.type)}`}>
                      {tx.net_amount >= 0 ? "+" : ""}R{Math.abs(tx.net_amount).toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
