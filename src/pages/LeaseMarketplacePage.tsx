import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import CreditScoreCard from "@/components/leasing/CreditScoreCard";
import { Search, SlidersHorizontal, Star, MapPin, Calendar, Shield, TrendingUp, Car, CreditCard, Monitor, Wrench, ChefHat, Printer, ArrowRight, Eye } from "lucide-react";

const CATEGORY_ICONS: Record<string, any> = {
  'vehicles': Car, 'pos-systems': CreditCard, 'kitchen-equipment': ChefHat,
  'electronics': Monitor, 'tools-machinery': Wrench, 'office-equipment': Printer,
};

const CONDITION_LABELS: Record<string, string> = {
  'new': 'New', 'like_new': 'Like New', 'good': 'Good', 'fair': 'Fair', 'refurbished': 'Refurbished',
};

interface AssetListing {
  id: string; title: string; description?: string; category: string;
  images: string[] | null; lease_price_monthly: number; lease_price_weekly?: number;
  lease_price_daily?: number; security_deposit: number; condition?: string;
  is_available?: boolean; lease_to_own?: boolean; insurance_required?: boolean;
  min_lease_duration_months?: number; max_lease_duration_months?: number;
  brand?: string; model?: string; location_address?: string; rating?: number;
  review_count?: number; views_count?: number; featured?: boolean; total_leases?: number;
}

const LeaseMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetListing[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [priceRange, setPriceRange] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assetsRes, catsRes] = await Promise.all([
      supabase.from("leaseable_assets").select("*").eq("is_available", true).in("status", ["active"]),
      supabase.from("lease_asset_categories").select("*").eq("is_active", true).order("sort_order"),
    ]);
    setAssets((assetsRes.data || []) as any);
    setCategories(catsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = assets.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && 
        !(a.brand || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory !== "all" && a.category.toLowerCase() !== selectedCategory) return false;
    if (priceRange === "under1000" && a.lease_price_monthly >= 1000) return false;
    if (priceRange === "1000-5000" && (a.lease_price_monthly < 1000 || a.lease_price_monthly > 5000)) return false;
    if (priceRange === "5000-15000" && (a.lease_price_monthly < 5000 || a.lease_price_monthly > 15000)) return false;
    if (priceRange === "over15000" && a.lease_price_monthly < 15000) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "price_low") return a.lease_price_monthly - b.lease_price_monthly;
    if (sortBy === "price_high") return b.lease_price_monthly - a.lease_price_monthly;
    if (sortBy === "popular") return (b.total_leases || 0) - (a.total_leases || 0);
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="max-w-2xl">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
              <TrendingUp className="h-3 w-3 mr-1" />Powered by 1145 Behavioral Credit
            </Badge>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Lease Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Access vehicles, equipment & more — scored by your platform performance, not your bank.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets, brands, models..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-12 rounded-xl" />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48 h-12 rounded-xl"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="w-full sm:w-44 h-12 rounded-xl"><SelectValue placeholder="Price Range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Price</SelectItem>
                <SelectItem value="under1000">Under R1,000/mo</SelectItem>
                <SelectItem value="1000-5000">R1,000 – R5,000</SelectItem>
                <SelectItem value="5000-15000">R5,000 – R15,000</SelectItem>
                <SelectItem value="over15000">R15,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            {user && <CreditScoreCard compact />}
            
            {/* Categories */}
            <Card className="border-0 ring-1 ring-border">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Categories</p>
                <button onClick={() => setSelectedCategory("all")} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                  All Assets
                </button>
                {categories.map(c => {
                  const Icon = CATEGORY_ICONS[c.slug] || Monitor;
                  return (
                    <button key={c.id} onClick={() => setSelectedCategory(c.slug)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${selectedCategory === c.slug ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                      <Icon className="h-4 w-4" />{c.name}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Sort */}
            <Card className="border-0 ring-1 ring-border">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Sort By</p>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price_low">Price: Low → High</SelectItem>
                    <SelectItem value="price_high">Price: High → Low</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Asset Grid */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">{filtered.length} asset{filtered.length !== 1 ? 's' : ''} available</p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <SlidersHorizontal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-1">No Assets Found</h3>
                  <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(asset => (
                  <Card key={asset.id} className="group border-0 ring-1 ring-border overflow-hidden hover:shadow-lg hover:ring-primary/30 transition-all cursor-pointer" onClick={() => navigate(`/lease/apply/${asset.id}`)}>
                    <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                      {asset.images?.[0] ? (
                        <img src={asset.images[0]} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {(() => { const Icon = CATEGORY_ICONS[asset.category.toLowerCase()] || Monitor; return <Icon className="h-16 w-16 text-muted-foreground/30" />; })()}
                        </div>
                      )}
                      {asset.featured && <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">Featured</Badge>}
                      {asset.lease_to_own && <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-white border-0">Lease-to-Own</Badge>}
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        {asset.insurance_required && <Badge variant="secondary" className="text-xs"><Shield className="h-3 w-3 mr-0.5" />Insured</Badge>}
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{asset.title}</h3>
                          <p className="text-xs text-muted-foreground">{asset.brand} {asset.model}</p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">{CONDITION_LABELS[asset.condition || 'new'] || asset.condition}</Badge>
                      </div>

                      {asset.location_address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{asset.location_address}</p>
                      )}

                      <div className="flex items-center gap-2">
                        {(asset.rating || 0) > 0 && (
                          <span className="flex items-center gap-0.5 text-xs"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{(asset.rating || 0).toFixed(1)}</span>
                        )}
                        {(asset.total_leases || 0) > 0 && (
                          <span className="text-xs text-muted-foreground">{asset.total_leases} leased</span>
                        )}
                        {(asset.views_count || 0) > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Eye className="h-3 w-3" />{asset.views_count}</span>
                        )}
                      </div>

                      <div className="pt-2 border-t flex items-end justify-between">
                        <div>
                          <p className="text-xl font-black tracking-tight">{formatCurrency(asset.lease_price_monthly)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                          {asset.lease_price_weekly && <p className="text-xs text-muted-foreground">{formatCurrency(asset.lease_price_weekly)}/week</p>}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Deposit: {formatCurrency(asset.security_deposit)}</p>
                          <p>{asset.min_lease_duration_months || 1}–{asset.max_lease_duration_months || 24} mo</p>
                        </div>
                      </div>

                      <Button className="w-full rounded-lg mt-2" size="sm">
                        Apply Now <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaseMarketplacePage;
