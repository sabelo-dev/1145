import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin, Calendar, Clock, ArrowRight, Car, Package, Users, Shield,
  ShoppingBag, Wallet, Briefcase, KeyRound, Megaphone, Building2, Sparkles, TrendingUp, Zap, Star,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SEO from "@/components/SEO";
import ProductGrid from "@/components/shop/ProductGrid";
import { Product } from "@/types";
import { fetchFeaturedProducts, fetchPopularProducts, fetchNewArrivals, fetchFeaturedBrands, FeaturedBrand } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const services = [
  { name: "Shop", desc: "Marketplace", icon: ShoppingBag, href: "/shop", tag: "Popular" },
  { name: "Travel", desc: "Request a ride", icon: Car, href: "/rides/request" },
  { name: "Package", desc: "Send parcels", icon: Package, href: "/package/send" },
  { name: "Wallet", desc: "Money & Gold", icon: Wallet, href: "/wallet" },
  { name: "Lease", desc: "Rent-to-own", icon: KeyRound, href: "/lease/marketplace", tag: "New" },
  { name: "Business", desc: "Merchant tools", icon: Briefcase, href: "/merchant/dashboard" },
  { name: "Influence", desc: "Creator hub", icon: Megaphone, href: "/influencer/login" },
  { name: "Stay", desc: "Book a stay", icon: Building2, href: "/stays", tag: "New" },
];


const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [when, setWhen] = useState("now");
  const [featured, setFeatured] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedBrand[]>([]);
  const [activeRide, setActiveRide] = useState<{ id: string; pickup_address: string; dropoff_address: string; status: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [f, t, n, b] = await Promise.all([
          fetchFeaturedProducts(4),
          fetchPopularProducts(4),
          fetchNewArrivals(4),
          fetchFeaturedBrands(6),
        ]);
        setFeatured(f || []);
        setTrending(t || []);
        setNewArrivals(n || []);
        setFeaturedBrands(b || []);
      } catch (e) {
        console.error("Home load failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveRide(null);
      return;
    }

    const activeStatuses = ["requested", "searching", "accepted", "arriving", "in_progress"];
    const loadActiveRide = async () => {
      const { data } = await supabase
        .from("rides")
        .select("id, pickup_address, dropoff_address, status")
        .eq("passenger_id", user.id)
        .in("status", activeStatuses)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveRide(data);
    };

    void loadActiveRide();
    const channel = supabase
      .channel(`home-active-ride-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rides", filter: `passenger_id=eq.${user.id}` }, () => {
        void loadActiveRide();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (pickup) params.set("pickup", pickup);
    if (destination) params.set("destination", destination);
    navigate(`/rides/request?${params.toString()}`);
  };

  const handlePackageQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({
      mode: "package",
      pickup: senderAddress.trim(),
      destination: recipientAddress.trim(),
    });
    navigate(`/rides/request?${params.toString()}`);
  };

  const handleShopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = shopSearch.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  return (
    <div ref={ref} className="min-h-screen bg-background text-foreground">
      <SEO
        title="1145 Lifestyle — Shop, Ride, Earn"
        description="One platform for shopping, rides, deliveries, stays, and wallet — reimagined for South Africa."
        keywords="1145, shop, ride, wallet, stays, marketplace, south africa"
      />
      <Header />

      {/* HERO */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div className="space-y-6">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05]"
            >
              Go anywhere. Get anything. <span className="text-text-secondary">All with <span className="text-brand">1145</span>.</span>
            </motion.h1>

            <Tabs defaultValue="ride" className="w-full">
              <TabsList className="bg-transparent p-0 h-auto gap-6 border-b border-border rounded-none w-full justify-start">
                <TabsTrigger value="ride" className="text-text-secondary hover:text-brand hover:bg-surface-hover rounded-t-md data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-brand rounded-b-none px-2 pb-3 text-sm font-medium">
                  <Car className="h-4 w-4 mr-2" /> Ride
                </TabsTrigger>
                <TabsTrigger value="package" className="text-text-secondary hover:text-brand hover:bg-surface-hover rounded-t-md data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-brand rounded-b-none px-2 pb-3 text-sm font-medium">
                  <Package className="h-4 w-4 mr-2" /> Package & Send
                </TabsTrigger>
                <TabsTrigger value="shop" className="text-text-secondary hover:text-brand hover:bg-surface-hover rounded-t-md data-[state=active]:border-b-2 data-[state=active]:border-brand data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:[&_svg]:text-brand rounded-b-none px-2 pb-3 text-sm font-medium">
                  <ShoppingBag className="h-4 w-4 mr-2" /> Shop
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ride" className="mt-5">
                <form onSubmit={handleRequest} className="space-y-2.5">
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                    <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location" className="pl-11 h-12 text-sm bg-surface-input border border-transparent rounded-md text-foreground placeholder:text-text-secondary hover:bg-surface-hover focus:bg-background focus:border-brand focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                    <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Dropoff location" className="pl-11 h-12 text-sm bg-surface-input border border-transparent rounded-md text-foreground placeholder:text-text-secondary hover:bg-surface-hover focus:bg-background focus:border-brand focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                      <select value={when} onChange={(e) => setWhen(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-surface-input rounded-md text-sm text-foreground appearance-none border border-transparent transition-colors hover:bg-surface-hover focus:bg-background focus:border-brand focus:outline-none">
                        <option value="now">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="later">Pick a date</option>
                      </select>
                    </div>
                    <div className="relative group">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                      <select className="w-full h-12 pl-11 pr-4 bg-surface-input rounded-md text-sm text-foreground appearance-none border border-transparent transition-colors hover:bg-surface-hover focus:bg-background focus:border-brand focus:outline-none">
                        <option>Now</option><option>In 15 min</option><option>In 30 min</option><option>In 1 hour</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button type="submit" variant="cta" disabled={!pickup.trim() || !destination.trim()} className="h-11 px-6 font-semibold">See prices</Button>
                    <Link to="/login" className="inline-flex items-center h-11 px-2 text-sm font-medium text-foreground underline underline-offset-4 decoration-current transition-colors hover:text-brand active:text-brand-pressed">
                      Log in to see recent activity
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="package" className="mt-5">
                <form onSubmit={handlePackageQuote} className="space-y-2.5">
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                    <Input value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Sender address" className="pl-11 h-12 text-sm bg-surface-input border border-transparent rounded-md text-foreground placeholder:text-text-secondary hover:bg-surface-hover focus:bg-background focus:border-brand focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                    <Input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="Recipient address" className="pl-11 h-12 text-sm bg-surface-input border border-transparent rounded-md text-foreground placeholder:text-text-secondary hover:bg-surface-hover focus:bg-background focus:border-brand focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <Button type="submit" disabled={!senderAddress.trim() || !recipientAddress.trim()} className="h-11 px-6 font-medium">Get a quote</Button>
                </form>
              </TabsContent>

              <TabsContent value="shop" className="mt-5">
                <form onSubmit={handleShopSearch} className="space-y-2.5">
                  <div className="relative group">
                    <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary transition-colors group-hover:text-brand group-focus-within:text-brand" />
                    <Input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder="Search products, brands, categories" className="pl-11 h-12 text-sm bg-surface-input border border-transparent rounded-md text-foreground placeholder:text-text-secondary hover:bg-surface-hover focus:bg-background focus:border-brand focus-visible:ring-0 focus-visible:ring-offset-0" />
                  </div>
                  <Button type="submit" className="h-11 px-6 font-medium">{shopSearch.trim() ? "Search marketplace" : "Browse marketplace"}</Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: compact visual (50% smaller than before) */}
          <div className="relative w-full max-w-sm mx-auto lg:max-w-none lg:w-[70%] lg:ml-auto aspect-[4/3] rounded-2xl overflow-hidden bg-surface-input border border-border">
            <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.05)), radial-gradient(circle at 30% 30%, hsl(var(--primary)/0.35), transparent 55%), radial-gradient(circle at 70% 70%, hsl(var(--primary)/0.2), transparent 50%)" }} />
            <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 400 300" fill="none">
              <path d="M0 180 Q120 140 200 200 T400 170" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
              <path d="M40 50 Q160 100 260 70 T400 110" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
              <circle cx="110" cy="170" r="6" fill="hsl(var(--primary))" />
              <circle cx="290" cy="120" r="6" fill="hsl(var(--foreground))" />
            </svg>
            <button
              type="button"
              onClick={() => navigate(activeRide ? `/rides/track/${activeRide.id}` : user ? "/rides" : "/login")}
              className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur rounded-xl p-3 text-left shadow-lg transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={activeRide ? "View your current ride" : "View ride activity"}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{activeRide ? "Current ride activity" : "Rides on demand"}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {activeRide
                      ? `${activeRide.status.replace("_", " ")} · ${activeRide.pickup_address} → ${activeRide.dropoff_address}`
                      : user ? "View your ride activity or request a ride." : "Tap “See prices” to get matched with a nearby driver."}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* ALL SERVICES */}
      <section className="hidden border-b border-border md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Everything 1145</h2>
              <p className="text-muted-foreground text-sm mt-1">All your services, in one place.</p>
            </div>
            <Link to="/services" className="text-sm underline underline-offset-4 hidden sm:inline">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {services.map((s, i) => (
              <motion.div key={s.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.3 }}>
                <Link to={s.href} className="group relative bg-surface-input hover:bg-surface-hover active:bg-surface-pressed hover:text-brand transition rounded-xl p-4 flex flex-col justify-between h-full min-h-[110px]">
                  {s.tag && (
                    <span className="absolute top-2 right-2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-surface-selected text-brand">{s.tag}</span>
                  )}
                  <s.icon className="h-6 w-6" />
                  <div className="mt-3">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  <Sparkles className="h-3 w-3" /> Featured
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">Handpicked for you</h2>
              </div>
              <Link to="/shop"><Button variant="outline" size="sm">Shop all</Button></Link>
            </div>
            <ProductGrid products={featured} columns={4} />
          </div>
        </section>
      )}

      {/* FEATURED BRANDS */}
      {featuredBrands.length > 0 && (
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  <Star className="h-3 w-3" /> Featured brands
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">Shop by brand</h2>
              </div>
              <Link to="/shop"><Button variant="outline" size="sm">Discover all</Button></Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {featuredBrands.map((b, i) => (
                <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                  <Link to={`/shop?brand=${encodeURIComponent(b.name)}`} className="group relative aspect-square rounded-xl bg-background border border-border flex flex-col items-center justify-center p-4 hover:border-foreground transition overflow-hidden">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="max-h-16 max-w-[80%] object-contain mb-2" loading="lazy" />
                    ) : null}
                    <span className="text-lg font-bold tracking-tight text-center">{b.name}</span>
                    {b.businessType && (
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">{b.businessType}</span>
                    )}
                    <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* TRENDING */}
      {trending.length > 0 && (
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" /> Trending now
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">What's popular this week</h2>
              </div>
              <Link to="/popular"><Button variant="outline" size="sm">See trending</Button></Link>
            </div>
            <ProductGrid products={trending} columns={4} />
          </div>
        </section>
      )}

      {/* NEW ARRIVALS */}
      {newArrivals.length > 0 && (
        <section className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-1">
                  <Zap className="h-3 w-3" /> Fresh drops
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">New arrivals</h2>
              </div>
              <Link to="/new-arrivals"><Button variant="outline" size="sm">See all</Button></Link>
            </div>
            <ProductGrid products={newArrivals} columns={4} />
          </div>
        </section>
      )}

      {/* DRIVE/EARN */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid lg:grid-cols-2 gap-8 items-center">
          <div className="w-full max-w-xs mx-auto lg:mx-0 aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center order-2 lg:order-1">
            <Users className="h-16 w-16 text-primary/60" />
          </div>
          <div className="order-1 lg:order-2 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold">Grow your business...</h2>
            <p className="text-muted-foreground">Make money on your sleep. You focus on your Brand or Product we focus on marketing and fulfilment</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/merchant/register"><Button className="h-11 px-6">Get started</Button></Link>
              <Link to="/merchant/login" className="inline-flex items-center h-11 px-2 underline underline-offset-4 text-sm font-medium">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">Reimagined for South Africa</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Shield, title: "Safety first", desc: "PIN verified trips, panic button, and real-time tracking on every ride." },
              { icon: Car, title: "Reliable arrivals", desc: "Smart dispatch matches you with the closest driver in seconds." },
              { icon: Package, title: "Beyond rides", desc: "Send packages, shop the marketplace, and earn UCoin rewards." },
            ].map((f) => (
              <div key={f.title} className="bg-muted rounded-xl p-5 space-y-3">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to move & earn?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Sign up in minutes and get where you need to go — or start earning today.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="h-11 px-7">Sign up to ride</Button></Link>
            <Link to="/driver/register"><Button variant="outline" className="h-11 px-7">Sign up to drive</Button></Link>
            <Link to="/influencer/register"><Button variant="outline" className="h-11 px-7">Sign up to influence</Button></Link>
          </div>
        </div>
      </section>
      
      <Footer />
      <div className="h-0 pb-nav md:pb-0" />
      <MobileBottomNav />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
