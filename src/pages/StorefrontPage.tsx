import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Star, Store, Mail, MessageSquare, Calendar, Clock, Shield, Crown, Medal, Award, ChevronDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
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
          // Fetch vendor tier
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

          // Fetch customization
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
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 text-center py-12">
          <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Store Not Found</h1>
          <p className="text-muted-foreground mb-6">The store you're looking for doesn't exist.</p>
          <Link to="/shop"><Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Shop</Button></Link>
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

  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = products.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const homepageSections: string[] = vendorTier === 'gold' && customization?.homepage_sections
    ? (customization.homepage_sections as unknown as string[])
    : vendorTier === 'starter'
      ? ['products']
      : ['hero', 'featured', 'products', 'about', 'testimonials', 'faq', 'policies'];

  const fontStyle = customFont ? { fontFamily: `"${customFont}", sans-serif` } : {};

  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'announcement':
        if (!announcementActive || !capabilities.announcementBar) return null;
        return (
          <div key="announcement" className="text-center py-2 px-4 text-sm font-medium" style={{ backgroundColor: accentColor, color: '#fff' }}>
            {customization.announcement_bar_text}
          </div>
        );

      case 'hero':
        if (!capabilities.customBanner) return null;
        return (
          <div key="hero" className="relative">
            {videoBannerUrl && capabilities.videoBanner ? (
              <div className="w-full h-48 md:h-64 lg:h-80 overflow-hidden bg-muted">
                <iframe src={videoBannerUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="Store video" />
              </div>
            ) : store.banner_url ? (
              <div className="w-full h-48 md:h-64 lg:h-80 overflow-hidden relative">
                <img src={store.banner_url} alt={`${store.name} banner`} className="w-full h-full object-cover" />
                {capabilities.ctaButton && ctaUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Link to={ctaUrl}>
                      <Button size="lg" style={{ backgroundColor: accentColor }} className="text-white font-semibold px-8">
                        {ctaText}
                      </Button>
                    </Link>
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
          <div key="featured" className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Featured Products</h2>
            <ProductGrid products={featuredProducts} />
          </div>
        );

      case 'products':
        return (
          <div key="products" className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {vendorTier === 'starter' ? 'Products' : 'All Products'} ({products.length})
              </h2>
            </div>
            {paginatedProducts.length > 0 ? (
              <>
                <ProductGrid
                  products={paginatedProducts}
                  columns={layoutType === 'minimal' ? 3 : layoutType === 'modern' ? 3 : 4}
                />
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Button
                        key={i}
                        variant={currentPage === i + 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(i + 1)}
                      >
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No Products Yet</h3>
                <p className="text-muted-foreground">This store hasn't added any products yet.</p>
              </div>
            )}
          </div>
        );

      case 'about':
        if (!capabilities.aboutUs || !aboutUs) return null;
        return (
          <div key="about" className="container mx-auto px-4 py-8">
            <Card>
              <CardHeader>
                <CardTitle>About Us</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line">{aboutUs}</p>
              </CardContent>
            </Card>
          </div>
        );

      case 'testimonials':
        if (!capabilities.testimonials || testimonials.length === 0) return null;
        return (
          <div key="testimonials" className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">What Our Customers Say</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.map((t) => (
                <Card key={t.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-4 w-4 ${s <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                      ))}
                    </div>
                    <p className="text-muted-foreground italic mb-3">"{t.text}"</p>
                    <p className="font-semibold text-foreground text-sm">— {t.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'faq':
        if (!capabilities.faqSection || faqItems.length === 0) return null;
        return (
          <div key="faq" className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full max-w-2xl">
              {faqItems.map((f) => (
                <AccordionItem key={f.id} value={f.id}>
                  <AccordionTrigger>{f.question}</AccordionTrigger>
                  <AccordionContent>{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );

      case 'newsletter':
        if (!emailCapture || !capabilities.emailCapture) return null;
        return (
          <div key="newsletter" className="py-12" style={{ backgroundColor: `${accentColor}10` }}>
            <div className="container mx-auto px-4 text-center max-w-lg">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {customization?.email_capture_title || 'Subscribe to our newsletter'}
              </h3>
              <p className="text-muted-foreground mb-4">Get updates on new products and exclusive deals</p>
              <div className="flex gap-2">
                <Input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter your email"
                  type="email"
                />
                <Button style={{ backgroundColor: accentColor }} className="text-white">Subscribe</Button>
              </div>
            </div>
          </div>
        );

      case 'social':
        if (!capabilities.socialLinks || Object.values(socialLinks).every(v => !v)) return null;
        return (
          <div key="social" className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-center gap-4">
              {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
                <a key={platform} href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Badge variant="outline" className="gap-1 capitalize">
                    <ExternalLink className="h-3 w-3" />
                    {platform}
                  </Badge>
                </a>
              ))}
            </div>
          </div>
        );

      case 'policies':
        if (!store.shipping_policy && !store.return_policy) return null;
        return (
          <div key="policies" className="container mx-auto px-4 py-8 border-t">
            <h3 className="text-xl font-bold text-foreground mb-6">Store Policies</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {store.shipping_policy && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Shipping Policy</h4>
                  <p className="text-muted-foreground">{store.shipping_policy}</p>
                </div>
              )}
              {store.return_policy && (
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Return Policy</h4>
                  <p className="text-muted-foreground">{store.return_policy}</p>
                </div>
              )}
            </div>
          </div>
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

      {/* Store Header */}
      <div className="border-b" style={vendorTier !== 'starter' ? { borderBottomColor: `${accentColor}30` } : {}}>
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-4 md:gap-6">
            {/* Logo/Profile */}
            <div className="flex-shrink-0">
              {(store.logo_url || vendor?.logo_url) ? (
                <img
                  src={store.logo_url || vendor.logo_url}
                  alt={store.name}
                  className={`object-cover border-4 border-background shadow-lg ${
                    vendorTier === 'starter' ? 'w-12 h-12 rounded-full' : 'w-20 h-20 rounded-full'
                  }`}
                />
              ) : (
                <div className={`rounded-full bg-primary/20 flex items-center justify-center border-4 border-background shadow-lg ${
                  vendorTier === 'starter' ? 'w-12 h-12' : 'w-20 h-20'
                }`}>
                  <Store className={vendorTier === 'starter' ? 'h-5 w-5 text-primary' : 'h-8 w-8 text-primary'} />
                </div>
              )}
            </div>

            {/* Store Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className={`font-bold text-foreground ${vendorTier === 'starter' ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                  {store.name}
                </h1>
                {capabilities.sellerBadge && (
                  <Badge className="gap-1 text-xs" style={{ backgroundColor: vendorTier === 'gold' ? '#eab308' : accentColor, color: '#fff' }}>
                    {vendorTier === 'gold' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                    {capabilities.sellerBadge}
                  </Badge>
                )}
              </div>

              {vendorTier === 'starter' && (
                <p className="text-sm text-muted-foreground mb-1">Sold by {store.name}</p>
              )}

              {vendor?.business_name && vendor.business_name !== store.name && vendorTier !== 'starter' && (
                <p className="text-muted-foreground mb-1">by {vendor.business_name}</p>
              )}

              <div className="flex items-center gap-3 flex-wrap text-sm">
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({products.length} products)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>South Africa</span>
                </div>
                {capabilities.trustIndicators && (
                  <>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Joined {store.created_at ? format(new Date(store.created_at), 'MMM yyyy') : 'Recently'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Usually responds within 24h</span>
                    </div>
                  </>
                )}
              </div>

              {vendorTier !== 'starter' && (store.description || vendor?.description) && (
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
                  {store.description || vendor.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex flex-col gap-2">
              <Link to="/shop">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Shop
                </Button>
              </Link>
              {capabilities.contactForm && (
                <Button variant="outline" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Seller
                </Button>
              )}
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
        <div className="border-t py-4 text-center">
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
