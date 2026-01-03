import { useUCoin } from '@/hooks/useUCoin';
import { useAuth } from '@/contexts/AuthContext';
import { UCoinWalletCard } from './UCoinWalletCard';
import { UCoinTransactionList } from './UCoinTransactionList';
import { UCoinRewardsShop } from './UCoinRewardsShop';
import { UCoinEarningGuide } from './UCoinEarningGuide';
import { SocialMiningDashboard } from '@/components/mining/SocialMiningDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gift, BookOpen, History, Pickaxe } from 'lucide-react';

export function UCoinDashboard() {
  const { user, isVendor, isDriver } = useAuth();
  const { wallet, transactions, earningRules, spendingOptions, isLoading, spendUCoin } = useUCoin();

  const userType = isDriver ? 'driver' : isVendor ? 'vendor' : 'consumer';

  if (!user) {
    return (
      <div className="text-center py-12">
        <Coins className="h-16 w-16 mx-auto mb-4 text-amber-500 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Sign in to access Ubuntu Coin</h2>
        <p className="text-muted-foreground">Create an account or sign in to start earning and redeeming UCoin rewards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UCoinWalletCard wallet={wallet} isLoading={isLoading} />

      <Tabs defaultValue="mining" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mining" className="flex items-center gap-2">
            <Pickaxe className="h-4 w-4" />
            <span className="hidden sm:inline">Mining</span>
          </TabsTrigger>
          <TabsTrigger value="shop" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Rewards</span>
          </TabsTrigger>
          <TabsTrigger value="earn" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">How to Earn</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="mining" className="mt-4">
          <SocialMiningDashboard />
        </TabsContent>
        
        <TabsContent value="shop" className="mt-4">
          <UCoinRewardsShop
            options={spendingOptions}
            balance={wallet?.balance || 0}
            userType={userType}
            onRedeem={spendUCoin}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="earn" className="mt-4">
          <UCoinEarningGuide rules={earningRules} isLoading={isLoading} />
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <UCoinTransactionList transactions={transactions} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
