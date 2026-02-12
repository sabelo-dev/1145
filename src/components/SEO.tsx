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
  title = "1145 - Premium Online Shopping",
  description = "Shop 1145 for premium fashion, electronics, home goods & more. 1145 is your trusted South African marketplace with fast delivery and secure checkout. Find everything at 1145.",
  keywords = "1145, 1145 Lifestyle, 1145 online shopping, 1145 South Africa, 1145 marketplace, 1145 fashion, 1145 electronics, 1145 home goods, ecommerce, premium marketplace, online store South Africa",
  image = "https://1145lifestyle.com/og-image.png",
  url,
  type = "website",
  structuredData,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title.includes("1145") ? title : `${title} | 1145`;
  const canonicalUrl = url || typeof window !== "undefined" ? window.location.href : "";

  const defaultStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "1145",
    "alternateName": ["1145", "1145 Lifestyle", "1145lifestyle", "1145 SA", "1145 Shop"],
    "url": "https://1145lifestyle.com",
    "description": description,
    "inLanguage": "en-ZA",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://1145lifestyle.com/shop?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
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

      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData || defaultStructuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;
