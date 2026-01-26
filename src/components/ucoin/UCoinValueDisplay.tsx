import { Coins } from 'lucide-react';
import { UCoinDisplayMode, UCOIN_RAND_VALUE } from '@/types/ucoin';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UCoinValueDisplayProps {
  amount: number;
  displayMode?: UCoinDisplayMode;
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UCoinValueDisplay({
  amount,
  displayMode = 'ucoin',
  showIcon = true,
  className = '',
  size = 'md'
}: UCoinValueDisplayProps) {
  // 1 UCoin = R0.10
  const randValue = amount * UCOIN_RAND_VALUE;

  const formatCurrency = (): string => {
    return `R${randValue.toFixed(2)}`;
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
      case 'currency':
        return formatCurrency();
      default:
        return `${amount.toLocaleString()} UCoin`;
    }
  };

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <p><strong>{amount.toLocaleString()} UCoin</strong></p>
      <p>= {formatCurrency()}</p>
      <p className="text-muted-foreground">1 UCoin = R0.10</p>
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
