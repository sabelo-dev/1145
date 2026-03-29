import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Store, ShoppingBag, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import ProductGrid from "@/components/shop/ProductGrid";
import { Product } from "@/types";
import { fetchProductsByStore, fetchStoreBySlug } from "@/services/products";
import { supabase } from "@/integrations/supabase/client";
import { StorefrontTier, TIER_CAPABILITIES, Testimonial, FAQItem, StorefrontLayout } from "@/types/storefront";
import { format } from "date-fns";

// Brand experience components
import StorefrontHero from "@/components/storefront/StorefrontHero";
import StorefrontBrandStory from "@/components/storefront/StorefrontBrandStory";
import StorefrontCollections from "@/components/storefront/StorefrontCollections";
import StorefrontProductSpotlight from "@/components/storefront/StorefrontProductSpotlight";
import StorefrontSocialProof from "@/components/storefront/StorefrontSocialProof";
import StorefrontStickyNav from "@/components/storefront/StorefrontStickyNav";
import StorefrontNewsletter from "@/components/storefront/StorefrontNewsletter";

const PRODUCTS_PER_PAGE = 12;

interface StorefrontPageProps {
  domainStoreSlug?: string;
  forceWhiteLabel?: boolean;
}

const StorefrontPage: React.FC<StorefrontPageProps> = ({ domainStoreSlug, forceWhiteLabel }) => {
  const { storeSlug: urlStoreSlug } = useParams<{ storeSlug: string }>();
  const storeSlug = domainStoreSlug || urlStoreSlug;
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<any>(null);
  const [customization, setCustomization] = useState<any>(null);
  const [vendorTier, setVendorTier] = useState<StorefrontTier>("starter");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const loadStorefrontData = async () => {
      if (!storeSlug) return;
      try {
        setLoading(true);
        const [storeData, productsData] = await Promise.all([
          fetchStoreBySlug(storeSlug),
          fetchProductsByStore(storeSlug),
        ]);
        setStore(storeData);
        setProducts(productsData);

        if (storeData) {
          const vendor = storeData.vendors;
          if (vendor?.id) {
            const { data: vendorData } = await supabase
              .from("vendors")
              .select("subscription_tier")
              .eq("id", vendor.id)
              .maybeSingle();
            if (vendorData) {
              const tier = vendorData.subscription_tier as string;
              const validTiers: StorefrontTier[] = ["starter", "bronze", "silver", "gold"];
              setVendorTier(validTiers.includes(tier as StorefrontTier) ? (tier as StorefrontTier) : "starter");
            }
          }

          const { data: cust } = await supabase
            .from("storefront_customizations")
            .select("*")
            .eq("store_id", storeData.id)
            .maybeSingle();
          setCustomization(cust);
        }
      } catch (error) {
        console.error("Error loading storefront:", error);
      } finally {
        setLoading(false);
      }
    };
    loadStorefrontData();
  }, [storeSlug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading store...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Store className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-8">The store you're looking for doesn't exist or has been removed.</p>
          <Link to="/shop">
            <Button size="lg" className="w-full">Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Extract data
  const capabilities = TIER_CAPABILITIES[vendorTier] || TIER_CAPABILITIES["starter"];
  const vendor = store.vendors;
  const accentColor = customization?.accent_color || "#6366f1";
  const layoutType: StorefrontLayout = customization?.layout_type || "grid";
  const testimonials: Testimonial[] = (customization?.testimonials as unknown as Testimonial[]) || [];
  const faqItems: FAQItem[] = (customization?.faq_items as unknown as FAQItem[]) || [];
  const socialLinks: Record<string, string> = (customization?.social_links as Record<string, string>) || {};
  const aboutUs: string = customization?.about_us || "";
  const announcementActive = customization?.announcement_bar_active && customization?.announcement_bar_text;
  const emailCapture = customization?.email_capture_enabled;
  const ctaText = customization?.cta_button_text || "Shop Now";
  const ctaUrl = customization?.cta_button_url;
  const videoBannerUrl = customization?.video_banner_url;
  const whiteLabel = customization?.white_label;
  const customFont = customization?.custom_font;

  const avgRating = products.length > 0
    ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
    : 0;

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  const filteredProducts = activeCategory ? products.filter((p) => p.category === activeCategory) : products;
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const fontStyle = customFont ? { fontFamily: `"${customFont}", sans-serif` } : {};
  const showPlatformBranding = forceWhiteLabel ? false : !whiteLabel || !capabilities.whiteLabel;
  const logoUrl = store.logo_url || vendor?.logo_url;

  // Build section list for nav
  const activeSections: string[] = [];
  if (capabilities.featuredProducts && products.length > 0) activeSections.push("spotlight");
  if (categories.length >= 2) activeSections.push("collections");
  activeSections.push("products");
  if (capabilities.aboutUs && aboutUs) activeSections.push("about");
  if ((capabilities.testimonials && testimonials.length > 0) || avgRating > 0) activeSections.push("testimonials");
  if (capabilities.faqSection && faqItems.length > 0) activeSections.push("faq");

  return (
    <div className="min-h-screen flex flex-col bg-background" style={fontStyle}>
      {showPlatformBranding && <Header />}

      <main className="flex-1">
        {/* Announcement Bar */}
        {announcementActive && capabilities.announcementBar && (
          <div className="text-center py-2.5 px-4 text-sm font-medium tracking-wide text-white" style={{ backgroundColor: accentColor }}>
            {customization.announcement_bar_text}
          </div>
        )}

        {/* Hero Section — Full brand experience */}
        {capabilities.customBanner && (
          <StorefrontHero
            storeName={store.name}
            description={store.description || vendor?.description}
            bannerUrl={store.banner_url}
            videoUrl={videoBannerUrl}
            logoUrl={logoUrl}
            accentColor={accentColor}
            ctaText={ctaText}
            ctaUrl={ctaUrl}
            tagline={customization?.custom_meta_description}
            hasVideo={!!capabilities.videoBanner}
          />
        )}

        {/* Sticky Smart Navigation */}
        <StorefrontStickyNav
          storeName={store.name}
          logoUrl={logoUrl}
          accentColor={accentColor}
          vendorTier={vendorTier}
          sellerBadge={capabilities.sellerBadge}
          avgRating={avgRating}
          totalProducts={products.length}
          description={store.description || vendor?.description}
          createdAt={store.created_at}
          hasContactForm={!!capabilities.contactForm}
          hasTrustIndicators={!!capabilities.trustIndicators}
          showPlatformBranding={showPlatformBranding}
          sections={activeSections}
        />

        {/* Signature Products Spotlight */}
        {capabilities.featuredProducts && products.length > 0 && (
          <StorefrontProductSpotlight
            products={products.slice(0, 4)}
            accentColor={accentColor}
            storeName={store.name}
          />
        )}

        {/* Collections (category-based shopping) */}
        <StorefrontCollections
          categories={categories}
          products={products}
          accentColor={accentColor}
          onCategoryClick={(cat) => {
            setActiveCategory(cat);
            setCurrentPage(1);
          }}
        />

        {/* Full Catalog */}
        <section id="products" className="px-4 py-8 md:py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">
                  All Products
                  <span className="text-base font-normal text-muted-foreground ml-2">({filteredProducts.length})</span>
                </h2>
              </div>

              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                  <Button
                    variant={activeCategory === null ? "default" : "outline"}
                    size="sm"
                    className="rounded-full whitespace-nowrap flex-shrink-0"
                    onClick={() => { setActiveCategory(null); setCurrentPage(1); }}
                  >
                    All
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat}
                      variant={activeCategory === cat ? "default" : "outline"}
                      size="sm"
                      className="rounded-full whitespace-nowrap flex-shrink-0"
                      onClick={() => { setActiveCategory(cat); setCurrentPage(1); }}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {paginatedProducts.length > 0 ? (
              <>
                <ProductGrid
                  products={paginatedProducts}
                  columns={layoutType === "minimal" ? 3 : layoutType === "modern" ? 3 : 4}
                />
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-1 mt-10">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="rounded-full"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
                      <Button
                        key={i}
                        variant={currentPage === i + 1 ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(i + 1)}
                        className="rounded-full w-9 h-9 p-0"
                      >
                        {i + 1}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-full"
                    >
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No Products Yet</h3>
                <p className="text-sm text-muted-foreground">This store hasn't added any products yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Brand Story */}
        {capabilities.aboutUs && aboutUs && (
          <div id="about">
            <StorefrontBrandStory
              storeName={store.name}
              aboutUs={aboutUs}
              accentColor={accentColor}
              logoUrl={logoUrl}
              joinedDate={store.created_at ? format(new Date(store.created_at), "MMMM yyyy") : undefined}
            />
          </div>
        )}

        {/* Social Proof & Reviews */}
        {(capabilities.testimonials || avgRating > 0) && (
          <div id="testimonials">
            <StorefrontSocialProof
              testimonials={testimonials}
              avgRating={avgRating}
              totalProducts={products.length}
              accentColor={accentColor}
            />
          </div>
        )}

        {/* FAQ */}
        {capabilities.faqSection && faqItems.length > 0 && (
          <section id="faq" className="px-4 py-8 md:py-12" style={{ backgroundColor: `${accentColor}05` }}>
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Frequently Asked Questions</h2>
              </div>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {faqItems.map((f) => (
                  <AccordionItem key={f.id} value={f.id} className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="text-sm md:text-base font-medium py-4">{f.question}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-4">{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        )}

        {/* Newsletter / Email Capture */}
        {emailCapture && capabilities.emailCapture && (
          <StorefrontNewsletter
            title={customization?.email_capture_title}
            accentColor={accentColor}
            storeName={store.name}
          />
        )}

        {/* Social Links */}
        {capabilities.socialLinks && Object.values(socialLinks).some((v) => v) && (
          <div className="px-4 py-6">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {Object.entries(socialLinks)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-full gap-1.5 capitalize">
                      <ExternalLink className="h-3 w-3" />
                      {platform}
                    </Button>
                  </a>
                ))}
            </div>
          </div>
        )}

        {/* Store Policies */}
        {(store.shipping_policy || store.return_policy) && (
          <section className="px-4 py-8 md:py-12 border-t">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-lg font-bold text-foreground mb-6 text-center">Store Policies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {store.shipping_policy && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <h4 className="font-semibold text-foreground mb-2 text-sm">Shipping Policy</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{store.shipping_policy}</p>
                    </CardContent>
                  </Card>
                )}
                {store.return_policy && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <h4 className="font-semibold text-foreground mb-2 text-sm">Return Policy</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{store.return_policy}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Platform branding for free tier */}
        {capabilities.platformBranding && !whiteLabel && (
          <div className="border-t py-6 text-center">
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold">1145 Lifestyle</span>
            </p>
          </div>
        )}
      </main>

      {showPlatformBranding && <Footer />}

      {!showPlatformBranding && (
        <footer className="border-t py-8 text-center bg-card">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-sm font-medium text-foreground mb-1">{store.name}</p>
            {Object.values(socialLinks).some((v) => v) && (
              <div className="flex items-center justify-center gap-3 mt-3 mb-3">
                {Object.entries(socialLinks)
                  .filter(([, url]) => url)
                  .map(([platform, url]) => (
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground text-xs capitalize">
                      {platform}
                    </a>
                  ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {store.name}. All rights reserved.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default StorefrontPage;
