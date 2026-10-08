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
    goldPrice,
    formatGold,
    formatCurrencyAmount,
    convertCurrency,
    currencyToMgGold,
    getCurrency,
  } = useGoldPricingContext();

  const safePrice = price ?? 0;

  // Convert to the display currency. If a rate is missing, keep the original
  // currency rather than showing a wrong amount.
  const inDisplayCurrency = (amount: number) => {
    const converted = convertCurrency(amount, currency, displayCurrency);
    return converted == null
      ? formatCurrencyAmount(amount, currency)
      : formatCurrencyAmount(converted, displayCurrency);
  };

  // Gold can only be shown once the gold price and this currency's rate are loaded;
  // until then every mode shows the currency price instead of "0 mg Au".
  const goldReady = mgGold != null || (!!goldPrice && !!getCurrency(currency));
  const mode = goldReady ? displayMode : 'currency';

  const goldValue = mgGold ?? currencyToMgGold(safePrice, currency);
  const formattedCurrency = inDisplayCurrency(safePrice);
  const formattedGold = formatGold(goldValue, goldUnit);
  const hasCompare = !!compareAtPrice && compareAtPrice > safePrice;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  const renderCurrencyPrice = () => (
    <span className={cn(sizeClasses[size], 'font-semibold tabular-nums', className)}>
      {formattedCurrency}
    </span>
  );

  const renderGoldPrice = () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            sizeClasses[size],
            'font-semibold tabular-nums text-gold dark:text-gold inline-flex items-center gap-1',
            className
          )}>
            <Coins className={cn(
              size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'
            )} aria-hidden />
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
    if (!hasCompare) return null;

    const formattedCompare = mode === 'gold'
      ? formatGold(currencyToMgGold(compareAtPrice!, currency), goldUnit)
      : inDisplayCurrency(compareAtPrice!);

    return (
      <span className="text-muted-foreground line-through text-sm ml-2 tabular-nums">
        <span className="sr-only">Was </span>{formattedCompare}
      </span>
    );
  };

  if (mode === 'gold') {
    return (
      <div className="inline-flex items-center flex-wrap">
        {renderGoldPrice()}
        {renderComparePrice()}
      </div>
    );
  }

  if (goldReady && (mode === 'both' || showGoldInline)) {
    return (
      <div className="inline-flex items-center flex-wrap gap-x-2">
        {renderCurrencyPrice()}
        <span className="text-muted-foreground text-sm tabular-nums">
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
