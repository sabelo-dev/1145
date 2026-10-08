import React from "react";
import ProductGrid from "@/components/shop/ProductGrid";
import { Section, SectionHeader, type SectionProps } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Product } from "@/types";

interface ProductRailProps {
  id: string;
  eyebrow?: string;
  title: string;
  action?: { to: string; label: string };
  /** `null` while loading: the rail reserves its space with skeletons. */
  products: Product[] | null;
  tone?: SectionProps["tone"];
}

/** A titled row of catalogue products. Renders nothing when the list is empty. */
const ProductRail: React.FC<ProductRailProps> = ({ id, eyebrow, title, action, products, tone }) => {
  if (products && products.length === 0) return null;

  return (
    <Section tone={tone} aria-labelledby={id} aria-busy={!products}>
      <SectionHeader id={id} eyebrow={eyebrow} title={title} action={action} />
      {products ? (
        <ProductGrid products={products} columns={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={i === 3 ? "md:hidden lg:block" : undefined}>
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

export default ProductRail;
