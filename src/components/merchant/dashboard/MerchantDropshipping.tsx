import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDropshipMerchant } from "@/hooks/useDropshipping";
import { Boxes, RefreshCw, Search, Store, Truck, TrendingUp } from "lucide-react";

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

  const listedIds = useMemo(
    () => new Set(m.listings.map((l: any) => l.dropship_product_id)),
    [m.listings],
  );

  const catalogue = useMemo(
    () => m.catalogue.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [m.catalogue, search],
  );

  if (m.loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4 min-w-0">
      <div className="header-row">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">Dropshipping</h2>
          <p className="text-sm text-muted-foreground truncate">
            Sell approved products without holding stock
          </p>
        </div>
        <div className="header-actions">
          <Button variant="outline" size="sm" onClick={m.reload} disabled={m.busy}>
            <RefreshCw className={`h-4 w-4 ${m.busy ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline sm:ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Products in your store" value={m.summary?.listings ?? m.listings.length} icon={Store} />
        <Stat label="Published" value={m.summary?.published ?? m.listings.filter((l: any) => l.status === "published").length} icon={Boxes} />
        <Stat label="Orders" value={m.summary?.orders ?? m.fulfillments.length} icon={Truck} />
        <Stat label="Profit earned" value={money(m.summary?.profit)} icon={TrendingUp} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="catalogue">Find products</TabsTrigger>
          <TabsTrigger value="listings">My products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
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
              return (
                <Card key={p.id}>
                  <CardContent className="p-3 space-y-2 min-w-0">
                    {images[0] && (
                      <img src={images[0]} alt={p.name} loading="lazy"
                        className="w-full h-32 object-cover rounded-md bg-muted" />
                    )}
                    <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recommended price</span>
                        <span className="font-medium">{money(p.recommended_price_zar)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock</span>
                        <span>{p.stock}</span>
                      </div>
                    </div>
                    <Input type="number" placeholder={`Your price (${money(p.recommended_price_zar)})`}
                      value={prices[p.id] ?? ""} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value })} />
                    <Button size="sm" className="w-full" disabled={added || m.busy}
                      onClick={() => m.addToStore(p.id, prices[p.id] ? Number(prices[p.id]) : undefined)}>
                      {added ? "Already in your store" : "Add to my store"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {!catalogue.length && (
              <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No approved products are available yet. Check back once 1145 approves new stock.
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
          {m.fulfillments.map((f: any) => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="header-row">
                  <div className="min-w-0">
                    <p className="font-medium truncate">1145-{String(f.order_id).slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {f.tracking_number ? `${f.carrier || "Courier"} · ${f.tracking_number}` : "Awaiting dispatch"}
                    </p>
                  </div>
                  <Badge variant="outline">{String(f.status).replace(/_/g, " ")}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {!m.fulfillments.length && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No dropshipping orders yet.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MerchantDropshipping;
