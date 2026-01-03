import { Coins, Scale, Banknote } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UCoinDisplayMode, GoldUnit } from '@/types/ucoin';

interface UCoinDisplayToggleProps {
  displayMode: UCoinDisplayMode;
  goldUnit: GoldUnit;
  onModeChange: (mode: UCoinDisplayMode) => void;
  onUnitChange: (unit: GoldUnit) => void;
  compact?: boolean;
}

export function UCoinDisplayToggle({
  displayMode,
  goldUnit,
  onModeChange,
  onUnitChange,
  compact = false
}: UCoinDisplayToggleProps) {
  if (compact) {
    return (
      <ToggleGroup
        type="single"
        value={displayMode}
        onValueChange={(value) => value && onModeChange(value as UCoinDisplayMode)}
        className="justify-start"
      >
        <ToggleGroupItem value="ucoin" aria-label="Show as UCoin" className="gap-1 text-xs">
          <Coins className="h-3 w-3" />
          <span className="hidden sm:inline">UCoin</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="gold" aria-label="Show as Gold" className="gap-1 text-xs">
          <Scale className="h-3 w-3" />
          <span className="hidden sm:inline">Gold</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="currency" aria-label="Show as Currency" className="gap-1 text-xs">
          <Banknote className="h-3 w-3" />
          <span className="hidden sm:inline">Currency</span>
        </ToggleGroupItem>
      </ToggleGroup>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Display Mode</Label>
        <ToggleGroup
          type="single"
          value={displayMode}
          onValueChange={(value) => value && onModeChange(value as UCoinDisplayMode)}
          className="justify-start"
        >
          <ToggleGroupItem value="ucoin" aria-label="Show as UCoin" className="gap-2">
            <Coins className="h-4 w-4" />
            UCoin
          </ToggleGroupItem>
          <ToggleGroupItem value="gold" aria-label="Show as Gold" className="gap-2">
            <Scale className="h-4 w-4" />
            Gold
          </ToggleGroupItem>
          <ToggleGroupItem value="currency" aria-label="Show as Currency" className="gap-2">
            <Banknote className="h-4 w-4" />
            Currency
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {displayMode === 'gold' && (
        <div className="space-y-2">
          <Label>Gold Unit</Label>
          <Select value={goldUnit} onValueChange={(v) => onUnitChange(v as GoldUnit)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mg">Milligrams (mg)</SelectItem>
              <SelectItem value="g">Grams (g)</SelectItem>
              <SelectItem value="oz">Troy Ounces (oz)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
