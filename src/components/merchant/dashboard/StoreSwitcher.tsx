import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type StoreAccess } from "@/services/merchantAi";

/** Picks which store to work in when the user has more than one. */
const StoreSwitcher: React.FC<{
  stores: StoreAccess[];
  current: StoreAccess;
  onChange: (storeId: string) => void;
}> = ({ stores, current, onChange }) => {
  if (stores.length < 2) {
    return <span className="text-sm text-muted-foreground">{ROLE_LABELS[current.role]}</span>;
  }
  return (
    <Select value={current.store_id} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-56" aria-label="Store">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stores.map((s) => (
          <SelectItem key={s.store_id} value={s.store_id}>
            {s.store_name} · {ROLE_LABELS[s.role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default StoreSwitcher;
