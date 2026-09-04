import { Product } from "@/types";
import { getPlatformBaseUrl } from "@/lib/appUrl";

export const getOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "1145 Lifestyle",
  alternateName: ["1145", "1145lifestyle", "1145 SA", "1145 Shop"],
  url: getPlatformBaseUrl(),
  logo: `${getPlatformBaseUrl()}/uploads/logo.png`,
  description: "1145  is a next-generation e-commerce ecosystem, designed to empower businesses of all sizes to sell online with ease and users across all walks of life to transact, shop, travel and monetize in one platform. Built for scalability, security, and performance, 1145 enables vendors to manage their storefronts independently while providing customers with a seamless and engaging shopping experience.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Service",
    email: "support@1145.io",
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
  url: getPlatformBaseUrl(),
  inLanguage: "en-ZA",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${getPlatformBaseUrl()}/shop?search={search_term_string}`,
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
