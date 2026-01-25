import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubscriptionComparisonTable from './SubscriptionComparisonTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, ArrowRight, Medal, Gem, Infinity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TierType = 'starter' | 'bronze' | 'silver' | 'gold';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: TierType;
  onUpgrade: (tier: TierType, billing: 'monthly' | 'yearly') => Promise<void>;
}

const tierConfig: Record<TierType, { 
  icon: React.ElementType; 
  label: string;
  description: string;
  color: string;
  features: string[];
}> = {
  starter: {
    icon: Star,
    label: 'Starter',
    description: 'Get started for free',
    color: 'text-muted-foreground',
    features: [
      '25 product listings',
      '1 promotion/month',
      '10% commission',
      '7-day payouts',
      'Email support',
      'Basic analytics',
    ],
  },
  bronze: {
    icon: Medal,
    label: 'Bronze',
    description: 'For growing sellers',
    color: 'text-amber-700',
    features: [
      '100 product listings',
      '5 promotions/month',
      '9% commission',
      '5-day payouts',
      'R100 monthly ad credits',
      '1.1x search boost',
    ],
  },
  silver: {
    icon: Gem,
    label: 'Silver',
    description: 'For established brands',
    color: 'text-slate-500',
    features: [
      '300 product listings',
      '20 promotions/month',
      '8% commission',
      '3-day payouts',
      'R250 monthly ad credits',
      'Verified badge',
      'Advanced analytics',
      'Priority support',
    ],
  },
  gold: {
    icon: Crown,
    label: 'Gold',
    description: 'For top performers',
    color: 'text-yellow-600',
    features: [
      'Unlimited products',
      'Unlimited promotions',
      '6% commission',
      '24-48hr payouts',
      'R500 monthly ad credits',
      'Premium badge',
      'Homepage exposure',
      'API access',
      'Cross-border selling',
    ],
  },
};

// Placeholder pricing
const pricing: Record<TierType, { monthly: number; yearly: number }> = {
  starter: { monthly: 0, yearly: 0 },
  bronze: { monthly: 99, yearly: 990 },
  silver: { monthly: 249, yearly: 2490 },
  gold: { monthly: 499, yearly: 4990 },
};

const SubscriptionUpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onUpgrade,
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'simple' | 'detailed'>('simple');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleSelectPlan = async (tier: TierType, billing: 'monthly' | 'yearly') => {
    if (tier === currentTier) return;
    
    try {
      setLoading(true);
      await onUpgrade(tier, billing);
      toast.success(`Welcome to ${tierConfig[tier].label}! Enjoy your new features.`);
      onClose();
    } catch (error) {
      toast.error('Failed to change plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const tiers: TierType[] = ['starter', 'bronze', 'silver', 'gold'];
  const currentTierIndex = tiers.indexOf(currentTier);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            Choose Your Plan
          </DialogTitle>
          <DialogDescription>
            Select the plan that best fits your business needs. Upgrade or downgrade anytime.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'simple' | 'detailed')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Quick View</TabsTrigger>
            <TabsTrigger value="detailed">Full Comparison</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simple" className="mt-6 space-y-6">
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map((tier, index) => {
                const config = tierConfig[tier];
                const Icon = config.icon;
                const price = pricing[tier][billingPeriod];
                const isCurrentTier = tier === currentTier;
                const isRecommended = tier === 'silver';
                const isUpgrade = index > currentTierIndex;
                
                return (
                  <Card 
                    key={tier}
                    className={cn(
                      'relative',
                      isCurrentTier && 'ring-2 ring-primary',
                      isRecommended && 'border-primary',
                      tier === 'gold' && 'border-yellow-400/50'
                    )}
                  >
                    {isRecommended && (
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary border-0 text-xs">
                        Popular
                      </Badge>
                    )}
                    <CardHeader className="text-center pb-2">
                      <div className={cn("flex items-center justify-center gap-2", config.color)}>
                        <Icon className="h-5 w-5" />
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                      </div>
                      {isCurrentTier && (
                        <Badge variant="outline" className="mx-auto text-xs">Current</Badge>
                      )}
                      <div className="text-2xl font-bold mt-2">
                        {price === 0 ? (
                          'Free'
                        ) : (
                          <>
                            R{price}
                            <span className="text-xs font-normal text-muted-foreground">
                              /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-1">
                        {config.features.slice(0, 5).map((feature, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            {feature.toLowerCase().includes('unlimited') ? (
                              <span className="flex items-center gap-1">
                                <Infinity className="h-3 w-3 text-primary" />
                                {feature}
                              </span>
                            ) : (
                              feature
                            )}
                          </li>
                        ))}
                        {config.features.length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{config.features.length - 5} more...
                          </li>
                        )}
                      </ul>
                      <Button
                        size="sm"
                        className={cn(
                          "w-full text-xs",
                          tier === 'gold' && !isCurrentTier && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                        )}
                        variant={isCurrentTier ? 'outline' : tier === 'starter' ? 'secondary' : 'default'}
                        disabled={isCurrentTier || loading}
                        onClick={() => handleSelectPlan(tier, billingPeriod)}
                      >
                        {isCurrentTier ? 'Current' : isUpgrade ? (
                          <>Upgrade <ArrowRight className="h-3 w-3 ml-1" /></>
                        ) : 'Downgrade'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ROI Calculator */}
            {currentTier === 'starter' && (
              <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">Upgrade ROI Calculator</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    If you sell R10,000/month, Bronze pays for itself with commission savings!
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Sales</p>
                      <p className="font-bold">R10,000</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission Saved</p>
                      <p className="font-bold text-primary">R100 (1%)</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Benefit</p>
                      <p className="font-bold text-primary">+R1/mo profit</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="detailed" className="mt-6">
            <SubscriptionComparisonTable
              currentTier={currentTier}
              onSelectPlan={handleSelectPlan}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionUpgradeModal;
