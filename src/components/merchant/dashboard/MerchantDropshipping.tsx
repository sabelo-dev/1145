import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDropshipMerchant } from "@/hooks/useDropshipping";
import { stripHtml } from "@/lib/utils";
import { Boxes, ExternalLink, RefreshCw, Search, Store, Truck, TrendingUp } from "lucide-react";

const money = (v: number | null | undefined) =>
  `R${Number(v ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Stat = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: any }) => (
  <Card>
    <CardContent className="p-4 flex flex-col items-start gap-1 min-w-0">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xl font-semibold truncate w-full">{value}</span>
      <span className="text-xs text-muted-foreground truncate w-full">{label}</span>
    </CardContent>
  </Card>
);

const MerchantDropshipping: React.FC = () => {
  const m = useDropshipMerchant();
  const [tab, setTab] = useState("catalogue");
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [confirmOrder, setConfirmOrder] = useState<any | null>(null);
  const [fxMode, setFxMode] = useState<"live" | "manual">("live");
  const [manualRate, setManualRate] = useState("");
  const [margin, setMargin] = useState("0");
  const [autoFulfill, setAutoFulfill] = useState(true);

  useEffect(() => {
    setFxMode(m.settings.fx_mode);
    setManualRate(m.settings.manual_fx_rate ? String(m.settings.manual_fx_rate) : "");
    setMargin(String(m.settings.fx_margin_pct ?? 0));
    setAutoFulfill(m.settings.auto_fulfill);
  }, [m.settings]);

  const listedIds = useMemo(
    () => new Set(m.listings.map((l: any) => l.dropship_product_id)),
    [m.listings],
  );

  const catalogue = useMemo(
    () =>
      m.catalogue
        .filter((p) => Number(p.stock ?? 0) > 0)
        .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [m.catalogue, search],
  );

  if (m.loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4 min-w-0">
      <div className="header-row">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">My storefront products</h2>
          <p className="text-sm text-muted-foreground truncate">
            Browse approved products and publish them to your own store
          </p>
        </div>
        <div className="header-actions">
          {m.store?.slug && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/store/${m.store.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline sm:ml-2">View my store</span>
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={m.reload} disabled={m.busy}>
            <RefreshCw className={`h-4 w-4 ${m.busy ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline sm:ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {m.fx?.rate ? (
        <p className="text-xs text-muted-foreground">
          Supplier prices are in US dollars and are converted to rand automatically at
          {" "}<span className="font-medium text-foreground">R{m.fx.rate.toFixed(2)} per $1</span>
          {" "}before anything is published.
        </p>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Products in your store" value={m.summary?.products?.total ?? m.listings.length} icon={Store} />
        <Stat
          label="Published"
          value={m.summary?.products?.published ?? m.listings.filter((l: any) => l.status === "published").length}
          icon={Boxes}
        />
        <Stat label="Orders" value={m.summary?.orders?.total ?? m.fulfillments.length} icon={Truck} />
        <Stat label="Profit earned" value={money(m.summary?.sales?.profit)} icon={TrendingUp} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="catalogue">Find products</TabsTrigger>
          <TabsTrigger value="listings">My products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="pricing">Pricing &amp; rate</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search approved products…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogue.map((p) => {
              const images = Array.isArray(p.images) ? (p.images as string[]) : [];
              const added = listedIds.has(p.id);
              const typed = prices[p.id] ? Number(prices[p.id]) : Number(p.recommended_price_zar || 0);
              const profit = typed - Number(p.landed_cost_zar || 0);
              return (
                <Card key={p.id}>
                  <CardContent className="p-3 space-y-2 min-w-0">
                    {images[0] && (
                      <img src={images[0]} alt={p.name} loading="lazy"
                        className="w-full h-32 object-cover rounded-md bg-muted" />
                    )}
                    <p className="text-sm font-medium line-clamp-2">{stripHtml(p.name)}</p>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Your cost</span>
                        <span className="font-medium">{money(p.landed_cost_zar)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Recommended price</span>
                        <span className="font-medium">{money(p.recommended_price_zar)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Your profit</span>
                        <span className={profit > 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                          {money(profit)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">In stock</span>
                        <span>{p.stock}</span>
                      </div>
                    </div>
                    <Input type="number" inputMode="decimal"
                      placeholder={`Your price (${money(p.recommended_price_zar)})`}
                      value={prices[p.id] ?? ""} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })} />
                    <div className="flex flex-col gap-2">
                      <Button size="sm" className="w-full" disabled={added || m.busy}
                        onClick={() => m.addAndPublish(p.id, prices[p.id] ? Number(prices[p.id]) : undefined)}>
                        {added ? "Already in your store" : "Publish to my store"}
                      </Button>
                      {!added && (
                        <Button size="sm" variant="outline" className="w-full" disabled={m.busy}
                          onClick={() => m.addToStore(p.id, prices[p.id] ? Number(prices[p.id]) : undefined)}>
                          Save as draft
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!catalogue.length && (
              <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No in-stock approved products are available yet. Check back once 1145 approves new stock.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-3">
          {m.listings.map((l: any) => (
            <Card key={l.id}>
              <CardContent className="p-4 space-y-3">
                <div className="header-row">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.dropship_products?.name || "Product"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Cost {money(l.dropship_products?.landed_cost_zar)} · Stock {l.dropship_products?.stock ?? 0}
                    </p>
                  </div>
                  <div className="header-actions">
                    <Badge variant={l.status === "published" ? "default" : "secondary"}>{l.status}</Badge>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input type="number" defaultValue={l.selling_price}
                    onBlur={(e) => Number(e.target.value) !== Number(l.selling_price) &&
                      m.updateListing(l.id, { selling_price: Number(e.target.value) })}
                    className="sm:max-w-40" />
                  {l.status === "published" ? (
                    <Button size="sm" variant="outline" onClick={() => m.unpublish(l.id)} disabled={m.busy}>Unpublish</Button>
                  ) : (
                    <Button size="sm" onClick={() => m.publish(l.id)} disabled={m.busy}>Publish</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => m.remove(l.id)} disabled={m.busy}>Remove</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!m.listings.length && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">You have not added any products yet.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            {m.settings.auto_fulfill
              ? "Paid orders are sent to the supplier automatically. You can also send one now."
              : "You send paid orders to the supplier yourself from here."}
          </p>
          {m.orders.map((row: any) => {
            const f = row.fulfillment;
            const sent = !!f?.supplier_order_number;
            return (
              <Card key={row.order.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="header-row">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {row.order.order_number || `1145-${String(row.order.id).slice(0, 8).toUpperCase()}`}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {row.lines.map((l: any) => `${l.quantity} × ${stripHtml(l.name)}`).join(", ")}
                      </p>
                    </div>
                    <div className="header-actions">
                      <Badge variant="outline">
                        {f ? String(f.status).replace(/_/g, " ") : "waiting to be sent"}
                      </Badge>
                      <span className="text-sm font-medium">{money(row.merchant_total)}</span>
                    </div>
                  </div>
                  {f?.tracking_number && (
                    <p className="text-xs text-muted-foreground break-all">
                      {f.carrier || "Courier"} · {f.tracking_number}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!sent && (
                      <Button size="sm" disabled={m.busy} onClick={() => setConfirmOrder(row)}>
                        Send to supplier
                      </Button>
                    )}
                    {sent && (
                      <Button size="sm" variant="outline" disabled={m.busy}
                        onClick={() => m.trackShipment(f.id)}>
                        <RefreshCw className="h-4 w-4 mr-2" />Refresh status
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/orders/${row.order.id}/tracking`}>Delivery status</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!m.orders.length && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No orders for your products yet.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="font-medium">Dollar to rand rate</p>
                <p className="text-xs text-muted-foreground">
                  Today's live rate is R{Number(m.fx?.live_rate ?? m.fx?.rate ?? 0).toFixed(2)} per $1.
                  Your products are priced at R{Number(m.fx?.rate ?? 0).toFixed(2)} per $1.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={fxMode === "live" ? "default" : "outline"}
                  onClick={() => setFxMode("live")}>Use the live rate</Button>
                <Button size="sm" variant={fxMode === "manual" ? "default" : "outline"}
                  onClick={() => setFxMode("manual")}>Set my own rate</Button>
              </div>
              {fxMode === "manual" && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Rand per $1</label>
                  <Input type="number" inputMode="decimal" value={manualRate}
                    placeholder={String(m.fx?.live_rate ?? "18.50")}
                    onChange={(e) => setManualRate(e.target.value)} className="sm:max-w-40" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Extra safety margin (%)</label>
                <Input type="number" inputMode="decimal" value={margin}
                  onChange={(e) => setMargin(e.target.value)} className="sm:max-w-40" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Send paid orders automatically</p>
                  <p className="text-xs text-muted-foreground">
                    Turn this off to send each order to the supplier yourself.
                  </p>
                </div>
                <Switch checked={autoFulfill} onCheckedChange={setAutoFulfill} />
              </div>
              <Button size="sm" disabled={m.busy}
                onClick={() => m.saveSettings({
                  fx_mode: fxMode,
                  manual_fx_rate: fxMode === "manual" ? Number(manualRate) : null,
                  fx_margin_pct: Number(margin || 0),
                  auto_fulfill: autoFulfill,
                })}>
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirmOrder} onOpenChange={(open) => !open && setConfirmOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this order to the supplier?</DialogTitle>
            <DialogDescription>
              The supplier will pack and ship it. This cannot be undone from here.
            </DialogDescription>
          </DialogHeader>
          {confirmOrder && (
            <div className="text-sm space-y-1">
              <p className="font-medium">
                {confirmOrder.order.order_number || `1145-${String(confirmOrder.order.id).slice(0, 8).toUpperCase()}`}
              </p>
              <p className="text-muted-foreground">
                {confirmOrder.lines.map((l: any) => `${l.quantity} × ${stripHtml(l.name)}`).join(", ")}
              </p>
              <p className="font-medium">{money(confirmOrder.merchant_total)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOrder(null)}>Cancel</Button>
            <Button disabled={m.busy}
              onClick={async () => {
                const row = confirmOrder;
                setConfirmOrder(null);
                if (row) await m.submitToSupplier(row.order.id);
              }}>
              Yes, send it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MerchantDropshipping;
