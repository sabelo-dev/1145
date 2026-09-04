import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Search, ShoppingBag, Truck } from "lucide-react";

interface MarketplaceItem {
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

const MarketplacePage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("dropship_public_products")
        .select("*")
        .not("store_product_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setItems(((data as any[]) || []) as MarketplaceItem[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])),
    [items],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        Number(i.stock) > 0 &&
        (category === "all" || i.category === category) &&
        (!term || i.name.toLowerCase().includes(term)),
    );
    if (sort === "price_low") list.sort((a, b) => Number(a.price_zar) - Number(b.price_zar));
    if (sort === "price_high") list.sort((a, b) => Number(b.price_zar) - Number(a.price_zar));
    return list;
  }, [items, search, category, sort]);

  return (
    <div ref={ref} className="container mx-auto px-4 py-6 space-y-5">
      <SEO
        title="1145 Marketplace | Shop curated products in South Africa"
        description="Browse curated 1145 Marketplace products with ZAR pricing, secure checkout and door-to-door delivery across South Africa."
      />

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">1145 Marketplace</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Curated products, priced in Rand, delivered to your door. Secure checkout with instant order tracking.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the marketplace…"
            className="pl-9"
            aria-label="Search the marketplace"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_low">Price: low to high</SelectItem>
            <SelectItem value="price_high">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((item) => (
            <Link
              key={item.id}
              to={`/cj/product/${item.id}`}
              className="group rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col min-w-0 transition-shadow hover:shadow-lg"
            >
              <div className="aspect-square bg-muted overflow-hidden">
                <img
                  src={firstImage(item.images)}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                />
              </div>
              <div className="p-3 space-y-1.5 flex-1 flex flex-col min-w-0">
                {item.category && (
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                    {item.category}
                  </span>
                )}
                <h2 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {item.name}
                </h2>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <span className="font-bold text-sm">{formatCurrency(Number(item.price_zar))}</span>
                  <Badge variant="secondary" className="text-[10px]">In stock</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
          <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No in-stock marketplace products right now. Check back soon.</p>
          <Button asChild variant="outline"><Link to="/shop">Browse the shop</Link></Button>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Truck className="h-3.5 w-3.5" /> Orders are placed with our suppliers only after your payment is confirmed.
      </p>
    </div>
  );
});

MarketplacePage.displayName = "MarketplacePage";

export default MarketplacePage;
