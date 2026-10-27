import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SA_PROVINCES, provincesOf, withProvinces } from "@/lib/deliveryCoverage";

interface Props {
  /** The merchant's full shipping_regions list (countries and provinces). */
  regions: string[];
  onChange: (regions: string[]) => void;
}

/**
 * Which South African provinces a merchant delivers to. None ticked means
 * nationwide; shoppers in other provinces don't see the merchant's products.
 */
const ProvinceCoverage: React.FC<Props> = ({ regions, onChange }) => {
  const selected = provincesOf(regions);
  const toggle = (p: string) =>
    onChange(withProvinces(regions, selected.includes(p) ? selected.filter((s) => s !== p) : [...selected, p]));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">South African provinces you deliver to</legend>
      <p className="text-sm text-muted-foreground">
        Leave all unticked to deliver nationwide. Shoppers outside your provinces won't see your products on the homepage.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {SA_PROVINCES.map((p) => (
          <Label key={p} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-normal">
            <Checkbox checked={selected.includes(p)} onCheckedChange={() => toggle(p)} />
            {p}
          </Label>
        ))}
      </div>
    </fieldset>
  );
};

export default ProvinceCoverage;
