import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BiGoldBadgeProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function BiGoldBadge({ amount, size = 'md', showIcon = true, className }: BiGoldBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 text-white font-semibold',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Coins size={iconSizes[size]} className="flex-shrink-0" />}
      <span>{amount.toLocaleString()}</span>
    </div>
  );
}
