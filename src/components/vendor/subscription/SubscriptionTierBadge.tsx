import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionTierBadgeProps {
  tier: 'starter' | 'bronze' | 'silver' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const SubscriptionTierBadge: React.FC<SubscriptionTierBadgeProps> = ({
  tier,
  size = 'md',
  showIcon = true,
  className,
}) => {
  const isGold = tier === 'gold';
  const isStarter = tier === 'starter';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge
      variant={isGold ? 'default' : 'secondary'}
      className={cn(
        sizeClasses[size],
        isGold && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0',
        !isGold && 'bg-muted text-muted-foreground',
        className
      )}
    >
      {showIcon && (
        isGold ? (
          <Crown className={cn(iconSizes[size], 'mr-1')} />
        ) : (
          <Star className={cn(iconSizes[size], 'mr-1')} />
        )
      )}
      {isStarter ? 'Starter' : tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Badge>
  );
};

export default SubscriptionTierBadge;
