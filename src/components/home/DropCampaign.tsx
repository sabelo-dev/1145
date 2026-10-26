import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dropCampaign, type HomeImage } from "@/content/home";
import ResponsiveImage from "@/components/ui/responsive-image";
import { track } from "@/lib/analytics";

interface Campaign {
  id: string;
  title: string;
  image: HomeImage;
  to: string;
  closes: string | null;
}

const fallback: Campaign = {
  id: "xixlv-drop",
  title: dropCampaign.title,
  image: dropCampaign.image,
  to: dropCampaign.cta.to,
  closes: dropCampaign.closes,
};

/**
 * The live "hero" banner scheduled in Admin → CMS, if there is one. Admins
 * publish and schedule campaigns there without a website deployment.
 */
async function loadScheduledCampaign(): Promise<Campaign | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cms_banners")
    .select("id, title, image_url, link_url, end_date")
    .eq("position", "hero")
    .eq("is_active", true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    title: data.title,
    image: data.image_url ? { src: data.image_url, alt: "", width: 720, height: 720 } : fallback.image,
    to: data.link_url || fallback.to,
    closes: data.end_date,
  };
}

const closesLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date(iso));

/** The XIXLV DROP competition, or whichever campaign is scheduled in its place. */
const DropCampaign: React.FC = () => {
  const [campaign, setCampaign] = useState<Campaign>(fallback);

  useEffect(() => {
    let alive = true;
    loadScheduledCampaign().then((c) => alive && c && setCampaign(c)).catch(() => {});
    return () => { alive = false; };
  }, []);

  // The built-in competition hides itself once it has closed.
  if (campaign.id === fallback.id && campaign.closes && new Date(campaign.closes) < new Date()) return null;

  const external = /^https?:\/\//.test(campaign.to);
  const onClick = () => track("campaign_click", { campaign: campaign.id });

  return (
    <section aria-labelledby="drop-title" className="section">
      <div className="page-container">
        <div className="relative isolate grid overflow-hidden rounded-[2rem] bg-navy-900 text-white lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 -z-10 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="min-w-0 p-6 sm:p-10 lg:p-12">
            <p className="eyebrow inline-flex rounded-full bg-gold px-3 py-1 text-navy-900">{dropCampaign.eyebrow}</p>
            <h2 id="drop-title" className="type-headline mt-5 text-white">{campaign.title}</h2>

            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {dropCampaign.steps.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan font-bold text-navy-900">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">{step.title}</span>
                    <span className="block text-sm text-white/70">{step.desc}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              {external ? (
                <a href={campaign.to} onClick={onClick} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold px-7 font-semibold text-navy-900 transition-opacity hover:opacity-90">
                  {dropCampaign.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              ) : (
                <Link to={campaign.to} onClick={onClick} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gold px-7 font-semibold text-navy-900 transition-opacity hover:opacity-90">
                  {dropCampaign.cta.label} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
                {campaign.closes && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-4 w-4" aria-hidden /> Closes {closesLabel(campaign.closes)}
                  </span>
                )}
                <span aria-hidden>·</span>
                <Link to={dropCampaign.terms.to} className="underline underline-offset-4 hover:text-white">{dropCampaign.terms.label}</Link>
              </p>
            </div>
          </div>

          <div className="relative min-h-[14rem] lg:min-h-full">
            <ResponsiveImage
              src={campaign.image.src}
              sizes="(min-width: 1024px) 38vw, 90vw"
              alt={campaign.image.alt}
              width={campaign.image.width}
              height={campaign.image.height}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DropCampaign;
