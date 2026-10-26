import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { collections } from "@/content/home";
import ResponsiveImage from "@/components/ui/responsive-image";
import { OFFICIAL_STORE_PATH } from "@/lib/officialStore";

/** A small set of current collections, each with its own image and a direct link. */
const CollectionGrid: React.FC = () => (
  <Section aria-labelledby="collections-title">
    <SectionHeader
      id="collections-title"
      eyebrow="The collection"
      title="Find your piece."
      action={{ to: OFFICIAL_STORE_PATH, label: "Shop everything" }}
    />
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 lg:grid-cols-4 lg:gap-x-6">
      {collections.map(({ name, linkLabel, to, image }) => (
        <li key={name} className="min-w-0">
          {/* One link per card; the image is decorative because the link names the destination. */}
          <Link to={to} aria-label={linkLabel} className="group block rounded-2xl">
            <ResponsiveImage
              src={image.src}
              sizes="(min-width: 1024px) 22vw, 45vw"
              alt=""
              width={image.width}
              height={image.height}
              loading="lazy"
              decoding="async"
              className="aspect-square w-full rounded-2xl bg-surface-muted object-cover transition-transform duration-300 ease-out-soft group-hover:scale-[1.015]"
            />
            <span className="mt-3 flex items-center justify-between gap-2 px-1">
              <span className="type-title text-foreground">{name}</span>
              <ArrowUpRight aria-hidden className="h-5 w-5 shrink-0 text-text-secondary transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </Section>
);

export default CollectionGrid;
