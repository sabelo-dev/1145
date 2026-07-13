
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchProductsBySubcategory } from "@/services/products";
import ProductGrid from "@/components/shop/ProductGrid";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";

const FurniturePage: React.FC = () => {
  const [furniture, setFurniture] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const products = await fetchProductsBySubcategory("Home & Kitchen", "Furniture");
        setFurniture(products);
      } catch (error) {
        console.error("Error loading furniture:", error);
        setFurniture([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="wwe-container py-8">
        {/* Breadcrumbs */}
        <div className="mb-6 text-sm">
          <Link to="/shop" className="text-gray-500 hover:text-wwe-navy">Home</Link>
          {" / "}
          <Link to="/categories" className="text-gray-500 hover:text-wwe-navy">Categories</Link>
          {" / "}
          <Link to="/category/home-kitchen" className="text-gray-500 hover:text-wwe-navy">Home & Kitchen</Link>
          {" / "}
          <span className="text-gray-900">Furniture</span>
        </div>

        {/* Page Header */}
        <div className="mb-8 relative rounded-lg overflow-hidden bg-gradient-to-r from-amber-700 to-orange-800">
          <div className="relative z-10 p-6 md:p-10">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
              Home Furniture
            </h1>
            <p className="text-white/80 max-w-xl">
              Transform your living space with our beautiful furniture collection. 
              From comfort to style, find pieces that make your house feel like home.
            </p>
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <h2 className="text-xl font-semibold">
              Furniture Collection
              <span className="text-gray-500 ml-2">({furniture.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading products...</p>
            </div>
          ) : furniture.length > 0 ? (
            <ProductGrid products={furniture} />
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-gray-600 mb-4">
                There are currently no furniture products available.
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

export default FurniturePage;
