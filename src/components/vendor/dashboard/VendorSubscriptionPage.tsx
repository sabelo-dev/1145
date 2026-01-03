import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, TrendingUp, Package, Percent, Clock, Shield, Zap, Star } from 'lucide-react';
import { SubscriptionComparisonTable, SubscriptionStatusCard } from '../subscription';
import { useVendorSubscription } from '@/hooks/useVendorSubscription';
import { Skeleton } from '@/components/ui/skeleton';

interface VendorSubscriptionPageProps {
  vendorId?: string;
  currentTier: 'standard' | 'premium';
  onUpgrade: () => void;
}

const VendorSubscriptionPage: React.FC<VendorSubscriptionPageProps> = ({
  vendorId,
  currentTier,
  onUpgrade,
}) => {
  const { loading, subscription, tierConfig } = useVendorSubscription(vendorId);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const isPremium = currentTier === 'premium';

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <SubscriptionStatusCard
        vendorId={vendorId}
        onUpgrade={onUpgrade}
      />

      {/* Premium Benefits Highlight (for Standard users) */}
      {!isPremium && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Why Upgrade to Premium?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <Percent className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">Lower Fees</h4>
                <p className="text-sm text-muted-foreground">
                  Pay only 6% commission vs 10% on Standard
                </p>
                <p className="text-primary font-bold mt-1">Save 4% on every sale</p>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <Clock className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">Faster Payouts</h4>
                <p className="text-sm text-muted-foreground">
                  Get paid in 24-48 hours instead of 7 days
                </p>
                <p className="text-primary font-bold mt-1">Better cash flow</p>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">More Visibility</h4>
                <p className="text-sm text-muted-foreground">
                  1.5x search boost, homepage exposure, featured badge
                </p>
                <p className="text-primary font-bold mt-1">More customers</p>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <Package className="h-8 w-8 text-primary mb-2" />
                <h4 className="font-semibold">Unlimited Products</h4>
                <p className="text-sm text-muted-foreground">
                  No limits on your catalog size
                </p>
                <p className="text-primary font-bold mt-1">Scale freely</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/10 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">ROI Calculator</h4>
                  <p className="text-sm text-muted-foreground">
                    If you sell R7,500+/month, Premium pays for itself in commission savings alone!
                  </p>
                </div>
                <Button onClick={onUpgrade} className="gap-1">
                  <Crown className="h-4 w-4" />
                  Upgrade Now - R299/mo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Premium Member Benefits (for Premium users) */}
      {isPremium && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Your Premium Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">Verified & Premium Badges</h4>
                  <p className="text-sm text-muted-foreground">
                    Build trust with visible premium status
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">1.5x Search Boost</h4>
                  <p className="text-sm text-muted-foreground">
                    Rank higher in search results
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Zap className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">Priority Support</h4>
                  <p className="text-sm text-muted-foreground">
                    &lt;12 hour response time
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Star className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">R500 Monthly Ad Credits</h4>
                  <p className="text-sm text-muted-foreground">
                    Boost your products for free
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Package className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">Advanced Tools</h4>
                  <p className="text-sm text-muted-foreground">
                    Bulk upload, inventory sync, A/B testing
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Percent className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <h4 className="font-medium">Lower Fees</h4>
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
            onSelectPlan={onUpgrade}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorSubscriptionPage;
