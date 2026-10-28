import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CheckCircle2, Loader2, PackageX, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  fetchStock, fetchStockHistory, setStock, STOCK_REASONS, variationLabel, type StockReason,
} from "@/services/merchantAi";

const LOW = 5;

/** Stock state with icon + label (never colour alone). */
const StockBadge: React.FC<{ n: number }> = ({ n }) =>
  n <= 0 ? <Badge variant="destructive" className="gap-1"><PackageX className="h-3 w-3" aria-hidden /> Out of stock</Badge>
    : n <= LOW ? <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" aria-hidden /> Low · {n}</Badge>
      : <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" aria-hidden /> {n} in stock</Badge>;

/** One editable stock line (a product without variants, or one variant). */
const StockLine: React.FC<{
  label: string;
  quantity: number;
  onSave: (quantity: number, reason: StockReason) => Promise<unknown>;
}> = ({ label, quantity, onSave }) => {
  const [value, setValue] = useState(String(quantity));
  const [reason, setReason] = useState<StockReason>("count");
  const [saving, setSaving] = useState(false);
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0;
  const changed = valid && parsed !== quantity;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {/* Own row on phones; inline beside the controls from sm up. */}
      <span className="w-full min-w-0 break-words text-sm sm:w-auto sm:flex-1">{label}</span>
      <Input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => setValue(e.target.value)}
        className="h-10 w-20 shrink-0 text-right sm:w-24" aria-label={`Stock for ${label}`} />
      <Select value={reason} onValueChange={(v) => setReason(v as StockReason)}>
        <SelectTrigger className="h-10 min-w-0 flex-1 sm:w-44 sm:flex-none" aria-label="Reason"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(STOCK_REASONS) as StockReason[]).map((r) => <SelectItem key={r} value={r}>{STOCK_REASONS[r]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button className="h-10 shrink-0" disabled={!changed || saving}
        onClick={async () => {
          setSaving(true);
          try { await onSave(parsed, reason); } finally { setSaving(false); }
        }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
      </Button>
    </div>
  );
};

/**
 * Stock control for operators and managers: set a product's or variant's
 * stock to a counted number with a reason. Every change is recorded
 * (merchant_stock_adjustments) and shown under Recent changes.
 */
const ConsoleStock: React.FC<{ storeId: string }> = ({ storeId }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const stock = useQuery({ queryKey: ["merchant-stock", storeId, query], queryFn: () => fetchStock(storeId, query) });
  const history = useQuery({ queryKey: ["merchant-stock-history", storeId], queryFn: () => fetchStockHistory(storeId) });

  const save = useMutation({
    mutationFn: (v: { productId: string; variationId: string | null; quantity: number; reason: StockReason }) =>
      setStock(storeId, v.productId, v.variationId, v.quantity, v.reason),
    onSuccess: () => {
      toast.success("Stock updated");
      queryClient.invalidateQueries({ queryKey: ["merchant-stock", storeId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-stock-history", storeId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-store-analytics"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = stock.data ?? [];
  const out = items.filter((i) => i.total <= 0).length;
  const low = items.filter((i) => i.total > 0 && i.total <= LOW).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Stock</h2>
          <p className="text-sm text-muted-foreground">
            {stock.data ? `${items.length} products · ${out} out of stock · ${low} low` : "Loading…"}
          </p>
        </div>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or SKU" className="h-10 min-w-0 flex-1 sm:w-56 sm:flex-none" aria-label="Search stock" />
          <Button type="submit" variant="outline" className="h-10 shrink-0" aria-label="Search"><Search className="h-4 w-4" /></Button>
        </form>
      </div>

      {stock.error && <p className="text-sm text-destructive">{(stock.error as Error).message}</p>}
      {stock.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
      {stock.data && items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>}

      <div className="space-y-3">
        {/* Lowest stock first, so what needs attention is at the top */}
        {[...items].sort((a, b) => a.total - b.total).map((item) => (
          <Card key={item.product_id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-1">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{item.name}</CardTitle>
                <CardDescription>
                  {[item.sku && `SKU ${item.sku}`, item.status !== "approved" && item.status !== "active" ? item.status : null,
                    item.last_adjusted_at && `changed ${formatDistanceToNowStrict(new Date(item.last_adjusted_at))} ago`]
                    .filter(Boolean).join(" · ")}
                </CardDescription>
              </div>
              <StockBadge n={item.total} />
            </CardHeader>
            <CardContent className="divide-y p-4 pt-0">
              {item.variations.length === 0 ? (
                <StockLine key={`p:${item.quantity}`} label="Stock" quantity={item.quantity}
                  onSave={(quantity, reason) => save.mutateAsync({ productId: item.product_id, variationId: null, quantity, reason })} />
              ) : (
                item.variations.map((v) => (
                  <StockLine key={`${v.variation_id}:${v.quantity}`} label={variationLabel(v.attributes, v.sku)} quantity={v.quantity}
                    onSave={(quantity, reason) => save.mutateAsync({ productId: item.product_id, variationId: v.variation_id, quantity, reason })} />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent changes</CardTitle>
          <CardDescription>Every stock change made here, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {history.data?.length ? (
            <ul className="divide-y text-sm">
              {history.data.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{h.product_name}</span>
                    {(h.variation_sku || h.variation_attributes) && <span className="text-muted-foreground"> · {variationLabel(h.variation_attributes, h.variation_sku)}</span>}
                    <span className="text-muted-foreground"> · {h.old_quantity} → <span className="font-medium text-foreground">{h.new_quantity}</span> · {STOCK_REASONS[h.reason]}</span>
                    {h.note && <span className="text-muted-foreground"> · “{h.note}”</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.changed_by ?? "Someone"} · {formatDistanceToNowStrict(new Date(h.created_at))} ago</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{history.isLoading ? "Loading…" : "No stock changes yet."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsoleStock;
