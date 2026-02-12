import { Product } from "@/types";

export const getOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "1145 Lifestyle",
  alternateName: ["1145", "1145lifestyle", "1145 SA", "1145 Shop"],
  url: "https://1145lifestyle.com",
  logo: "https://1145lifestyle.com/uploads/logo.png",
  description: "1145 Lifestyle is South Africa's premier online marketplace for quality products from trusted merchants. Shop 1145 for fashion, electronics, home goods and more.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    email: "support@1145lifestyle.com",
    availableLanguage: "English",
  },
  sameAs: [
    "https://twitter.com/1145lifestyle",
    "https://facebook.com/1145lifestyle",
    "https://instagram.com/1145lifestyle"
  ],
});

export const getWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "1145 Lifestyle",
  alternateName: ["1145", "1145lifestyle"],
  url: "https://1145lifestyle.com",
  inLanguage: "en-ZA",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://1145lifestyle.com/shop?search={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
});

export const getProductSchema = (product: Product) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: product.name,
  description: product.description || "",
  image: product.images?.[0] || "",
  brand: {
    "@type": "Brand",
    name: product.vendorName || "1145 Lifestyle",
  },
  offers: {
    "@type": "Offer",
    url: typeof window !== "undefined" ? window.location.href : "",
    priceCurrency: "ZAR",
    price: product.price,
    availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    seller: {
      "@type": "Organization",
      name: product.vendorName || "1145 Lifestyle",
    },
  },
  aggregateRating:
    product.rating && product.reviewCount
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
        }
      : undefined,
});

export const getBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});
