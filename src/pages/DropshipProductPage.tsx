import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, cn } from "@/lib/utils";
import SEO from "@/components/SEO";
import { Truck, ShieldCheck, PackageCheck, Minus, Plus, ChevronLeft } from "lucide-react";

interface PublicDropshipProduct {
  id: string;
  name: string;
  description: string | null;
  images: any;
  category: string | null;
  stock: number;
  price_zar: number;
  store_product_id: string | null;
}

interface PublicDropshipVariant {
  id: string;
  dropship_product_id: string;
  name: string | null;
  sku: string | null;
  attributes: any;
  image_url: string | null;
  stock: number;
  price_zar: number;
}

const PLACEHOLDER = "/placeholder.svg";

const toImages = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw.filter((i) => typeof i === "string" && i.length > 0);
  if (typeof raw === "string" && raw) return [raw];
  return [];
};

const attributeLabel = (variant: PublicDropshipVariant): string => {
  const attrs = variant.attributes && typeof variant.attributes === "object" ? variant.attributes : {};
  const parts = Object.entries(attrs as Record<string, unknown>)
    .filter(([key, value]) => key && !key.startsWith("_") && value !== null && String(value).trim() !== "")
    .map(([, value]) => String(value));
  return parts.join(" / ") || variant.name || variant.sku || "Option";
};

const DropshipProductPage = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<PublicDropshipProduct | null>(null);
  const [variants, setVariants] = useState<PublicDropshipVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!productId) return;
      setLoading(true);
      const [{ data: p }, { data: v }] = await Promise.all([
        supabase.from("dropship_public_products").select("*").eq("id", productId).maybeSingle(),
        supabase.from("dropship_public_variants").select("*").eq("dropship_product_id", productId),
      ]);
      if (!active) return;
      setProduct((p as any) ?? null);
      const list = ((v as any[]) || []) as PublicDropshipVariant[];
      setVariants(list);
      setSelectedVariantId(list.find((x) => x.stock > 0)?.id ?? list[0]?.id ?? null);
      setActiveImage(0);
      setQuantity(1);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const gallery = useMemo(() => {
    const base = toImages(product?.images);
    const variantImages = variants.map((v) => v.image_url).filter(Boolean) as string[];
    const all = Array.from(new Set([...base, ...variantImages]));
    return all.length ? all : [PLACEHOLDER];
  }, [product, variants]);

  useEffect(() => {
    if (!selectedVariant?.image_url) return;
    const index = gallery.indexOf(selectedVariant.image_url);
    if (index >= 0) setActiveImage(index);
  }, [selectedVariant, gallery]);

  const price = selectedVariant?.price_zar ?? product?.price_zar ?? 0;
  const stock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;
  const inStock = stock > 0;

  const purchasable = !!product?.store_product_id;

  const handleBuy = () => {
    if (!product?.store_product_id) return;
    const cartProductId = product.store_product_id;
    for (let i = 0; i < quantity; i++) {
      addToCart({
        productId: cartProductId,
        name: product.name,
        price,
        image: gallery[activeImage] ?? PLACEHOLDER,
        variationId: selectedVariant?.id,
        variationAttributes: selectedVariant
          ? { Option: attributeLabel(selectedVariant) }
          : undefined,
        productType: "dropship",
      });
    }
    navigate("/checkout");
  };

  if (loading) {
    return (
      <div ref={ref} className="container mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div ref={ref} className="container mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold">Product not available</h1>
        <p className="text-muted-foreground">This item is no longer listed.</p>
        <Button asChild>
          <Link to="/shop">Browse the shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div ref={ref} className="container mx-auto px-4 py-4 sm:py-8">
      <SEO
        title={`${product.name} | 1145 Lifestyle`}
        description={(product.description || product.name).slice(0, 155)}
      />

      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gallery */}
        <div className="min-w-0">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
            <img
              src={gallery[activeImage] ?? PLACEHOLDER}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
              }}
            />
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {gallery.slice(0, 12).map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors",
                    i === activeImage ? "border-primary" : "border-border",
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            {product.category && <Badge variant="secondary">{product.category}</Badge>}
            <h1 className="text-xl sm:text-3xl font-bold leading-tight break-words">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(price)}</span>
              <Badge variant={inStock ? "secondary" : "destructive"}>
                {inStock ? `${stock} in stock` : "Out of stock"}
              </Badge>
            </div>
          </div>

          {variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Options</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    disabled={v.stock <= 0}
                    className={cn(
                      "min-h-[44px] rounded-lg border px-3 text-sm transition-colors",
                      v.id === selectedVariantId
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50",
                      v.stock <= 0 && "opacity-40 line-through",
                    )}
                  >
                    {attributeLabel(v)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <p className="text-sm font-medium">Quantity</p>
            <div className="flex items-center rounded-lg border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setQuantity((q) => Math.min(Math.max(stock, 1), q + 1))}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            className="w-full min-h-[48px] text-base"
            disabled={!inStock || !purchasable}
            onClick={handleBuy}
          >
            {!purchasable
              ? "Coming soon"
              : inStock
                ? `Buy now — ${formatCurrency(price * quantity)}`
                : "Out of stock"}
          </Button>
          {!purchasable && (
            <p className="text-xs text-muted-foreground">
              This item is not on sale yet. It will be available in the marketplace shortly.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Tracked delivery</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Secure checkout</span>
            <span className="flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Returns supported</span>
          </div>

          {product.description && (
            <>
              <Separator />
              <div className="space-y-2">
                <h2 className="text-base font-semibold">Description</h2>
                <div className="prose prose-sm max-w-none text-sm text-muted-foreground whitespace-pre-line break-words">
                  {product.description.replace(/<[^>]+>/g, " ").trim()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

DropshipProductPage.displayName = "DropshipProductPage";

export default DropshipProductPage;
