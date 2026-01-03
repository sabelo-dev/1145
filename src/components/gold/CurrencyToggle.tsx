import React from 'react';
import { useGoldPricingContext } from '@/contexts/GoldPricingContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Coins, Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CurrencyToggleProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function CurrencyToggle({ className, showLabel = true, compact = false }: CurrencyToggleProps) {
  const {
    displayMode,
    displayCurrency,
    goldUnit,
    currencies,
    updatePreference,
    getCurrency,
  } = useGoldPricingContext();

  const currentCurrency = getCurrency(displayCurrency);

  const handleDisplayModeChange = (value: string) => {
    updatePreference({ displayMode: value as 'currency' | 'gold' | 'both' });
  };

  const handleCurrencyChange = (value: string) => {
    updatePreference({ preferredCurrency: value });
  };

  const handleGoldUnitChange = (value: string) => {
    updatePreference({ goldUnit: value as 'mg' | 'g' | 'oz' });
  };

  const getDisplayModeLabel = () => {
    switch (displayMode) {
      case 'gold':
        return goldUnit === 'mg' ? 'mg Au' : goldUnit === 'g' ? 'g Au' : 'oz Au';
      case 'both':
        return `${currentCurrency?.currencySymbol || displayCurrency} + Au`;
      default:
        return currentCurrency?.currencySymbol || displayCurrency;
    }
  };

  const getDisplayModeIcon = () => {
    if (displayMode === 'gold') {
      return <Coins className="h-4 w-4 text-amber-500" />;
    }
    return <Globe className="h-4 w-4" />;
  };

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('gap-1', className)}>
            {getDisplayModeIcon()}
            <span className="text-xs">{getDisplayModeLabel()}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Display Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={displayMode} onValueChange={handleDisplayModeChange}>
            <DropdownMenuRadioItem value="currency">
              <Globe className="h-4 w-4 mr-2" />
              Currency Only
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="gold">
              <Coins className="h-4 w-4 mr-2 text-amber-500" />
              Gold Only
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="both">
              <div className="flex items-center mr-2">
                <Globe className="h-3 w-3" />
                <span className="mx-0.5">+</span>
                <Coins className="h-3 w-3 text-amber-500" />
              </div>
              Both
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          {displayMode !== 'gold' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Currency</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={displayCurrency} onValueChange={handleCurrencyChange}>
                {currencies.slice(0, 5).map((c) => (
                  <DropdownMenuRadioItem key={c.currencyCode} value={c.currencyCode}>
                    {c.currencySymbol} {c.currencyCode}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}

          {displayMode !== 'currency' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gold Unit</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={goldUnit} onValueChange={handleGoldUnitChange}>
                <DropdownMenuRadioItem value="mg">Milligrams (mg)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="g">Grams (g)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oz">Troy Ounces (oz)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && <span className="text-sm text-muted-foreground">View prices in:</span>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {getDisplayModeIcon()}
            <span>{getDisplayModeLabel()}</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Display Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={displayMode} onValueChange={handleDisplayModeChange}>
            <DropdownMenuRadioItem value="currency">
              <Globe className="h-4 w-4 mr-2" />
              Currency Only
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="gold">
              <Coins className="h-4 w-4 mr-2 text-amber-500" />
              Gold Only
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="both">
              <div className="flex items-center mr-2">
                <Globe className="h-3 w-3" />
                <span className="mx-0.5">+</span>
                <Coins className="h-3 w-3 text-amber-500" />
              </div>
              Currency + Gold
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>

          {displayMode !== 'gold' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Preferred Currency</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={displayCurrency} onValueChange={handleCurrencyChange}>
                {currencies.map((c) => (
                  <DropdownMenuRadioItem key={c.currencyCode} value={c.currencyCode}>
                    <span className="w-6">{c.currencySymbol}</span>
                    <span>{c.currencyName}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </>
          )}

          {displayMode !== 'currency' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gold Unit</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={goldUnit} onValueChange={handleGoldUnitChange}>
                <DropdownMenuRadioItem value="mg">Milligrams (mg Au)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="g">Grams (g Au)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oz">Troy Ounces (oz Au)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
