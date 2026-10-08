import React from "react";
import { Link } from "react-router-dom";
import { Section, SectionHeader } from "@/components/ui/section";
import { services } from "@/content/home";

/** What 1145 offers, at a glance. Every tile is a live route. */
const ServiceRail: React.FC = () => (
  <Section compact aria-labelledby="services-title" className="border-b border-border">
    <SectionHeader
      id="services-title"
      title="One account. Everything 1145."
      action={{ to: "/services", label: "All services" }}
      className="mb-6 md:mb-8"
    />
    <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
      {services.map(({ name, desc, icon: Icon, href }) => (
        <li key={name} className="min-w-0">
          <Link
            to={href}
            className="group flex h-full flex-col items-center gap-2 rounded-2xl p-2 text-center transition-colors hover:bg-surface-hover sm:items-start sm:border sm:border-border sm:bg-card sm:p-4 sm:text-left sm:hover:border-foreground/20 sm:hover:bg-card"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-input text-foreground transition-colors group-hover:bg-navy-900 group-hover:text-cyan sm:h-11 sm:w-11 sm:rounded-xl">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 sm:mt-2">
              <span className="block text-xs font-semibold text-foreground sm:text-sm">{name}</span>
              <span className="hidden text-xs text-text-secondary sm:block">{desc}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </Section>
);

export default ServiceRail;
