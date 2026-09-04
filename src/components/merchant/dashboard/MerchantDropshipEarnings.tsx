import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDropshipMerchant } from "@/hooks/useDropshipping";
import { stripHtml } from "@/lib/utils";
import { Coins, Percent, RefreshCw, ShoppingBag, TrendingUp } from "lucide-react";

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

const MerchantDropshipEarnings: React.FC = () => {
  const m = useDropshipMerchant();

  if (m.loading) return <Skeleton className="h-96 w-full" />;

  const totals = m.earnings?.totals || { revenue: 0, cost: 0, profit: 0, units: 0, margin_pct: 0 };
  const rows = m.earnings?.products || [];

  return (
    <div className="space-y-4 min-w-0">
      <div className="header-row">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">Dropshipping earnings</h2>
          <p className="text-sm text-muted-foreground truncate">
            What each product sold, what it cost you and what you kept
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
        <Stat label="Sales" value={money(totals.revenue)} icon={ShoppingBag} />
        <Stat label="Product costs" value={money(totals.cost)} icon={Coins} />
        <Stat label="Profit kept" value={money(totals.profit)} icon={TrendingUp} />
        <Stat label="Profit margin" value={`${Number(totals.margin_pct || 0).toFixed(1)}%`} icon={Percent} />
      </div>

      <div className="space-y-3">
        {rows.map((p) => (
          <Card key={p.listing_id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3 min-w-0">
                {p.image && (
                  <img src={p.image} alt={stripHtml(p.name)} loading="lazy"
                    className="h-14 w-14 rounded-md object-cover bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium line-clamp-2">{stripHtml(p.name)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.units_sold} sold · {p.orders} order{p.orders === 1 ? "" : "s"} · {p.stock} in stock
                  </p>
                </div>
                <Badge variant={p.status === "published" ? "default" : "secondary"} className="shrink-0">
                  {p.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Your price</p>
                  <p className="font-medium">{money(p.selling_price)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cost each</p>
                  <p className="font-medium">{money(p.unit_cost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sales</p>
                  <p className="font-medium">{money(p.revenue_zar)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Profit</p>
                  <p className={`font-medium ${p.profit_zar >= 0 ? "text-primary" : "text-destructive"}`}>
                    {money(p.profit_zar)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!rows.length && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nothing has sold yet. Publish products to your store and your earnings will appear here.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MerchantDropshipEarnings;
