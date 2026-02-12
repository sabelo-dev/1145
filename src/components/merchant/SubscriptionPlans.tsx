import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Infinity, Gem, Medal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionPlan } from "@/types/subscription";
import { cn } from "@/lib/utils";

type TierType = 'starter' | 'bronze' | 'silver' | 'gold';

interface SubscriptionPlansProps {
  onSelectPlan?: (plan: SubscriptionPlan, billing: 'monthly' | 'yearly') => void;
  currentTier?: TierType;
}

const tierConfig: Record<TierType, { icon: React.ElementType; color: string; bgGradient: string }> = {
  starter: { icon: Star, color: 'text-muted-foreground', bgGradient: '' },
  bronze: { icon: Medal, color: 'text-amber-700', bgGradient: '' },
  silver: { icon: Gem, color: 'text-slate-500', bgGradient: '' },
  gold: { icon: Crown, color: 'text-yellow-600', bgGradient: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20' },
};

// Placeholder pricing
const fallbackPricing: Record<TierType, { monthly: number; yearly: number }> = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 99, yearly: 990 },
  silver: { monthly: 249, yearly: 2490 },
  gold: { monthly: 499, yearly: 4990 },
};

const tierFeatures: Record<TierType, string[]> = {
  starter: ['25 product listings', '1 promotion/month', 'Basic analytics', '10% commission', '7-day payouts', 'Email support'],
  bronze: ['100 product listings', '5 promotions/month', 'Basic analytics', '9% commission', '5-day payouts', 'R100 monthly ad credits'],
  silver: ['300 product listings', '20 promotions/month', 'Advanced analytics', '8% commission', '3-day payouts', 'R250 monthly ad credits', 'Verified badge', 'Priority support'],
  gold: ['Unlimited products', 'Unlimited promotions', 'Advanced analytics + A/B testing', '6% commission', '24-48hr payouts', 'R500 monthly ad credits', 'Premium badge', 'Homepage exposure', 'API access'],
};

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ 
  onSelectPlan, 
  currentTier = 'starter' 
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .order('price', { ascending: true });

        if (error) throw error;
        setPlans((data || []) as SubscriptionPlan[]);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted"></CardHeader>
              <CardContent className="h-48 bg-muted/50"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const tiers: TierType[] = ['starter', 'bronze', 'silver', 'gold'];

  const getPrice = (tier: TierType): number => {
    const plan = plans.find(p => 
      p.name.toLowerCase() === tier && 
      p.billing_period === billingPeriod
    );
    return plan?.price ?? fallbackPricing[tier][billingPeriod];
  };

  const getPlan = (tier: TierType): SubscriptionPlan | undefined => {
    return plans.find(p => 
      p.name.toLowerCase() === tier && 
      p.billing_period === billingPeriod
    );
  };

  const isCurrentPlan = (tier: TierType) => {
    return tier === currentTier;
  };

  const getButtonText = (tier: TierType) => {
    if (isCurrentPlan(tier)) return 'Current Plan';
    const tierIndex = tiers.indexOf(tier);
    const currentIndex = tiers.indexOf(currentTier);
    if (tierIndex < currentIndex) return 'Downgrade';
    return `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
  };

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Label className={cn("text-sm", billingPeriod === 'monthly' && 'font-semibold')}>Monthly</Label>
        <Switch
          checked={billingPeriod === 'yearly'}
          onCheckedChange={(checked) => setBillingPeriod(checked ? 'yearly' : 'monthly')}
        />
        <Label className={cn("text-sm", billingPeriod === 'yearly' && 'font-semibold')}>
          Yearly
          <Badge variant="secondary" className="ml-2 text-xs">Save ~17%</Badge>
        </Label>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const config = tierConfig[tier];
          const Icon = config.icon;
          const price = getPrice(tier);
          const plan = getPlan(tier);
          const features = tierFeatures[tier];
          const isRecommended = tier === 'silver';
          
          return (
            <Card 
              key={tier} 
              className={cn(
                'relative',
                tier === 'gold' && 'border-yellow-400/50',
                isRecommended && 'border-primary ring-2 ring-primary/20',
                isCurrentPlan(tier) && 'ring-2 ring-primary',
                config.bgGradient
              )}
            >
              {isRecommended && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary border-0">
                  Popular
                </Badge>
              )}
              {tier === 'gold' && !isRecommended && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                  Best Value
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <div className={cn("flex items-center justify-center gap-2 mb-2", config.color)}>
                  <Icon className="h-6 w-6" />
                  <CardTitle className="text-xl capitalize">{tier}</CardTitle>
                </div>
                {isCurrentPlan(tier) && (
                  <Badge variant="outline" className="mx-auto mb-2">Current Plan</Badge>
                )}
                <div className="text-3xl font-bold">
                  {price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      R{price}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {feature.toLowerCase().includes('unlimited') ? (
                        <span className="flex items-center gap-1">
                          <Infinity className="h-4 w-4 text-primary" />
                          {feature}
                        </span>
                      ) : (
                        feature
                      )}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={cn(
                    "w-full",
                    tier === 'gold' && !isCurrentPlan(tier) && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 gap-1'
                  )}
                  variant={isCurrentPlan(tier) ? "outline" : tier === 'starter' ? "secondary" : "default"}
                  disabled={isCurrentPlan(tier)}
                  onClick={() => plan && onSelectPlan?.(plan, billingPeriod)}
                >
                  {tier === 'gold' && !isCurrentPlan(tier) && <Crown className="h-4 w-4" />}
                  {getButtonText(tier)}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
