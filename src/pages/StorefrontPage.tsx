import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Star, Store, Mail, MessageSquare, Calendar, Clock, Shield, Crown, Medal, Award, ChevronDown, ExternalLink, ChevronRight, Heart, Share2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import ProductGrid from "@/components/shop/ProductGrid";
import { Product } from "@/types";
import { fetchProductsByStore, fetchStoreBySlug } from "@/services/products";
import { supabase } from "@/integrations/supabase/client";
import { StorefrontTier, TIER_CAPABILITIES, Testimonial, FAQItem, StorefrontLayout } from "@/types/storefront";
import { format } from "date-fns";

const PRODUCTS_PER_PAGE = 12;

const StorefrontPage: React.FC = () => {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<any>(null);
  const [customization, setCustomization] = useState<any>(null);
  const [vendorTier, setVendorTier] = useState<StorefrontTier>('starter');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [emailInput, setEmailInput] = useState("");
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
              .from('vendors')
              .select('subscription_tier')
              .eq('id', vendor.id)
              .maybeSingle();
            if (vendorData) {
              const tier = vendorData.subscription_tier as string;
              const validTiers: StorefrontTier[] = ['starter', 'bronze', 'silver', 'gold'];
              setVendorTier(validTiers.includes(tier as StorefrontTier) ? (tier as StorefrontTier) : 'starter');
            }
          }

          const { data: cust } = await supabase
            .from('storefront_customizations')
            .select('*')
            .eq('store_id', storeData.id)
            .maybeSingle();
          setCustomization(cust);
        }
      } catch (error) {
        console.error('Error loading storefront:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStorefrontData();
  }, [storeSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground animate-pulse">Loading store...</p>
          </div>
        </div>
      </div>
    );
  }

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
            <Button size="lg" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const capabilities = TIER_CAPABILITIES[vendorTier] || TIER_CAPABILITIES['starter'];
  const vendor = store.vendors;
  const accentColor = customization?.accent_color || '#6366f1';
  const secondaryColor = customization?.secondary_color || '#8b5cf6';
  const layoutType: StorefrontLayout = customization?.layout_type || 'grid';
  const testimonials: Testimonial[] = (customization?.testimonials as unknown as Testimonial[]) || [];
  const faqItems: FAQItem[] = (customization?.faq_items as unknown as FAQItem[]) || [];
  const socialLinks: Record<string, string> = (customization?.social_links as Record<string, string>) || {};
  const aboutUs: string = customization?.about_us || '';
  const announcementActive = customization?.announcement_bar_active && customization?.announcement_bar_text;
  const emailCapture = customization?.email_capture_enabled;
  const ctaText = customization?.cta_button_text || 'Shop Now';
  const ctaUrl = customization?.cta_button_url;
  const videoBannerUrl = customization?.video_banner_url;
  const whiteLabel = customization?.white_label;
  const customFont = customization?.custom_font;

  const avgRating = products.length > 0
    ? products.reduce((sum, p) => sum + p.rating, 0) / products.length
    : 0;

  // Get unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : products;

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const homepageSections: string[] = vendorTier === 'gold' && customization?.homepage_sections
    ? (customization.homepage_sections as unknown as string[])
    : vendorTier === 'starter'
      ? ['products']
      : ['hero', 'featured', 'products', 'about', 'testimonials', 'faq', 'policies'];

  const fontStyle = customFont ? { fontFamily: `"${customFont}", sans-serif` } : {};

  const isVideoUrl = (url: string) => {
    return url.match(/\.(mp4|webm|ogg)(\?|$)/i) || url.includes('supabase.co/storage');
  };

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'announcement':
        if (!announcementActive || !capabilities.announcementBar) return null;
        return (
          <div key="announcement" className="text-center py-2.5 px-4 text-sm font-medium tracking-wide" style={{ backgroundColor: accentColor, color: '#fff' }}>
            {customization.announcement_bar_text}
          </div>
        );

      case 'hero':
        if (!capabilities.customBanner) return null;
        return (
          <div key="hero" className="relative">
            {videoBannerUrl && capabilities.videoBanner ? (
              <div className="w-full aspect-[21/9] max-h-[480px] overflow-hidden bg-muted relative">
                {isVideoUrl(videoBannerUrl) ? (
                  <video
                    src={videoBannerUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <iframe src={videoBannerUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="Store video" />
                )}
                {capabilities.ctaButton && ctaUrl && (
                  <div className="absolute inset-0 flex items-end justify-start p-6 md:p-12 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                    <div>
                      <h2 className="text-white text-2xl md:text-4xl font-bold mb-3 drop-shadow-lg">{store.name}</h2>
                      <Link to={ctaUrl}>
                        <Button size="lg" className="text-white font-semibold px-8 rounded-full shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: accentColor }}>
                          {ctaText}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : store.banner_url ? (
              <div className="w-full aspect-[21/9] max-h-[480px] overflow-hidden relative">
                <img src={store.banner_url} alt={`${store.name} banner`} className="w-full h-full object-cover" />
                {capabilities.ctaButton && ctaUrl && (
                  <div className="absolute inset-0 flex items-end justify-start p-6 md:p-12 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                    <div>
                      <h2 className="text-white text-2xl md:text-4xl font-bold mb-3 drop-shadow-lg">{store.name}</h2>
                      <Link to={ctaUrl}>
                        <Button size="lg" className="text-white font-semibold px-8 rounded-full shadow-lg hover:scale-105 transition-transform" style={{ backgroundColor: accentColor }}>
                          {ctaText}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );

      case 'featured':
        if (!capabilities.featuredProducts || products.length === 0) return null;
        const featuredProducts = products.slice(0, 4);
        return (
          <section key="featured" className="px-4 py-8 md:py-12">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">Featured Products</h2>
                  <p className="text-sm text-muted-foreground mt-1">Hand-picked just for you</p>
                </div>
                <Link to="#products">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View all <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <ProductGrid products={featuredProducts} />
            </div>
          </section>
        );

      case 'products':
        return (
          <section key="products" id="products" className="px-4 py-8 md:py-12">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    {vendorTier === 'starter' ? 'Products' : 'All Products'}
                    <span className="text-base font-normal text-muted-foreground ml-2">({filteredProducts.length})</span>
                  </h2>
                </div>

                {/* Category filter pills */}
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
                    {categories.map(cat => (
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
                    columns={layoutType === 'minimal' ? 3 : layoutType === 'modern' ? 3 : 4}
                  />
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-1 mt-10">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-full"
                      >
                        <ChevronDown className="h-4 w-4 rotate-90" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => (
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
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
        );

      case 'about':
        if (!capabilities.aboutUs || !aboutUs) return null;
        return (
          <section key="about" className="px-4 py-8 md:py-12" style={{ backgroundColor: `${accentColor}08` }}>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">About Us</h2>
              <Separator className="w-12 mx-auto mb-6" style={{ backgroundColor: accentColor }} />
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{aboutUs}</p>
            </div>
          </section>
        );

      case 'testimonials':
        if (!capabilities.testimonials || testimonials.length === 0) return null;
        return (
          <section key="testimonials" className="px-4 py-8 md:py-12">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-foreground">What Our Customers Say</h2>
                <p className="text-sm text-muted-foreground mt-1">Real reviews from real customers</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {testimonials.map((t) => (
                  <Card key={t.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 md:p-6">
                      <div className="flex items-center gap-0.5 mb-4">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-4 w-4 ${s <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                        ))}
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">"{t.text}"</p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: accentColor }}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground text-sm">{t.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        );

      case 'faq':
        if (!capabilities.faqSection || faqItems.length === 0) return null;
        return (
          <section key="faq" className="px-4 py-8 md:py-12" style={{ backgroundColor: `${accentColor}05` }}>
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
        );

      case 'newsletter':
        if (!emailCapture || !capabilities.emailCapture) return null;
        return (
          <section key="newsletter" className="py-10 md:py-16" style={{ backgroundColor: `${accentColor}10` }}>
            <div className="max-w-md mx-auto px-4 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {customization?.email_capture_title || 'Stay in the loop'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">Get exclusive deals and new arrivals straight to your inbox</p>
              <div className="flex gap-2">
                <Input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter your email"
                  type="email"
                  className="rounded-full"
                />
                <Button className="rounded-full text-white px-6" style={{ backgroundColor: accentColor }}>Subscribe</Button>
              </div>
            </div>
          </section>
        );

      case 'social':
        if (!capabilities.socialLinks || Object.values(socialLinks).every(v => !v)) return null;
        return (
          <div key="social" className="px-4 py-6">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5 capitalize">
                    <ExternalLink className="h-3 w-3" />
                    {platform}
                  </Button>
                </a>
              ))}
            </div>
          </div>
        );

      case 'policies':
        if (!store.shipping_policy && !store.return_policy) return null;
        return (
          <section key="policies" className="px-4 py-8 md:py-12 border-t">
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background" style={fontStyle}>
      {/* Announcement Bar */}
      {homepageSections.includes('announcement') && renderSection('announcement')}

      {/* Hero / Banner */}
      {homepageSections.includes('hero') && renderSection('hero')}

      {/* Store Header - Modern sticky-style */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30" style={vendorTier !== 'starter' ? { borderBottomColor: `${accentColor}20` } : {}}>
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5">
          <div className="flex items-center gap-3 md:gap-5">
            {/* Logo/Profile */}
            <div className="flex-shrink-0">
              {(store.logo_url || vendor?.logo_url) ? (
                <img
                  src={store.logo_url || vendor.logo_url}
                  alt={store.name}
                  className={`object-cover rounded-full ring-2 ring-background shadow-md ${
                    vendorTier === 'starter' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-14 h-14 md:w-16 md:h-16'
                  }`}
                />
              ) : (
                <div className={`rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-background shadow-md ${
                  vendorTier === 'starter' ? 'w-10 h-10 md:w-12 md:h-12' : 'w-14 h-14 md:w-16 md:h-16'
                }`}>
                  <Store className={vendorTier === 'starter' ? 'h-5 w-5 text-primary' : 'h-7 w-7 text-primary'} />
                </div>
              )}
            </div>

            {/* Store Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`font-bold text-foreground truncate ${vendorTier === 'starter' ? 'text-lg' : 'text-lg md:text-2xl'}`}>
                  {store.name}
                </h1>
                {capabilities.sellerBadge && (
                  <Badge className="gap-1 text-xs flex-shrink-0 rounded-full" style={{ backgroundColor: vendorTier === 'gold' ? '#eab308' : accentColor, color: '#fff' }}>
                    {vendorTier === 'gold' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    <span className="hidden sm:inline">{capabilities.sellerBadge}</span>
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 md:gap-3 flex-wrap text-xs md:text-sm mt-1">
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground hidden sm:inline">({products.length})</span>
                  </div>
                )}
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>South Africa</span>
                </div>
                {capabilities.trustIndicators && (
                  <>
                    <span className="text-muted-foreground hidden md:inline">·</span>
                    <div className="hidden md:flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Joined {store.created_at ? format(new Date(store.created_at), 'MMM yyyy') : 'Recently'}</span>
                    </div>
                  </>
                )}
              </div>

              {vendorTier !== 'starter' && (store.description || vendor?.description) && (
                <p className="text-muted-foreground mt-1.5 text-xs md:text-sm line-clamp-1 md:line-clamp-2 max-w-xl">
                  {store.description || vendor.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {capabilities.contactForm && (
                <Button variant="outline" size="sm" className="rounded-full hidden sm:flex">
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  Contact
                </Button>
              )}
              <Link to="/shop">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <ArrowLeft className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">Shop</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Sections - rendered in order */}
      {homepageSections
        .filter(s => s !== 'announcement' && s !== 'hero')
        .map(sectionId => renderSection(sectionId))}

      {/* Platform branding for free tier */}
      {capabilities.platformBranding && !whiteLabel && (
        <div className="border-t py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">1145 Lifestyle</span>
          </p>
        </div>
      )}

      {/* Social links footer */}
      {homepageSections.includes('social') && renderSection('social')}
    </div>
  );
};

export default StorefrontPage;
