import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGoldPricingContext } from "@/contexts/GoldPricingContext";
import { useUCoin } from "@/hooks/useUCoin";
import { useUCoinTransfer } from "@/hooks/useUCoinTransfer";
import { UnifiedPortfolioCard } from "@/components/wallet/UnifiedPortfolioCard";
import { QuickActions } from "@/components/wallet/QuickActions";
import { UnifiedTransactionList } from "@/components/wallet/UnifiedTransactionList";
import { SendMoneyPanel } from "@/components/wallet/SendMoneyPanel";
import { GoldTradingPanel } from "@/components/wallet/GoldTradingPanel";
import { GoldPriceTicker } from "@/components/wallet/GoldPriceTicker";
import { BankTransferDialog } from "@/components/wallet/BankTransferDialog";
import { motion } from "framer-motion";

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { displayCurrency } = useGoldPricingContext();

  const [wallet, setWallet] = useState<any>(null);
  const [walletTxs, setWalletTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'send' | 'trade'>('overview');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // UCoin data
  const { wallet: ucoinWallet, transactions: ucoinTxs, isLoading: ucoinLoading } = useUCoin();
  const { transfer: ucoinTransfer, isTransferring: ucoinTransferring } = useUCoinTransfer();

  const fetchWalletData = useCallback(async () => {
    if (!user) return;
    await supabase.rpc("get_or_create_wallet", { p_user_id: user.id });
    const [walletRes, txRes] = await Promise.all([
      supabase.from("platform_wallets").select("*").eq("user_id", user.id).single(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setWallet(walletRes.data);
    setWalletTxs(txRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchWalletData();
  }, [user, fetchWalletData]);

  // Merge transactions from both sources
  const mergedTransactions = [
    ...walletTxs.map(tx => ({ ...tx, source: 'wallet' as const })),
    ...ucoinTxs.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      net_amount: tx.type === 'earn' ? tx.amount : -tx.amount,
      category: tx.category,
      description: tx.description,
      asset_type: 'UCOIN',
      status: 'completed',
      created_at: tx.created_at,
      source: 'ucoin' as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleSendZar = async (to: string, amount: number, note?: string) => {
    if (!user || !wallet) throw new Error('Not ready');
    if (amount > wallet.balance_zar) throw new Error('Insufficient balance');

    const { error } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: user.id,
      type: "transfer_out",
      amount: -amount,
      net_amount: -amount,
      status: "completed",
      description: note || `Transfer to ${to}`,
      counterparty_id: to,
      completed_at: new Date().toISOString(),
    });
    if (error) throw error;

    await supabase.from("platform_wallets").update({
      balance_zar: wallet.balance_zar - amount,
      lifetime_spent: wallet.lifetime_spent + amount,
    }).eq("id", wallet.id);

    toast({ title: "Sent!", description: `R${amount.toFixed(2)} transferred successfully` });
    fetchWalletData();
  };

  const handleSendUcoin = async (to: string, amount: number, note?: string) => {
    return ucoinTransfer(to, amount, note);
  };

  const zarBalance = wallet?.balance_zar || 0;
  const goldBalanceMg = wallet?.gold_balance_mg || 0;
  const ucoinBalance = ucoinWallet?.balance || 0;
  const pendingZar = wallet?.pending_balance_zar || 0;
  const lifetimeEarned = ucoinWallet?.lifetime_earned || 0;
  const isLoading = loading || ucoinLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-3 px-4 h-14">
          <Button variant="ghost" size="icon" onClick={() => navigate("/services")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight">Wallet</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-5 max-w-2xl space-y-5">
        {/* Portfolio Card */}
        <UnifiedPortfolioCard
          zarBalance={zarBalance}
          goldBalanceMg={goldBalanceMg}
          ucoinBalance={ucoinBalance}
          pendingZar={pendingZar}
          lifetimeEarned={lifetimeEarned}
        />

        {/* Gold Price Ticker */}
        <GoldPriceTicker />

        {/* Quick Actions */}
        <QuickActions
          onDeposit={() => setDepositOpen(true)}
          onTransfer={() => setActiveView('send')}
          onWithdraw={() => setWithdrawOpen(true)}
          onTradeGold={() => setActiveView('trade')}
          onViewHistory={() => setActiveView('overview')}
        />

        {/* Content Sections */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="overview" className="text-xs font-medium">Activity</TabsTrigger>
            <TabsTrigger value="send" className="text-xs font-medium">Send</TabsTrigger>
            <TabsTrigger value="trade" className="text-xs font-medium gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Trade Gold
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <UnifiedTransactionList
              transactions={mergedTransactions}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="send" className="mt-4">
            <SendMoneyPanel
              zarBalance={zarBalance}
              ucoinBalance={ucoinBalance}
              walletAddress={user?.id || ''}
              isTransferring={ucoinTransferring}
              onSendZar={handleSendZar}
              onSendUcoin={handleSendUcoin}
            />
          </TabsContent>

          <TabsContent value="trade" className="mt-4">
            <GoldTradingPanel
              zarBalance={zarBalance}
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
