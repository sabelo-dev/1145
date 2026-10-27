import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SEO from "@/components/SEO";
import ValuePropHero from "@/components/home/ValuePropHero";
import TrustStrip from "@/components/home/TrustStrip";
import JourneyTabs from "@/components/home/JourneyTabs";
import CollectionGrid from "@/components/home/CollectionGrid";
import ProductRail from "@/components/home/ProductRail";
import DropCampaign from "@/components/home/DropCampaign";
import MerchantShowcase from "@/components/home/MerchantShowcase";
import GrowthPrograms from "@/components/home/GrowthPrograms";
import AppDownloadBand from "@/components/home/AppDownloadBand";
import { helpLinks } from "@/content/home";
import { Product } from "@/types";
import { fetchAllProducts, fetchFeaturedProducts, fetchPopularProducts, fetchNewArrivals } from "@/services/products";
import { useDeliveryArea } from "@/hooks/useDeliveryArea";
import { deliversTo } from "@/lib/deliveryCoverage";
import { recentInterests, track } from "@/lib/analytics";
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

type Catalogue = { featured: Product[]; trending: Product[]; fresh: Product[]; all: Product[] };

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { area } = useDeliveryArea();
  // `null` while loading, so each rail can reserve its space.
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);

  useEffect(() => { track("home_impression", { area: area?.label }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const [featured, trending, fresh, all] = await Promise.all([
          fetchFeaturedProducts(8),
          fetchPopularProducts(12),
          fetchNewArrivals(12),
          fetchAllProducts(),
        ]);
        setCatalogue({ featured: featured || [], trending: trending || [], fresh: fresh || [], all: all || [] });
      } catch (e) {
        console.error("Home load failed", e);
        setCatalogue({ featured: [], trending: [], fresh: [], all: [] });
      }
    })();
  }, []);

  // Only products whose merchant delivers to the visitor's province (or nationwide).
  const { featured, trending, recommended, newArrivals } = useMemo(() => {
    if (!catalogue) return { featured: null, trending: null, recommended: [] as Product[], newArrivals: null };
    // A product appears in one rail only, so a small catalogue never repeats itself down the page.
    const seen = new Set<string>();
    const unique = (list: Product[]) => {
      const picked = list.filter((p) => deliversTo(p.shippingRegions, area?.province) && !seen.has(p.id)).slice(0, 4);
      picked.forEach((p) => seen.add(p.id));
      return picked;
    };
    const featured = unique(catalogue.featured);
    const trending = unique(catalogue.trending);
    // Recommended: the categories this visitor viewed recently, from real inventory.
    const interests = recentInterests();
    const recommended = interests.length ? unique(catalogue.all.filter((p) => p.inStock && interests.includes(p.category))) : [];
    return { featured, trending, recommended, newArrivals: unique(catalogue.fresh) };
  }, [catalogue, area?.province]);

  const spotlight = useMemo(() => featured?.find((p) => p.images?.[0] && p.price > 0) ?? null, [featured]);
  const areaNote = area ? `Delivering to ${area.label}, ${area.province}` : undefined;

  return (
    <div ref={ref} className="min-h-screen bg-background text-foreground">
      <SEO
        title="1145 — Shop, Ride & Discover in one South African app"
        description="Shop South African brands and local merchants, request a ride, and discover food, stays and services — all in the 1145 app."
        keywords="1145, XIXLV, shop online south africa, ride app, marketplace, super app, rand"
      />
      <Header />

      <main>
        <ValuePropHero spotlight={spotlight} />
        <TrustStrip />
        <JourneyTabs />

        <ProductRail
          id="trending-title"
          eyebrow={areaNote ?? "Trending now"}
          title="Trending on 1145"
          action={{ to: "/popular", label: "See all" }}
          products={trending}
        />

        {recommended.length > 0 && (
          <ProductRail
            id="recommended-title"
            tone="muted"
            eyebrow="Based on what you viewed"
            title="Recommended for you"
            action={{ to: "/shop", label: "Shop all" }}
            products={recommended}
          />
        )}

        <ProductRail
          id="featured-title"
          eyebrow="Featured"
          title="Handpicked for you"
          action={{ to: "/shop", label: "Shop all" }}
          products={featured}
        />

        <DropCampaign />

        {/* Curated categories — and the fallback when the catalogue has nothing to show. */}
        <CollectionGrid />

        <ProductRail
          id="new-title"
          eyebrow="Fresh drops"
          title="Just landed"
          action={{ to: "/new-arrivals", label: "See all" }}
          products={newArrivals}
        />

        {/* Ride: its own clearly labelled service, loaded when scrolled near. */}
        <Deferred placeholderClassName="min-h-[34rem] bg-navy-900 lg:min-h-[38rem]">
          <MoveSection />
        </Deferred>

        <MerchantShowcase />
        <GrowthPrograms />

        {/* HELP & POLICIES */}
        <section aria-labelledby="help-title" className="section-compact bg-surface-muted">
          <div className="page-container">
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
          </div>
        </section>

        <AppDownloadBand />
      </main>

      {/* Footer carries the bottom-nav offset (pb-nav) so content never hides behind it */}
      <Footer />
      <MobileBottomNav />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
