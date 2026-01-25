import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, TrendingUp, Package, Percent, Clock, Shield, Zap, Star, Gem, Medal, ArrowRight } from 'lucide-react';
import { SubscriptionComparisonTable, SubscriptionStatusCard } from '../subscription';
import { useVendorSubscription } from '@/hooks/useVendorSubscription';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type TierType = 'starter' | 'bronze' | 'silver' | 'gold';

interface VendorSubscriptionPageProps {
  vendorId?: string;
  currentTier?: TierType;
  onUpgrade: () => void;
}

const tierOrder: TierType[] = ['starter', 'bronze', 'silver', 'gold'];

const tierBenefits: Record<TierType, { icon: React.ElementType; title: string; benefits: string[] }> = {
  starter: {
    icon: Star,
    title: 'Starter Benefits',
    benefits: ['25 product listings', '1 promotion/month', 'Basic analytics', 'Email support'],
  },
  bronze: {
    icon: Medal,
    title: 'Bronze Benefits',
    benefits: ['100 product listings', '5 promotions/month', '9% commission', 'R100 monthly ad credits', '5-day payouts'],
  },
  silver: {
    icon: Gem,
    title: 'Silver Benefits',
    benefits: ['300 product listings', '20 promotions/month', '8% commission', 'R250 monthly ad credits', '3-day payouts', 'Verified badge', 'Advanced analytics', 'Priority support'],
  },
  gold: {
    icon: Crown,
    title: 'Gold Benefits',
    benefits: ['Unlimited products', 'Unlimited promotions', '6% commission', 'R500 monthly ad credits', '24-48hr payouts', 'Premium badge', 'Homepage exposure', 'API access', 'Cross-border selling'],
  },
};

const VendorSubscriptionPage: React.FC<VendorSubscriptionPageProps> = ({
  vendorId,
  currentTier: propTier,
  onUpgrade,
}) => {
  const { loading, subscription } = useVendorSubscription(vendorId);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const currentTier: TierType = (subscription?.tier as TierType) || propTier || 'starter';
  const isTopTier = currentTier === 'gold';
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const nextTier = !isTopTier ? tierOrder[currentTierIndex + 1] : null;

  const handleSelectPlan = (tier: TierType, billing: 'monthly' | 'yearly') => {
    console.log('Selected plan:', tier, billing);
    onUpgrade();
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <SubscriptionStatusCard
        vendorId={vendorId}
        onUpgrade={onUpgrade}
      />

      {/* Upgrade Prompt (for non-Gold users) */}
      {!isTopTier && nextTier && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {React.createElement(tierBenefits[nextTier].icon, { className: "h-5 w-5 text-primary" })}
              Why Upgrade to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {currentTier === 'starter' && (
                <>
                  <div className="p-4 bg-background rounded-lg border">
                    <Percent className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Lower Fees</h4>
                    <p className="text-sm text-muted-foreground">
                      Pay only 9% commission vs 10% on Starter
                    </p>
                    <p className="text-primary font-bold mt-1">Save 1% on every sale</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Package className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">More Products</h4>
                    <p className="text-sm text-muted-foreground">
                      List up to 100 products vs 25 on Starter
                    </p>
                    <p className="text-primary font-bold mt-1">4x more listings</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Clock className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Faster Payouts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get paid in 5 days instead of 7 days
                    </p>
                    <p className="text-primary font-bold mt-1">Better cash flow</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Zap className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Ad Credits</h4>
                    <p className="text-sm text-muted-foreground">
                      Get R100 in monthly ad credits included
                    </p>
                    <p className="text-primary font-bold mt-1">Boost your reach</p>
                  </div>
                </>
              )}
              {currentTier === 'bronze' && (
                <>
                  <div className="p-4 bg-background rounded-lg border">
                    <Percent className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Even Lower Fees</h4>
                    <p className="text-sm text-muted-foreground">
                      Pay only 8% commission vs 9% on Bronze
                    </p>
                    <p className="text-primary font-bold mt-1">Additional 1% savings</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Package className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">More Products</h4>
                    <p className="text-sm text-muted-foreground">
                      List up to 300 products vs 100 on Bronze
                    </p>
                    <p className="text-primary font-bold mt-1">3x more listings</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <TrendingUp className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Advanced Analytics</h4>
                    <p className="text-sm text-muted-foreground">
                      Unlock detailed sales insights
                    </p>
                    <p className="text-primary font-bold mt-1">Data-driven growth</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Shield className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Verified Badge</h4>
                    <p className="text-sm text-muted-foreground">
                      Build trust with customers
                    </p>
                    <p className="text-primary font-bold mt-1">Increased conversions</p>
                  </div>
                </>
              )}
              {currentTier === 'silver' && (
                <>
                  <div className="p-4 bg-background rounded-lg border">
                    <Percent className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Lowest Fees</h4>
                    <p className="text-sm text-muted-foreground">
                      Pay only 6% commission vs 8% on Silver
                    </p>
                    <p className="text-primary font-bold mt-1">Save 2% on every sale</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Clock className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Fastest Payouts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get paid in 24-48 hours
                    </p>
                    <p className="text-primary font-bold mt-1">Optimal cash flow</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <TrendingUp className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Homepage Exposure</h4>
                    <p className="text-sm text-muted-foreground">
                      Get featured on the homepage
                    </p>
                    <p className="text-primary font-bold mt-1">Maximum visibility</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border">
                    <Package className="h-8 w-8 text-primary mb-2" />
                    <h4 className="font-semibold">Unlimited Everything</h4>
                    <p className="text-sm text-muted-foreground">
                      No limits on products or promotions
                    </p>
                    <p className="text-primary font-bold mt-1">Scale freely</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-semibold">Ready to grow your business?</h4>
                  <p className="text-sm text-muted-foreground">
                    Upgrade now and unlock more features to boost your sales.
                  </p>
                </div>
                <Button onClick={onUpgrade} className="gap-1">
                  {React.createElement(tierBenefits[nextTier].icon, { className: "h-4 w-4" })}
                  Upgrade to {nextTier.charAt(0).toUpperCase() + nextTier.slice(1)}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Tier Benefits (for Gold users) */}
      {isTopTier && (
        <Card className="border-yellow-400/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              Your Gold Benefits
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">Active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <Shield className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">Premium Badge</h4>
                  <p className="text-sm text-muted-foreground">
                    Stand out with exclusive premium status
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <TrendingUp className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">1.5x Search Boost</h4>
                  <p className="text-sm text-muted-foreground">
                    Rank highest in search results
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <Zap className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">Priority Support</h4>
                  <p className="text-sm text-muted-foreground">
                    &lt;12 hour response time
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <Star className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">R500 Monthly Ad Credits</h4>
                  <p className="text-sm text-muted-foreground">
                    Boost your products for free
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <Package className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">Unlimited Everything</h4>
                  <p className="text-sm text-muted-foreground">
                    Products, promotions, and more
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-background rounded-lg border">
                <Percent className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-medium">Lowest Fees</h4>
                  <p className="text-sm text-muted-foreground">
                    Only 6% commission on sales
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Full Plan Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionComparisonTable
            currentTier={currentTier}
            onSelectPlan={handleSelectPlan}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorSubscriptionPage;
