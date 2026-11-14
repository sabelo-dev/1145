import React, { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Car, ShoppingBag, Store } from "lucide-react";
import SEO from "@/components/SEO";

// Analytics brings the data client with it, so it loads after the page paints.
const analytics = () => import("@/lib/analytics");

/**
 * Landing page for paid and social traffic: /start, or /start?for=shop|vendor|driver
 * for an ad aimed at one audience. Each audience gets exactly one call to action
 * that leads straight into a flow that works for a signed-out visitor.
 *
 * Kept deliberately light for mobile data: no header, footer, product data or
 * photos, and the brand load animation is skipped on this path
 * (src/brand/loader.html), so the call to action is the first thing painted.
 */

type Audience = "shop" | "vendor" | "driver";

const AUDIENCES: Record<Audience, {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  to: string;
}> = {
  shop: {
    icon: ShoppingBag,
    eyebrow: "Shop",
    title: "African brands and local merchants, delivered.",
    description: "Find something you love and check out in minutes.",
    points: ["Card, Instant EFT or SnapScan via PayFast", "Free delivery over R1 000", "30-day returns"],
    cta: "Order now",
    to: "/shop",
  },
  vendor: {
    icon: Store,
    eyebrow: "Sell",
    title: "Open your store on 1145.",
    description: "Start free on the Starter plan and upgrade when you grow.",
    points: ["List up to 25 products free", "10% commission, no monthly fee", "Payouts every 7 days"],
    cta: "Become a vendor",
    // Create the account as a merchant, then straight into store onboarding.
    to: "/register?role=merchant&redirect=%2Fmerchant%2Fonboarding",
  },
  driver: {
    icon: Car,
    eyebrow: "Drive",
    title: "Earn on your schedule.",
    description: "Take rides and deliveries near you with the 1145 Driver app.",
    points: ["Sign up in a few minutes", "Verify your ID and vehicle", "Start once you're approved"],
    cta: "Drive with 1145",
    // Create the account as a driver, then straight into driver onboarding.
    to: "/register?role=driver&redirect=%2Fdriver%2Fonboarding",
  },
};

const ORDER: Audience[] = ["shop", "vendor", "driver"];

// Words an ad link might use for each audience.
const ALIASES: Record<string, Audience> = {
  shop: "shop", order: "shop", buy: "shop", shopper: "shop",
  vendor: "vendor", sell: "vendor", seller: "vendor", merchant: "vendor",
  driver: "driver", drive: "driver",
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const StartPage: React.FC = () => {
  const [params] = useSearchParams();
  const audience = ALIASES[(params.get("for") || "").toLowerCase()] as Audience | undefined;

  // Which ad brought the visitor, sent with every event from this page.
  const utm = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) out[key] = value;
    }
    return out;
  }, [params]);

  useEffect(() => {
    analytics()
      .then(({ track }) => track("home_impression", { page: "start", audience: audience ?? "all", ...utm }))
      .catch(() => {});
  }, [audience, utm]);

  // The buttons are full page loads into the app, which would cut off a queued
  // event: send the click first (waiting at most 400 ms), then go.
  const onCta = (e: React.MouseEvent<HTMLAnchorElement>, which: Audience) => {
    const props = { campaign: `start-${which}`, audience: which, ...utm };
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      analytics().then(({ track }) => track("campaign_click", props)).catch(() => {});
      return; // opening in a new tab: leave the browser to it
    }
    e.preventDefault();
    const href = e.currentTarget.href;
    const sent = analytics().then(({ track, flushNow }) => {
      track("campaign_click", props);
      return flushNow();
    });
    Promise.race([sent, new Promise((resolve) => setTimeout(resolve, 400))])
      .catch(() => {})
      .finally(() => window.location.assign(href));
  };

  const shown = audience ? [audience] : ORDER;
  const others = audience ? ORDER.filter((a) => a !== audience) : [];

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <SEO
        title={audience ? `${AUDIENCES[audience].cta} | 1145` : "Shop, sell or drive with 1145"}
        description="Shop African brands and local merchants, open your own store, or drive with 1145."
      />

      <header className="page-container flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2 font-semibold" aria-label="1145 home">
          <img src="/logo-mark-96.webp" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="text-lg">1145</span>
        </a>
        <a href="/login" className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
          Sign in
        </a>
      </header>

      <main className="page-container pb-12 pt-4 sm:pt-8">
        {!audience && (
          <div className="mb-8 max-w-2xl">
            <h1 className="type-display text-white">Shop, sell or drive with 1145.</h1>
            <p className="type-lead mt-4 text-white/75">One app for shopping, selling and driving. Pick where you want to start.</p>
          </div>
        )}

        <div className={audience ? "max-w-xl" : "grid gap-4 md:grid-cols-3"}>
          {shown.map((key) => {
            const a = AUDIENCES[key];
            const Icon = a.icon;
            const Heading = audience ? "h1" : "h2";
            return (
              <section
                key={key}
                aria-labelledby={`start-${key}`}
                className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"
              >
                <p className="eyebrow inline-flex items-center gap-2 text-gold">
                  <Icon className="h-4 w-4" aria-hidden /> {a.eyebrow}
                </p>
                <Heading id={`start-${key}`} className={`${audience ? "type-display" : "text-2xl font-semibold"} mt-3 text-white`}>
                  {a.title}
                </Heading>
                <p className="mt-3 text-white/75">{a.description}</p>
                <ul className="mb-auto mt-5 space-y-2 text-sm text-white/80">
                  {a.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                      {point}
                    </li>
                  ))}
                </ul>
                <a
                  href={a.to}
                  onClick={(e) => onCta(e, key)}
                  className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-semibold text-brand-foreground shadow-glow transition-colors hover:bg-brand-hover"
                >
                  {a.cta} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </section>
            );
          })}
        </div>

        {others.length > 0 && (
          <p className="mt-8 text-sm text-white/60">
            Looking for something else?{" "}
            {others.map((key, i) => (
              <React.Fragment key={key}>
                {i > 0 && " · "}
                <a href={`/start?for=${key}`} className="text-white/85 underline underline-offset-4 hover:text-white">
                  {AUDIENCES[key].cta}
                </a>
              </React.Fragment>
            ))}
          </p>
        )}
      </main>
    </div>
  );
};

export default StartPage;
