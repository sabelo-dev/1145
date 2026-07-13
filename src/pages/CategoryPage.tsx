
import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProductsByCategory, fetchCategories } from "@/services/products";
import ProductGrid from "@/components/shop/ProductGrid";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Product, Category } from "@/types";
import { getBreadcrumbSchema } from "@/utils/structuredData";

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const categories = await fetchCategories(true); // Only show categories with products
        const foundCategory = categories.find((c) => c.slug === slug);
        
        if (foundCategory) {
          setCategory(foundCategory);
          const categoryProducts = await fetchProductsByCategory(foundCategory.name);
          setProducts(categoryProducts);
        }
      } catch (error) {
        console.error("Error loading category data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug]);

  if (!category) {
    return (
      <div className="wwe-container py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Category Not Found</h1>
        <p className="mb-6">Sorry, the category you are looking for does not exist.</p>
        <Link to="/categories">
          <Button className="bg-wwe-navy hover:bg-wwe-navy/90">
            Browse Categories
          </Button>
        </Link>
      </div>
    );
  }

  const breadcrumbItems = [
    { name: 'Home', url: '/shop' },
    { name: 'Categories', url: '/categories' },
    { name: category.name, url: `/category/${category.slug}` },
  ];

  return (
    <div className="bg-gray-50">
      <SEO
        title={`${category.name} Products`}
        description={`Explore our collection of ${category.name.toLowerCase()} products. High-quality items from trusted brands at competitive prices. Shop ${category.name} now.`}
        keywords={`${category.name}, shop ${category.name.toLowerCase()}, buy ${category.name.toLowerCase()}, best ${category.name.toLowerCase()}`}
        image={category.image}
        structuredData={getBreadcrumbSchema(breadcrumbItems)}
      />
      <div className="wwe-container py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
          <Link to="/shop" className="text-gray-500 hover:text-wwe-navy">
            Home
          </Link>{" "}
          /{" "}
          <Link to="/categories" className="text-gray-500 hover:text-wwe-navy">
            Categories
          </Link>{" "}
          / <span className="text-gray-900">{category.name}</span>
        </nav>

        {/* Category Header */}
        <div className="mb-8 relative rounded-lg overflow-hidden bg-gradient-to-r from-wwe-navy to-blue-700">
          <div className="absolute inset-0 opacity-20">
            <img
              src={category.image}
              alt={category.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-10 p-6 md:p-10">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
              {category.name}
            </h1>
            <p className="text-white/80 max-w-xl">
              Explore our collection of {category.name.toLowerCase()} products.
              High-quality items from trusted brands at competitive prices.
            </p>
          </div>
        </div>

        {/* Subcategories */}
        {category.subcategories && category.subcategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Browse Subcategories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {category.subcategories.map((subcategory) => (
                <Link
                  key={subcategory.id}
                  to={`/category/${category.slug}/${subcategory.slug}`}
                  className="bg-white rounded-md shadow-sm border p-4 text-center hover:border-wwe-navy transition-colors"
                >
                  <span className="font-medium">{subcategory.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-xl font-semibold">
              Products in {category.name}{" "}
              <span className="text-gray-500">({products.length})</span>
            </h2>
            
            {/* Sort options would go here in a real implementation */}
          </div>

          {products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-gray-600 mb-4">
                There are currently no products in this category.
              </p>
              <Link to="/shop">
                <Button className="bg-wwe-navy hover:bg-wwe-navy/90">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryPage;
