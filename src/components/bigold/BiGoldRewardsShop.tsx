import { useState } from 'react';
import { Coins, Percent, Truck, Rocket, Banknote, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BiGoldSpendingOption } from '@/types/bigold';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BiGoldRewardsShopProps {
  options: BiGoldSpendingOption[];
  balance: number;
  userType: 'consumer' | 'vendor' | 'driver';
  onRedeem: (category: string) => Promise<boolean>;
  isLoading?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  discount_5_percent: <Percent className="h-5 w-5" />,
  discount_10_percent: <Percent className="h-5 w-5" />,
  free_delivery: <Truck className="h-5 w-5" />,
  delivery_discount: <Truck className="h-5 w-5" />,
  ad_boost_basic: <Rocket className="h-5 w-5" />,
  ad_boost_premium: <Rocket className="h-5 w-5" />,
  priority_listing: <Rocket className="h-5 w-5" />,
  cashout_driver: <Banknote className="h-5 w-5" />,
  cashout_vendor: <Banknote className="h-5 w-5" />
};

export function BiGoldRewardsShop({ options, balance, userType, onRedeem, isLoading }: BiGoldRewardsShopProps) {
  const [selectedOption, setSelectedOption] = useState<BiGoldSpendingOption | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const filteredOptions = options.filter(opt => opt.user_types.includes(userType));

  const handleRedeem = async () => {
    if (!selectedOption) return;
    
    setIsRedeeming(true);
    await onRedeem(selectedOption.category);
    setIsRedeeming(false);
    setSelectedOption(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Rewards Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredOptions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Rewards Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No rewards available for your account type</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            Rewards Shop
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredOptions.map((option) => {
              const canAfford = balance >= option.cost;
              
              return (
                <div
                  key={option.id}
                  className={`relative rounded-lg border p-4 transition-all ${
                    canAfford 
                      ? 'hover:border-amber-500 hover:shadow-md cursor-pointer' 
                      : 'opacity-60'
                  }`}
                  onClick={() => canAfford && setSelectedOption(option)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
                      {categoryIcons[option.category] || <Coins className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{option.description}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Coins className="h-3 w-3 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {option.cost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {!canAfford && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                      <span className="text-xs text-muted-foreground">
                        Need {(option.cost - balance).toLocaleString()} more
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedOption} onOpenChange={() => setSelectedOption(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-500" />
              Confirm Redemption
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to redeem <strong>{selectedOption?.cost.toLocaleString()} BiGold</strong> for:
              <br />
              <span className="font-medium text-foreground">{selectedOption?.description}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRedeeming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRedeem}
              disabled={isRedeeming}
              className="bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600"
            >
              {isRedeeming ? 'Redeeming...' : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Redeem
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
