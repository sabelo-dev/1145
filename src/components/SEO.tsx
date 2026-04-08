import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "article";
  structuredData?: object;
  noindex?: boolean;
}

const SEO = ({
  title = "1145 – Social Commerce Marketplace | Shop, Sell & Influence in South Africa",
  description = "1145 is a South African social commerce platform where you can shop, sell, and earn. Discover trending products, connect your social media, and monetize your influence with seamless checkout and fast delivery.",
  keywords = "1145, 1145 Lifestyle, 1145 South Africa, social commerce South Africa,shop online South Africa, sell online South Africa, influencer marketplace,creator economy platform, TikTok shop integration, Instagram shopping,online marketplace Africa, ecommerce South Africa, dropshipping South Africa,multi-vendor marketplace, digital marketplace SA, earn online South Africa",
  image = "https://1145lifestyle.com/og-image.png",
  url,
  type = "website",
  structuredData,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title.includes("1145") ? title : `${title} | 1145`;
  const canonicalUrl =
    url || (typeof window !== "undefined" ? window.location.href : "");
  const defaultStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "1145",
        "url": "https://1145lifestyle.com",
        "description": description,
        "inLanguage": "en-ZA",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://1145lifestyle.com/shop?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "Organization",
        "name": "1145",
        "url": "https://1145lifestyle.com",
        "logo": image,
        "sameAs": [
          "https://www.tiktok.com/",
          "https://www.instagram.com/",
          "https://www.facebook.com/"
        ]
      },
      {
        "@type": "SoftwareApplication",
        "name": "1145 Super App",
        "applicationCategory": "ShoppingApplication",
        "operatingSystem": "Web",
        "description": "A social commerce platform that enables users to shop, sell, and monetize content."
      }
    ]
  };

  return (
    <Helmet>
      {/* Google Site Verification */}
      <meta name="google-site-verification" content="-vvnQNYKVZL8QHHAzbtV_Rv9KsEC1G-VV7N7rmyBy7c" />

      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="1145" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <meta name="robots" content="index, follow" />
      <meta name="author" content="1145" />
      <meta name="theme-color" content="#000000" />
      <meta property="og:locale" content="en_ZA" />
      <meta property="og:region" content="ZA" />

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData || defaultStructuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;
