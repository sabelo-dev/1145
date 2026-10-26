import React from "react";
import { Link } from "react-router-dom";
import { trustPoints } from "@/content/home";

/** Payment, delivery, returns and merchant facts, right where purchase hesitation starts. */
const TrustStrip: React.FC = () => (
  <section aria-labelledby="trust-title" className="border-y border-border bg-background">
    <div className="page-container py-4 md:py-5">
      <h2 id="trust-title" className="sr-only">Shopping with confidence</h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {trustPoints.map(({ title, desc, icon: Icon, to }) => (
          <li key={title} className="min-w-0">
            <Link to={to} className="flex h-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-hover">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-soft text-brand dark:bg-surface-input">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="block text-xs text-text-secondary">{desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default TrustStrip;
