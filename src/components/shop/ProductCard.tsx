import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Heart, ShoppingCart, Eye } from "lucide-react";
import { Product } from "@/types";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import StarRating from "@/components/ui/star-rating";
import { GoldPriceDisplay } from "@/components/gold";

interface ProductCardProps {
  product: Product;
  className?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, className }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [selectedVariation, setSelectedVariation] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  const attributeTypes = React.useMemo(() => {
    if (!product.variations || product.variations.length === 0) return [];
    const types = new Set<string>();
    product.variations.forEach(v => {
      if (v.attributes && typeof v.attributes === 'object') {
        Object.entries(v.attributes).forEach(([key, value]) => {
          if (key && !key.startsWith('_') && value !== null && value !== undefined && String(value).trim() !== '') {
            types.add(key);
          }
        });
      }
    });
    return Array.from(types);
  }, [product.variations]);

  const getAttributeValues = (type: string) => {
    if (!product.variations || type.startsWith('_')) return [];
    const values = new Set<string>();
    product.variations.forEach(v => {
      if (v.attributes && v.attributes[type]) {
        const value = String(v.attributes[type]).trim();
        if (value !== '') values.add(value);
      }
    });
    return Array.from(values);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsAdding(true);
    const variation = product.variations?.find(v => v.id === selectedVariation);
    
    addToCart({
      productId: product.id,
      name: product.name,
      price: applyPlatformMarkup(variation?.price || product.price),
      image: variation?.imageUrl || product.images[0],
      variationId: selectedVariation || undefined,
      variationAttributes: variation?.attributes,
    });

    setTimeout(() => setIsAdding(false), 600);
  };

  const markedUpPrice = applyPlatformMarkup(product.price);
  const markedUpCompareAt = product.compareAtPrice ? applyPlatformMarkup(product.compareAtPrice) : undefined;
  const isNew = new Date(product.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isOnSale = markedUpCompareAt && markedUpCompareAt > markedUpPrice;
  const discountPercent = isOnSale
    ? Math.round(((markedUpCompareAt! - markedUpPrice) / markedUpCompareAt!) * 100)
    : 0;

  return (
    <div className={cn("product-card group relative", className)}>
      <Link to={`/product/${product.slug}`} className="block h-full">
        {/* Product Image */}
        <div className="relative overflow-hidden aspect-square bg-muted/30">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
            }}
          />

          {/* Overlay actions */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Quick actions bar */}
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-center gap-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 shadow-lg",
                isAdding
                  ? "bg-green-500 text-white scale-95"
                  : "bg-white text-foreground hover:bg-primary hover:text-primary-foreground"
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              {isAdding ? "Added!" : product.inStock ? "Add to Cart" : "Sold Out"}
            </button>
            <Link
              to={`/product/${product.slug}`}
              className="p-2 rounded-lg bg-white/90 text-foreground hover:bg-white transition-colors shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Wishlist button */}
          <button
            className={cn(
              "absolute top-2.5 right-2.5 p-2 rounded-full transition-all duration-300 shadow-sm",
              isInWishlist(product.id)
                ? "bg-red-500 text-white scale-100"
                : "bg-white/80 backdrop-blur-sm text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
          >
            <Heart
              size={14}
              className={isInWishlist(product.id) ? "fill-current" : ""}
            />
          </button>

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {isNew && (
              <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                NEW
              </Badge>
            )}
            {isOnSale && (
              <Badge className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm">
                -{discountPercent}%
              </Badge>
            )}
            {!product.inStock && (
              <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5 rounded-md">
                Sold Out
              </Badge>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-3 md:p-4">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {product.category}
          </div>
          <h3 className="font-semibold text-foreground text-sm leading-tight mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Vendor */}
          {product.vendorName && product.vendorSlug && (
            <div className="text-[11px] text-muted-foreground mb-2">
              <span
                className="hover:text-primary transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/store/${product.vendorSlug}`;
                }}
              >
                by {product.vendorName}
              </span>
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <StarRating rating={product.rating} />
            <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <GoldPriceDisplay
              price={applyPlatformMarkup(selectedVariation ? (product.variations?.find(v => v.id === selectedVariation)?.price || product.price) : product.price)}
              compareAtPrice={markedUpCompareAt}
              size="md"
            />
          </div>

          {/* Compact variation selector */}
          {product.variations && product.variations.length > 0 && attributeTypes.length > 0 && (
            <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
              {attributeTypes.slice(0, 1).map(attrType => {
                const values = getAttributeValues(attrType);
                if (values.length === 0) return null;
                return (
                  <div key={attrType} className="flex flex-wrap gap-1">
                    {values.slice(0, 4).map(value => {
                      const matchingVariation = product.variations?.find(
                        v => v.attributes && v.attributes[attrType] === value
                      );
                      const isSelected = selectedVariation === matchingVariation?.id;
                      return (
                        <button
                          key={value}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedVariation(matchingVariation?.id || null);
                          }}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-medium border rounded-md transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                    {values.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-center">+{values.length - 4}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
