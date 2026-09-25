import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, Building2, Car, Clock, KeyRound, Megaphone, Package, Search, Shield,
  ShoppingBag, Sparkles, Star, Store, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SEO from "@/components/SEO";
import ProductGrid from "@/components/shop/ProductGrid";
import { Product } from "@/types";
import { fetchFeaturedProducts, fetchPopularProducts, fetchNewArrivals, fetchFeaturedBrands, FeaturedBrand } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Same names and order as the Services page. */
const services = [
  { name: "Shop", desc: "Marketplace", icon: ShoppingBag, href: "/shop", tag: "Popular" },
  { name: "Ride", desc: "Get a lift", icon: Car, href: "/rides/request" },
  { name: "Send", desc: "Parcels & courier", icon: Package, href: "/package/send" },
  { name: "Wallet", desc: "Money & gold", icon: Wallet, href: "/wallet" },
  { name: "Lease", desc: "Rent-to-own", icon: KeyRound, href: "/lease/marketplace", tag: "New" },
  { name: "Stay", desc: "Book a stay", icon: Building2, href: "/stays", tag: "New" },
  { name: "Sell", desc: "Open a store", icon: Store, href: "/merchant/register" },
  { name: "Create", desc: "Creator hub", icon: Megaphone, href: "/influencer/login" },
];

const drop = [
  { src: "/images/drop-001/hoodie_black.webp", label: "TIME Hoodie" },
  { src: "/images/drop-001/tracksuit_stone.webp", label: "TIME Tracksuit" },
  { src: "/images/drop-001/cap_red.webp", label: "TIME Cap" },
  { src: "/images/drop-001/legging_navy.webp", label: "MOVE Legging" },
];

type Mode = "ride" | "send" | "shop";
const modes: { id: Mode; label: string; icon: typeof Car }[] = [
  { id: "ride", label: "Ride", icon: Car },
  { id: "send", label: "Send", icon: Package },
  { id: "shop", label: "Shop", icon: ShoppingBag },
];

const fieldClass =
  "h-12 w-full rounded-xl border border-transparent bg-surface-input pl-11 pr-4 text-[15px] text-foreground placeholder:text-text-secondary transition-colors hover:bg-surface-hover focus:border-foreground focus:bg-background focus:outline-none";

/** Section heading with an optional eyebrow and a trailing link. */
const SectionHead = ({ eyebrow, icon: Icon, title, to, cta }: { eyebrow?: string; icon?: typeof Star; title: string; to?: string; cta?: string }) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && (
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-text-secondary">
          {Icon && <Icon className="h-3.5 w-3.5" />} {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
    </div>
    {to && (
      <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground hover:underline">
        {cta || "See all"} <ArrowRight className="h-4 w-4" />
      </Link>
    )}
  </div>
);

/** Route illustration: streets, a cyan route, pickup/drop-off pins and a car. */
const RouteMap = () => (
  <svg viewBox="0 0 480 360" className="h-full w-full" role="img" aria-label="Illustration of a route on a map">
    <defs>
      <linearGradient id="route" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="hsl(var(--cyan))" />
        <stop offset="0.8" stopColor="hsl(var(--cyan))" />
        <stop offset="1" stopColor="hsl(var(--gold))" />
      </linearGradient>
      <radialGradient id="glow" cx="0.3" cy="0.35" r="0.8">
        <stop offset="0" stopColor="hsl(var(--cyan) / 0.25)" />
        <stop offset="1" stopColor="transparent" />
      </radialGradient>
    </defs>
    <rect width="480" height="360" fill="url(#glow)" />
    <g stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round">
      <path d="M-10 90 H500" /><path d="M-10 250 H500" /><path d="M120 -10 V370" /><path d="M330 -10 V370" />
    </g>
    <g stroke="rgba(255,255,255,0.045)" strokeWidth="6">
      <path d="M-10 170 H500" /><path d="M220 -10 V370" /><path d="M420 -10 V370" /><path d="M40 -10 V370" />
    </g>
    <path d="M80 212 C 130 200, 150 170, 200 160 S 300 140, 330 110 S 380 70, 400 58" fill="none" stroke="url(#route)" strokeWidth="5" strokeLinecap="round" />
    <circle cx="80" cy="212" r="10" fill="#ffffff" stroke="hsl(var(--cyan))" strokeWidth="4" />
    <rect x="390" y="48" width="20" height="20" rx="4" fill="hsl(var(--gold))" />
    <g transform="translate(252 148) rotate(-20)">
      <rect x="-15" y="-9" width="30" height="18" rx="6" fill="hsl(0 0% 100%)" />
      <rect x="-7" y="-6" width="12" height="12" rx="2" fill="hsl(var(--navy-800))" />
    </g>
  </svg>
);

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("ride");
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
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const secondFieldRef = useRef<HTMLInputElement>(null);

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

  /** Never a dead button: if a field is missing, take the user straight to it. */
  const requireFields = (first: string, second: string) => {
    if (!first.trim()) { firstFieldRef.current?.focus(); return false; }
    if (!second.trim()) { secondFieldRef.current?.focus(); return false; }
    return true;
  };

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFields(pickup, destination)) return;
    const params = new URLSearchParams({ pickup, destination });
    if (when !== "now") params.set("when", when);
    navigate(`/rides/request?${params.toString()}`);
  };

  const handlePackageQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireFields(senderAddress, recipientAddress)) return;
    const params = new URLSearchParams({ mode: "package", pickup: senderAddress.trim(), destination: recipientAddress.trim() });
    navigate(`/rides/request?${params.toString()}`);
  };

  const handleShopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = shopSearch.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  };

  /** Two stacked inputs joined by a route line, like a trip planner.
   *  Called as a function (not rendered as <Component/>) so the inputs keep
   *  their identity across renders and never lose focus while typing. */
  const routeFields = (a: string, setA: (v: string) => void, aLabel: string, b: string, setB: (v: string) => void, bLabel: string) => (
    <div className="relative space-y-2">
      <span aria-hidden className="absolute left-[21px] top-[26px] h-[calc(100%-52px)] w-px bg-foreground/25" />
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-foreground bg-background" />
        <input ref={firstFieldRef} value={a} onChange={(e) => setA(e.target.value)} placeholder={aLabel} aria-label={aLabel} className={fieldClass} />
      </div>
      <div className="relative">
        <span aria-hidden className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-[3px] bg-foreground" />
        <input ref={secondFieldRef} value={b} onChange={(e) => setB(e.target.value)} placeholder={bLabel} aria-label={bLabel} className={fieldClass} />
      </div>
    </div>
  );

  return (
    <div ref={ref} className="min-h-screen bg-background text-foreground">
      <SEO
        title="1145 Lifestyle — Shop, Ride, Earn"
        description="One platform for shopping, rides, deliveries, stays, and wallet — reimagined for South Africa."
        keywords="1145, shop, ride, wallet, stays, marketplace, south africa"
      />
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-cyan/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 right-0 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-20">
          <div className="min-w-0 space-y-7">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> Rides · Delivery · Shopping · Wallet
              </span>
              <h1 className="text-[2.1rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Go anywhere.<br />Get anything.<br />
                <span className="text-cyan">All with </span><span className="text-[hsl(var(--gold))]">1145.</span>
              </h1>
            </motion.div>

            {/* Booking card */}
            <div className="rounded-2xl bg-background p-4 text-foreground shadow-float sm:p-5">
              <div role="tablist" aria-label="What do you need?" className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-surface-input p-1">
                {modes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={mode === id}
                    onClick={() => setMode(id)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-all",
                      mode === id ? "bg-background text-foreground shadow-soft" : "text-text-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {mode === "ride" && (
                <form onSubmit={handleRequest} className="space-y-3">
                  {routeFields(pickup, setPickup, "Pickup location", destination, setDestination, "Where to?")}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative sm:w-44">
                      <Clock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                      <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When" className={cn(fieldClass, "appearance-none")}>
                        <option value="now">Pickup now</option>
                        <option value="15m">In 15 min</option>
                        <option value="1h">In 1 hour</option>
                        <option value="later">Schedule</option>
                      </select>
                    </div>
                    <Button type="submit" variant="cta" className="h-12 flex-1 rounded-xl text-base font-semibold">
                      See prices <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              )}

              {mode === "send" && (
                <form onSubmit={handlePackageQuote} className="space-y-3">
                  {routeFields(senderAddress, setSenderAddress, "Collect from", recipientAddress, setRecipientAddress, "Deliver to")}
                  <Button type="submit" variant="cta" className="h-12 w-full rounded-xl text-base font-semibold">
                    Get a quote <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </form>
              )}

              {mode === "shop" && (
                <form onSubmit={handleShopSearch} className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                    <input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder="Search products, brands, stores" aria-label="Search products" className={fieldClass} />
                  </div>
                  <Button type="submit" variant="cta" className="h-12 w-full rounded-xl text-base font-semibold">
                    {shopSearch.trim() ? "Search" : "Browse the marketplace"} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </form>
              )}

              {activeRide ? (
                <button
                  type="button"
                  onClick={() => navigate(`/rides/track/${activeRide.id}`)}
                  className="mt-4 flex w-full items-center gap-3 rounded-xl bg-surface-selected p-3 text-left transition hover:bg-surface-pressed"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground"><Car className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold capitalize">Ride {activeRide.status.replace("_", " ")}</span>
                    <span className="block truncate text-xs text-text-secondary">{activeRide.pickup_address} → {activeRide.dropoff_address}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-secondary" />
                </button>
              ) : !user ? (
                <p className="mt-4 text-sm text-text-secondary">
                  <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">Log in</Link> to see your recent trips and orders.
                </p>
              ) : null}
            </div>
          </div>

          {/* Visual */}
          <div className="relative hidden lg:block">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-navy-800 shadow-float">
              <RouteMap />
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl bg-background/95 p-4 text-foreground shadow-elevated backdrop-blur">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-cyan"><Car className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Driver matched in seconds</p>
                  <p className="truncate text-xs text-text-secondary">PIN-verified trips · live tracking · panic button</p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">4 min</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <SectionHead title="Everything 1145" to="/services" cta="All services" />
          <div className="bleed-x snap-rail md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0 lg:grid-cols-8">
            {services.map((s) => (
              <Link
                key={s.name}
                to={s.href}
                className="group relative flex w-[7.5rem] flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-elevated md:w-auto"
              >
                {s.tag && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-navy-900 px-2 py-0.5 text-[11px] font-semibold text-white">{s.tag}</span>
                )}
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-input text-foreground transition-colors group-hover:bg-navy-900 group-hover:text-cyan">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="mt-4 text-sm font-semibold">{s.name}</span>
                <span className="text-xs text-text-secondary">{s.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* DROP 001 */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <Link
            to="/store/marketplace"
            className="group grid overflow-hidden rounded-3xl bg-surface-muted transition-shadow hover:shadow-elevated md:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
              <span className="w-fit rounded-full bg-navy-900 px-3 py-1 text-xs font-semibold tracking-widest text-gold">DROP 001</span>
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl">Wear the time.<br />Official 1145 apparel.</h2>
              <p className="max-w-sm text-text-secondary">Hoodies, tracksuits, caps and training wear in five signature colours.</p>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cta px-5 py-3 text-sm font-semibold text-cta-foreground transition-transform group-hover:translate-x-0.5">
                Shop the drop <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3">
              {drop.map((d) => (
                <div key={d.src} className="relative overflow-hidden rounded-2xl bg-background">
                  <img src={d.src} alt={`1145 ${d.label}`} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">{d.label}</span>
                </div>
              ))}
            </div>
          </Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <SectionHead eyebrow="Featured" icon={Sparkles} title="Handpicked for you" to="/shop" cta="Shop all" />
            <ProductGrid products={featured} columns={4} />
          </div>
        </section>
      )}

      {featuredBrands.length > 0 && (
        <section className="border-b border-border bg-surface-muted">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <SectionHead eyebrow="Featured brands" icon={Star} title="Shop by brand" to="/shop" cta="Discover all" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {featuredBrands.map((b) => (
                <Link
                  key={b.id}
                  to={`/shop?brand=${encodeURIComponent(b.name)}`}
                  className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-background p-4 text-center text-lg font-bold tracking-tight transition hover:-translate-y-0.5 hover:shadow-elevated"
                >
                  {b.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <SectionHead eyebrow="Trending now" icon={TrendingUp} title="Popular this week" to="/popular" />
            <ProductGrid products={trending} columns={4} />
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
            <SectionHead eyebrow="Fresh drops" icon={Zap} title="New arrivals" to="/new-arrivals" />
            <ProductGrid products={newArrivals} columns={4} />
          </div>
        </section>
      )}

      {/* SELL ON 1145 */}
      <section className="overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:py-16 lg:grid-cols-2 lg:px-8">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">For businesses</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Grow your business with 1145.</h2>
            <p className="max-w-lg text-text-secondary">
              List your products, and we handle the marketing, payments and delivery. Sell to customers across South Africa — and get paid while you sleep.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="cta" className="h-12 rounded-xl px-6 text-base font-semibold">
                <Link to="/merchant/register">Start selling</Link>
              </Button>
              <Link to="/merchant/login" className="text-sm font-semibold underline underline-offset-4">
                I already have a store
              </Link>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative mx-auto w-full max-w-md">
            <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan/20 via-transparent to-gold/20 blur-2xl" />
            <div className="relative space-y-4 rounded-3xl bg-navy-900 p-5 text-white shadow-float">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Store overview</p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">This week</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[["Sales", "R24.8k"], ["Orders", "186"], ["Payout", "Fri"]].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[11px] text-white/60">{k}</p>
                    <p className="mt-1 text-lg font-bold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex h-24 items-end gap-1.5 rounded-2xl bg-white/5 p-3">
                {[35, 52, 40, 68, 58, 82, 96].map((h, i) => (
                  <span key={i} className={cn("flex-1 rounded-md", i === 6 ? "bg-gold" : "bg-cyan/70")} style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="text-xs text-white/60">Illustrative preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY 1145 */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
          <SectionHead title="Reimagined for South Africa" />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Shield, title: "Safety first", desc: "PIN-verified trips, a panic button and real-time tracking on every ride." },
              { icon: Car, title: "Reliable arrivals", desc: "Smart dispatch matches you with the closest driver in seconds." },
              { icon: Wallet, title: "Rewards that add up", desc: "Earn UCoin on rides, orders and reviews — and spend it anywhere on 1145." },
            ].map((f) => (
              <div key={f.title} className="space-y-3 rounded-2xl border border-border bg-card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-cyan"><f.icon className="h-5 w-5" /></span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-cyan/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl space-y-6 px-4 py-16 text-center sm:px-6 md:py-20">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to move &amp; earn?</h2>
          <p className="text-white/70">Sign up in minutes to ride, deliver, sell or create — one account for all of 1145.</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 font-semibold text-navy-900 transition hover:bg-white/90">Sign up to ride</Link>
            <Link to="/driver/register" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 px-6 font-semibold text-white transition hover:bg-white/10">Drive with 1145</Link>
            <Link to="/influencer/login" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 px-6 font-semibold text-white transition hover:bg-white/10">Become a creator</Link>
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
