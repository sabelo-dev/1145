import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ban, Loader2, RotateCcw, Search, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatMinor } from "@/lib/money";
import { canUse, newRequestKey, type StoreAccess } from "@/services/merchantAi";
import {
  fetchCurrentShift, fetchDaySummary, fetchPosSettings, fetchSale, fetchSales, fetchShifts, getRegisterName, refundSale, saleNo,
  savePosSettings, TENDER_LABELS, voidSale, type PosSale, type PosSettings, type SaleStatus,
} from "@/services/pos";
import PosReceipt from "./PosReceipt";
import { shareShiftReport, ShiftReportView } from "./PosShift";

const STATUS: Record<SaleStatus, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  completed: { label: "Paid", variant: "secondary" },
  partially_refunded: { label: "Part refunded", variant: "outline" },
  refunded: { label: "Refunded", variant: "outline" },
  voided: { label: "Voided", variant: "destructive" },
};

const today = () => format(new Date(), "yyyy-MM-dd");

/** Refund some or all of a sale; the amount is worked out by the database from what was paid. */
const RefundForm: React.FC<{ sale: PosSale; onDone: (s: PosSale) => void }> = ({ sale, onDone }) => {
  const register = getRegisterName();
  const shift = useQuery({ queryKey: ["pos-shift", sale.store_id, register], queryFn: () => fetchCurrentShift(sale.store_id, register) });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"cash" | "card" | "eft">("cash");
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const key = useRef(newRequestKey());

  const lines = sale.lines.filter((l) => l.quantity > l.refunded_quantity);
  const estimate = lines.reduce((s, l) => {
    const q = qty[l.line_id] ?? 0;
    const left = l.quantity - l.refunded_quantity;
    if (!q) return s;
    return s + (q === left ? l.line_total_minor - l.refunded_minor : Math.floor((l.line_total_minor * q) / l.quantity));
  }, 0);
  const chosen = Object.values(qty).some((q) => q > 0);

  const refund = useMutation({
    mutationFn: () => refundSale({
      saleId: sale.sale_id, shiftId: shift.data!.shift_id,
      lines: Object.entries(qty).filter(([, q]) => q > 0).map(([line_id, quantity]) => ({ line_id, quantity })),
      method, reason: reason.trim(), restock, requestKey: key.current,
    }),
    onSuccess: (s) => { key.current = newRequestKey(); toast.success("Refund recorded"); onDone(s); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (shift.isLoading) return <Loader2 className="mx-auto h-5 w-5 animate-spin" />;
  if (!shift.data) return <p className="text-sm text-muted-foreground">Open a shift on {register} (Sell tab) to give refunds, so the money comes out of a till.</p>;

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (chosen && reason.trim()) refund.mutate(); }}>
      <div className="flex justify-end">
        <Button type="button" variant="link" className="h-auto p-0"
          onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.line_id, l.quantity - l.refunded_quantity])))}>Refund everything</Button>
      </div>
      <ul className="divide-y rounded-md border">
        {lines.map((l) => {
          const left = l.quantity - l.refunded_quantity;
          const q = qty[l.line_id] ?? 0;
          return (
            <li key={l.line_id} className="flex items-center gap-2 p-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="text-xs text-muted-foreground">of {left}</span>
              <Input inputMode="numeric" className="h-10 w-16 text-center" value={q || ""} placeholder="0" aria-label={`Units of ${l.name} to refund`}
                onChange={(e) => { const n = Math.max(0, Math.min(left, Math.floor(Number(e.target.value) || 0))); setQty((x) => ({ ...x, [l.line_id]: n })); }} />
            </li>
          );
        })}
      </ul>
      <div className="grid grid-cols-3 gap-2">
        {(["cash", "card", "eft"] as const).map((m) => (
          <Button key={m} type="button" variant={method === m ? "default" : "outline"} className="h-11" onClick={() => setMethod(m)}>{TENDER_LABELS[m]}</Button>
        ))}
      </div>
      <Input placeholder="Reason, e.g. faulty, wrong size" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className="h-11" aria-label="Reason" />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={restock} onCheckedChange={(v) => setRestock(v === true)} /> Put the items back in stock
      </label>
      <Button type="submit" className="h-12 w-full" disabled={!chosen || !reason.trim() || refund.isPending}>
        {refund.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Refund ${formatMinor(estimate)} by ${TENDER_LABELS[method]}`}
      </Button>
      {method === "card" && <p className="text-xs text-muted-foreground">Do the refund on your card machine too.</p>}
    </form>
  );
};

/** A sale's receipt, with refund and void for managers and operators. */
const SaleDialog: React.FC<{ saleId: string | null; canManage: boolean; onClose: () => void }> = ({ saleId, canManage, onClose }) => {
  const queryClient = useQueryClient();
  const sale = useQuery({ queryKey: ["pos-sale", saleId], queryFn: () => fetchSale(saleId!), enabled: !!saleId });
  const [mode, setMode] = useState<"view" | "refund" | "void">("view");
  const [voidReason, setVoidReason] = useState("");
  useEffect(() => { setMode("view"); setVoidReason(""); }, [saleId]);

  const updated = (s: PosSale) => {
    queryClient.setQueryData(["pos-sale", s.sale_id], s);
    for (const k of ["pos-sales", "pos-day", "pos-shift", "pos-shifts", "pos-catalog", "merchant-stock"]) queryClient.invalidateQueries({ queryKey: [k] });
    setMode("view");
  };
  const doVoid = useMutation({
    mutationFn: () => voidSale(saleId!, voidReason.trim()),
    onSuccess: (s) => { toast.success("Sale voided"); updated(s); },
    onError: (e: Error) => toast.error(e.message),
  });

  const s = sale.data;
  const canRefund = s && canManage && (s.status === "completed" || s.status === "partially_refunded");
  const canVoid = s && canManage && s.status === "completed" && !s.payments.some((p) => p.method === "pay_1145");

  return (
    <Dialog open={!!saleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Sale {s ? saleNo(s.sale_number) : ""} {s && <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>}</DialogTitle>
          <DialogDescription>{s ? `${format(new Date(s.created_at), "d MMM yyyy HH:mm")} · ${s.register_name}${s.cashier ? ` · ${s.cashier}` : ""}` : "Loading…"}</DialogDescription>
        </DialogHeader>
        {sale.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
        {sale.error && <p className="text-sm text-destructive">{(sale.error as Error).message}</p>}
        {s && mode === "view" && (
          <div className="space-y-3">
            <PosReceipt sale={s} />
            {s.void_reason && <p className="text-sm text-muted-foreground">Voided: “{s.void_reason}”</p>}
            {s.refunds.map((r) => (
              <p key={r.refund_id} className="text-sm text-muted-foreground">
                Refund {format(new Date(r.created_at), "d MMM HH:mm")}: {formatMinor(r.amount_minor)} by {TENDER_LABELS[r.method]} · “{r.reason}”{r.restocked ? " · restocked" : ""}
              </p>
            ))}
            {(canRefund || canVoid) && (
              <div className="flex gap-2">
                {canRefund && <Button variant="outline" className="h-11 flex-1 gap-2" onClick={() => setMode("refund")}><RotateCcw className="h-4 w-4" /> Refund</Button>}
                {canVoid && <Button variant="outline" className="h-11 flex-1 gap-2 text-destructive" onClick={() => setMode("void")}><Ban className="h-4 w-4" /> Void</Button>}
              </div>
            )}
          </div>
        )}
        {s && mode === "refund" && (
          <div className="space-y-2">
            <RefundForm sale={s} onDone={updated} />
            <Button variant="ghost" className="w-full" onClick={() => setMode("view")}>Back</Button>
          </div>
        )}
        {s && mode === "void" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (voidReason.trim()) doVoid.mutate(); }}>
            <p className="text-sm text-muted-foreground">
              Voiding cancels the whole sale and puts the stock back. Use it for sales rung up by mistake on this shift; otherwise refund.
              {s.payments.some((p) => p.method === "card") && " Void it on the card machine too."}
            </p>
            <Input placeholder="Why? e.g. rung up twice" value={voidReason} maxLength={200} onChange={(e) => setVoidReason(e.target.value)} className="h-11" aria-label="Reason" />
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="h-11" onClick={() => setMode("view")}>Back</Button>
              <Button type="submit" variant="destructive" className="h-11 flex-1" disabled={!voidReason.trim() || doVoid.isPending}>
                {doVoid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Void ${formatMinor(s.total_minor)}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const SalesList: React.FC<{ storeId: string; canManage: boolean }> = ({ storeId, canManage }) => {
  const [day, setDay] = useState(today);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const sales = useQuery({ queryKey: ["pos-sales", storeId, day, query], queryFn: () => fetchSales(storeId, day, query) });
  const list = sales.data ?? [];
  const total = list.filter((s) => s.status !== "voided").reduce((n, s) => n + s.total_minor - s.refunded_minor, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="pos-day">Day</Label>
          <Input id="pos-day" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} className="h-11 w-44" disabled={!!query} />
        </div>
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Input value={search} onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setQuery(""); }} placeholder="Sale no., customer or phone"
            className="h-11 min-w-0 flex-1" aria-label="Find a sale" />
          <Button type="submit" variant="outline" className="h-11" aria-label="Find"><Search className="h-4 w-4" /></Button>
        </form>
      </div>
      <p className="text-sm text-muted-foreground">
        {sales.data ? `${list.length} sale${list.length === 1 ? "" : "s"} · ${formatMinor(total)} after refunds` : "Loading…"}{query ? ` · matching “${query}”` : ""}
      </p>
      {sales.error && <p className="text-sm text-destructive">{(sales.error as Error).message}</p>}
      <ul className="divide-y rounded-md border">
        {list.map((s) => (
          <li key={s.sale_id}>
            <button type="button" onClick={() => setOpen(s.sale_id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{saleNo(s.sale_number)} <span className="font-normal text-muted-foreground">· {format(new Date(s.created_at), query ? "d MMM HH:mm" : "HH:mm")}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  {[`${s.items} item${s.items === 1 ? "" : "s"}`, (s.methods ?? []).map((m) => TENDER_LABELS[m]).join(" + "), s.customer_name, s.register_name, s.cashier].filter(Boolean).join(" · ")}
                </p>
              </div>
              {s.status !== "completed" && <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>}
              <span className={`font-semibold tabular-nums ${s.status === "voided" ? "line-through text-muted-foreground" : ""}`}>{formatMinor(s.total_minor)}</span>
            </button>
          </li>
        ))}
        {sales.data && list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No sales.</li>}
      </ul>
      <SaleDialog saleId={open} canManage={canManage} onClose={() => setOpen(null)} />
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card><CardContent className="p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-xl font-semibold tabular-nums">{value}</p>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </CardContent></Card>
);

const DaySummaryView: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [day, setDay] = useState(today);
  const summary = useQuery({ queryKey: ["pos-day", storeId, day], queryFn: () => fetchDaySummary(storeId, day) });
  const d = summary.data;
  const peak = d?.by_hour.reduce((m, h) => Math.max(m, h.total_minor), 0) ?? 0;
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="pos-summary-day">Day</Label>
        <Input id="pos-summary-day" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} className="h-11 w-44" />
      </div>
      {summary.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {summary.error && <p className="text-sm text-destructive">{(summary.error as Error).message}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Net sales" value={formatMinor(d.net_minor)} hint={`${formatMinor(d.gross_minor)} less ${formatMinor(d.refunds_minor)} refunds`} />
            <Stat label="Sales" value={String(d.sales_count)} hint={`${d.items_sold} items · ${d.voids_count} voided`} />
            <Stat label="Average sale" value={formatMinor(d.average_sale_minor)} />
            <Stat label="VAT included" value={formatMinor(d.vat_minor)} hint={d.discount_minor ? `${formatMinor(d.discount_minor)} discounts` : undefined} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Takings by method</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(Object.keys(TENDER_LABELS) as Array<keyof typeof TENDER_LABELS>).map((m) => (
                  <div key={m} className="flex justify-between"><span className="text-muted-foreground">{TENDER_LABELS[m]}</span><span className="tabular-nums">{formatMinor(d.by_method[m] ?? 0)}</span></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Best sellers</CardTitle></CardHeader>
              <CardContent>
                {d.top_items.length ? (
                  <ol className="space-y-1 text-sm">
                    {d.top_items.map((t) => (
                      <li key={t.name} className="flex justify-between gap-2"><span className="truncate">{t.quantity}× {t.name}</span><span className="tabular-nums">{formatMinor(t.total_minor)}</span></li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted-foreground">No sales on this day.</p>}
              </CardContent>
            </Card>
          </div>
          {d.by_hour.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By hour</CardTitle><CardDescription>Sales total in each hour</CardDescription></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {d.by_hour.map((h) => (
                    <li key={h.hour} className="flex items-center gap-2">
                      <span className="w-12 tabular-nums text-muted-foreground">{String(h.hour).padStart(2, "0")}:00</span>
                      <span className="h-3 rounded-sm bg-primary" style={{ width: `${peak ? Math.max(2, (h.total_minor / peak) * 60) : 0}%` }} aria-hidden />
                      <span className="tabular-nums">{formatMinor(h.total_minor)}</span>
                      <span className="text-xs text-muted-foreground">({h.sales})</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

const ShiftHistory: React.FC<{ storeId: string }> = ({ storeId }) => {
  const shifts = useQuery({ queryKey: ["pos-shifts", storeId], queryFn: () => fetchShifts(storeId) });
  const [open, setOpen] = useState<string | null>(null);
  const shown = shifts.data?.find((s) => s.shift_id === open) ?? null;
  return (
    <div className="space-y-2">
      {shifts.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      {shifts.error && <p className="text-sm text-destructive">{(shifts.error as Error).message}</p>}
      <ul className="divide-y rounded-md border">
        {shifts.data?.map((s) => (
          <li key={s.shift_id}>
            <button type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50" onClick={() => setOpen(s.shift_id)}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.register_name} <span className="font-normal text-muted-foreground">· {format(new Date(s.opened_at), "d MMM HH:mm")}{s.closed_at ? `–${format(new Date(s.closed_at), "HH:mm")}` : ""}</span></p>
                <p className="text-xs text-muted-foreground">{s.sales_count} sales · {s.opened_by ?? ""}</p>
              </div>
              {s.status === "open" ? <Badge>Open</Badge>
                : s.variance_minor ? <Badge variant="destructive">{s.variance_minor > 0 ? "Over" : "Short"} {formatMinor(Math.abs(s.variance_minor))}</Badge>
                  : <Badge variant="secondary">Balanced</Badge>}
              <span className="tabular-nums">{formatMinor(s.net_minor)}</span>
            </button>
          </li>
        ))}
        {shifts.data?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No shifts yet.</li>}
      </ul>
      <Dialog open={!!shown} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{shown?.status === "open" ? "X report" : "Z report"}</DialogTitle><DialogDescription>{shown?.register_name}</DialogDescription></DialogHeader>
          {shown && <>
            <ShiftReportView report={shown} />
            <Button variant="outline" className="h-11 w-full gap-2" onClick={() => void shareShiftReport(shown)}><Share2 className="h-4 w-4" /> Share report</Button>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SettingsForm: React.FC<{ storeId: string }> = ({ storeId }) => {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["pos-settings", storeId], queryFn: () => fetchPosSettings(storeId) });
  const [form, setForm] = useState<PosSettings | null>(null);
  const [limit, setLimit] = useState("");
  useEffect(() => {
    if (settings.data) { setForm(settings.data); setLimit(String(settings.data.cashier_max_discount_bp / 100)); }
  }, [settings.data]);
  const limitNum = Number(limit.replace(",", "."));
  const limitBp = limit.trim() !== "" && !Number.isNaN(limitNum) && limitNum >= 0 && limitNum <= 100 ? Math.round(limitNum * 100) : null;
  const save = useMutation({
    mutationFn: () => savePosSettings(storeId, { ...form!, cashier_max_discount_bp: limitBp! }),
    onSuccess: (s) => { queryClient.setQueryData(["pos-settings", storeId], s); toast.success("POS settings saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!form) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  return (
    <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="pos-vat">VAT registered</Label>
          <p className="text-sm text-muted-foreground">Receipts become tax invoices showing the 15% VAT included in prices.</p>
        </div>
        <Switch id="pos-vat" checked={form.vat_registered} onCheckedChange={(v) => setForm({ ...form, vat_registered: v })} />
      </div>
      {form.vat_registered && (
        <div className="space-y-1.5">
          <Label htmlFor="pos-vat-no">VAT number</Label>
          <Input id="pos-vat-no" inputMode="numeric" value={form.vat_number ?? ""} placeholder="4xxxxxxxxx" maxLength={12}
            onChange={(e) => setForm({ ...form, vat_number: e.target.value })} className="h-11" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pos-limit">Most a cashier can discount without a manager (%)</Label>
        <Input id="pos-limit" inputMode="decimal" value={limit} className="h-11 w-32" aria-invalid={limitBp === null}
          onChange={(e) => setLimit(e.target.value)} />
        {limitBp === null && <p className="text-sm text-destructive">Enter a percentage from 0 to 100</p>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="pos-open">Allow open items</Label>
          <p className="text-sm text-muted-foreground">Ring up things not in the catalogue by typing a name and price.</p>
        </div>
        <Switch id="pos-open" checked={form.allow_open_items} onCheckedChange={(v) => setForm({ ...form, allow_open_items: v })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pos-header">Receipt header</Label>
        <Textarea id="pos-header" value={form.receipt_header ?? ""} maxLength={300} placeholder="e.g. Shop 4, Riverside Mall"
          onChange={(e) => setForm({ ...form, receipt_header: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pos-footer">Receipt footer</Label>
        <Textarea id="pos-footer" value={form.receipt_footer ?? ""} maxLength={300} placeholder="e.g. Exchanges within 7 days with this slip. Thank you!"
          onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} />
      </div>
      <Button type="submit" className="h-11" disabled={save.isPending || limitBp === null}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save settings"}</Button>
    </form>
  );
};

/** The "Sales" tab: till sales, refunds and voids, day summary, shifts and POS settings. */
const PosSales: React.FC<{ access: StoreAccess }> = ({ access }) => {
  const storeId = access.store_id;
  const canManage = canUse(access, "operations");
  const canSummary = canUse(access, "insights");
  const canSettings = canUse(access, "settings");
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Till sales</h2>
      <Tabs defaultValue="sales">
        <TabsList className="flex w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          {canSummary && <TabsTrigger value="day">Day summary</TabsTrigger>}
          <TabsTrigger value="shifts">Shifts</TabsTrigger>
          {canSettings && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>
        <TabsContent value="sales"><SalesList storeId={storeId} canManage={canManage} /></TabsContent>
        {canSummary && <TabsContent value="day"><DaySummaryView storeId={storeId} /></TabsContent>}
        <TabsContent value="shifts"><ShiftHistory storeId={storeId} /></TabsContent>
        {canSettings && <TabsContent value="settings"><SettingsForm storeId={storeId} /></TabsContent>}
      </Tabs>
    </div>
  );
};

export default PosSales;
