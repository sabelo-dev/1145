
import React, { useState, useEffect } from "react";
import ProductGrid from "@/components/shop/ProductGrid";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Filter, SortAsc } from "lucide-react";
import { cn } from "@/lib/utils";
import { Product, Category } from "@/types";
import { fetchAllProducts, fetchCategories } from "@/services/products";

const ShopPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);
  const [sortBy, setSortBy] = useState<string>("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          fetchAllProducts(),
          fetchCategories(true) // Only show categories with products
        ]);

        setProducts(productsData);
        setCategories(categoriesData);
        
        // Update max price range based on actual products
        if (productsData.length > 0) {
          const maxPrice = Math.max(...productsData.map(p => p.price));
          setPriceRange([0, Math.ceil(maxPrice / 100) * 100]);
        }
      } catch (error) {
        console.error('Error loading shop data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Extract all vendors/brands from products
  const allBrands = Array.from(new Set(products.map((p) => p.vendorName)));

  // Filter products based on selected filters
  const filteredProducts = products.filter((product) => {
    // Filter by category
    if (selectedCategory && product.category !== selectedCategory) {
      return false;
    }

    // Filter by price range
    if (product.price < priceRange[0] || product.price > priceRange[1]) {
      return false;
    }

    // Filter by in-stock status
    if (inStockOnly && !product.inStock) {
      return false;
    }

    // Filter by brands
    if (selectedBrands.length > 0 && !selectedBrands.includes(product.vendorName)) {
      return false;
    }

    return true;
  });

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price;
      case "price-high":
        return b.price - a.price;
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "rating":
        return b.rating - a.rating;
      case "featured":
      default:
        return 0; // No specific sorting
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <SEO
        title="Shop All Products"
        description="Browse our complete collection of quality products. Filter by category, price, and brand to find exactly what you need. Fast shipping and secure checkout."
        keywords="shop online, products, all categories, best prices, quality products, online shopping"
      />
      <div className="wwe-container py-8">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Shop All Products</h1>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {sortedProducts.length} of {products.length} products
            </p>

            {/* Sort & Filter buttons for mobile */}
            <div className="flex items-center gap-2 md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <SortAsc className="mr-2 h-4 w-4" /> Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy("featured")}>
                    Featured
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("price-low")}>
                    Price: Low to High
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("price-high")}>
                    Price: High to Low
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("newest")}>
                    Newest
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("rating")}>
                    Highest Rated
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
            </div>

            {/* Sort dropdown for desktop */}
            <div className="hidden md:block">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Filters Sidebar - Hidden on mobile unless showFilters is true */}
          <aside
            className={cn(
              "w-full md:w-64 space-y-6 shrink-0",
              showFilters ? "block" : "hidden md:block"
            )}
          >
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCategory("");
                    setPriceRange([0, 2000]);
                    setInStockOnly(false);
                    setSelectedBrands([]);
                  }}
                >
                  Clear All
                </Button>
              </div>

              {/* Categories Filter */}
              <Accordion type="single" collapsible defaultValue="categories">
                <AccordionItem value="categories" className="border-b">
                  <AccordionTrigger className="py-2">Categories</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "justify-start px-0 hover:bg-transparent hover:underline",
                              selectedCategory === category.name && "font-semibold text-wwe-navy"
                            )}
                            onClick={() =>
                              setSelectedCategory(
                                selectedCategory === category.name ? "" : category.name
                              )
                            }
                          >
                            {category.name}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Price Range Filter */}
              <Accordion type="single" collapsible defaultValue="price">
                <AccordionItem value="price" className="border-b">
                  <AccordionTrigger className="py-2">Price Range</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <Slider
                        value={priceRange}
                        min={0}
                        max={2000}
                        step={10}
                        onValueChange={(value) => setPriceRange(value as [number, number])}
                      />
                      <div className="flex items-center justify-between">
                        <div className="w-20">
                          <Input
                            type="number"
                            value={priceRange[0]}
                            onChange={(e) =>
                              setPriceRange([
                                parseInt(e.target.value),
                                priceRange[1],
                              ])
                            }
                            className="h-8"
                          />
                        </div>
                        <span>to</span>
                        <div className="w-20">
                          <Input
                            type="number"
                            value={priceRange[1]}
                            onChange={(e) =>
                              setPriceRange([
                                priceRange[0],
                                parseInt(e.target.value),
                              ])
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Brands Filter */}
              <Accordion type="single" collapsible defaultValue="brands">
                <AccordionItem value="brands" className="border-b">
                  <AccordionTrigger className="py-2">Brands</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {allBrands.map((brand) => (
                        <div key={brand} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand}`}
                            checked={selectedBrands.includes(brand)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedBrands([...selectedBrands, brand]);
                              } else {
                                setSelectedBrands(
                                  selectedBrands.filter((b) => b !== brand)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={`brand-${brand}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {brand}
                          </label>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {/* Availability Filter */}
              <div className="py-4 border-b">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="in-stock"
                    checked={inStockOnly}
                    onCheckedChange={(checked) => setInStockOnly(!!checked)}
                  />
                  <label
                    htmlFor="in-stock"
                    className="text-sm font-medium leading-none"
                  >
                    In Stock Only
                  </label>
                </div>
              </div>

              {/* Apply Filters Button - Mobile Only */}
              <div className="mt-4 md:hidden">
                <Button
                  className="w-full bg-wwe-navy hover:bg-wwe-navy/90"
                  onClick={() => setShowFilters(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {sortedProducts.length > 0 ? (
              <ProductGrid products={sortedProducts} />
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-gray-600">
                  Try adjusting your filters to find what you're looking for.
                </p>
                <Button
                  className="mt-4 bg-wwe-navy hover:bg-wwe-navy/90"
                  onClick={() => {
                    setSelectedCategory("");
                    setPriceRange([0, 2000]);
                    setInStockOnly(false);
                    setSelectedBrands([]);
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
