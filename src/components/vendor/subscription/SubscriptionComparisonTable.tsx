import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Star, Infinity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionComparisonTableProps {
  currentTier: 'standard' | 'premium';
  onSelectPlan: (plan: 'standard' | 'premium') => void;
  className?: string;
}

interface FeatureRow {
  category: string;
  feature: string;
  standard: boolean | string | number;
  premium: boolean | string | number;
  highlight?: boolean;
}

const features: FeatureRow[] = [
  // Visibility & Discovery
  { category: 'Visibility & Discovery', feature: 'Product listing', standard: true, premium: true },
  { category: 'Visibility & Discovery', feature: 'Search ranking weight', standard: '1.0x', premium: '1.5x', highlight: true },
  { category: 'Visibility & Discovery', feature: 'Category priority', standard: false, premium: true },
  { category: 'Visibility & Discovery', feature: 'Homepage exposure', standard: false, premium: true, highlight: true },
  { category: 'Visibility & Discovery', feature: 'Featured badge', standard: false, premium: true },
  { category: 'Visibility & Discovery', feature: 'Recommendation engine', standard: 'Limited', premium: 'Full' },
  
  // Storefront & Branding
  { category: 'Storefront & Branding', feature: 'Default store template', standard: true, premium: true },
  { category: 'Storefront & Branding', feature: 'Custom store theme', standard: false, premium: true },
  { category: 'Storefront & Branding', feature: 'Banner & hero images', standard: false, premium: true },
  { category: 'Storefront & Branding', feature: 'Store video', standard: false, premium: true },
  { category: 'Storefront & Branding', feature: 'Custom store URL', standard: false, premium: true },
  
  // Product Management
  { category: 'Product Management', feature: 'Max active products', standard: 25, premium: 'Unlimited', highlight: true },
  { category: 'Product Management', feature: 'Bulk upload', standard: false, premium: true },
  { category: 'Product Management', feature: 'Bulk edit', standard: false, premium: true },
  { category: 'Product Management', feature: 'Inventory sync', standard: false, premium: true },
  { category: 'Product Management', feature: 'Product scheduling', standard: false, premium: true },
  
  // Sales & Growth Tools
  { category: 'Sales & Growth Tools', feature: 'Basic sales stats', standard: true, premium: true },
  { category: 'Sales & Growth Tools', feature: 'Advanced analytics', standard: false, premium: true, highlight: true },
  { category: 'Sales & Growth Tools', feature: 'A/B testing', standard: false, premium: true },
  { category: 'Sales & Growth Tools', feature: 'Smart discounts', standard: false, premium: true },
  { category: 'Sales & Growth Tools', feature: 'Promotion campaigns', standard: '1/month', premium: 'Unlimited', highlight: true },
  
  // Financials
  { category: 'Financials', feature: 'Platform commission', standard: '10%', premium: '6%', highlight: true },
  { category: 'Financials', feature: 'Payout speed', standard: '7 days', premium: '24-48 hrs', highlight: true },
  { category: 'Financials', feature: 'Ad credits', standard: false, premium: 'R500/month' },
  
  // Trust & Status
  { category: 'Trust & Status', feature: 'Seller rating', standard: true, premium: true },
  { category: 'Trust & Status', feature: 'Verified badge', standard: false, premium: true },
  { category: 'Trust & Status', feature: 'Premium badge', standard: false, premium: true },
  { category: 'Trust & Status', feature: 'Top Seller leaderboard', standard: false, premium: true },
  
  // Customer Support
  { category: 'Customer Support', feature: 'Support channel', standard: 'Email', premium: 'Priority chat + email' },
  { category: 'Customer Support', feature: 'Response SLA', standard: '48-72 hrs', premium: '<12 hrs', highlight: true },
  { category: 'Customer Support', feature: 'Account manager', standard: false, premium: 'Optional' },
  
  // Market Access
  { category: 'Market Access', feature: 'Local selling', standard: true, premium: true },
  { category: 'Market Access', feature: 'Cross-border selling', standard: false, premium: true },
  { category: 'Market Access', feature: 'Bulk buyers', standard: false, premium: true },
  { category: 'Market Access', feature: 'API access', standard: false, premium: true },
];

const renderValue = (value: boolean | string | number) => {
  if (value === true) {
    return <Check className="h-5 w-5 text-primary" />;
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/50" />;
  }
  if (value === 'Unlimited') {
    return (
      <span className="flex items-center gap-1 text-primary font-medium">
        <Infinity className="h-4 w-4" />
        Unlimited
      </span>
    );
  }
  return <span className="font-medium">{value}</span>;
};

const SubscriptionComparisonTable: React.FC<SubscriptionComparisonTableProps> = ({
  currentTier,
  onSelectPlan,
  className,
}) => {
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureRow[]>);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Plan Headers */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1" />
        
        {/* Standard Plan */}
        <Card className={cn(
          'text-center',
          currentTier === 'standard' && 'ring-2 ring-primary'
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center gap-2">
              <Star className="h-5 w-5" />
              <CardTitle>Standard</CardTitle>
            </div>
            {currentTier === 'standard' && (
              <Badge variant="outline" className="mx-auto">Current Plan</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Free</div>
            <p className="text-sm text-muted-foreground mt-1">Perfect for getting started</p>
            <Button
              variant={currentTier === 'standard' ? 'outline' : 'secondary'}
              className="w-full mt-4"
              disabled={currentTier === 'standard'}
              onClick={() => onSelectPlan('standard')}
            >
              {currentTier === 'standard' ? 'Current Plan' : 'Downgrade'}
            </Button>
          </CardContent>
        </Card>
        
        {/* Premium Plan */}
        <Card className={cn(
          'text-center border-primary relative overflow-hidden',
          currentTier === 'premium' && 'ring-2 ring-primary'
        )}>
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl-lg">
            Recommended
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <CardTitle>Premium</CardTitle>
            </div>
            {currentTier === 'premium' && (
              <Badge className="mx-auto">Current Plan</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              R299<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">For growth-focused sellers</p>
            <Button
              className="w-full mt-4 gap-1"
              disabled={currentTier === 'premium'}
              onClick={() => onSelectPlan('premium')}
            >
              <Crown className="h-4 w-4" />
              {currentTier === 'premium' ? 'Current Plan' : 'Upgrade Now'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardContent className="p-0">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures], categoryIndex) => (
            <div key={category}>
              <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                {category}
              </div>
              {categoryFeatures.map((feature, featureIndex) => (
                <div
                  key={feature.feature}
                  className={cn(
                    'grid grid-cols-3 gap-4 px-4 py-3 items-center',
                    featureIndex < categoryFeatures.length - 1 && 'border-b',
                    feature.highlight && 'bg-primary/5'
                  )}
                >
                  <div className="text-sm">
                    {feature.feature}
                    {feature.highlight && (
                      <Badge variant="outline" className="ml-2 text-xs">Key</Badge>
                    )}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.standard)}
                  </div>
                  <div className="flex justify-center">
                    {renderValue(feature.premium)}
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
