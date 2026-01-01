import { useBiGold } from '@/hooks/useBiGold';
import { useAuth } from '@/contexts/AuthContext';
import { BiGoldWalletCard } from './BiGoldWalletCard';
import { BiGoldTransactionList } from './BiGoldTransactionList';
import { BiGoldRewardsShop } from './BiGoldRewardsShop';
import { BiGoldEarningGuide } from './BiGoldEarningGuide';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gift, BookOpen, History } from 'lucide-react';

export function BiGoldDashboard() {
  const { user, isVendor, isDriver } = useAuth();
  const { wallet, transactions, earningRules, spendingOptions, isLoading, spendBiGold } = useBiGold();

  const userType = isDriver ? 'driver' : isVendor ? 'vendor' : 'consumer';

  if (!user) {
    return (
      <div className="text-center py-12">
        <Coins className="h-16 w-16 mx-auto mb-4 text-amber-500 opacity-50" />
        <h2 className="text-xl font-semibold mb-2">Sign in to access BiGold</h2>
        <p className="text-muted-foreground">Create an account or sign in to start earning and redeeming BiGold rewards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BiGoldWalletCard wallet={wallet} isLoading={isLoading} />

      <Tabs defaultValue="shop" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
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
        
        <TabsContent value="shop" className="mt-4">
          <BiGoldRewardsShop
            options={spendingOptions}
            balance={wallet?.balance || 0}
            userType={userType}
            onRedeem={spendBiGold}
            isLoading={isLoading}
          />
        </TabsContent>
        
        <TabsContent value="earn" className="mt-4">
          <BiGoldEarningGuide rules={earningRules} isLoading={isLoading} />
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <BiGoldTransactionList transactions={transactions} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
