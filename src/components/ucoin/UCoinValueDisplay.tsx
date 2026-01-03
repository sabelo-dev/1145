import { Coins } from 'lucide-react';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { UCoinDisplayMode, GoldUnit, UCOIN_GOLD_RATIO } from '@/types/ucoin';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UCoinValueDisplayProps {
  amount: number;
  displayMode?: UCoinDisplayMode;
  goldUnit?: GoldUnit;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UCoinValueDisplay({
  amount,
  displayMode = 'ucoin',
  goldUnit = 'mg',
  showIcon = true,
  className = '',
  size = 'md'
}: UCoinValueDisplayProps) {
  const { mgGoldToCurrency, displayCurrency, getCurrency } = useGoldPricingContext();

  // 1 UCoin = 1 mg gold
  const mgGold = amount * UCOIN_GOLD_RATIO.MG_PER_UCOIN;
  const currencyValue = mgGoldToCurrency(mgGold, displayCurrency);
  const currency = getCurrency(displayCurrency);

  const formatGold = (mg: number, unit: GoldUnit): string => {
    switch (unit) {
      case 'g':
        return `${(mg / 1000).toFixed(3)} g Au`;
      case 'oz':
        return `${(mg / 31103.4768).toFixed(6)} oz Au`;
      default:
        return `${mg.toLocaleString()} mg Au`;
    }
  };

  const formatCurrency = (): string => {
    const symbol = currency?.currencySymbol || displayCurrency;
    return `${symbol}${currencyValue.toFixed(2)}`;
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const getDisplayValue = (): string => {
    switch (displayMode) {
      case 'gold':
        return formatGold(mgGold, goldUnit);
      case 'currency':
        return formatCurrency();
      default:
        return `${amount.toLocaleString()} UCoin`;
    }
  };

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p><strong>{amount.toLocaleString()} UCoin</strong></p>
      <p>= {formatGold(mgGold, 'mg')}</p>
      <p>= {formatGold(mgGold, 'g')}</p>
      <p>≈ {formatCurrency()}</p>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 cursor-help ${sizeClasses[size]} ${className}`}>
            {showIcon && displayMode === 'ucoin' && (
              <Coins className={`${iconSizes[size]} text-amber-500`} />
            )}
            <span>{getDisplayValue()}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
