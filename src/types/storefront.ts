export type StorefrontTier = 'starter' | 'bronze' | 'silver' | 'gold';
export type StorefrontLayout = 'grid' | 'modern' | 'minimal';

export interface StorefrontCustomization {
  id: string;
  store_id: string;
  accent_color: string;
  secondary_color: string;
  layout_type: StorefrontLayout;
  about_us: string | null;
  social_links: Record<string, string>;
  cta_button_text: string;
  cta_button_url: string | null;
  video_banner_url: string | null;
  testimonials: Testimonial[];
  faq_items: FAQItem[];
  announcement_bar_text: string | null;
  announcement_bar_active: boolean;
  email_capture_enabled: boolean;
  email_capture_title: string;
  custom_font: string | null;
  custom_css: string | null;
  custom_meta_title: string | null;
  custom_meta_description: string | null;
  homepage_sections: string[];
  mega_menu_config: Record<string, any>;
  custom_domain: string | null;
  white_label: boolean;
  ga_tracking_id: string | null;
  meta_pixel_id: string | null;
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
  rating: number;
  avatar?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface StorefrontTierCapabilities {
  maxProducts: number | null;
  customBanner: boolean;
  customLogo: boolean;
  customAccentColor: boolean;
  customSecondaryColor: boolean;
  layoutOptions: boolean;
  aboutUs: boolean;
  socialLinks: boolean;
  featuredProducts: boolean;
  sellerBadge: string | null;
  contactForm: boolean;
  trustIndicators: boolean;
  ctaButton: boolean;
  videoBanner: boolean;
  testimonials: boolean;
  faqSection: boolean;
  announcementBar: boolean;
  emailCapture: boolean;
  flashSales: boolean;
  crossSellWidgets: boolean;
  customFont: boolean;
  customCss: boolean;
  dragDropBuilder: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  advancedSeo: boolean;
  analyticsIntegration: boolean;
  platformBranding: boolean;
  storeCategories: boolean;
  discountCodes: boolean;
  promotionalBanners: boolean;
}

export const TIER_CAPABILITIES: Record<StorefrontTier, StorefrontTierCapabilities> = {
  starter: {
    maxProducts: 20,
    customBanner: false,
    customLogo: false,
    customAccentColor: false,
    customSecondaryColor: false,
    layoutOptions: false,
    aboutUs: false,
    socialLinks: false,
    featuredProducts: false,
    sellerBadge: null,
    contactForm: false,
    trustIndicators: false,
    ctaButton: false,
    videoBanner: false,
    testimonials: false,
    faqSection: false,
    announcementBar: false,
    emailCapture: false,
    flashSales: false,
    crossSellWidgets: false,
    customFont: false,
    customCss: false,
    dragDropBuilder: false,
    customDomain: false,
    whiteLabel: false,
    advancedSeo: false,
    analyticsIntegration: false,
    platformBranding: true,
    storeCategories: false,
    discountCodes: false,
    promotionalBanners: false,
  },
  bronze: {
    maxProducts: 100,
    customBanner: true,
    customLogo: true,
    customAccentColor: true,
    customSecondaryColor: false,
    layoutOptions: false,
    aboutUs: true,
    socialLinks: true,
    featuredProducts: true,
    sellerBadge: 'Verified Seller',
    contactForm: true,
    trustIndicators: true,
    ctaButton: false,
    videoBanner: false,
    testimonials: false,
    faqSection: false,
    announcementBar: false,
    emailCapture: false,
    flashSales: false,
    crossSellWidgets: false,
    customFont: false,
    customCss: false,
    dragDropBuilder: false,
    customDomain: false,
    whiteLabel: false,
    advancedSeo: false,
    analyticsIntegration: false,
    platformBranding: false,
    storeCategories: true,
    discountCodes: true,
    promotionalBanners: false,
  },
  silver: {
    maxProducts: 1000,
    customBanner: true,
    customLogo: true,
    customAccentColor: true,
    customSecondaryColor: true,
    layoutOptions: true,
    aboutUs: true,
    socialLinks: true,
    featuredProducts: true,
    sellerBadge: 'Verified Seller',
    contactForm: true,
    trustIndicators: true,
    ctaButton: true,
    videoBanner: true,
    testimonials: true,
    faqSection: true,
    announcementBar: true,
    emailCapture: true,
    flashSales: true,
    crossSellWidgets: true,
    customFont: false,
    customCss: false,
    dragDropBuilder: false,
    customDomain: false,
    whiteLabel: false,
    advancedSeo: false,
    analyticsIntegration: false,
    platformBranding: false,
    storeCategories: true,
    discountCodes: true,
    promotionalBanners: true,
  },
  gold: {
    maxProducts: null,
    customBanner: true,
    customLogo: true,
    customAccentColor: true,
    customSecondaryColor: true,
    layoutOptions: true,
    aboutUs: true,
    socialLinks: true,
    featuredProducts: true,
    sellerBadge: 'Verified Gold',
    contactForm: true,
    trustIndicators: true,
    ctaButton: true,
    videoBanner: true,
    testimonials: true,
    faqSection: true,
    announcementBar: true,
    emailCapture: true,
    flashSales: true,
    crossSellWidgets: true,
    customFont: true,
    customCss: true,
    dragDropBuilder: true,
    customDomain: true,
    whiteLabel: true,
    advancedSeo: true,
    analyticsIntegration: true,
    platformBranding: false,
    storeCategories: true,
    discountCodes: true,
    promotionalBanners: true,
  },
};
