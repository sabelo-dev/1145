import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Search, Wallet } from "lucide-react";
import { useUCoin } from "@/hooks/useUCoin";
import { useAuth } from "@/contexts/AuthContext";
import { UCOIN_RAND_VALUE } from "@/types/ucoin";
import { stripHtml } from "@/lib/utils";
import { useUCoinListings } from "@/hooks/useUCoinListings";
import UCoinListingCard from "@/components/ucoin/UCoinListingCard";
import SellItemDialog from "@/components/ucoin/SellItemDialog";


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
        </TabsContent>

        <TabsContent value="community" className="mt-4 space-y-4">
          <div className="header-row">
            <p className="text-sm text-muted-foreground min-w-0">
              Items listed by other members. Pay the seller directly in UCoin.
            </p>
            <div className="header-actions">
              {user ? (
                <SellItemDialog busy={busy} onUpload={uploadImages} onCreate={createListing} />
              ) : (
                <Button asChild size="sm"><Link to="/login">Sign in to sell</Link></Button>
              )}
            </div>
          </div>

          {listingsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72" />)}
            </div>
          ) : filteredListings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No member items yet. Be the first to list something for UCoin.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredListings.map((listing) => (
                <UCoinListingCard
                  key={listing.id}
                  listing={listing}
                  balance={balance}
                  isOwner={listing.seller_id === user?.id}
                  signedIn={!!user}
                  busy={busy}
                  onBuy={buyListing}
                  onBid={placeBid}
                  onCancel={cancelListing}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4 space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-3">Items I'm selling</h2>
            {myListings.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't listed anything yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {myListings.map((listing) => (
                    <UCoinListingCard
                      key={listing.id}
                      listing={listing}
                      balance={balance}
                      isOwner
                      signedIn={!!user}
                      busy={busy}
                      onBuy={buyListing}
                      onBid={placeBid}
                      onCancel={cancelListing}
                    />
                  ))}
                </div>

                {myListings.some((l) => (bidsByListing[l.id] || []).some((b) => b.status === "active")) && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <h3 className="text-sm font-semibold">Offers waiting for you</h3>
                      {myListings.flatMap((l) =>
                        (bidsByListing[l.id] || [])
                          .filter((b) => b.status === "active")
                          .map((b) => (
                            <div key={b.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
                              <div className="min-w-0">
                                <p className="text-sm truncate">{l.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {b.amount_ucoin.toLocaleString()} UCoin offered
                                </p>
                              </div>
                              <Button size="sm" disabled={busy} onClick={() => acceptBid(b.id)}>
                                Accept
                              </Button>
                            </div>
                          )),
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">Items I've bought</h2>
            {myPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing bought with UCoin yet.</p>
            ) : (
              <div className="space-y-2">
                {myPurchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
                    <p className="text-sm truncate min-w-0">{p.title}</p>
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      {(p.sold_price_ucoin || p.price_ucoin).toLocaleString()} UCoin
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        </Tabs>

      </div>
    </div>
  );
});

UCoinMarketPage.displayName = "UCoinMarketPage";

export default UCoinMarketPage;
