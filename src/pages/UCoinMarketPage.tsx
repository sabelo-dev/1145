import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Coins, Search, Wallet } from "lucide-react";
import { useUCoin } from "@/hooks/useUCoin";
import { useAuth } from "@/contexts/AuthContext";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";
import { stripHtml } from "@/lib/utils";

interface MarketItem {
  id: string;
  name: string;
  description: string | null;
  images: any;
  category: string | null;
  stock: number;
  price_zar: number;
  store_product_id: string | null;
  created_at: string;
}

const PLACEHOLDER = "/placeholder.svg";

const firstImage = (raw: any): string => {
  if (Array.isArray(raw)) {
    const found = raw.find((i) => typeof i === "string" && i.length > 0);
    if (found) return found;
  }
  if (typeof raw === "string" && raw) return raw;
  return PLACEHOLDER;
};

const ucoinPrice = (zar: number) => Math.ceil(Number(zar || 0) / UCOIN_RAND_VALUE);

const UCoinMarketPage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { user } = useAuth();
  const { wallet } = useUCoin();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);

  const balance = wallet?.balance ?? 0;

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("dropship_public_products")
        .select("*")
        .not("store_product_id", "is", null)
        .gt("stock", 0)
        .order("price_zar", { ascending: true })
        .limit(200);
      if (!active) return;
      setItems(((data as any[]) || []) as MarketItem[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (term && !stripHtml(item.name || "").toLowerCase().includes(term)) return false;
      if (affordableOnly && ucoinPrice(item.price_zar) > balance) return false;
      return true;
    });
  }, [items, search, affordableOnly, balance]);

  return (
    <div ref={ref} className="min-h-screen bg-background">
      <SEO
        title="UCoin Market | Spend your mining rewards on real goods"
        description="Turn the UCoin you mined into real products. Every UCoin is worth R0.10 at checkout on 1145 Lifestyle."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="header-row">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Coins className="h-6 w-6 text-gold shrink-0" />
                UCoin Market
              </h1>
              <p className="text-sm text-muted-foreground">
                Spend the UCoin you mined on real products. 1 UCoin = R0.10 at checkout.
              </p>
            </div>
            <div className="header-actions">
              <Card className="border-gold/40">
                <CardContent className="p-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-gold" />
                  <div className="leading-tight">
                    <p className="text-sm font-semibold">{balance.toLocaleString()} UCoin</p>
                    <p className="text-[11px] text-muted-foreground">
                      worth R{(balance * UCOIN_RAND_VALUE).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search the UCoin market"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant={affordableOnly ? "default" : "outline"}
            onClick={() => setAffordableOnly((v) => !v)}
            disabled={!user}
          >
            What I can afford
          </Button>
        </div>

        {loading ? (
          <div className="auto-grid gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nothing matches yet. Mine a few more UCoin or clear the filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const coins = ucoinPrice(item.price_zar);
              const affordable = coins <= balance;
              return (
                <Card key={item.id} className="overflow-hidden flex flex-col">
                  <Link to={`/dropship/product/${item.id}`} className="block">
                    <img
                      src={firstImage(item.images)}
                      alt={stripHtml(item.name)}
                      loading="lazy"
                      className="h-40 w-full object-cover bg-muted"
                    />
                  </Link>
                  <CardContent className="p-3 flex flex-col gap-2 flex-1 min-w-0">
                    <Link to={`/dropship/product/${item.id}`} className="text-sm font-medium line-clamp-2 hover:underline">
                      {stripHtml(item.name)}
                    </Link>
                    <div className="mt-auto space-y-1">
                      <div className="flex items-center gap-1 text-gold font-semibold text-sm">
                        <Coins className="h-3.5 w-3.5 shrink-0" />
                        {coins.toLocaleString()} UCoin
                      </div>
                      <p className="text-xs text-muted-foreground">or R{Number(item.price_zar).toFixed(2)}</p>
                      <Badge variant={affordable ? "default" : "secondary"} className="text-[11px]">
                        {user ? (affordable ? "You can buy this" : `${(coins - balance).toLocaleString()} UCoin short`) : "Sign in to pay with UCoin"}
                      </Badge>
                    </div>
                    <Button asChild size="sm" className="w-full">
                      <Link to={`/dropship/product/${item.id}`}>View item</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

UCoinMarketPage.displayName = "UCoinMarketPage";

export default UCoinMarketPage;
