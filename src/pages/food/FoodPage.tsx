import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Search, Store, UtensilsCrossed } from "lucide-react";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEateries } from "@/services/food";
import { useFoodCart } from "@/contexts/FoodCartContext";
import { cn, formatCurrency } from "@/lib/utils";
import type { Eatery } from "@/types/food";

const EateryCard: React.FC<{ eatery: Eatery }> = ({ eatery }) => (
  <Link
    to={`/food/${eatery.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/25"
  >
    <div className="relative aspect-[16/9] bg-surface-muted">
      {eatery.cover_url ? (
        <img src={eatery.cover_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-text-secondary">
          <UtensilsCrossed className="h-10 w-10" aria-hidden />
        </span>
      )}
      {!eatery.accepting_orders && (
        <span className="absolute left-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
          Closed
        </span>
      )}
    </div>
    <div className="flex flex-1 flex-col gap-1 p-4">
      <h3 className="type-title text-foreground">{eatery.name}</h3>
      {eatery.cuisines.length > 0 && <p className="truncate text-sm text-text-secondary">{eatery.cuisines.join(" · ")}</p>}
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-sm text-text-secondary tabular-nums">
        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden /> about {eatery.prep_time_min} min prep</span>
        <span>{eatery.delivery_fee > 0 ? `${formatCurrency(eatery.delivery_fee)} delivery` : "Free delivery"}</span>
      </p>
    </div>
  </Link>
);

const FoodPage: React.FC = () => {
  const { data: eateries, isLoading, isError } = useQuery({ queryKey: ["eateries"], queryFn: fetchEateries, staleTime: 60_000 });
  const basket = useFoodCart();
  const [searchParams, setSearchParams] = useSearchParams();
  // Arriving from the home planner: /food?q=…
  const [query, setQuery] = useState(() => searchParams.get("q")?.trim() ?? "");
  const [cuisine, setCuisine] = useState<string | null>(null);
  // "Delivering to": kept in the address so a filtered view can be shared or bookmarked.
  const area = searchParams.get("area") ?? "";
  const setArea = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("area", value); else next.delete("area");
    setSearchParams(next, { replace: true });
  };

  const cuisines = useMemo(
    () => [...new Set((eateries ?? []).flatMap((e) => e.cuisines))].sort((a, b) => a.localeCompare(b)),
    [eateries],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (eateries ?? []).filter((e) =>
      (!cuisine || e.cuisines.includes(cuisine))
      // An eatery with no list delivers anywhere, so it matches every area.
      && (!area || e.delivery_areas.length === 0 || e.delivery_areas.some((a) => a.toLowerCase() === area.toLowerCase()))
      && (!q || [e.name, e.city, ...e.cuisines].some((text) => text.toLowerCase().includes(q))));
  }, [eateries, query, cuisine, area]);

  const areas = useMemo(
    () => [...new Set((eateries ?? []).flatMap((e) => e.delivery_areas))].sort((a, b) => a.localeCompare(b)),
    [eateries],
  );

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Food delivery | 1145" description="Order from local eateries on 1145 and have it delivered to your door." />

      <section className="border-b border-border bg-surface-muted">
        <div className="page-container py-10 md:py-14">
          <p className="eyebrow text-text-secondary">Food delivery</p>
          <h1 className="type-headline mt-2">Order from local eateries.</h1>
          <p className="type-lead mt-3 max-w-xl text-text-secondary">Pick an eatery, fill your basket and a 1145 driver brings it to you.</p>
          <div className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search eateries, cuisines or a city"
              aria-label="Search eateries"
              className="h-12 w-full rounded-full border border-border bg-background pl-11 pr-4 text-base text-foreground placeholder:text-text-secondary focus:border-foreground focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="page-container section-compact" aria-labelledby="eateries-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 id="eateries-title" className="type-title">
            {isLoading ? "Finding eateries…" : `${shown.length} ${shown.length === 1 ? "eatery" : "eateries"}`}
          </h2>
          <Link to="/food/orders" className="link-arrow text-foreground">My food orders <ArrowRight aria-hidden /></Link>
        </div>

        {areas.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="food-area" className="text-sm font-medium text-foreground">Delivering to</label>
            <select
              id="food-area" value={area} onChange={(e) => setArea(e.target.value)}
              className="h-11 rounded-full border border-border bg-background px-4 text-sm text-foreground focus:border-foreground focus:outline-none"
            >
              <option value="">Any area</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              {area && !areas.some((a) => a.toLowerCase() === area.toLowerCase()) && <option value={area}>{area}</option>}
            </select>
          </div>
        )}

        {cuisines.length > 1 && (
          <div role="group" aria-label="Filter by cuisine" className="mb-6 flex flex-wrap gap-2">
            {[null, ...cuisines].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                aria-pressed={cuisine === c}
                onClick={() => setCuisine(c)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                  cuisine === c ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-surface-hover",
                )}
              >
                {c ?? "All"}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <p role="alert" className="rounded-2xl border border-border p-8 text-center text-text-secondary">
            We couldn't load eateries right now. Please try again in a moment.
          </p>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
            <p className="type-title mt-4">{eateries?.length ? "No eateries match your search" : "No eateries are listed yet"}</p>
            <p className="mt-2 text-text-secondary">
              {eateries?.length ? "Try a different name, cuisine, city or delivery area." : "Own a restaurant, café or takeaway? List it on 1145."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((eatery) => <li key={eatery.id} className="min-w-0"><EateryCard eatery={eatery} /></li>)}
          </ul>
        )}

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-surface-muted p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-cyan"><Store className="h-6 w-6" aria-hidden /></span>
            <div>
              <p className="font-semibold text-foreground">Run an eatery?</p>
              <p className="text-sm text-text-secondary">List your menu and take delivery orders on 1145.</p>
            </div>
          </div>
          <Link to="/eatery/dashboard" className="link-arrow text-foreground">List your eatery <ArrowRight aria-hidden /></Link>
        </div>
      </section>

      {/* Basket shortcut: sits above the phone bottom bar */}
      {basket.eatery && basket.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] z-40 px-4 md:bottom-6">
          <Link
            to={`/food/${basket.eatery.slug}`}
            className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 rounded-full bg-cta px-6 font-semibold text-cta-foreground shadow-float"
          >
            <span className="truncate">Basket · {basket.eatery.name}</span>
            <span className="shrink-0 tabular-nums">{basket.itemCount} · {formatCurrency(basket.subtotal)}</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default FoodPage;
