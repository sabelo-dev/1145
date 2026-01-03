import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Star, Zap, Clock, Percent, Package, TrendingUp, Shield } from 'lucide-react';
import { useVendorSubscription } from '@/hooks/useVendorSubscription';
import SubscriptionTierBadge from './SubscriptionTierBadge';
import UsageMeter from './UsageMeter';
import UpgradeTriggerBanner from './UpgradeTriggerBanner';
import { Skeleton } from '@/components/ui/skeleton';

interface SubscriptionStatusCardProps {
  vendorId?: string;
  onUpgrade: () => void;
  className?: string;
}

const SubscriptionStatusCard: React.FC<SubscriptionStatusCardProps> = ({
  vendorId,
  onUpgrade,
  className,
}) => {
  const {
    loading,
    subscription,
    tierConfig,
    upgradeTriggers,
    getProductUsagePercent,
    getPromotionUsagePercent,
  } = useVendorSubscription(vendorId);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) return null;

  const isPremium = subscription.tier === 'premium';

  return (
    <div className="space-y-4">
      {/* Upgrade Triggers */}
      {upgradeTriggers.length > 0 && (
        <UpgradeTriggerBanner
          triggers={upgradeTriggers}
          onUpgrade={onUpgrade}
          onDismiss={() => {}}
        />
      )}

      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isPremium ? (
                <Crown className="h-5 w-5 text-primary" />
              ) : (
                <Star className="h-5 w-5" />
              )}
              Your Subscription
            </CardTitle>
            <SubscriptionTierBadge tier={subscription.tier} />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Key Benefits */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Percent className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="font-bold text-lg">{subscription.commissionRate}%</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Payout Speed</p>
              <p className="font-bold text-lg">
                {subscription.payoutDays === 2 ? '24-48 hrs' : `${subscription.payoutDays} days`}
              </p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Search Boost</p>
              <p className="font-bold text-lg">{subscription.searchBoost}x</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Ad Credits</p>
              <p className="font-bold text-lg">R{subscription.adCredits}</p>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="space-y-3">
            <UsageMeter
              label="Products"
              current={subscription.productCount}
              limit={subscription.productLimit}
            />
            <UsageMeter
              label="Monthly Promotions"
              current={subscription.promotionsUsed}
              limit={subscription.promotionsLimit}
            />
          </div>

          {/* Premium Features Preview (for Standard users) */}
          {!isPremium && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Unlock with Premium
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Unlimited products
                </div>
                <div className="flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  6% commission (save 4%)
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  24-48 hr payouts
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Advanced analytics
                </div>
              </div>
              <Button onClick={onUpgrade} className="w-full mt-4 gap-1">
                <Crown className="h-4 w-4" />
                Upgrade to Premium - R299/mo
              </Button>
            </div>
          )}

          {/* Premium Status */}
          {isPremium && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Premium Active</p>
                  <p className="text-xs text-muted-foreground">
                    Thank you for being a Premium seller!
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Manage Subscription
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionStatusCard;
