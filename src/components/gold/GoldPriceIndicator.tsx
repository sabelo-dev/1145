import React from 'react';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { Coins, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface GoldPriceIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function GoldPriceIndicator({ className, showDetails = false }: GoldPriceIndicatorProps) {
  const { goldPrice, isLoading } = useGoldPricingContext();

  if (isLoading || !goldPrice) {
    return (
      <Badge variant="outline" className={cn('animate-pulse', className)}>
        <Coins className="h-3 w-3 mr-1" />
        Loading...
      </Badge>
    );
  }

  const formattedPrice = goldPrice.pricePerOzUsd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const formattedDate = format(new Date(goldPrice.fetchedAt), 'MMM d, HH:mm');

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                'bg-gold/10 text-gold border-gold dark:bg-gold/15 dark:text-gold dark:border-gold',
                className
              )}
            >
              <Coins className="h-3 w-3 mr-1" />
              {formattedPrice}/oz
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="font-semibold">Gold Price</p>
              <p>{formattedPrice} per troy ounce</p>
              <p className="text-muted-foreground">Updated: {formattedDate}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-gold/10 dark:bg-gold/15 border border-gold dark:border-gold', className)}>
      <div className="p-2 rounded-full bg-gold dark:bg-gold/15">
        <Coins className="h-5 w-5 text-gold dark:text-gold" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">Current Gold Price</p>
        <p className="text-lg font-semibold text-gold dark:text-gold">{formattedPrice}/oz</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Last updated</p>
        <p className="text-xs">{formattedDate}</p>
      </div>
    </div>
  );
}
