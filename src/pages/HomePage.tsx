import React, { useState, useEffect } from "react";
import HomeHero from "@/components/home/HomeHero";
import HomeNavMenu from "@/components/home/HomeNavMenu";
import CategorySection from "@/components/home/CategorySection";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import PromoSection from "@/components/home/PromoSection";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Product, Category } from "@/types";
import { fetchCategories, fetchFeaturedProducts, fetchNewArrivals, fetchPopularProducts } from "@/services/products";
import { getOrganizationSchema, getWebsiteSchema } from "@/utils/structuredData";

const HomePage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Set timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Loading timeout")), 10000),
        );

        const dataPromise = Promise.all([
          fetchCategories(true), // Only show categories with products
          fetchFeaturedProducts(4),
          fetchNewArrivals(4),
          fetchPopularProducts(4),
        ]);

        const [categoriesData, featuredData, newArrivalsData, popularData] = (await Promise.race([
          dataPromise,
          timeoutPromise,
        ])) as [any, any, any, any];

        setCategories(categoriesData || []);
        setFeaturedProducts(featuredData || []);
        setNewArrivals(newArrivalsData || []);
        setPopularProducts(popularData || []);
      } catch (error) {
        console.error("Error loading homepage data:", error);
        // Set empty arrays as fallback
        setCategories([]);
        setFeaturedProducts([]);
        setNewArrivals([]);
        setPopularProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [getOrganizationSchema(), getWebsiteSchema()],
  };

  return (
    <div>
      <SEO
        title="1145 Lifestyle - Your Premier Online Marketplace"
        description="Discover quality products from trusted vendors. Shop electronics, fashion, home goods, and more with fast shipping and secure checkout."
        keywords="online marketplace, ecommerce, shop online, vendors, products, best deals"
        structuredData={structuredData}
      />
      <HomeNavMenu />
      <HomeHero />
      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading products...</p>
        </div>
      ) : (
        <>
          <CategorySection categories={categories} />
          <FeaturedProducts
            title="Featured Products"
            subtitle="Discover our handpicked selection of top products"
            products={featuredProducts}
            viewAllLink="/shop"
          />
          <PromoSection />
          <FeaturedProducts
            title="New Arrivals"
            subtitle="The latest additions to our catalog"
            products={newArrivals}
            viewAllLink="/new-arrivals"
          />
          <FeaturedProducts
            title="Popular Products"
            subtitle="Loved by our customers"
            products={popularProducts}
            viewAllLink="/popular"
          />
        </>
      )}
      <Footer />
    </div>
  );
};

export default HomePage;
