import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionTierBadgeProps {
  tier: 'standard' | 'premium';
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
  const isPremium = tier === 'premium';

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
      variant={isPremium ? 'default' : 'secondary'}
      className={cn(
        sizeClasses[size],
        isPremium && 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0',
        !isPremium && 'bg-muted text-muted-foreground',
        className
      )}
    >
      {showIcon && (
        isPremium ? (
          <Crown className={cn(iconSizes[size], 'mr-1')} />
        ) : (
          <Star className={cn(iconSizes[size], 'mr-1')} />
        )
      )}
      {isPremium ? 'Premium' : 'Standard'}
    </Badge>
  );
};

export default SubscriptionTierBadge;
