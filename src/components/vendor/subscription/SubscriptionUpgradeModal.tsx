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
import { Check, Crown, Star, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: 'standard' | 'premium';
  onUpgrade: (plan: 'standard' | 'premium') => Promise<void>;
}

const standardFeatures = [
  'Basic product listings',
  'Up to 25 products',
  '1 promotion per month',
  '10% platform commission',
  '7-day payout speed',
  'Email support (48-72 hrs)',
  'Local selling',
  'Basic sales stats',
];

const premiumFeatures = [
  'Unlimited products',
  'Unlimited promotions',
  '6% platform commission',
  '24-48 hr payouts',
  'Priority chat support (<12 hrs)',
  'Advanced analytics & A/B testing',
  'Custom store theme & branding',
  'Cross-border selling & API access',
  'R500 monthly ad credits',
  'Featured & Verified badges',
  'Homepage exposure',
  'Bulk upload & inventory sync',
];

const SubscriptionUpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  onUpgrade,
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'simple' | 'detailed'>('simple');

  const handleSelectPlan = async (plan: 'standard' | 'premium') => {
    if (plan === currentTier) return;
    
    try {
      setLoading(true);
      await onUpgrade(plan);
      toast.success(
        plan === 'premium' 
          ? 'Welcome to Premium! Enjoy your new features.' 
          : 'Plan changed successfully.'
      );
      onClose();
    } catch (error) {
      toast.error('Failed to change plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          
          <TabsContent value="simple" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Standard Plan */}
              <Card className={currentTier === 'standard' ? 'ring-2 ring-primary' : ''}>
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star className="h-6 w-6" />
                    <CardTitle className="text-xl">Standard</CardTitle>
                  </div>
                  {currentTier === 'standard' && (
                    <Badge variant="outline">Current Plan</Badge>
                  )}
                  <div className="text-4xl font-bold mt-4">Free</div>
                  <p className="text-sm text-muted-foreground">Perfect for getting started</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {standardFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={currentTier === 'standard' ? 'outline' : 'secondary'}
                    className="w-full"
                    disabled={currentTier === 'standard' || loading}
                    onClick={() => handleSelectPlan('standard')}
                  >
                    {currentTier === 'standard' ? 'Current Plan' : 'Downgrade'}
                  </Button>
                </CardContent>
              </Card>

              {/* Premium Plan */}
              <Card className={`relative border-primary ${currentTier === 'premium' ? 'ring-2 ring-primary' : ''}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0">
                    Recommended
                  </Badge>
                </div>
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Crown className="h-6 w-6 text-primary" />
                    <CardTitle className="text-xl">Premium</CardTitle>
                  </div>
                  {currentTier === 'premium' && (
                    <Badge>Current Plan</Badge>
                  )}
                  <div className="text-4xl font-bold mt-4">
                    R299
                    <span className="text-lg font-normal text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground">For growth-focused sellers</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {premiumFeatures.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full gap-1"
                    disabled={currentTier === 'premium' || loading}
                    onClick={() => handleSelectPlan('premium')}
                  >
                    {currentTier === 'premium' ? (
                      'Current Plan'
                    ) : (
                      <>
                        Upgrade Now <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* ROI Calculator */}
            {currentTier === 'standard' && (
              <Card className="mt-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-2">Premium ROI Calculator</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    If you sell R7,500/month, Premium pays for itself with commission savings alone!
                  </p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Sales</p>
                      <p className="font-bold">R10,000</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission Saved</p>
                      <p className="font-bold text-primary">R400 (4%)</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Benefit</p>
                      <p className="font-bold text-primary">+R101/mo</p>
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
