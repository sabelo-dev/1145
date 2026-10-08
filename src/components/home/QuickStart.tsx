import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { quickStart } from "@/content/home";

/**
 * The three things people come to do most — ride, shop, stay — one tap from
 * the top of the page. Sits directly under the hero.
 */
const QuickStart: React.FC = () => (
  <section aria-labelledby="quick-start-title" className="section-compact border-b border-border bg-background">
    <div className="page-container">
      <h2 id="quick-start-title" className="sr-only">Get started</h2>
      <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
        {quickStart.map(({ title, desc, cta, icon: Icon, to }) => (
          <li key={to} className="min-w-0">
            <Link
              to={to}
              className="group flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 hover:bg-surface-hover md:flex-col md:items-start md:gap-0 md:p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-cyan md:h-14 md:w-14">
                <Icon className="h-6 w-6 md:h-7 md:w-7" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 md:mt-5">
                <span className="type-title block text-foreground">{title}</span>
                <span className="mt-0.5 block text-sm text-text-secondary md:mt-1.5 md:text-base">{desc}</span>
              </span>
              <span className="link-arrow shrink-0 text-foreground md:mt-6">
                <span className="hidden md:inline">{cta}</span> <ArrowRight aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default QuickStart;
