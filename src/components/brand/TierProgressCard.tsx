import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, Lock, Crown, Rocket, Users, Star } from 'lucide-react';
import { BrandTier } from '@/types/brand';
import { cn } from '@/lib/utils';

interface TierProgressCardProps {
  currentTier: BrandTier | null;
  allTiers: BrandTier[];
  currentMetrics: {
    revenue: number;
    fulfillmentRate: number;
    rating: number;
    orders: number;
  };
}

const tierIcons: Record<string, React.ElementType> = {
  starter: Star,
  growth: Rocket,
  partner: Users,
  elite: Crown
};

export function TierProgressCard({ currentTier, allTiers, currentMetrics }: TierProgressCardProps) {
  const currentLevel = currentTier?.level || 0;
  
  const getProgressToNextTier = (nextTier: BrandTier) => {
    const metrics = [
      { current: currentMetrics.revenue, required: nextTier.min_revenue, label: 'Revenue' },
      { current: currentMetrics.fulfillmentRate, required: nextTier.min_fulfillment_rate, label: 'Fulfillment' },
      { current: currentMetrics.rating, required: nextTier.min_rating, label: 'Rating' },
      { current: currentMetrics.orders, required: nextTier.min_orders, label: 'Orders' }
    ];

    return metrics.map(m => ({
      ...m,
      progress: Math.min((m.current / Math.max(m.required, 1)) * 100, 100),
      met: m.current >= m.required
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Brand Tier Program
        </CardTitle>
        <CardDescription>
          Grow your tier to unlock lower commissions, faster payouts, and more visibility
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tier Progress Line */}
        <div className="relative">
          <div className="flex justify-between mb-2">
            {allTiers.map((tier, idx) => {
              const Icon = tierIcons[tier.name] || Star;
              const isActive = tier.level === currentLevel;
              const isUnlocked = tier.level <= currentLevel;
              
              return (
                <div key={tier.id} className="flex flex-col items-center z-10">
                  <div 
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                      isActive && "ring-4 ring-offset-2 ring-primary",
                      isUnlocked 
                        ? "text-white border-transparent" 
                        : "bg-muted text-muted-foreground border-muted-foreground/30"
                    )}
                    style={{ 
                      backgroundColor: isUnlocked ? tier.badge_color : undefined
                    }}
                  >
                    {isUnlocked ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {tier.display_name}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Progress line */}
          <div className="absolute top-6 left-6 right-6 h-0.5 bg-muted -z-0">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${((currentLevel - 1) / (allTiers.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Tier Benefits */}
        {currentTier && (
          <div className="p-4 rounded-lg border" style={{ borderColor: currentTier.badge_color + '40' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Your Current Benefits</h4>
              <Badge style={{ backgroundColor: currentTier.badge_color, color: 'white' }}>
                {currentTier.display_name}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Commission</p>
                <p className="font-bold text-lg">{currentTier.commission_rate}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payout Speed</p>
                <p className="font-bold text-lg">{currentTier.payout_days} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Visibility Boost</p>
                <p className="font-bold text-lg">{currentTier.visibility_boost}x</p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly Credits</p>
                <p className="font-bold text-lg">{currentTier.promo_credits_monthly}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(currentTier.features as string[]).map((feature, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Next Tier Progress */}
        {currentTier && currentTier.level < allTiers.length && (
          <div className="space-y-4">
            <h4 className="font-medium">
              Progress to {allTiers.find(t => t.level === currentTier.level + 1)?.display_name}
            </h4>
            {getProgressToNextTier(allTiers.find(t => t.level === currentTier.level + 1)!).map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={metric.met ? "text-green-600" : "text-muted-foreground"}>
                    {metric.met && <Check className="h-3 w-3 inline mr-1" />}
                    {metric.label}
                  </span>
                  <span>
                    {metric.label === 'Revenue' && `R${metric.current.toLocaleString()}`}
                    {metric.label === 'Fulfillment' && `${metric.current.toFixed(0)}%`}
                    {metric.label === 'Rating' && `${metric.current.toFixed(1)}/5`}
                    {metric.label === 'Orders' && metric.current}
                    {' / '}
                    {metric.label === 'Revenue' && `R${metric.required.toLocaleString()}`}
                    {metric.label === 'Fulfillment' && `${metric.required}%`}
                    {metric.label === 'Rating' && `${metric.required}/5`}
                    {metric.label === 'Orders' && metric.required}
                  </span>
                </div>
                <Progress 
                  value={metric.progress} 
                  className={cn("h-2", metric.met && "[&>div]:bg-green-500")}
                />
              </div>
            ))}
          </div>
        )}

        {/* All Tiers Comparison */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            View all tier benefits →
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tier</th>
                  <th className="text-right py-2">Commission</th>
                  <th className="text-right py-2">Payout</th>
                  <th className="text-right py-2">Visibility</th>
                  <th className="text-right py-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {allTiers.map((tier) => (
                  <tr 
                    key={tier.id} 
                    className={cn(
                      "border-b",
                      tier.level === currentLevel && "bg-muted/50"
                    )}
                  >
                    <td className="py-2">
                      <Badge 
                        variant="outline"
                        style={{ borderColor: tier.badge_color, color: tier.badge_color }}
                      >
                        {tier.display_name}
                      </Badge>
                    </td>
                    <td className="text-right py-2">{tier.commission_rate}%</td>
                    <td className="text-right py-2">{tier.payout_days} days</td>
                    <td className="text-right py-2">{tier.visibility_boost}x</td>
                    <td className="text-right py-2">{tier.promo_credits_monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
