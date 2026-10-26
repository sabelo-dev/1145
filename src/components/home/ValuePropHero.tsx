import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Smartphone } from "lucide-react";
import HomeSearch from "@/components/home/HomeSearch";
import { valueProp } from "@/content/home";
import { useGoldPricingContext } from "@/contexts/GoldPricingContext";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import { track } from "@/lib/analytics";
import { DOWNLOADABLE_APPS } from "@/config/appDownloads";
import type { Product } from "@/types";

/**
 * The page's lead: what 1145 is, the app download as the primary action,
 * shopping as the immediate one, and search right there.
 * `spotlight` is a real catalogue product; its price chip floats over the
 * image so it never shifts the layout when it arrives.
 */
const ValuePropHero: React.FC<{ spotlight?: Product | null }> = ({ spotlight }) => {
  const { eyebrow, title, description, primary, secondary, image, secondaryImage } = valueProp;
  const { formatPrice } = useGoldPricingContext();

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-navy-900 text-white">
      {/* Decorative glow, clipped by the section so it never widens the page. */}
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 -z-10 h-[32rem] w-[32rem] rounded-full bg-cyan/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 -z-10 h-[26rem] w-[26rem] rounded-full bg-gold/10 blur-3xl" />

      <div className="page-container grid items-center gap-10 pb-12 pt-10 md:pb-16 md:pt-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14 lg:py-20">
        <div className="min-w-0">
          <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-gold">
            {eyebrow}
          </p>
          <h1 id="hero-title" className="type-display mt-5 text-white">{title}</h1>
          <p className="type-lead mt-5 max-w-xl text-white/75">{description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={primary.to}
              onClick={() => track("download_click", { placement: "hero" })}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground shadow-glow transition-colors hover:bg-brand-hover"
            >
              <Download className="h-5 w-5" aria-hidden /> {primary.label}
            </Link>
            <Link
              to={secondary.to}
              onClick={() => track("category_click", { category: "marketplace", placement: "hero" })}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              {secondary.label} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
            <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
            {DOWNLOADABLE_APPS[0].testFlightUrl ? "Free on Android. iPhone via TestFlight." : "Free on Android. iPhone coming soon."}
          </p>

          <HomeSearch inverse className="mt-8 max-w-xl" />
        </div>

        {/* Product visual: two real drop pieces, the first is the LCP image. */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="grid grid-cols-[3fr_2fr] items-end gap-3 sm:gap-4">
            <figure className="relative min-w-0 overflow-hidden rounded-[1.75rem] bg-cloud">
              <img
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                // Lowercase on purpose: React 18 only passes the attribute through in this form.
                {...{ fetchpriority: "high" }}
                decoding="async"
                className="aspect-[4/5] w-full object-cover"
              />
              <figcaption className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-xs font-bold text-navy-900">
                XIXLV
              </figcaption>
            </figure>
            <figure className="min-w-0 overflow-hidden rounded-[1.5rem] bg-cloud">
              <img
                src={secondaryImage.src}
                alt={secondaryImage.alt}
                width={secondaryImage.width}
                height={secondaryImage.height}
                loading="lazy"
                decoding="async"
                className="aspect-[3/4] w-full object-cover"
              />
            </figure>
          </div>

          {spotlight && (
            <Link
              to={`/product/${spotlight.slug}`}
              className="absolute -bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/95 p-3 shadow-float backdrop-blur sm:left-auto sm:right-6 sm:w-72"
            >
              {spotlight.images?.[0] && (
                <img src={spotlight.images[0]} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl bg-white object-cover" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{spotlight.name}</span>
                <span className="block text-sm font-bold text-gold">{formatPrice(applyPlatformMarkup(spotlight.price))}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default ValuePropHero;
