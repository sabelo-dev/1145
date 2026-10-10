
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callRewardRpc } from "@/lib/ucRewards";
import { useParams, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Star, Truck, ShieldCheck, Heart, Calendar, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import ProductLeaseOption from "@/components/leasing/ProductLeaseOption";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn, stripHtml } from "@/lib/utils";
import { GoldPriceDisplay } from "@/components/gold";
import StarRating from "@/components/ui/star-rating";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import ProductImageViewer from "@/components/shop/ProductImageViewer";
import SEO from "@/components/SEO";
import { Product, ProductVariation } from "@/types";
import { fetchProductBySlug, fetchRelatedProducts } from "@/services/products";
import { getProductSchema, getBreadcrumbSchema } from "@/utils/structuredData";
import { applyPlatformMarkup } from "@/utils/pricingMarkup";

const ProductPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [colorImage, setColorImage] = useState<string | null>(null);
  const { user } = useAuth();

  // Browse/shop reward: 5 UC per product viewed (once a day, up to 25 UC).
  useEffect(() => {
    if (!user || !product?.id) return;
    callRewardRpc('uc_record_product_view', { p_product_id: product.id }).catch(() => undefined);
  }, [user, product?.id]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        setColorImage(null); // Reset color image when loading new product
        
        const productData = await fetchProductBySlug(slug);
        
        if (productData) {
          setProduct(productData);
          
          // Auto-select first variation if available
          if (productData.variations && productData.variations.length > 0) {
            const firstVariation = productData.variations[0];
            setSelectedVariation(firstVariation);
            setSelectedAttributes(firstVariation.attributes);
          }
          
          const related = await fetchRelatedProducts(productData.id, productData.category, 4);
          setRelatedProducts(related);
        }
      } catch (error) {
        console.error('Error loading product:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [slug]);

  // Get unique attribute types and values - filter out empty/invalid and internal attributes
  const attributeTypes = React.useMemo(() => {
    if (!product?.variations || product.variations.length === 0) return [];
    const types = new Set<string>();
    product.variations.forEach(v => {
      if (v.attributes && typeof v.attributes === 'object') {
        Object.entries(v.attributes).forEach(([key, value]) => {
          // Only include attributes with valid keys, non-empty values, and exclude internal attributes (prefixed with _)
          if (key && !key.startsWith('_') && value !== null && value !== undefined && String(value).trim() !== '') {
            types.add(key);
          }
        });
      }
    });
    return Array.from(types);
  }, [product?.variations]);

  const getAttributeValues = (type: string) => {
    if (!product?.variations || type.startsWith('_')) return [];
    const values = new Set<string>();
    product.variations.forEach(v => {
      if (v.attributes && v.attributes[type]) {
        const value = String(v.attributes[type]).trim();
        if (value !== '') {
          values.add(value);
        }
      }
    });
    return Array.from(values);
  };

  // Handle attribute selection
  const handleAttributeSelect = (type: string, value: string) => {
    const newAttributes = { ...selectedAttributes, [type]: value };
    setSelectedAttributes(newAttributes);

    // Find matching variation
    const matchingVariation = product?.variations?.find(v => {
      return Object.keys(newAttributes).every(
        key => key.startsWith('_') || v.attributes[key] === newAttributes[key]
      );
    });

    if (matchingVariation) {
      setSelectedVariation(matchingVariation);
      
      // Check for color-specific image in _images attribute
      const imagesAttr = matchingVariation.attributes['_images'];
      if (imagesAttr && type === 'Color') {
        try {
          const imagesMap = typeof imagesAttr === 'string' ? JSON.parse(imagesAttr) : imagesAttr;
          const colorImage = imagesMap['Color'] || imagesMap[value];
          if (colorImage && !colorImage.startsWith('blob:')) {
            // Add the color image to the beginning of the images array for display
            setColorImage(colorImage);
            setSelectedImage(0);
            return;
          }
        } catch (e) {
          console.error('Error parsing _images attribute:', e);
        }
      }
      
      // Fallback: Update main image if variation has a direct imageUrl
      if (matchingVariation.imageUrl && product?.images) {
        const varImageIndex = product.images.findIndex(img => img === matchingVariation.imageUrl);
        if (varImageIndex !== -1) {
          setSelectedImage(varImageIndex);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="wwe-container py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
        <p className="mb-6">Sorry, the product you are looking for does not exist.</p>
        <Link to="/shop">
          <Button className="bg-cta text-cta-foreground hover:bg-brand-hover">
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    const fallbackImage = product.images && product.images.length > 0 ? product.images[0] : '/placeholder.svg';
    addToCart({
      productId: product.id,
      name: product.name,
      price: applyPlatformMarkup(selectedVariation?.price || product.price),
      image: selectedVariation?.imageUrl || fallbackImage,
      variationId: selectedVariation?.id,
      variationAttributes: selectedVariation?.attributes,
      productType: product.productType,
      preorder: canPreorder,
    }, quantity);
  };

  const incrementQuantity = () => setQuantity(quantity + 1);
  const decrementQuantity = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const currentPrice = applyPlatformMarkup(selectedVariation?.price || product.price);
  const compareAtPriceMarkup = product.compareAtPrice ? applyPlatformMarkup(product.compareAtPrice) : undefined;
  const discountPercent = compareAtPriceMarkup ? Math.round(((compareAtPriceMarkup - currentPrice) / compareAtPriceMarkup) * 100) : 0;
  const isInStock = selectedVariation ? selectedVariation.quantity > 0 : product.inStock;
  // Out-of-stock XIXLV Marketplace items can be pre-ordered: paid in full now, shipped when restocked.
  const canPreorder = !isInStock && !!product.allowPreorder;

  const breadcrumbItems = [
    { name: 'Home', url: '/shop' },
    { name: 'Shop', url: '/shop' },
    { name: product.category, url: `/category/${product.category.toLowerCase()}` },
    { name: product.name, url: `/product/${product.slug}` },
  ];

  return (
    <div className="bg-white">
      <SEO
        title={`${product.name} - ${product.category}`}
        description={stripHtml(product.description).substring(0, 160) || `Buy ${product.name} from ${product.merchantName}. High quality products at great prices.`}
        keywords={`${product.name}, ${product.category}, ${product.merchantName}, buy online, shop`}
        image={product.images?.[0]}
        type="product"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [getProductSchema(product), getBreadcrumbSchema(breadcrumbItems)],
        }}
      />
      <div className="wwe-container py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
          <Link to="/" className="text-text-secondary hover:text-foreground">Home</Link>
          {" "} / {" "}
          <Link to="/shop" className="text-text-secondary hover:text-foreground">Shop</Link>
          {" "} / {" "}
          <Link to={`/category/${product.category.toLowerCase()}`} className="text-text-secondary hover:text-foreground">
            {product.category}
          </Link>
          {" "} / <span className="text-foreground" aria-current="page">{product.name}</span>
        </nav>

        {/* Product Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-surface-muted group">
              <ProductImageViewer
                src={colorImage || (product.images && product.images.length > 0 ? product.images[selectedImage] : '/placeholder.svg')}
                alt={product.name}
                onNext={product.images && product.images.length > 1 ? () => {
                  setColorImage(null);
                  setSelectedImage(prev => prev === product.images!.length - 1 ? 0 : prev + 1);
                } : undefined}
                onPrev={product.images && product.images.length > 1 ? () => {
                  setColorImage(null);
                  setSelectedImage(prev => prev === 0 ? product.images!.length - 1 : prev - 1);
                } : undefined}
              />
              {/* Pagination arrows */}
              {product.images && product.images.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setColorImage(null);
                      setSelectedImage(prev => prev === 0 ? product.images!.length - 1 : prev - 1);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background p-2 rounded-full shadow-md transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setColorImage(null);
                      setSelectedImage(prev => prev === product.images!.length - 1 ? 0 : prev + 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background p-2 rounded-full shadow-md transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {/* Dot indicators */}
                  {/* min-h-0 / p-0 opt out of the global 44px touch-target rule, which stretched these into tall bars */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-black/25 px-2 py-1.5 backdrop-blur-sm">
                    {product.images.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setColorImage(null); setSelectedImage(idx); }}
                        className={cn(
                          "h-1.5 w-1.5 min-h-0 shrink-0 rounded-full p-0 transition-all",
                          selectedImage === idx && !colorImage
                            ? "bg-white scale-125"
                            : "bg-white/50 hover:bg-white/80"
                        )}
                        aria-label={`Go to image ${idx + 1}`}
                        aria-current={selectedImage === idx && !colorImage}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {product.images && product.images.length > 0 && (
              <div className="flex space-x-2 overflow-x-auto no-scrollbar p-0.5 pb-2">
                {product.images.map((image, idx) => (
                <button
                  type="button"
                  key={idx}
                  aria-label={`Show image ${idx + 1} of ${product.images.length}`}
                  aria-current={selectedImage === idx && !colorImage}
                  className={`relative h-14 w-14 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-md border p-0 ${
                    selectedImage === idx
                      ? "ring-2 ring-primary"
                      : "hover:ring-1 hover:ring-muted-foreground/30"
                  }`}
                  onClick={() => { setColorImage(null); setSelectedImage(idx); }}
                >
                  <img
                    src={image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.svg';
                    }}
                  />
                </button>
              ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col space-y-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
              <div className="flex items-center space-x-2 mt-2">
                <StarRating rating={product.rating} />
                <span className="text-text-secondary text-sm">
                  {product.rating.toFixed(1)} ({product.reviewCount} reviews)
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="mt-4">
              <div className="flex items-baseline space-x-2">
                <GoldPriceDisplay
                  price={currentPrice}
                  compareAtPrice={compareAtPriceMarkup}
                  size="lg"
                  className="text-2xl font-bold"
                />
                {compareAtPriceMarkup && compareAtPriceMarkup > currentPrice && (
                  <>
                    <Badge className="bg-gold text-gold-foreground hover:bg-gold">
                      {discountPercent}% off
                    </Badge>
                  </>
                )}
              </div>
            </div>

            {/* Availability */}
            <div>
              <Badge className={isInStock ? "bg-success/10 text-success hover:bg-success/10" : canPreorder ? "bg-navy-900 text-gold hover:bg-navy-900" : "bg-destructive/10 text-destructive hover:bg-destructive/10"}>
                {isInStock ? "In Stock" : canPreorder ? "Pre-order" : "Out of Stock"}
              </Badge>
              {selectedVariation && isInStock && (
                <span className="text-sm text-text-secondary ml-2">
                  {selectedVariation.quantity} available
                </span>
              )}
              {canPreorder && (
                <p className="mt-2 text-sm text-text-secondary">
                  Currently out of stock. Pay in full at checkout to reserve yours; your order is only placed once
                  payment succeeds, and it ships as soon as it's restocked.
                </p>
              )}
            </div>

            {/* Short Description */}
            <p className="text-foreground mt-2 whitespace-pre-line">{stripHtml(product.description)}</p>

            {/* Merchant Info */}
            <div className="mt-2">
              <span className="text-sm text-text-secondary">
                Brand: <span className="text-foreground font-medium">{product.merchantName}</span>
              </span>
            </div>

            {/* Variation Selection - only show if there are valid attributes */}
            {attributeTypes.length > 0 && (
              <div className="space-y-5 border-t pt-6 mt-6">
              <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="space-y-5">
                    {attributeTypes.map(attrType => {
                      const values = getAttributeValues(attrType);
                      if (values.length === 0) return null;
                      
                      return (
                        <div key={attrType} className="space-y-3" role="group" aria-labelledby={`option-${attrType.replace(/\s+/g, "-")}`}>
                          <p id={`option-${attrType.replace(/\s+/g, "-")}`} className="text-sm">
                            <span className="font-medium capitalize">{attrType}</span>
                            <span className="text-text-secondary">
                              {selectedAttributes[attrType] != null ? `: ${String(selectedAttributes[attrType])}` : " — choose one"}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {values.map(value => {
                              const isSelected = selectedAttributes[attrType] === value;
                              
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => handleAttributeSelect(attrType, value)}
                                  className={cn(
                                    "min-h-[44px] px-5 py-2.5 border-2 rounded-lg text-sm font-medium transition-colors",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                      : "border-border bg-background hover:border-primary/50 hover:bg-muted"
                                  )}
                                >
                                  {String(value)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col space-y-4 mt-6">
              {/* Lease Option */}
              {product.listingType && product.listingType !== 'sale' && (
                <ProductLeaseOption
                  productId={product.id}
                  productName={product.name}
                  listingType={product.listingType}
                  salePrice={currentPrice}
                />
              )}

              {/* Purchase option - show if listing is 'sale' or 'both' */}
              {(!product.listingType || product.listingType === 'sale' || product.listingType === 'both') && (
                <>
                  {/* Quantity Selector */}
                  <div className="flex items-center space-x-4">
                    <span id="quantity-label" className="text-foreground">Quantity</span>
                    <div className="flex items-center" role="group" aria-labelledby="quantity-label">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-r-none"
                        onClick={decrementQuantity}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus aria-hidden />
                      </Button>
                      <div className="flex h-11 w-12 items-center justify-center border-y border-border tabular-nums" aria-live="polite" aria-atomic="true">
                        <span className="sr-only">Quantity </span>{quantity}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-l-none"
                        onClick={incrementQuantity}
                        aria-label="Increase quantity"
                      >
                        <Plus aria-hidden />
                      </Button>
                    </div>
                  </div>

                  {/* Add to Cart & Wishlist */}
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleAddToCart}
                      variant="cta"
                      size="lg"
                      className="flex-1"
                      disabled={!isInStock && !canPreorder}
                    >
                      {isInStock ? "Add to Cart" : canPreorder ? "Pre-order" : "Out of Stock"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={isInWishlist(product.id) ? "Remove from wishlist" : "Save to wishlist"}
                      aria-pressed={isInWishlist(product.id)}
                      className={isInWishlist(product.id) ? "h-12 w-12 text-destructive" : "h-12 w-12"}
                    >
                      <Heart 
                        className={`h-5 w-5 ${isInWishlist(product.id) ? "fill-current" : ""}`} 
                      />
                    </Button>
                  </div>
                </>
              )}

              {/* Lease-only products - just wishlist */}
              {product.listingType === 'lease' && (
                <div className="flex space-x-3">
                  <Button 
                    variant="outline"
                    onClick={() => toggleWishlist(product.id)}
                    className={`flex-1 ${isInWishlist(product.id) ? "text-destructive" : ""}`}
                  >
                    <Heart className={`h-5 w-5 mr-2 ${isInWishlist(product.id) ? "fill-current" : ""}`} />
                    {isInWishlist(product.id) ? "Saved" : "Save to Wishlist"}
                  </Button>
                </div>
              )}
            </div>

            {/* Shipping & Returns */}
            <div className="border-t border-border pt-4 mt-6 space-y-3">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
                <span className="text-sm">
                  Free shipping on orders over R500.{" "}
                  <Link to="/shipping" className="font-medium underline underline-offset-4">Delivery details</Link>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden />
                <span className="text-sm">
                  30-day returns on most items.{" "}
                  <Link to="/returns" className="font-medium underline underline-offset-4">Returns policy</Link>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Tabs */}
        <div className="mb-12">
          <Tabs defaultValue="details">
            <TabsList className="w-full border-b">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({product.reviewCount})</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="py-6">
              <div className="prose max-w-none">
                <p className="mb-4 whitespace-pre-line">{stripHtml(product.description)}</p>
              </div>
            </TabsContent>
            <TabsContent value="specs" className="py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-4">
                  <h3 className="font-semibold mb-2">Product Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-text-secondary">Brand</span>
                    <span>{product.merchantName}</span>
                    <span className="text-text-secondary">Category</span>
                    <span>{product.subcategory || product.category}</span>
                    {selectedVariation?.sku && (
                      <>
                        <span className="text-text-secondary">SKU</span>
                        <span>{selectedVariation.sku}</span>
                      </>
                    )}
                  </div>
                </div>
                {product.variations && product.variations.length > 0 && (
                  <div className="border rounded-md p-4">
                    <h3 className="font-semibold mb-2">Available Options</h3>
                    <div className="text-sm space-y-1">
                      {attributeTypes.map(type => (
                        <div key={type}>
                          <span className="text-text-secondary capitalize">{type}s: </span>
                          <span>{getAttributeValues(type).join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="py-6">
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Review Summary</h3>
                    <Button className="bg-cta text-cta-foreground hover:bg-brand-hover">Write a Review</Button>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl font-bold">{product.rating.toFixed(1)}</div>
                    <div>
                      <StarRating rating={product.rating} />
                      <div className="text-sm text-text-secondary">Based on {product.reviewCount} reviews</div>
                    </div>
                  </div>
                </div>

                {product.reviewCount === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet. Be the first to review this product.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <FeaturedProducts
            title="You May Also Like"
            products={relatedProducts}
            viewAllLink={`/category/${product.category.toLowerCase()}`}
          />
        )}
      </div>
    </div>
  );
};

export default ProductPage;
