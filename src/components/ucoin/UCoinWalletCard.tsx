import { Coins, TrendingUp, TrendingDown, Sparkles, Scale } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { UCoinWallet, UCOIN_GOLD_RATIO } from '@/types/ucoin';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UCoinWalletCardProps {
  wallet: UCoinWallet | null;
  isLoading?: boolean;
}

export function UCoinWalletCard({ wallet, isLoading }: UCoinWalletCardProps) {
  const { mgGoldToCurrency, displayCurrency, getCurrency } = useGoldPricingContext();
  
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 p-6">
          <Skeleton className="h-8 w-32 bg-white/30" />
          <Skeleton className="h-12 w-48 mt-2 bg-white/30" />
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = wallet?.balance || 0;
  const lifetimeEarned = wallet?.lifetime_earned || 0;
  const lifetimeSpent = wallet?.lifetime_spent || 0;
  
  // 1 UCoin = 1 mg gold
  const goldMg = balance * UCOIN_GOLD_RATIO.MG_PER_UCOIN;
  const goldGrams = goldMg / 1000;
  const currencyValue = mgGoldToCurrency(goldMg, displayCurrency);
  const currency = getCurrency(displayCurrency);
  const currencySymbol = currency?.currencySymbol || displayCurrency;

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      <div className="bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="h-6 w-6" />
            <span className="font-semibold text-lg">Ubuntu Coin Balance</span>
            <Sparkles className="h-4 w-4 text-yellow-200" />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-4xl font-bold tracking-tight cursor-help">
                  {balance.toLocaleString()}
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-sm">
                <div className="space-y-1">
                  <p><strong>Gold Backing:</strong></p>
                  <p>= {goldMg.toLocaleString()} mg Au</p>
                  <p>= {goldGrams.toFixed(3)} g Au</p>
                  <p>≈ {currencySymbol}{currencyValue.toFixed(2)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
            <Scale className="h-3 w-3" />
            <span>1 UCoin = 1 mg Gold | ≈ {currencySymbol}{currencyValue.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Total Earned</span>
            </div>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {lifetimeEarned.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Total Spent</span>
            </div>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {lifetimeSpent.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
