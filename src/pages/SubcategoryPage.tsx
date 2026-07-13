import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProductsBySubcategory, fetchCategories, fetchSubcategoriesByCategory } from "@/services/products";
import ProductGrid from "@/components/shop/ProductGrid";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Product, Category } from "@/types";
import { getBreadcrumbSchema } from "@/utils/structuredData";

const SubcategoryPage: React.FC = () => {
  const { categorySlug, subcategorySlug } = useParams<{ categorySlug: string; subcategorySlug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategory, setSubcategory] = useState<any | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const categories = await fetchCategories(true);
        const foundCategory = categories.find((c) => c.slug === categorySlug);

        if (foundCategory) {
          setCategory(foundCategory);
          const subcategories = await fetchSubcategoriesByCategory(foundCategory.id);
          const foundSubcategory = subcategories.find((s) => s.slug === subcategorySlug);

          if (foundSubcategory) {
            setSubcategory(foundSubcategory);
            const subcategoryProducts = await fetchProductsBySubcategory(foundCategory.name, foundSubcategory.name);
            setProducts(subcategoryProducts);
          }
        }
      } catch (error) {
        console.error("Error loading subcategory data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categorySlug, subcategorySlug]);

  if (!category || !subcategory) {
    return (
      <div className="wwe-container py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Subcategory Not Found</h1>
        <p className="mb-6">Sorry, the subcategory you are looking for does not exist.</p>
        <Link to="/categories">
          <Button>Browse Categories</Button>
        </Link>
      </div>
    );
  }

  const breadcrumbItems = [
    { name: "Home", url: "/shop" },
    { name: "Categories", url: "/categories" },
    { name: category.name, url: `/category/${category.slug}` },
    { name: subcategory.name, url: `/category/${category.slug}/${subcategory.slug}` },
  ];

  return (
    <div className="bg-background">
      <SEO
        title={`${subcategory.name} - ${category.name} | 1145 Lifestyle`}
        description={`Shop ${subcategory.name.toLowerCase()} in our ${category.name.toLowerCase()} category. Quality products from trusted vendors at competitive prices.`}
        keywords={`${subcategory.name}, ${category.name}, shop ${subcategory.name.toLowerCase()}, buy ${subcategory.name.toLowerCase()}`}
        structuredData={getBreadcrumbSchema(breadcrumbItems)}
      />
      <div className="wwe-container py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
          <Link to="/shop" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/categories" className="text-muted-foreground hover:text-foreground">
            Categories
          </Link>{" "}
          /{" "}
          <Link to={`/category/${category.slug}`} className="text-muted-foreground hover:text-foreground">
            {category.name}
          </Link>{" "}
          / <span className="text-foreground">{subcategory.name}</span>
        </nav>

        {/* Subcategory Header */}
        <div className="mb-8 relative rounded-lg overflow-hidden bg-gradient-to-r from-primary to-primary/80">
          <div className="relative z-10 p-6 md:p-10">
            <h1 className="text-2xl md:text-4xl font-bold text-primary-foreground mb-2">{subcategory.name}</h1>
            <p className="text-primary-foreground/80 max-w-xl">
              {subcategory.description ||
                `Explore our collection of ${subcategory.name.toLowerCase()} products. Quality items from trusted vendors at competitive prices.`}
            </p>
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-xl font-semibold">
              Products in {subcategory.name} <span className="text-muted-foreground">({products.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading products...</p>
            </div>
          ) : products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            <div className="text-center py-12 bg-card rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">There are currently no products in this subcategory.</p>
              <Link to="/shop">
                <Button>Continue Shopping</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubcategoryPage;
