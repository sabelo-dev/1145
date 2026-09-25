import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByStore } from "@/services/products";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import { formatCurrency, cn } from "@/lib/utils";

type Slide = { id: string; image: string; title: string; subtitle?: string; href: string; external?: boolean; label: string };

const ROTATE_MS = 5000;
const MARKETPLACE_SLUG = "marketplace";

/** Active "promo" CMS banners inside their date window, in display order. */
async function loadAdverts(): Promise<Slide[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cms_banners")
    .select("id, title, image_url, link_url, start_date, end_date, display_order")
    .eq("position", "promo")
    .eq("is_active", true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order("display_order", { ascending: true })
    .limit(8);
  if (error) return [];
  return (data ?? [])
    .filter((b) => b.image_url)
    .map((b) => ({
      id: b.id,
      image: b.image_url!,
      title: b.title,
      href: b.link_url || "/shop",
      external: !!b.link_url && /^https?:\/\//.test(b.link_url) && !b.link_url.includes(window.location.host),
      label: "Sponsored",
    }));
}

/** Fallback: approved, priced products from the official Marketplace store. */
async function loadMarketplaceProducts(): Promise<Slide[]> {
  const products = await fetchProductsByStore(MARKETPLACE_SLUG);
  return products
    .filter((p) => p.images?.[0] && p.price > 0)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      image: p.images[0],
      title: p.name,
      subtitle: formatCurrency(applyPlatformMarkup(p.price)),
      href: `/product/${p.slug}`,
      label: "1145 Marketplace",
    }));
}

/**
 * Home-page promo card: shows adverts when any are live, otherwise a slideshow
 * of Marketplace products. Renders nothing if there is neither.
 */
const HomePromoCard: React.FC<{ className?: string }> = ({ className }) => {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ads = await loadAdverts();
      const next = ads.length ? ads : await loadMarketplaceProducts();
      if (alive) setSlides(next);
    })().catch(() => alive && setSlides([]));
    return () => { alive = false; };
  }, []);

  // Auto-advance (paused on hover/touch, and for users who prefer reduced motion).
  useEffect(() => {
    if (!slides || slides.length < 2 || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [slides, paused]);

  if (!slides) {
    return <div className={cn("aspect-[4/3] w-full animate-pulse rounded-3xl bg-navy-900/90", className)} aria-hidden />;
  }
  if (slides.length === 0) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length);
  const slide = slides[index % slides.length];

  const inner = (
    <>
      <img
        key={slide.id}
        src={slide.image}
        alt={slide.title}
        loading="lazy"
        className="absolute inset-0 h-full w-full animate-fade-in object-cover"
        onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-navy-900 via-navy-900/40 to-transparent" />
      <span className="absolute left-4 top-4 rounded-full bg-navy-900/80 px-3 py-1 text-xs font-semibold text-[hsl(var(--gold))] backdrop-blur">
        {slide.label}
      </span>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="line-clamp-2 text-lg font-semibold text-white">{slide.title}</p>
          {slide.subtitle && <p className="mt-0.5 text-sm font-medium text-white/80">{slide.subtitle}</p>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-900 transition-transform group-hover:translate-x-0.5">
          Shop now <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </>
  );

  return (
    <div
      className={cn("relative mx-auto w-full max-w-md", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div aria-hidden className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan/20 via-transparent to-gold/20 blur-2xl" />
      <div
        className="relative aspect-[4/3] touch-pan-y overflow-hidden rounded-3xl bg-navy-900 shadow-float"
        aria-roledescription="carousel"
        aria-label={slides[0].label === "Sponsored" ? "Sponsored offers" : "Products from the 1145 Marketplace"}
        onPointerDown={(e) => { swipeStart.current = e.clientX; swiped.current = false; setPaused(true); }}
        onPointerUp={(e) => {
          if (swipeStart.current != null) {
            const dx = e.clientX - swipeStart.current;
            if (Math.abs(dx) > 50) { swiped.current = true; go(dx < 0 ? 1 : -1); }
          }
          swipeStart.current = null;
          setPaused(false);
        }}
        // A swipe must not also count as a tap on the slide link.
        onClickCapture={(e) => { if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; } }}
      >
        {slide.external ? (
          <a href={slide.href} target="_blank" rel="noopener noreferrer sponsored" className="group absolute inset-0">{inner}</a>
        ) : (
          <Link to={slide.href} className="group absolute inset-0">{inner}</Link>
        )}

        {slides.length > 1 && (
          <div className="absolute right-4 top-4 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show slide ${i + 1} of ${slides.length}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn("h-2 min-h-0 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePromoCard;
