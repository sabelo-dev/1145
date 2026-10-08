import React, { Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Car, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/ui/section";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SEO from "@/components/SEO";
import CampaignHero from "@/components/home/CampaignHero";
import QuickStart from "@/components/home/QuickStart";
import ServiceRail from "@/components/home/ServiceRail";
import CollectionGrid from "@/components/home/CollectionGrid";
import ProductRail from "@/components/home/ProductRail";
import HomePromoCard from "@/components/home/HomePromoCard";
import { helpLinks } from "@/content/home";
import { Product } from "@/types";
import { fetchFeaturedProducts, fetchPopularProducts, fetchNewArrivals, fetchFeaturedBrands, FeaturedBrand } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Below the fold and heavy (live supply polling, Google Maps on desktop).
const MoveSection = lazyWithRetry(() => import("@/components/home/MoveSection"));

/** Mounts its children only once the placeholder is close to the viewport. */
const Deferred: React.FC<{ placeholderClassName: string; children: React.ReactNode }> = ({ placeholderClassName, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || show) return;
    if (!("IntersectionObserver" in window)) { setShow(true); return; }
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setShow(true),
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [show]);

  const placeholder = <div ref={ref} className={placeholderClassName} aria-hidden />;
  return show ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder;
};

const reasons = [
  { icon: Shield, title: "Safety first", desc: "PIN-verified trips, a panic button and real-time tracking on every ride." },
  { icon: Car, title: "Reliable arrivals", desc: "Smart dispatch matches you with the closest driver in seconds." },
  { icon: Wallet, title: "Rewards that add up", desc: "Earn UCoin on rides, orders and reviews — and spend it anywhere on 1145." },
];

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { user } = useAuth();
  // `null` while loading, so each rail can reserve its space.
  const [featured, setFeatured] = useState<Product[] | null>(null);
  const [trending, setTrending] = useState<Product[] | null>(null);
  const [newArrivals, setNewArrivals] = useState<Product[] | null>(null);
  const [featuredBrands, setFeaturedBrands] = useState<FeaturedBrand[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [f, t, n, b] = await Promise.all([
          fetchFeaturedProducts(4),
          fetchPopularProducts(8),
          fetchNewArrivals(8),
          fetchFeaturedBrands(6),
        ]);
        // A product appears in one rail only, so a small catalogue never repeats itself down the page.
        const seen = new Set<string>();
        const unique = (list: Product[] | null | undefined) => {
          const fresh = (list || []).filter((p) => !seen.has(p.id)).slice(0, 4);
          fresh.forEach((p) => seen.add(p.id));
          return fresh;
        };
        setFeatured(unique(f));
        setTrending(unique(t));
        setNewArrivals(unique(n));
        setFeaturedBrands(b || []);
      } catch (e) {
        console.error("Home load failed", e);
        setFeatured([]);
        setTrending([]);
        setNewArrivals([]);
      }
    })();
  }, []);

  return (
    <div ref={ref} className="min-h-screen bg-background text-foreground">
      <SEO
        title="1145 Lifestyle — Shop, Ride, Earn"
        description="One platform for shopping, rides, deliveries, stays, and wallet — reimagined for South Africa."
        keywords="1145, shop, ride, wallet, stays, marketplace, south africa"
      />
      <Header />

      <main>
        <CampaignHero />
        <QuickStart />

        <Deferred placeholderClassName="min-h-[34rem] bg-navy-900 lg:min-h-[38rem]">
          <MoveSection />
        </Deferred>

        <ServiceRail />
        <CollectionGrid />

        <ProductRail
          id="featured-title"
          eyebrow="Featured"
          title="Handpicked for you"
          action={{ to: "/shop", label: "Shop all" }}
          products={featured}
        />

        {/* SELL ON 1145 */}
        <Section tone="muted" aria-labelledby="sell-title" containerClassName="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <p className="eyebrow text-text-secondary">For businesses</p>
            <h2 id="sell-title" className="type-headline mt-3">Grow your business with 1145.</h2>
            <p className="type-lead mt-4 max-w-lg text-text-secondary">
              List your products, and we handle the marketing, payments and delivery. Sell to customers across South Africa — and get paid while you sleep.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Button asChild variant="cta" size="lg" className="h-12 rounded-full px-7">
                <Link to="/merchant/register">Start selling</Link>
              </Button>
              <Link to="/merchant/login" className="link-arrow min-h-[44px] justify-center text-foreground sm:justify-start">
                I already have a store <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>

          {/* Adverts when live, otherwise a Marketplace product slideshow */}
          <HomePromoCard />
        </Section>

        <ProductRail
          id="trending-title"
          eyebrow="Trending now"
          title="Popular this week"
          action={{ to: "/popular", label: "See all" }}
          products={trending}
        />

        {/* A brand row only earns its place once there is a real choice of brands. */}
        {featuredBrands.length >= 3 && (
          <Section tone="muted" aria-labelledby="brands-title">
            <SectionHeader id="brands-title" eyebrow="Featured brands" title="Shop by brand" action={{ to: "/shop", label: "Discover all" }} />
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {featuredBrands.map((b) => (
                <li key={b.id} className="min-w-0">
                  <Link
                    to={b.storeSlug ? `/store/${b.storeSlug}` : `/shop?brand=${encodeURIComponent(b.name)}`}
                    className="flex aspect-[3/2] items-center justify-center rounded-2xl border border-border bg-background p-4 text-center text-lg font-bold tracking-tight transition-colors hover:border-foreground/30"
                  >
                    {b.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <ProductRail
          id="new-title"
          eyebrow="Fresh drops"
          title="New arrivals"
          action={{ to: "/new-arrivals", label: "See all" }}
          products={newArrivals}
        />

        {/* WHY 1145 */}
        <Section aria-labelledby="why-title" className="border-t border-border">
          <SectionHeader id="why-title" title="Reimagined for South Africa" />
          <ul className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {reasons.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="border-t border-foreground/15 pt-6">
                <Icon className="h-6 w-6 text-brand" aria-hidden />
                <h3 className="type-title mt-4">{title}</h3>
                <p className="mt-2 text-text-secondary">{desc}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* HELP & POLICIES */}
        <Section compact tone="muted" aria-labelledby="help-title">
          <h2 id="help-title" className="sr-only">Delivery, returns and support</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {helpLinks.map(({ title, desc, icon: Icon, to }) => (
              <li key={to} className="min-w-0">
                <Link to={to} className="group flex h-full items-center gap-4 rounded-2xl bg-background p-4 transition-colors hover:bg-surface-hover">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-input text-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="block text-sm text-text-secondary">{desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        {/* JOIN — one primary action; the earning routes stay as text links. */}
        {!user && (
          <Section tone="inverse" aria-labelledby="join-title" containerClassName="max-w-3xl text-center">
            <h2 id="join-title" className="type-headline text-white">Ready to move &amp; earn?</h2>
            <p className="type-lead mx-auto mt-4 max-w-xl text-white/75">
              Sign up in minutes to ride, deliver, sell or create — one account for all of 1145.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-base font-semibold text-navy-900 transition-colors hover:bg-white/90"
            >
              Create your account
            </Link>
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              <Link to="/driver/register" className="link-arrow min-h-[44px] text-white">Drive with 1145 <ArrowRight aria-hidden /></Link>
              <Link to="/influencer/login" className="link-arrow min-h-[44px] text-white">Become a creator <ArrowRight aria-hidden /></Link>
            </p>
          </Section>
        )}
      </main>

      {/* Footer carries the bottom-nav offset (pb-nav) so content never hides behind it */}
      <Footer />
      <MobileBottomNav />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
