import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Check, Heart, Plus } from "lucide-react";
import { Product } from "@/types";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import { cn } from "@/lib/utils";
import StarRating from "@/components/ui/star-rating";
import { GoldPriceDisplay } from "@/components/gold";

interface ProductCardProps {
  product: Product;
  className?: string;
}

/** Common colour names → swatch colours; anything else renders as a text chip. */
const SWATCHES: Record<string, string> = {
  black: "#111111", white: "#FFFFFF", navy: "#1E2A4A", red: "#B3202A", stone: "#D6CCBE",
  grey: "#8A8F98", gray: "#8A8F98", beige: "#E3D5B8", green: "#2F6B3F", blue: "#2457A8",
  brown: "#6B4A33", pink: "#E7A3B8", cream: "#F2EAD8", khaki: "#B8A77A", olive: "#6B6B3A",
  sand: "#D8C6AC", taupe: "#C2B3A1", slate: "#7E7D7A", "stone grey": "#A8A29A",
  ivory: "#EFE9DD", oatmeal: "#DDD3C4", smoke: "#8F8B86", sage: "#9A9A88",
};
const COLOUR_KEYS = ["color", "colour"];

const ProductCard: React.FC<ProductCardProps> = ({ product, className }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const navigate = useNavigate();
  const [selectedVariation, setSelectedVariation] = React.useState<string | null>(null);
  const [justAdded, setJustAdded] = React.useState(false);

  const variations = product.variations ?? [];
  const selected = variations.find((v) => v.id === selectedVariation);

  // The first visible attribute (e.g. Color) drives the quick selector.
  const primaryAttr = React.useMemo(() => {
    for (const v of variations) {
      for (const [key, value] of Object.entries(v.attributes ?? {})) {
        if (!key.startsWith("_") && value != null && String(value).trim()) return key;
      }
    }
    return null;
  }, [variations]);

  const options = React.useMemo(() => {
    if (!primaryAttr) return [];
    const seen = new Map<string, (typeof variations)[number]>();
    for (const v of variations) {
      const value = String(v.attributes?.[primaryAttr] ?? "").trim();
      if (value && !seen.has(value)) seen.set(value, v);
    }
    return [...seen.entries()].map(([value, variation]) => ({ value, variation }));
  }, [primaryAttr, variations]);

  const isColour = !!primaryAttr && COLOUR_KEYS.includes(primaryAttr.toLowerCase());

  // Out of stock (the chosen option, or the whole product): pre-order if allowed, else sold out.
  const outOfStock = selected ? (selected.quantity ?? 0) <= 0 : !product.inStock;
  const preorder = outOfStock && !!product.allowPreorder;
  const unavailable = outOfStock && !preorder;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart({
      productId: product.id,
      name: product.name,
      price: applyPlatformMarkup(selected?.price || product.price),
      image: selected?.imageUrl || product.images[0],
      variationId: selected?.id,
      variationAttributes: selected?.attributes,
      preorder,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const price = applyPlatformMarkup(selected?.price || product.price);
  const markedUpCompareAt = product.compareAtPrice ? applyPlatformMarkup(product.compareAtPrice) : undefined;
  const isNew = new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isOnSale = !!markedUpCompareAt && markedUpCompareAt > price;
  const discountPercent = isOnSale ? Math.round(((markedUpCompareAt! - price) / markedUpCompareAt!) * 100) : 0;
  const image = selected?.imageUrl || product.images[0];
  const wished = isInWishlist(product.id);

  return (
    <div className={cn("product-card group relative flex h-full flex-col", className)}>
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        <img
          src={image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]"
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
        />

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col gap-1.5">
          {preorder ? (
            <span className="rounded-md bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-gold">Pre-order</span>
          ) : unavailable ? (
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[11px] font-bold text-background">Sold out</span>
          ) : isOnSale ? (
            <span className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">-{discountPercent}%</span>
          ) : isNew ? (
            <span className="rounded-md bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-gold">NEW</span>
          ) : null}
        </div>

        {/* Always visible on touch; revealed on hover with a mouse. */}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={wished}
          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
          className={cn(
            "absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-soft transition-all",
            wished
              ? "bg-destructive text-destructive-foreground"
              : "bg-background/90 text-foreground backdrop-blur hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100",
          )}
        >
          <Heart className={cn("h-4 w-4", wished && "fill-current")} />
        </button>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={unavailable}
          aria-label={unavailable ? "Sold out" : `${preorder ? "Pre-order" : "Add"} ${product.name}`}
          className={cn(
            "absolute bottom-2.5 right-2.5 z-10 flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold shadow-elevated transition-all disabled:hidden",
            justAdded ? "bg-success text-success-foreground" : "bg-background text-foreground hover:bg-cta hover:text-cta-foreground",
            "[@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100",
          )}
        >
          {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          <span className="hidden sm:inline">{justAdded ? "Added" : preorder ? "Pre-order" : "Add"}</span>
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 md:p-4">
        {product.vendorName && product.vendorSlug ? (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); navigate(`/store/${product.vendorSlug}`); }}
            className="relative z-10 w-fit truncate text-left text-xs font-medium text-text-secondary hover:text-foreground hover:underline"
          >
            {product.vendorName}
          </button>
        ) : (
          <span className="text-xs font-medium text-text-secondary">{product.category}</span>
        )}

        {/* Stretched link: the whole card opens the product, without nesting other controls inside a link. */}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          <Link to={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
          </Link>
        </h3>

        {product.reviewCount > 0 && (
          <div className="flex items-center gap-1">
            <StarRating rating={product.rating} />
            <span className="text-xs text-text-secondary">({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <GoldPriceDisplay price={price} compareAtPrice={markedUpCompareAt} size="md" />
        </div>

        {options.length > 1 && (
          <div className="relative z-10 flex flex-wrap items-center gap-1 pt-1 sm:gap-1.5" role="group" aria-label={primaryAttr ?? "Options"}>
            {options.slice(0, 5).map(({ value, variation }) => {
              const isSelected = selectedVariation === variation.id;
              const swatch = isColour ? SWATCHES[value.toLowerCase()] : undefined;
              return swatch ? (
                <button
                  key={value}
                  type="button"
                  title={value}
                  aria-label={value}
                  aria-pressed={isSelected}
                  onClick={(e) => { e.preventDefault(); setSelectedVariation(isSelected ? null : variation.id); }}
                  className={cn(
                    "h-5 min-h-0 w-5 rounded-full border border-black/15 ring-offset-2 ring-offset-card transition-shadow sm:h-6 sm:w-6",
                    isSelected ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-foreground/30",
                  )}
                  style={{ backgroundColor: swatch }}
                />
              ) : (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={(e) => { e.preventDefault(); setSelectedVariation(isSelected ? null : variation.id); }}
                  className={cn(
                    "h-6 min-h-0 rounded-md border px-1.5 text-[11px] font-medium transition-colors sm:h-7 sm:px-2 sm:text-xs",
                    isSelected ? "border-foreground bg-foreground text-background" : "border-border text-text-secondary hover:border-foreground/40",
                  )}
                >
                  {value}
                </button>
              );
            })}
            {options.length > 5 && <span className="text-xs text-text-secondary">+{options.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
