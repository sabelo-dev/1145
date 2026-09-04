import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useDropshipAdmin, type DiscoveredProduct } from "@/hooks/useDropshipping";
import {
  Activity, AlertTriangle, Boxes, CheckCircle2, Download, PackageSearch, RefreshCw,
  Search, ShieldCheck, Truck, Undo2, XCircle, Plug,
} from "lucide-react";

const money = (v: number | null | undefined) =>
  `R${Number(v ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const healthTone: Record<string, string> = {
  healthy: "bg-primary/15 text-primary border-primary/30",
  degraded: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  offline: "bg-destructive/15 text-destructive border-destructive/30",
};

const statusTone: Record<string, string> = {
  pending_approval: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  published: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  suspended: "bg-muted text-muted-foreground",
  removed: "bg-muted text-muted-foreground",
};

const Stat = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: any }) => (
  <Card>
    <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xl font-semibold truncate w-full">{value}</span>
      <span className="text-xs text-muted-foreground truncate w-full">{label}</span>
    </CardContent>
  </Card>
);

const AdminDropshipping: React.FC = () => {
  const admin = useDropshipAdmin();
  const [tab, setTab] = useState("overview");

  const activeSupplier = admin.suppliers[0];

  return (
    <div className="space-y-4 min-w-0">
      <div className="header-row">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">Dropshipping</h2>
          <p className="text-sm text-muted-foreground truncate">
            Suppliers, catalogue, fulfilment and returns
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outline" size="sm" onClick={() => admin.refresh()} disabled={admin.loading}>
            <RefreshCw className={`h-4 w-4 ${admin.loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline sm:ml-2">Refresh</span>
          </Button>
          <Button size="sm" disabled={!activeSupplier || admin.busy}
            onClick={() => activeSupplier && admin.runSync("all", activeSupplier.id)}>
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Sync now</span>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><Overview admin={admin} /></TabsContent>
        <TabsContent value="suppliers" className="mt-4"><Suppliers admin={admin} /></TabsContent>
        <TabsContent value="discover" className="mt-4"><Discover admin={admin} /></TabsContent>
        <TabsContent value="catalogue" className="mt-4"><Catalogue admin={admin} /></TabsContent>
        <TabsContent value="inventory" className="mt-4"><Inventory admin={admin} /></TabsContent>
        <TabsContent value="orders" className="mt-4"><Orders admin={admin} /></TabsContent>
        <TabsContent value="returns" className="mt-4"><Returns admin={admin} /></TabsContent>
        <TabsContent value="errors" className="mt-4"><Errors /></TabsContent>
      </Tabs>
    </div>
  );
};

/* ------------------------------------------------------------- OVERVIEW */
const Overview: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const a = admin.analytics;
  if (admin.loading && !a) return <Skeleton className="h-64 w-full" />;
  if (!a) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No dropshipping data yet.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Products" value={a.products.total} icon={Boxes} />
        <Stat label="Pending approval" value={a.products.pending} icon={ShieldCheck} />
        <Stat label="Published" value={a.products.published} icon={CheckCircle2} />
        <Stat label="Orders" value={a.orders.total} icon={Truck} />
        <Stat label="Marketplace value" value={money(a.financials.gmv)} icon={Activity} />
        <Stat label="Merchant profit" value={money(a.financials.merchant_profit)} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Fulfilment</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {Object.entries(a.orders as Record<string, number>).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="capitalize text-muted-foreground truncate">{k.replace(/_/g, " ")}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            {a.performance.avg_fulfillment_hours != null && (
              <div className="flex items-center justify-between gap-3 pt-2 border-t">
                <span className="text-muted-foreground">Average time to ship</span>
                <span className="font-medium">{a.performance.avg_fulfillment_hours} h</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Supplier health</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(a.suppliers || []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{s.name}</span>
                <Badge variant="outline" className={healthTone[s.health] || ""}>{s.health}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- SUPPLIERS */
const Suppliers: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => (
  <div className="space-y-4">
    {admin.suppliers.map((s) => (
      <Card key={s.id}>
        <CardHeader className="pb-3">
          <div className="header-row">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{s.name}</CardTitle>
              <CardDescription className="truncate">
                {s.country || "—"} · prices in {s.base_currency} · last checked{" "}
                {s.last_health_check_at ? new Date(s.last_health_check_at).toLocaleString() : "never"}
              </CardDescription>
            </div>
            <div className="header-actions">
              <Badge variant="outline" className={healthTone[s.health] || ""}>{s.health}</Badge>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {s.last_error && (
            <p className="text-xs text-destructive break-words">{s.last_error}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <Label className="text-sm">Supplier active</Label>
              <Switch checked={s.status === "active"}
                onCheckedChange={(v) => admin.updateSupplier(s.id, { status: v ? "active" : "inactive" })} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border p-3">
              <Label className="text-sm">Auto price updates</Label>
              <Switch checked={s.auto_price_update}
                onCheckedChange={(v) => admin.updateSupplier(s.id, { auto_price_update: v })} />
            </div>
            <SupplierNumber label="Safety stock" value={s.safety_stock}
              onSave={(v) => admin.updateSupplier(s.id, { safety_stock: v })} />
            <SupplierNumber label="Merchant margin %" value={Number(s.pricing_rule?.merchant_margin_pct ?? 30)}
              onSave={(v) => admin.updateSupplier(s.id, { pricing_rule: { ...s.pricing_rule, merchant_margin_pct: v } })} />
            <SupplierNumber label="Platform fee %" value={Number(s.pricing_rule?.platform_fee_pct ?? 7)}
              onSave={(v) => admin.updateSupplier(s.id, { pricing_rule: { ...s.pricing_rule, platform_fee_pct: v } })} />
            <SupplierNumber label="Payment fee %" value={Number(s.pricing_rule?.payment_fee_pct ?? 3.5)}
              onSave={(v) => admin.updateSupplier(s.id, { pricing_rule: { ...s.pricing_rule, payment_fee_pct: v } })} />
            <SupplierNumber label="Currency buffer %" value={Number(s.pricing_rule?.fx_buffer_pct ?? 4)}
              onSave={(v) => admin.updateSupplier(s.id, { pricing_rule: { ...s.pricing_rule, fx_buffer_pct: v } })} />
            <SupplierNumber label="Fixed cost per order (R)" value={Number(s.pricing_rule?.operational_fee_flat ?? 15)}
              onSave={(v) => admin.updateSupplier(s.id, { pricing_rule: { ...s.pricing_rule, operational_fee_flat: v } })} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => admin.testSupplier(s.id)} disabled={admin.busy}>
              <Plug className="h-4 w-4 mr-2" />Test connection
            </Button>
            <Button size="sm" variant="outline" onClick={() => admin.runSync("inventory", s.id)} disabled={admin.busy}>
              <RefreshCw className="h-4 w-4 mr-2" />Sync stock &amp; prices
            </Button>
            <Button size="sm" variant="outline" onClick={() => admin.runSync("orders", s.id)} disabled={admin.busy}>
              <Truck className="h-4 w-4 mr-2" />Sync orders
            </Button>
            <Button size="sm" variant="outline" onClick={() => admin.reprice(s.id)} disabled={admin.busy}>
              Recalculate prices
            </Button>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const SupplierNumber: React.FC<{ label: string; value: number; onSave: (v: number) => void }> = ({ label, value, onSave }) => {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <div className="space-y-1 rounded-md border p-3">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="number" step="0.1" value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => Number(local) !== value && onSave(Number(local))} />
    </div>
  );
};

/* -------------------------------------------------------------- DISCOVER */
const Discover: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const supplier = admin.suppliers.find((s) => s.status === "active") || admin.suppliers[0];
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DiscoveredProduct[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!supplier) return;
    setSearching(true);
    const res = await admin.discover(supplier.id, { query, page: 1, page_size: 24 });
    setItems(res?.items || []);
    setSelected(new Set());
    setSearching(false);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search supplier products…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()} />
          </div>
          <div className="flex gap-2">
            <Button onClick={search} disabled={!supplier || searching}>
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageSearch className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
            <Button variant="secondary" disabled={!selected.size || admin.busy}
              onClick={async () => {
                if (!supplier) return;
                await admin.importProducts(supplier.id, Array.from(selected));
                setSelected(new Set());
              }}>
              <Download className="h-4 w-4 mr-2" />Import ({selected.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <Card key={p.supplierProductId} className={selected.has(p.supplierProductId) ? "ring-2 ring-primary" : ""}>
            <CardContent className="p-3 space-y-2 min-w-0">
              <div className="flex items-start gap-2">
                <Checkbox checked={selected.has(p.supplierProductId)} onCheckedChange={() => toggle(p.supplierProductId)} />
                <p className="text-sm font-medium line-clamp-2 flex-1 min-w-0">{p.name}</p>
              </div>
              {p.images?.[0] && (
                <img src={p.images[0]} alt={p.name} loading="lazy"
                  className="w-full h-32 object-cover rounded-md bg-muted" />
              )}
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Landed cost</span><span>{money(p.pricing?.landedCostZar)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Merchant profit</span><span>{money(p.pricing?.merchantProfitZar)}</span></div>
                <div className="flex justify-between font-medium"><span>Recommended</span><span>{money(p.pricing?.recommendedPriceZar)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{p.stock}</span></div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!items.length && !searching && (
          <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Search the connected supplier to see products you can bring into 1145.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- CATALOGUE */
const Catalogue: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const [filter, setFilter] = useState("pending_approval");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectFor, setRejectFor] = useState<string[] | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(
    () => admin.products.filter((p) =>
      (filter === "all" || p.status === filter) &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))),
    [admin.products, filter, search],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Search catalogue…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["pending_approval", "approved", "published", "rejected", "suspended", "all"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2 rounded-md border p-2">
          <span className="text-sm self-center px-1">{selected.size} selected</span>
          <Button size="sm" onClick={async () => { await admin.decide(Array.from(selected), "approve"); setSelected(new Set()); }}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={async () => { await admin.decide(Array.from(selected), "publish"); setSelected(new Set()); }}>
            Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectFor(Array.from(selected))}>
            <XCircle className="h-4 w-4 mr-2" />Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejectFor(Array.from(selected))}>
            Suspend
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => {
          const images = Array.isArray(p.images) ? p.images : [];
          return (
            <Card key={p.id} className={selected.has(p.id) ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-3 space-y-2 min-w-0">
                <div className="flex items-start gap-2">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <p className="text-sm font-medium line-clamp-2 flex-1 min-w-0">{p.name}</p>
                  <Badge variant="outline" className={statusTone[p.status] || ""}>{p.status.replace(/_/g, " ")}</Badge>
                </div>
                {images[0] && <img src={images[0]} alt={p.name} loading="lazy" className="w-full h-28 object-cover rounded-md bg-muted" />}
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Landed cost</span><span>{money(p.landed_cost_zar)}</span></div>
                  <div className="flex justify-between font-medium"><span>Recommended</span><span>{money(p.recommended_price_zar)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock</span><span>{p.stock}</span></div>
                </div>
                {p.rejection_reason && <p className="text-xs text-destructive">{p.rejection_reason}</p>}
              </CardContent>
            </Card>
          );
        })}
        {!rows.length && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="p-6 text-sm text-muted-foreground">Nothing here yet.</CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reason</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this product not suitable?" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (rejectFor) await admin.decide(rejectFor, "reject", reason);
              setRejectFor(null); setReason(""); setSelected(new Set());
            }}>Reject products</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ------------------------------------------------------------- INVENTORY */
const Inventory: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const groups = useMemo(() => {
    const live = admin.products.filter((p) => ["approved", "published"].includes(p.status));
    return {
      out: live.filter((p) => p.stock <= 0),
      low: live.filter((p) => p.stock > 0 && p.stock <= 5),
      ok: live.filter((p) => p.stock > 5),
      errors: admin.products.filter((p) => p.sync_status === "error"),
    };
  }, [admin.products]);

  const Section = ({ title, rows, tone }: { title: string; rows: any[]; tone?: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="truncate">{title}</span>
          <Badge variant="outline" className={tone}>{rows.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-72 overflow-y-auto">
        {rows.slice(0, 50).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{p.name}</span>
            <span className="shrink-0 text-muted-foreground">{p.sync_error ? "sync error" : `${p.stock} units`}</span>
          </div>
        ))}
        {!rows.length && <p className="text-sm text-muted-foreground">None.</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Out of stock" rows={groups.out} tone={healthTone.offline} />
      <Section title="Low stock" rows={groups.low} tone={healthTone.degraded} />
      <Section title="In stock" rows={groups.ok} tone={healthTone.healthy} />
      <Section title="Synchronisation errors" rows={groups.errors} tone={healthTone.offline} />
    </div>
  );
};

/* ---------------------------------------------------------------- ORDERS */
const Orders: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dropship_fulfillments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      {rows.map((f) => (
        <Card key={f.id}>
          <CardContent className="p-4 space-y-2">
            <div className="header-row">
              <div className="min-w-0">
                <p className="font-medium truncate">1145-{String(f.order_id).slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Supplier reference {f.supplier_order_number || "not created yet"}
                  {f.tracking_number ? ` · ${f.carrier || "carrier"} ${f.tracking_number}` : ""}
                </p>
              </div>
              <div className="header-actions">
                <Badge variant="outline">{String(f.status).replace(/_/g, " ")}</Badge>
                <span className="text-sm font-medium">{money(f.cost_total_zar)}</span>
              </div>
            </div>
            {f.last_error && <p className="text-xs text-destructive break-words">{f.last_error}</p>}
            {["awaiting_supplier_action", "supplier_failure"].includes(f.status) && (
              <Button size="sm" variant="outline" disabled={admin.busy}
                onClick={async () => { await admin.retryFulfillment(f.id); load(); }}>
                <RefreshCw className="h-4 w-4 mr-2" />Retry safely
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {!rows.length && <Card><CardContent className="p-6 text-sm text-muted-foreground">No dropshipping orders yet.</CardContent></Card>}
    </div>
  );
};

/* --------------------------------------------------------------- RETURNS */
const Returns: React.FC<{ admin: ReturnType<typeof useDropshipAdmin> }> = ({ admin }) => {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("dropship_returns").select("*").order("created_at", { ascending: false }).limit(100);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 space-y-2">
            <div className="header-row">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.reason}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Order 1145-{String(r.order_id).slice(0, 8).toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline">{r.status}</Badge>
            </div>
            {r.details && <p className="text-sm text-muted-foreground break-words">{r.details}</p>}
            {r.status === "requested" && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={admin.busy}
                  onClick={async () => { await admin.decideReturn(r.id, "approve", "Return approved."); load(); }}>
                  <Undo2 className="h-4 w-4 mr-2" />Approve
                </Button>
                <Button size="sm" variant="outline" disabled={admin.busy}
                  onClick={async () => { await admin.decideReturn(r.id, "reject", "Return declined."); load(); }}>
                  Decline
                </Button>
              </div>
            )}
            {r.status === "approved" && (
              <Button size="sm" variant="secondary" disabled={admin.busy}
                onClick={async () => { await admin.processRefund(r.order_id, Number(r.refund_amount || 0), r.id); load(); }}>
                Refund to wallet
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {!rows.length && <Card><CardContent className="p-6 text-sm text-muted-foreground">No return requests.</CardContent></Card>}
    </div>
  );
};

/* ---------------------------------------------------------------- ERRORS */
const Errors: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [hooks, setHooks] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [l, w] = await Promise.all([
        supabase.from("dropship_api_logs").select("*").eq("success", false).order("created_at", { ascending: false }).limit(50),
        supabase.from("dropship_webhook_events").select("*").order("created_at", { ascending: false }).limit(30),
      ]);
      setLogs(l.data || []);
      setHooks(w.data || []);
    })();
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Supplier errors</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="text-sm border-b pb-2 last:border-0">
              <div className="flex justify-between gap-2">
                <span className="font-medium truncate">{l.endpoint}</span>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-destructive break-words">{l.error_message}</p>
            </div>
          ))}
          {!logs.length && <p className="text-sm text-muted-foreground">No errors recorded.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent supplier events</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-96 overflow-y-auto">
          {hooks.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{h.event_type}</span>
              <Badge variant="outline" className={h.signature_valid ? healthTone.healthy : healthTone.offline}>
                {h.signature_valid ? (h.processed ? "applied" : "pending") : "rejected"}
              </Badge>
            </div>
          ))}
          {!hooks.length && <p className="text-sm text-muted-foreground">No supplier events received.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDropshipping;
