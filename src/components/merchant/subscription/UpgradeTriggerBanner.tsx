import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  X, 
  TrendingUp, 
  Package, 
  Percent, 
  DollarSign,
  Crown,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UpgradeTrigger } from '@/hooks/useVendorSubscription';

interface UpgradeTriggerBannerProps {
  triggers: UpgradeTrigger[];
  onUpgrade: () => void;
  onDismiss?: (triggerType: string) => void;
  className?: string;
}

const UpgradeTriggerBanner: React.FC<UpgradeTriggerBannerProps> = ({
  triggers,
  onUpgrade,
  onDismiss,
  className,
}) => {
  const [dismissedTriggers, setDismissedTriggers] = useState<string[]>([]);

  const visibleTriggers = triggers.filter(t => !dismissedTriggers.includes(t.type));

  if (visibleTriggers.length === 0) return null;

  const handleDismiss = (type: string) => {
    setDismissedTriggers(prev => [...prev, type]);
    onDismiss?.(type);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'product_limit_80':
        return <Package className="h-5 w-5" />;
      case 'promotion_cap':
        return <Percent className="h-5 w-5" />;
      case 'high_traffic':
        return <TrendingUp className="h-5 w-5" />;
      case 'sales_threshold':
        return <DollarSign className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const primaryTrigger = visibleTriggers[0];

  return (
    <Card className={cn(
      'border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5',
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-full text-primary">
            {getIcon(primaryTrigger.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Ready to grow your business?
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {primaryTrigger.message}
                </p>
                {primaryTrigger.potential_savings && (
                  <p className="text-sm text-primary font-medium mt-1">
                    Potential savings: R{primaryTrigger.potential_savings}/month
                  </p>
                )}
              </div>
              
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleDismiss(primaryTrigger.type)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {visibleTriggers.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {visibleTriggers.slice(1).map((trigger) => (
                  <span
                    key={trigger.type}
                    className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full"
                  >
                    {getIcon(trigger.type)}
                    {trigger.type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={onUpgrade} size="sm" className="gap-1">
                <Crown className="h-4 w-4" />
                Upgrade to Premium
              </Button>
              <span className="text-xs text-muted-foreground">
                Save 4% on fees • Unlimited products • Priority support
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UpgradeTriggerBanner;
