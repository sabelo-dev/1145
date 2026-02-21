import React from 'react';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { cn } from '@/lib/utils';
import { Coins } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GoldPriceDisplayProps {
  /** Price in the original currency */
  price: number;
  /** Currency code of the original price (defaults to ZAR) */
  currency?: string;
  /** Pre-calculated mg gold value (if available from database) */
  mgGold?: number | null;
  /** Compare at price for discount display */
  compareAtPrice?: number | null;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Show gold conversion inline */
  showGoldInline?: boolean;
}

export function GoldPriceDisplay({
  price,
  currency = 'ZAR',
  mgGold,
  compareAtPrice,
  size = 'md',
  className,
  showGoldInline = false,
}: GoldPriceDisplayProps) {
  const { 
    displayMode, 
    displayCurrency, 
    goldUnit,
    formatGold, 
    formatCurrencyAmount,
    mgGoldToCurrency,
    currencyToMgGold,
  } = useGoldPricingContext();

  // Calculate gold value if not provided
  const safePrice = price ?? 0;
  const goldValue = mgGold ?? currencyToMgGold(safePrice, currency);
  
  // Convert to display currency if different from original
  const displayPrice = currency === displayCurrency 
    ? price 
    : mgGoldToCurrency(goldValue, displayCurrency);

  const formattedCurrency = formatCurrencyAmount(displayPrice, displayCurrency);
  const formattedGold = formatGold(goldValue, goldUnit);

  // Compare at price conversions
  const compareGoldValue = compareAtPrice ? currencyToMgGold(compareAtPrice, currency) : null;
  const compareDisplayPrice = compareAtPrice && currency !== displayCurrency
    ? mgGoldToCurrency(compareGoldValue!, displayCurrency)
    : compareAtPrice;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  const renderCurrencyPrice = () => (
    <span className={cn(sizeClasses[size], 'font-semibold', className)}>
      {formattedCurrency}
    </span>
  );

  const renderGoldPrice = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            sizeClasses[size], 
            'font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1',
            className
          )}>
            <Coins className={cn(
              size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
            )} />
            {formattedGold}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>≈ {formattedCurrency}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderComparePrice = () => {
    if (!compareAtPrice || compareAtPrice <= price) return null;
    
    const formattedCompare = displayMode === 'gold' 
      ? formatGold(compareGoldValue!, goldUnit)
      : formatCurrencyAmount(compareDisplayPrice!, displayCurrency);

    return (
      <span className="text-muted-foreground line-through text-sm ml-2">
        {formattedCompare}
      </span>
    );
  };

  if (displayMode === 'gold') {
    return (
      <div className="inline-flex items-center flex-wrap">
        {renderGoldPrice()}
        {renderComparePrice()}
      </div>
    );
  }

  if (displayMode === 'both' || showGoldInline) {
    return (
      <div className="inline-flex items-center flex-wrap gap-2">
        {renderCurrencyPrice()}
        <span className="text-muted-foreground text-sm">
          ({formattedGold})
        </span>
        {renderComparePrice()}
      </div>
    );
  }

  // Default: currency only
  return (
    <div className="inline-flex items-center flex-wrap">
      {renderCurrencyPrice()}
      {renderComparePrice()}
    </div>
  );
}
