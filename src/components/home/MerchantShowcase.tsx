import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import HomePromoCard from "@/components/home/HomePromoCard";
import { track } from "@/lib/analytics";
import { useDeliveryArea } from "@/hooks/useDeliveryArea";
import { coverageLabel, deliversTo } from "@/lib/deliveryCoverage";

interface Storefront {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  category: string | null;
  regions: string[];
  methods: string[];
}

type StoreRef = { name: string; slug: string; logo_url: string | null };

/** Approved merchants with a live store, strongest first. */
async function loadStorefronts(): Promise<Storefront[]> {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, business_name, business_type, logo_url, shipping_regions, shipping_methods, stores(name, slug, logo_url)")
    .eq("status", "approved")
    .order("search_boost", { ascending: false, nullsFirst: false })
    .limit(12);
  if (error) return [];
  return (data ?? []).flatMap((m) => {
    const store: StoreRef | null = Array.isArray(m.stores) ? m.stores[0] : (m.stores as StoreRef | null);
    if (!store?.slug) return [];
    return [{
      id: m.id,
      name: store.name || m.business_name,
      slug: store.slug,
      logoUrl: store.logo_url || m.logo_url,
      category: m.business_type,
      regions: m.shipping_regions ?? [],
      methods: m.shipping_methods ?? [],
    }];
  });
}

const benefits = [
  "Reach shoppers across South Africa",
  "Payments, payouts and delivery handled",
  "Your own storefront and order console",
];

/**
 * Merchant discovery (verified storefronts) and merchant acquisition — the
 * page's secondary conversion path.
 */
const MerchantShowcase: React.FC = () => {
  const [all, setAll] = useState<Storefront[] | null>(null);
  const { area } = useDeliveryArea();
  // Only merchants that deliver to the visitor's province (or nationwide).
  const stores = useMemo(() => all?.filter((s) => deliversTo(s.regions, area?.province)) ?? null, [all, area?.province]);

  useEffect(() => {
    let alive = true;
    loadStorefronts().then((s) => alive && setAll(s)).catch(() => alive && setAll([]));
    return () => { alive = false; };
  }, []);

  return (
    <section aria-labelledby="merchants-title" className="section bg-surface-muted">
      <div className="page-container">
        {stores && stores.length >= 3 && (
          <div className="mb-14">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="eyebrow mb-3 text-text-secondary">Verified storefronts</p>
                <h2 id="merchants-title" className="type-headline">Shop trusted local merchants.</h2>
              </div>
              <Link to="/shop" className="link-arrow shrink-0 text-foreground">All stores <ArrowRight aria-hidden /></Link>
            </div>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" aria-label="Verified merchants">
              {stores.map((s) => (
                <li key={s.id} className="w-64 shrink-0 snap-start">
                  <Link
                    to={`/store/${s.slug}`}
                    onClick={() => track("category_click", { category: "storefront", store: s.slug, placement: "merchant_carousel" })}
                    className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40"
                  >
                    <span className="flex items-center gap-3">
                      {s.logoUrl ? (
                        <img src={s.logoUrl} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-background object-cover" />
                      ) : (
                        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-900 font-display text-lg font-bold text-gold">
                          {s.name.charAt(0)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{s.name}</span>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified merchant
                        </span>
                      </span>
                    </span>
                    {s.category && <span className="text-sm capitalize text-text-secondary">{s.category.replace(/_/g, " ")}</span>}
                    <span className="mt-auto flex items-start gap-2 text-xs text-text-secondary">
                      <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {[coverageLabel(s.regions), s.methods[0]].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="min-w-0">
            <p className="eyebrow text-gold">For businesses</p>
            <h2 id={stores && stores.length >= 3 ? undefined : "merchants-title"} className="type-headline mt-3">Grow your business with 1145.</h2>
            <p className="type-lead mt-4 max-w-lg text-text-secondary">
              Introduce your products to more customers through our marketplace. List once — we handle checkout, payments and delivery.
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Link
                to="/merchant/register"
                onClick={() => track("merchant_apply_click", { placement: "home_merchant" })}
                className="inline-flex h-12 items-center justify-center rounded-full bg-navy-900 px-7 font-semibold text-white transition-colors hover:bg-navy-700 dark:bg-gold dark:text-navy-900"
              >
                Become a merchant
              </Link>
              <Link to="/merchant/login" className="link-arrow min-h-[44px] justify-center text-foreground sm:justify-start">
                I already have a store <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
          <HomePromoCard />
        </div>
      </div>
    </section>
  );
};

export default MerchantShowcase;
