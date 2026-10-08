import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const tones = {
  default: "bg-background text-foreground",
  muted: "bg-surface-muted text-foreground",
  /** Brand navy band. Stays navy in dark mode too. */
  inverse: "bg-navy-900 text-white",
} as const;

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: keyof typeof tones;
  /** Tighter vertical rhythm for utility strips. */
  compact?: boolean;
  /** Classes for the inner content container. */
  containerClassName?: string;
}

/** A full-width page band with the shared content width and vertical rhythm. */
const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ tone = "default", compact = false, className, containerClassName, children, ...props }, ref) => (
    <section ref={ref} className={cn(tones[tone], compact ? "section-compact" : "section", className)} {...props}>
      <div className={cn("page-container", containerClassName)}>{children}</div>
    </section>
  ),
);
Section.displayName = "Section";

export interface SectionHeaderProps {
  /** Id for the heading, so the section can reference it with aria-labelledby. */
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /** One trailing link, e.g. "See all". */
  action?: { to: string; label: string };
  align?: "start" | "center";
  /** Set when the header sits on a dark (inverse) section. */
  inverse?: boolean;
  className?: string;
}

/** Eyebrow, heading, optional description and one trailing link. */
const SectionHeader: React.FC<SectionHeaderProps> = ({
  id, eyebrow, title, description, action, align = "start", inverse = false, className,
}) => (
  <div
    className={cn(
      "mb-8 flex flex-col gap-4 md:mb-10",
      align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
      className,
    )}
  >
    <div className={cn("min-w-0", align === "center" && "mx-auto max-w-2xl")}>
      {eyebrow && <p className={cn("eyebrow mb-3", inverse ? "text-white/70" : "text-text-secondary")}>{eyebrow}</p>}
      <h2 id={id} className={cn("type-headline", inverse && "text-white")}>{title}</h2>
      {description && (
        <p className={cn("type-lead mt-3 max-w-2xl", inverse ? "text-white/75" : "text-text-secondary")}>{description}</p>
      )}
    </div>
    {action && (
      <Link to={action.to} className={cn("link-arrow shrink-0", inverse ? "text-white" : "text-foreground")}>
        {action.label} <ArrowRight aria-hidden />
      </Link>
    )}
  </div>
);

export { Section, SectionHeader };
