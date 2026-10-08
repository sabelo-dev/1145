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

const GOLD_UNIT_SHORT = { mg: 'mg Au', g: 'g Au', oz: 'oz Au' } as const;

export function CurrencyToggle({ className, showLabel = true, compact = false }: CurrencyToggleProps) {
  const {
    displayMode,
    displayCurrency,
    goldUnit,
    goldPrice,
    currencies,
    updatePreference,
    getCurrency,
  } = useGoldPricingContext();

  const currencySymbol = getCurrency(displayCurrency)?.currencySymbol || displayCurrency;
  // Gold modes need a gold price; without one prices fall back to currency, so don't offer them.
  const goldAvailable = !!goldPrice;
  // Chosen currency first, so it is always visible however long the list gets.
  const orderedCurrencies = [...currencies].sort((a, b) =>
    Number(b.currencyCode === displayCurrency) - Number(a.currencyCode === displayCurrency));

  const label =
    displayMode === 'gold' ? GOLD_UNIT_SHORT[goldUnit]
      : displayMode === 'both' ? `${currencySymbol} + Au`
        : currencySymbol;
  const description =
    displayMode === 'gold' ? `gold, ${GOLD_UNIT_SHORT[goldUnit]}`
      : displayMode === 'both' ? `${displayCurrency} and gold`
        : displayCurrency;

  const icon = displayMode === 'gold'
    ? <Coins className="h-4 w-4 text-gold" aria-hidden />
    : <Globe className="h-4 w-4" aria-hidden />;

  const trigger = compact ? (
    <Button variant="ghost" size="sm" className={cn('gap-1', className)} aria-label={`Prices shown in ${description}. Change`}>
      {icon}
      <span className="text-xs">{label}</span>
      <ChevronDown className="h-3 w-3" aria-hidden />
    </Button>
  ) : (
    <Button variant="outline" size="sm" className="gap-2" aria-label={`Prices shown in ${description}. Change`}>
      {icon}
      <span>{label}</span>
      <ChevronDown className="h-4 w-4" aria-hidden />
    </Button>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn('max-h-[70vh] overflow-y-auto', compact ? 'w-52' : 'w-60')}>
        <DropdownMenuLabel>Show prices in</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={displayMode}
          onValueChange={(value) => updatePreference({ displayMode: value as 'currency' | 'gold' | 'both' })}
        >
          <DropdownMenuRadioItem value="currency">
            <Globe className="mr-2 h-4 w-4" aria-hidden />
            Currency
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="gold" disabled={!goldAvailable}>
            <Coins className="mr-2 h-4 w-4 text-gold" aria-hidden />
            Gold
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="both" disabled={!goldAvailable}>
            <span className="mr-2 flex items-center" aria-hidden>
              <Globe className="h-3 w-3" />
              <span className="mx-0.5">+</span>
              <Coins className="h-3 w-3 text-gold" />
            </span>
            Currency + gold
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {displayMode !== 'gold' && orderedCurrencies.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Currency</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={displayCurrency}
              onValueChange={(value) => updatePreference({ preferredCurrency: value })}
            >
              {orderedCurrencies.map((c) => (
                <DropdownMenuRadioItem key={c.currencyCode} value={c.currencyCode}>
                  <span className="w-8 shrink-0">{c.currencySymbol}</span>
                  <span className="truncate">{compact ? c.currencyCode : c.currencyName}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}

        {displayMode !== 'currency' && goldAvailable && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Gold unit</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={goldUnit}
              onValueChange={(value) => updatePreference({ goldUnit: value as 'mg' | 'g' | 'oz' })}
            >
              <DropdownMenuRadioItem value="mg">Milligrams (mg)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="g">Grams (g)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oz">Troy ounces (oz)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (compact) return menu;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && <span className="text-sm text-muted-foreground">View prices in:</span>}
      {menu}
    </div>
  );
}
