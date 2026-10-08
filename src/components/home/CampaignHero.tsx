import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroCampaign } from "@/content/home";

/**
 * The page's single lead story: one campaign, one primary action.
 * Static by design — no carousel, no auto-advance.
 */
const CampaignHero: React.FC = () => {
  const { eyebrow, title, description, primary, secondary, image, caption } = heroCampaign;

  return (
    <section aria-labelledby="hero-title" className="bg-surface-muted">
      <div className="page-container grid items-center gap-8 pb-10 pt-10 md:gap-10 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-20">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-3 text-gold">
            <span aria-hidden className="h-px w-8 bg-current" />
            {eyebrow}
          </p>
          <h1 id="hero-title" className="type-display mt-4 text-foreground">{title}</h1>
          <p className="type-lead mt-5 max-w-md text-text-secondary">{description}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <Button asChild variant="cta" size="lg" className="h-12 rounded-full px-7">
              <Link to={primary.to}>{primary.label}</Link>
            </Button>
            <Link to={secondary.to} className="link-arrow min-h-[44px] justify-center text-foreground sm:justify-start">
              {secondary.label} <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>

        <figure className="relative min-w-0">
          {/* The LCP image: eager, high priority, with reserved space. */}
          <img
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            // Lowercase on purpose: React 18 only passes the attribute through in this form.
            {...{ fetchpriority: "high" }}
            decoding="async"
            className="aspect-square w-full rounded-[1.75rem] bg-background object-cover md:rounded-[2.25rem]"
          />
          <figcaption className="absolute bottom-4 left-4 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-soft">
            {caption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

export default CampaignHero;
