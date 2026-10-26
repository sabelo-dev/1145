import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { growthPrograms } from "@/content/home";
import { track } from "@/lib/analytics";

/** Referral and creator programmes: the organic acquisition loop. */
const GrowthPrograms: React.FC = () => (
  <Section aria-labelledby="grow-title">
    <SectionHeader id="grow-title" eyebrow="Earn with 1145" title="Share what you love. Get rewarded." />
    <ul className="grid gap-4 md:grid-cols-2">
      {growthPrograms.map(({ id, eyebrow, title, desc, cta, icon: Icon }) => (
        <li key={id} className="min-w-0">
          <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-gold">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <p className="eyebrow mt-6 text-text-secondary">{eyebrow}</p>
            <h3 className="type-title mt-2 text-foreground">{title}</h3>
            <p className="mt-3 flex-1 text-text-secondary">{desc}</p>
            <Link
              to={cta.to}
              onClick={() => track(id === "referral" ? "referral_click" : "creator_click", { placement: "home" })}
              className="link-arrow mt-6 min-h-[44px] text-brand"
            >
              {cta.label} <ArrowRight aria-hidden />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  </Section>
);

export default GrowthPrograms;
