import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Briefcase, Clock, Search, Star } from "lucide-react";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchProviderRatings, fetchPublishedListings, fetchServiceCategories, formatMinor } from "@/services/serviceMarketplace";
import { cn } from "@/lib/utils";
import type { ProviderRating, ServiceListing } from "@/types/services";

const PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "50000", label: "Up to R500" },
  { value: "150000", label: "Up to R1,500" },
  { value: "500000", label: "Up to R5,000" },
];
const DELIVERY_OPTIONS = [
  { value: "", label: "Any delivery time" },
  { value: "3", label: "Within 3 days" },
  { value: "7", label: "Within 7 days" },
  { value: "14", label: "Within 14 days" },
];
const SORT_OPTIONS = [
  { value: "", label: "Newest" },
  { value: "price", label: "Price: low to high" },
  { value: "fast", label: "Fastest delivery" },
];

const selectClass =
  "h-11 rounded-full border border-border bg-background px-4 text-sm text-foreground focus:border-foreground focus:outline-none";

const fromPrice = (l: ServiceListing) => Math.min(...(l.packages ?? []).map((p) => p.price_minor));
const fastest = (l: ServiceListing) => Math.min(...(l.packages ?? []).map((p) => p.delivery_days));

export const ListingCard: React.FC<{ listing: ServiceListing; rating?: ProviderRating }> = ({ listing, rating }) => {
  const several = (listing.packages?.length ?? 0) > 1;
  return (
    <Link
      to={`/hire/${listing.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/25"
    >
      <div className="aspect-[16/9] bg-surface-muted">
        {listing.image_url ? (
          <img src={listing.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-text-secondary"><Briefcase className="h-9 w-9" aria-hidden /></span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <span className="truncate">{listing.provider?.display_name}</span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-brand" aria-label="Approved by 1145" />
        </p>
        <h3 className="font-sans text-base font-semibold leading-snug tracking-normal text-foreground line-clamp-2">{listing.title}</h3>
        {listing.summary && <p className="line-clamp-2 text-sm text-text-secondary">{listing.summary}</p>}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <p className="tabular-nums">
            {several && <span className="text-xs text-text-secondary">From </span>}
            <span className="text-lg font-semibold text-foreground">{formatMinor(fromPrice(listing))}</span>
          </p>
          <p className="flex items-center gap-3 text-sm text-text-secondary tabular-nums">
            {rating && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-4 w-4 fill-current text-gold" aria-hidden />
                {rating.average_rating.toFixed(1)} <span className="sr-only">out of 5 from</span> ({rating.review_count})
              </span>
            )}
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden /> {fastest(listing)} {fastest(listing) === 1 ? "day" : "days"}</span>
          </p>
        </div>
      </div>
    </Link>
  );
};

/** Service marketplace landing: search, categories and filters, all kept in the URL. */
const HirePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const maxPrice = params.get("max") ?? "";
  const within = params.get("days") ?? "";
  const sort = params.get("sort") ?? "";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const { data: listings, isLoading, isError } = useQuery({ queryKey: ["service-listings"], queryFn: fetchPublishedListings, staleTime: 60_000 });
  const { data: categories } = useQuery({ queryKey: ["service-categories"], queryFn: fetchServiceCategories, staleTime: 300_000 });
  const { data: ratings } = useQuery({ queryKey: ["service-ratings"], queryFn: fetchProviderRatings, staleTime: 300_000 });

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (listings ?? []).filter((l) =>
      (!category || l.category?.slug === category)
      && (!maxPrice || fromPrice(l) <= Number(maxPrice))
      && (!within || fastest(l) <= Number(within))
      && (!needle || [l.title, l.summary ?? "", l.provider?.display_name ?? "", l.category?.name ?? ""].some((t) => t.toLowerCase().includes(needle))));
    if (sort === "price") list.sort((a, b) => fromPrice(a) - fromPrice(b));
    if (sort === "fast") list.sort((a, b) => fastest(a) - fastest(b));
    return list;
  }, [listings, q, category, maxPrice, within, sort]);

  const filtered = !!(q || category || maxPrice || within);
  // Only offer categories that have something in them.
  const usedCategories = (categories ?? []).filter((c) => (listings ?? []).some((l) => l.category?.id === c.id));

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Hire a pro | 1145 Services" description="Order clearly scoped services from approved freelancers, agencies and local businesses on 1145." />

      <section className="border-b border-border bg-surface-muted">
        <div className="page-container py-10 md:py-14">
          <p className="eyebrow text-text-secondary">1145 Services</p>
          <h1 className="type-headline mt-2">Hire a pro for the job.</h1>
          <p className="type-lead mt-3 max-w-2xl text-text-secondary">
            Fixed-price services from providers approved by 1145. You see what's included, the price and the delivery time before you pay,
            and the whole order — brief, messages and delivery — stays in one place.
          </p>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input
              type="search" value={q} onChange={(e) => set("q", e.target.value)}
              placeholder="Search services or providers" aria-label="Search services"
              className="h-12 w-full rounded-full border border-border bg-background pl-11 pr-4 text-base text-foreground placeholder:text-text-secondary focus:border-foreground focus:outline-none"
            />
          </form>
        </div>
      </section>

      <section className="page-container section-compact" aria-labelledby="services-results">
        {usedCategories.length > 1 && (
          <div role="group" aria-label="Category" className="mb-4 flex flex-wrap gap-2">
            {[{ slug: "", name: "All services", id: "all" }, ...usedCategories].map((c) => (
              <button
                key={c.id} type="button" aria-pressed={category === c.slug} onClick={() => set("category", c.slug)}
                className={cn("h-10 rounded-full border px-4 text-sm font-medium transition-colors",
                  category === c.slug ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-surface-hover")}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <select aria-label="Price" value={maxPrice} onChange={(e) => set("max", e.target.value)} className={selectClass}>
            {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="Delivery time" value={within} onChange={(e) => set("days", e.target.value)} className={selectClass}>
            {DELIVERY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="Sort by" value={sort} onChange={(e) => set("sort", e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {filtered && <Button variant="ghost" className="h-11 rounded-full" onClick={() => setParams({}, { replace: true })}>Clear filters</Button>}
          <Link to="/hire/orders" className="link-arrow ml-auto min-h-[44px] text-foreground">My service orders <ArrowRight aria-hidden /></Link>
        </div>

        <h2 id="services-results" className="type-title mb-4" aria-live="polite">
          {isLoading ? "Loading services…" : `${shown.length} ${shown.length === 1 ? "service" : "services"}`}
        </h2>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
        ) : isError ? (
          <p role="alert" className="rounded-2xl border border-border p-8 text-center text-text-secondary">We couldn't load services right now. Please try again in a moment.</p>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-text-secondary" aria-hidden />
            <p className="type-title mt-4">{filtered ? "No services match those filters" : "No services are listed yet"}</p>
            <p className="mt-2 text-text-secondary">{filtered ? "Try fewer filters or a different search." : "Offer a service? Apply to become a provider."}</p>
            {filtered && <Button variant="outline" className="mt-4 rounded-full" onClick={() => setParams({}, { replace: true })}>Reset filters</Button>}
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((l) => <li key={l.id} className="min-w-0"><ListingCard listing={l} rating={ratings?.get(l.provider_id)} /></li>)}
          </ul>
        )}

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-surface-muted p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold text-foreground">Offer a service?</p>
            <p className="text-sm text-text-secondary">Freelancers, agencies and local businesses can apply to sell on 1145. Every provider and listing is reviewed before it goes live.</p>
          </div>
          <Link to="/hire/provider" className="link-arrow shrink-0 text-foreground">Become a provider <ArrowRight aria-hidden /></Link>
        </div>
      </section>
    </div>
  );
};

export default HirePage;
