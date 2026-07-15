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
import SEO from "@/components/SEO";
import ProductGrid from "@/components/shop/ProductGrid";
import { Product } from "@/types";
import { fetchFeaturedProducts, fetchPopularProducts, fetchNewArrivals } from "@/services/products";

const services = [
  { name: "Shop", desc: "Marketplace", icon: ShoppingBag, href: "/shop", tag: "Popular" },
  { name: "Travel", desc: "Request a ride", icon: Car, href: "/rides/request" },
  { name: "Package", desc: "Send parcels", icon: Package, href: "/rides/request" },
  { name: "Wallet", desc: "Money & Gold", icon: Wallet, href: "/wallet" },
  { name: "Lease", desc: "Rent-to-own", icon: KeyRound, href: "/lease", tag: "New" },
  { name: "Business", desc: "Merchant tools", icon: Briefcase, href: "/merchant/dashboard" },
  { name: "Influence", desc: "Creator hub", icon: Megaphone, href: "/influencer/login" },
  { name: "Stay", desc: "Book a stay", icon: Building2, href: "/stays", tag: "New" },
];

const featuredBrands = [
  { name: "Aurum", tag: "Luxury" },
  { name: "Kai Studio", tag: "Fashion" },
  { name: "Nova Tech", tag: "Electronics" },
  { name: "Terra Home", tag: "Living" },
  { name: "Flux Athletics", tag: "Sport" },
  { name: "Muse & Co", tag: "Beauty" },
];

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [when, setWhen] = useState("now");
  const [featured, setFeatured] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [f, t, n] = await Promise.all([
          fetchFeaturedProducts(4),
          fetchPopularProducts(4),
          fetchNewArrivals(4),
        ]);
        setFeatured(f || []);
        setTrending(t || []);
        setNewArrivals(n || []);
      } catch (e) {
        console.error("Home load failed", e);
      }
    })();
  }, []);

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (pickup) params.set("pickup", pickup);
    if (destination) params.set("destination", destination);
    navigate(`/rides/request?${params.toString()}`);
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
              Go anywhere. Get anything. <span className="text-muted-foreground">All with 1145.</span>
            </motion.h1>

            <Tabs defaultValue="ride" className="w-full">
              <TabsList className="bg-transparent p-0 h-auto gap-6 border-b border-border rounded-none w-full justify-start">
                <TabsTrigger value="ride" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 pb-3 text-sm font-medium">
                  <Car className="h-4 w-4 mr-2" /> Ride
                </TabsTrigger>
                <TabsTrigger value="package" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 pb-3 text-sm font-medium">
                  <Package className="h-4 w-4 mr-2" /> Package
                </TabsTrigger>
                <TabsTrigger value="shop" className="data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-0 pb-3 text-sm font-medium">
                  <ShoppingBag className="h-4 w-4 mr-2" /> Shop
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ride" className="mt-5">
                <form onSubmit={handleRequest} className="space-y-2.5">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location" className="pl-11 h-12 text-sm bg-muted border-0 rounded-md" />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Dropoff location" className="pl-11 h-12 text-sm bg-muted border-0 rounded-md" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select value={when} onChange={(e) => setWhen(e.target.value)} className="w-full h-12 pl-11 pr-4 bg-muted rounded-md text-sm appearance-none border-0 focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="now">Today</option>
                        <option value="tomorrow">Tomorrow</option>
                        <option value="later">Pick a date</option>
                      </select>
                    </div>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <select className="w-full h-12 pl-11 pr-4 bg-muted rounded-md text-sm appearance-none border-0 focus:outline-none focus:ring-2 focus:ring-ring">
                        <option>Now</option><option>In 15 min</option><option>In 30 min</option><option>In 1 hour</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Button type="submit" className="h-11 px-6 font-medium">See prices</Button>
                    <Link to="/login" className="inline-flex items-center h-11 px-2 text-sm font-medium underline underline-offset-4">
                      Log in to see recent activity
                    </Link>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="package" className="mt-5">
                <div className="space-y-2.5">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Sender address" className="pl-11 h-12 text-sm bg-muted border-0 rounded-md" />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Recipient address" className="pl-11 h-12 text-sm bg-muted border-0 rounded-md" />
                  </div>
                  <Button className="h-11 px-6 font-medium" onClick={() => navigate("/rides/request")}>Get a quote</Button>
                </div>
              </TabsContent>

              <TabsContent value="shop" className="mt-5">
                <div className="space-y-2.5">
                  <div className="relative">
                    <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products, brands, categories" className="pl-11 h-12 text-sm bg-muted border-0 rounded-md" onKeyDown={(e) => { if (e.key === "Enter") navigate(`/shop?search=${encodeURIComponent((e.target as HTMLInputElement).value)}`); }} />
                  </div>
                  <Button className="h-11 px-6 font-medium" onClick={() => navigate("/shop")}>Browse marketplace</Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: compact visual (50% smaller than before) */}
          <div className="relative w-full max-w-sm mx-auto lg:max-w-none lg:w-[70%] lg:ml-auto aspect-[4/3] rounded-2xl overflow-hidden bg-muted">
            <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.05)), radial-gradient(circle at 30% 30%, hsl(var(--primary)/0.35), transparent 55%), radial-gradient(circle at 70% 70%, hsl(var(--primary)/0.2), transparent 50%)" }} />
            <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 400 300" fill="none">
              <path d="M0 180 Q120 140 200 200 T400 170" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
              <path d="M40 50 Q160 100 260 70 T400 110" stroke="hsl(var(--foreground))" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
              <circle cx="110" cy="170" r="6" fill="hsl(var(--primary))" />
              <circle cx="290" cy="120" r="6" fill="hsl(var(--foreground))" />
            </svg>
            <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur rounded-xl p-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">Arriving in 3 min</p>
                  <p className="text-[10px] text-muted-foreground">1145X · Toyota Corolla · CA 123-456</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALL SERVICES */}
      <section className="border-b border-border">
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
                <Link to={s.href} className="group relative bg-muted hover:bg-accent transition rounded-xl p-4 flex flex-col justify-between h-full min-h-[110px]">
                  {s.tag && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{s.tag}</span>
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
              <motion.div key={b.name} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                <Link to={`/shop?brand=${encodeURIComponent(b.name)}`} className="group relative aspect-square rounded-xl bg-background border border-border flex flex-col items-center justify-center p-4 hover:border-foreground transition">
                  <span className="text-lg font-bold tracking-tight">{b.name}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{b.tag}</span>
                  <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
            <h2 className="text-2xl sm:text-3xl font-bold">Drive when you want, earn what you need</h2>
            <p className="text-muted-foreground">Make money on your schedule with deliveries or trips. Earn with a car, scooter, or bike.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/driver/register"><Button className="h-11 px-6">Get started</Button></Link>
              <Link to="/driver/login" className="inline-flex items-center h-11 px-2 underline underline-offset-4 text-sm font-medium">
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
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to move?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Sign up in minutes and get where you need to go — or start earning today.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register"><Button className="h-11 px-7">Sign up to ride</Button></Link>
            <Link to="/driver/register"><Button variant="outline" className="h-11 px-7">Sign up to drive</Button></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
