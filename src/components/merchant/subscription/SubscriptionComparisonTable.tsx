import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Star, Infinity, Gem, Medal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TierType = 'starter' | 'bronze' | 'silver' | 'gold';

interface SubscriptionComparisonTableProps {
  currentTier: TierType;
  onSelectPlan: (tier: TierType, billing: 'monthly' | 'yearly') => void;
  className?: string;
}

interface FeatureRow {
  category: string;
  feature: string;
  starter: boolean | string | number;
  bronze: boolean | string | number;
  silver: boolean | string | number;
  gold: boolean | string | number;
  highlight?: boolean;
}

const features: FeatureRow[] = [
  // Visibility & Discovery
  { category: 'Visibility & Discovery', feature: 'Product listing', starter: true, bronze: true, silver: true, gold: true },
  { category: 'Visibility & Discovery', feature: 'Search ranking boost', starter: '1.0x', bronze: '1.1x', silver: '1.25x', gold: '1.5x', highlight: true },
  { category: 'Visibility & Discovery', feature: 'Category priority', starter: false, bronze: false, silver: true, gold: true },
  { category: 'Visibility & Discovery', feature: 'Homepage exposure', starter: false, bronze: false, silver: false, gold: true, highlight: true },
  { category: 'Visibility & Discovery', feature: 'Premium badge', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Visibility & Discovery', feature: 'Verified badge', starter: false, bronze: false, silver: true, gold: true },
  
  // Storefront & Branding
  { category: 'Storefront & Branding', feature: 'Default store template', starter: true, bronze: true, silver: true, gold: true },
  { category: 'Storefront & Branding', feature: 'Custom store theme', starter: false, bronze: false, silver: true, gold: true },
  { category: 'Storefront & Branding', feature: 'Banner & hero images', starter: false, bronze: false, silver: true, gold: true },
  { category: 'Storefront & Branding', feature: 'Store video', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Storefront & Branding', feature: 'Custom store URL', starter: false, bronze: false, silver: true, gold: true },
  
  // Product Management
  { category: 'Product Management', feature: 'Max active products', starter: 25, bronze: 100, silver: 300, gold: 'Unlimited', highlight: true },
  { category: 'Product Management', feature: 'Bulk upload', starter: false, bronze: false, silver: true, gold: true },
  { category: 'Product Management', feature: 'Bulk edit', starter: false, bronze: false, silver: true, gold: true },
  { category: 'Product Management', feature: 'Inventory sync', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Product Management', feature: 'Product scheduling', starter: false, bronze: false, silver: true, gold: true },
  
  // Sales & Growth Tools
  { category: 'Sales & Growth Tools', feature: 'Basic sales stats', starter: true, bronze: true, silver: true, gold: true },
  { category: 'Sales & Growth Tools', feature: 'Advanced analytics', starter: false, bronze: false, silver: true, gold: true, highlight: true },
  { category: 'Sales & Growth Tools', feature: 'A/B testing', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Sales & Growth Tools', feature: 'Smart discounts', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Sales & Growth Tools', feature: 'Promotion campaigns/mo', starter: 1, bronze: 5, silver: 20, gold: 'Unlimited', highlight: true },
  
  // Financials
  { category: 'Financials', feature: 'Platform commission', starter: '10%', bronze: '9%', silver: '8%', gold: '6%', highlight: true },
  { category: 'Financials', feature: 'Payout speed', starter: '7 days', bronze: '5 days', silver: '3 days', gold: '24-48 hrs', highlight: true },
  { category: 'Financials', feature: 'Monthly ad credits', starter: 'R0', bronze: 'R100', silver: 'R250', gold: 'R500' },
  
  // Customer Support
  { category: 'Customer Support', feature: 'Support channel', starter: 'Email', bronze: 'Email', silver: 'Priority email', gold: 'Priority chat + email' },
  { category: 'Customer Support', feature: 'Response SLA', starter: '72 hrs', bronze: '48 hrs', silver: '24 hrs', gold: '<12 hrs', highlight: true },
  
  // Market Access
  { category: 'Market Access', feature: 'Local selling', starter: true, bronze: true, silver: true, gold: true },
  { category: 'Market Access', feature: 'Cross-border selling', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Market Access', feature: 'Bulk buyers', starter: false, bronze: false, silver: false, gold: true },
  { category: 'Market Access', feature: 'API access', starter: false, bronze: false, silver: false, gold: true },
];

// Placeholder pricing - to be updated
const pricing = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 99, yearly: 990 },
  silver: { monthly: 249, yearly: 2490 },
  gold: { monthly: 499, yearly: 4990 },
};

const tierConfig = {
  starter: { icon: Star, label: 'Starter', description: 'Get started for free', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  bronze: { icon: Medal, label: 'Bronze', description: 'For growing sellers', color: 'text-amber-700', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  silver: { icon: Gem, label: 'Silver', description: 'For established brands', color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-800/50' },
  gold: { icon: Crown, label: 'Gold', description: 'For top performers', color: 'text-yellow-600', bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20' },
};

const renderValue = (value: boolean | string | number) => {
  if (value === true) {
    return <Check className="h-4 w-4 text-primary" />;
  }
  if (value === false) {
    return <X className="h-4 w-4 text-muted-foreground/40" />;
  }
  if (value === 'Unlimited') {
    return (
      <span className="flex items-center gap-1 text-primary font-medium text-xs">
        <Infinity className="h-3 w-3" />
        Unlimited
      </span>
    );
  }
  return <span className="font-medium text-xs">{value}</span>;
};

const SubscriptionComparisonTable: React.FC<SubscriptionComparisonTableProps> = ({
  currentTier,
  onSelectPlan,
  className,
}) => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureRow[]>);

  const tiers: TierType[] = ['starter', 'bronze', 'silver', 'gold'];

  return (
    <div className={cn('space-y-6', className)}>
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

      {/* Plan Headers */}
      <div className="grid grid-cols-5 gap-2 md:gap-4">
        <div className="col-span-1" />
        
        {tiers.map((tier) => {
          const config = tierConfig[tier];
          const Icon = config.icon;
          const price = pricing[tier][billingPeriod];
          const isCurrentTier = currentTier === tier;
          const isRecommended = tier === 'silver';
          
          return (
            <Card 
              key={tier}
              className={cn(
                'text-center relative overflow-hidden',
                isCurrentTier && 'ring-2 ring-primary',
                tier === 'gold' && 'border-yellow-400/50',
                isRecommended && 'border-primary'
              )}
            >
              {isRecommended && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl-lg">
                  Popular
                </div>
              )}
              <CardHeader className="p-3 pb-2">
                <div className={cn("flex items-center justify-center gap-1.5", config.color)}>
                  <Icon className="h-4 w-4" />
                  <CardTitle className="text-sm">{config.label}</CardTitle>
                </div>
                {isCurrentTier && (
                  <Badge variant="outline" className="mx-auto text-[10px] px-1.5 py-0">Current</Badge>
                )}
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="text-xl font-bold">
                  {price === 0 ? (
                    'Free'
                  ) : (
                    <>
                      R{price}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 hidden md:block">{config.description}</p>
                <Button
                  size="sm"
                  className={cn(
                    "w-full mt-2 text-xs h-7",
                    tier === 'gold' && !isCurrentTier && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                  )}
                  variant={isCurrentTier ? 'outline' : tier === 'starter' ? 'secondary' : 'default'}
                  disabled={isCurrentTier}
                  onClick={() => onSelectPlan(tier, billingPeriod)}
                >
                  {isCurrentTier ? 'Current' : tier === 'starter' ? 'Downgrade' : 'Select'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardContent className="p-0">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
            <div key={category}>
              <div className="bg-muted/50 px-3 py-2 font-semibold text-xs">
                {category}
              </div>
              {categoryFeatures.map((feature, featureIndex) => (
                <div
                  key={feature.feature}
                  className={cn(
                    'grid grid-cols-5 gap-2 md:gap-4 px-3 py-2 items-center',
                    featureIndex < categoryFeatures.length - 1 && 'border-b',
                    feature.highlight && 'bg-primary/5'
                  )}
                >
                  <div className="text-xs col-span-1">
                    {feature.feature}
                    {feature.highlight && (
                      <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0 hidden md:inline-flex">Key</Badge>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.starter)}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.bronze)}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.silver)}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.gold)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionComparisonTable;
