import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
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
import { GoldPriceTicker } from "@/components/wallet/GoldPriceTicker";
import { useFintech } from "@/hooks/useFintech";
import { motion } from "framer-motion";

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { displayCurrency } = useGoldPricingContext();

  // Rand: the real wallet (public.wallets + wallet_ledger), written only by
  // the server after a PayFast deposit or an approved withdrawal.
  const { data: fintechData, loading: fintechLoading } = useFintech();
  const [goldBalanceMg, setGoldBalanceMg] = useState(0);
  const [activeView, setActiveView] = useState<'overview' | 'send'>('overview');

  // UCoin data
  const { wallet: ucoinWallet, transactions: ucoinTxs, isLoading: ucoinLoading } = useUCoin();
  const { transfer: ucoinTransfer, isTransferring: ucoinTransferring } = useUCoinTransfer();

  // Gold holding is display-only; trading is switched off.
  const fetchGold = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("platform_wallets").select("gold_balance_mg").eq("user_id", user.id).maybeSingle();
    setGoldBalanceMg(Number(data?.gold_balance_mg ?? 0));
  }, [user]);

  useEffect(() => {
    if (user) fetchGold();
  }, [user, fetchGold]);

  // Merge transactions from both sources
  const mergedTransactions = [
    ...(fintechData?.ledger ?? [])
      .filter((row) => row.bucket === 'available')
      .map((row) => {
        const signed = row.direction === 'credit' ? Number(row.amount) : -Number(row.amount);
        return {
          id: row.id,
          type: row.type,
          amount: signed,
          net_amount: signed,
          description: row.type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
          asset_type: 'ZAR',
          status: row.status,
          created_at: row.created_at,
          source: 'wallet' as const,
        };
      }),
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

  const handleSendUcoin = async (to: string, amount: number, note?: string) => {
    return ucoinTransfer(to, amount, note);
  };

  const zarBalance = Number(fintechData?.summary?.wallet?.available_balance ?? 0);
  const ucoinBalance = ucoinWallet?.balance || 0;
  const pendingZar = Number(fintechData?.summary?.wallet?.pending_balance ?? 0);
  const lifetimeEarned = ucoinWallet?.lifetime_earned || 0;
  const isLoading = (fintechLoading && !fintechData) || ucoinLoading;

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
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate("/fintech")}>
            Cards & Banks
          </Button>
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
          onDeposit={() => navigate("/fintech")}
          onTransfer={() => setActiveView('send')}
          onWithdraw={() => navigate("/fintech")}
          onViewHistory={() => setActiveView('overview')}
        />

        {/* Content Sections */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-2 h-10">
            <TabsTrigger value="overview" className="text-xs font-medium">Activity</TabsTrigger>
            <TabsTrigger value="send" className="text-xs font-medium">Send</TabsTrigger>
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
              onSendUcoin={handleSendUcoin}
            />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
};

export default WalletPage;
