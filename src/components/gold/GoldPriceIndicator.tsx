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
                'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
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
    <div className={cn('flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800', className)}>
      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900">
        <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">Current Gold Price</p>
        <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{formattedPrice}/oz</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Last updated</p>
        <p className="text-xs">{formattedDate}</p>
      </div>
    </div>
  );
}
